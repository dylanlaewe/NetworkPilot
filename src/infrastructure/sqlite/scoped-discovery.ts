import { createHash } from "node:crypto";
import type { SqliteSimulationRepository } from "./database";
import type { ScopedDiscoveryStore } from "@/application/candidate-refresh/scoped";
import type { CandidateRefreshResult } from "@/application/candidate-refresh";
import { importCandidateBatch } from "@/application/ingestion";
import { bucketReserve } from "./bucket-reserve";
import { assertFiveBucketEnabled, matchesBucketScope } from "@/domain/recipient-buckets";
import type { TargetCompany } from "@/domain/targeting";
import type { ScopedDiscoveryReadiness } from "@/application/candidate-refresh/scoped-readiness";
import {
  assertDatastoreSchema,
  inspectReadOnlyDatastore,
  requireDatastoreCapability,
  resolveDatastoreTopology,
  type NetworkPilotDatastoreTopology,
} from "./datastore-topology";
import { reconcileApolloDailyObservedConsumption } from "./apollo-accounting";
import { SqliteApolloPersonReservationStore } from "./apollo-person-reservations";

export class SqliteScopedDiscoveryStore implements ScopedDiscoveryStore {
  private readonly topology: NetworkPilotDatastoreTopology;

  constructor(
    private readonly repository: SqliteSimulationRepository,
    private readonly options: {
      companies?: readonly TargetCompany[];
      companyDomains?: Readonly<Record<string, string>>;
      topology?: NetworkPilotDatastoreTopology;
    } = {},
  ) {
    this.topology = options.topology ?? resolveDatastoreTopology();
  }

  preflight(
    input: Parameters<ScopedDiscoveryStore["preflight"]>[0],
  ): ScopedDiscoveryReadiness {
    try {
      requireDatastoreCapability(this.topology.canonical, "bucket-state-write");
      requireDatastoreCapability(this.topology.canonical, "provider-accounting");
      assertDatastoreSchema(this.topology.canonical, this.repository.native);
      if (input.scope.bucket === "recruiters")
        inspectReadOnlyDatastore(
          this.topology.recruiterSource,
          "candidate-evidence-read",
        );
      // Execute the downstream local projection before authorization. It uses
      // canonical state only; source databases never own bucket state.
      bucketReserve(this.repository, input.scope, input.at);
      if (input.requestId) {
        const operationId = `bucket-discovery:${createHash("sha256").update(input.requestId).digest("hex")}`,
          prior = this.repository.native
            .prepare("SELECT state FROM provider_operations WHERE id=?")
            .get(operationId) as { state: string } | undefined,
          saved = this.repository.native
            .prepare("SELECT result_json FROM candidate_refresh_events WHERE id=?")
            .get(operationId) as { result_json: string | null } | undefined;
        if (prior?.state === "completed" && saved?.result_json)
          return { ready: true, reason: null, technicalDetail: null };
      }
      const date = input.at.toLocaleDateString("en-CA", {
          timeZone: "America/New_York",
        }),
        status = this.repository.getApolloProviderStatus(date),
        remaining = input.policy.maximumPerDay - status.estimatedExposure;
      if (
        !input.policy.hardStop ||
        !Number.isInteger(input.requested) ||
        input.requested < 1 ||
        remaining < 1
      )
        return {
          ready: false,
          reason: "provider-budget-unavailable",
          technicalDetail: "provider-budget-exhausted",
        };
      return { ready: true, reason: null, technicalDetail: null };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown";
      const normalized = detail.toLowerCase();
      if (normalized.includes("capability") || normalized.includes("path-mismatch"))
        return {
          ready: false,
          reason: "datastore-topology-invalid",
          technicalDetail: detail,
        };
      if (detail.includes("recruiter-source-schema"))
        return {
          ready: false,
          reason: "recruiter-evidence-schema-invalid",
          technicalDetail: detail,
        };
      if (detail.includes("recruiter-source"))
        return {
          ready: false,
          reason: "recruiter-evidence-store-unavailable",
          technicalDetail: detail,
        };
      if (
        normalized.includes("migration required") ||
        detail.includes("0021_recipient_buckets") ||
        detail.includes("operational-schema-unavailable")
      )
        return {
          ready: false,
          reason: "canonical-schema-required",
          technicalDetail: detail,
        };
      return {
        ready: false,
        reason: "canonical-store-unavailable",
        technicalDetail: detail,
      };
    }
  }

  claim(input: Parameters<ScopedDiscoveryStore["claim"]>[0]) {
    assertFiveBucketEnabled();
    if (!input.policy.hardStop || ![input.policy.maximumPerBatch, input.policy.maximumPerDay, input.policy.maximumSearchCalls].every(n => Number.isInteger(n) && n > 0)) throw new Error("scoped-refresh-policy-invalid");
    return this.repository.transaction(() => {
      const operationId = `bucket-discovery:${createHash("sha256").update(input.requestId).digest("hex")}`, scopeJson = JSON.stringify(input.scope);
      const prior = this.repository.native.prepare("SELECT bucket_scope_json,state FROM provider_operations WHERE id=?").get(operationId) as { bucket_scope_json: string | null; state: string } | undefined;
      if (prior) {
        if (prior.bucket_scope_json !== scopeJson) throw new Error("scoped-refresh-request-conflict");
        const saved = this.repository.native.prepare("SELECT result_json FROM candidate_refresh_events WHERE id=?").get(operationId) as { result_json: string | null } | undefined;
        if (saved?.result_json) return { operationId, maximum: 0, existing: JSON.parse(saved.result_json) as CandidateRefreshResult };
        throw new Error(prior.state === "authorized" ? "scoped-refresh-in-progress" : "scoped-refresh-reconciliation-required");
      }
      const date = input.at.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), used = this.repository.getApolloProviderStatus(date).estimatedExposure;
      const maximum = Math.min(input.requested, input.policy.maximumPerBatch, Math.max(0, input.policy.maximumPerDay - used));
      if (!maximum) throw new Error("apollo-daily-budget-exhausted");
      this.repository.authorizeApolloOperation({ operationId, batchId: operationId, localDate: date, candidateCount: maximum, estimatedMaxExposure: maximum, maximumPerBatch: input.policy.maximumPerBatch, maximumPerDay: input.policy.maximumPerDay, hardStop: true, at: input.at });
      this.repository.native.prepare("UPDATE provider_operations SET bucket_scope_json=? WHERE id=?").run(scopeJson, operationId);
      return { operationId, maximum };
    });
  }
  complete(input: Parameters<ScopedDiscoveryStore["complete"]>[0]): CandidateRefreshResult {
    return this.repository.transaction(() => {
      const beforeIds = new Set(this.repository.listImportedCandidates().map(c => c.id));
      if (input.records.length) {
        const provider = input.records[0].sourceProviderId, dataset = input.records[0].datasetClassification;
        if (input.records.some(r => r.sourceProviderId !== provider || r.datasetClassification !== dataset)) throw new Error("scoped-refresh-source-conflict");
        importCandidateBatch(this.repository, this.options.companies ?? this.repository.listTargetCompanies(), { batchId: input.operationId, adapterId: provider, adapterVersion: "scoped-discovery-v1", datasetClassification: dataset, sourceFingerprint: input.operationId, records: input.records, strategyCompanyDomains: this.options.companyDomains, ...(dataset === "authorized-provider" ? { authorizedProviderAccess: { enabled: true, providerId: provider } } : {}) }, input.at);
      }
      const personReservations = new SqliteApolloPersonReservationStore(
        this.repository,
      );
      for (const record of input.records) {
        if (record.sourceProviderId !== "apollo") continue;
        const imported = this.repository.findImportedCandidate(
          "apollo",
          record.providerRecordId,
        );
        if (!imported)
          throw new Error("scoped-refresh-imported-candidate-missing");
        personReservations.markImported({
          personId: record.providerRecordId,
          operationId: input.operationId,
          importedCandidateId: imported.id,
          at: input.at,
        });
      }
      const added = this.repository.listImportedCandidates().filter(c => !beforeIds.has(c.id));
      for (const candidate of added) if (!matchesBucketScope(candidate.recipientBucket, input.scope)) {
        candidate.gateFailures = [...new Set([...candidate.gateFailures, "discovery-scope-mismatch"])];
        if (candidate.state === "eligible") candidate.state = "review-required";
        this.repository.native.prepare("UPDATE imported_candidates SET normalized_snapshot_json=?,lifecycle_state=? WHERE id=?").run(JSON.stringify(candidate), candidate.state, candidate.id);
      }
      const reserve = bucketReserve(this.repository, input.scope, input.at);
      const qualified = added.filter(c => reserve.eligible.some(e => e.id === c.id) && matchesBucketScope(c.recipientBucket, input.scope));
      const result: CandidateRefreshResult = { id: input.operationId, scope: input.scope, requested: input.requested, added: qualified.length, searchedCandidates: input.searchedCandidates, enrichedCandidates: input.records.length, rejectedCandidates: input.rejectedCandidates + added.length - qualified.length, remainingActionableCapacity: reserve.actionableCapacity, shortfallCode: qualified.length < input.requested ? "scoped-supply-shortfall" : null, createdAt: input.at.toISOString(), usableBefore: input.usableBefore, target: input.usableBefore + input.requested, deficit: input.requested, providerCap: input.maximum, maximumProviderUsage: input.maximum, providerRequired: true, searchCalls: input.searchCalls, enrichmentCreditsUsed: input.attempts, candidatesAdded: added.length, qualifiedCandidatesAdded: qualified.length, professionalCandidatesAdded: qualified.filter(c => c.outreachTrack !== "recruiter").length, recruiterCandidatesAdded: qualified.filter(c => c.outreachTrack === "recruiter").length, companiesAdded: new Set(qualified.map(c => c.strategyCompanyMatch!.companyId)).size, usableAfter: reserve.actionableCapacity };
      this.repository.native.prepare("INSERT INTO candidate_refresh_events(id,created_at_utc,usable_before,target_reserve,provider_cap,search_calls,enrichment_credits_used,candidates_added,qualified_candidates_added,usable_after,professional_candidates_added,recruiter_candidates_added,companies_added,bucket_scope_json,result_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(result.id, result.createdAt, result.usableBefore, result.target, result.providerCap, result.searchCalls, result.enrichmentCreditsUsed, result.candidatesAdded, result.qualifiedCandidatesAdded, result.usableAfter, result.professionalCandidatesAdded, result.recruiterCandidatesAdded, result.companiesAdded, JSON.stringify(input.scope), JSON.stringify(result));
      this.repository.native
        .prepare(
          "UPDATE provider_operations SET attempt_count=MAX(attempt_count,?) WHERE id=? AND state='authorized'",
        )
        .run(input.attempts, input.operationId);
      this.repository.completeApolloOperation(input.operationId, input.observedCredits);
      this.recordObservedConsumption(
        input.operationId,
        input.at,
        input.observedCredits,
      );
      return result;
    });
  }
  fail(
    operationId: string,
    reason: string,
    accounting?: { attempts: number; observedCredits: number | null; at: Date },
  ) {
    this.repository.transaction(() => {
      this.repository.failApolloOperation(operationId, reason);
      if (accounting) {
        const attempts =
            Number.isInteger(accounting.attempts) && accounting.attempts >= 0
              ? accounting.attempts
              : 0,
          observed =
            accounting.observedCredits !== null &&
            Number.isFinite(accounting.observedCredits) &&
            accounting.observedCredits >= 0
              ? accounting.observedCredits
              : null;
        this.repository.native
          .prepare(
            "UPDATE provider_operations SET attempt_count=MAX(attempt_count,?),observed_consumption=CASE WHEN ? IS NULL THEN observed_consumption WHEN observed_consumption IS NULL THEN ? ELSE MAX(observed_consumption,?) END WHERE id=? AND state='failed'",
          )
          .run(attempts, observed, observed, observed, operationId);
        this.recordObservedConsumption(
          operationId,
          accounting.at,
          observed ??
            ((this.repository.native
              .prepare(
                "SELECT observed_consumption FROM provider_operations WHERE id=?",
              )
              .get(operationId) as
              | { observed_consumption: number | null }
              | undefined)?.observed_consumption ?? null),
        );
      }
    });
  }

  private recordObservedConsumption(
    operationId: string,
    updatedAt: Date,
    observed: number | null,
  ): void {
    if (observed === null) return;
    const row = this.repository.native
        .prepare("SELECT occurred_at_utc FROM provider_operations WHERE id=?")
        .get(operationId) as { occurred_at_utc: string } | undefined;
    if (!row) throw new Error("scoped-refresh-accounting-operation-missing");
    const date = new Date(row.occurred_at_utc).toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    reconcileApolloDailyObservedConsumption(
      this.repository.native,
      date,
      updatedAt,
    );
  }
}

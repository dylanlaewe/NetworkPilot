import { createHash } from "node:crypto";
import type { CandidateSourceRecord } from "@/domain/candidates";
import type { TargetCompany } from "@/domain/targeting";
import { parseBucketScope } from "@/domain/recipient-buckets";
import {
  APOLLO_PERSON_RESERVATION_VERSION,
  type ApolloPersonReconciliationCommand,
  type ApolloPersonReconciliationRepository,
  type ApolloPersonReconciliationResult,
  type ApolloPersonReservationAuditEvent,
  type ApolloPersonReservationInspection,
  type ApolloPersonReservationLifecycle,
} from "@/application/candidate-refresh/apollo-person-reconciliation";
import type { ApolloPersonReservationStore } from "@/infrastructure/providers/apollo/scoped-provider";
import { reconcileApolloDailyObservedConsumption } from "./apollo-accounting";
import type { SqliteSimulationRepository } from "./database";
import { completeScopedCandidateRecords } from "./scoped-candidate-completion";

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;

type ReservationMetadata = {
  version: typeof APOLLO_PERSON_RESERVATION_VERSION;
  personId: string;
  ownerOperationId: string;
  lifecycle: ApolloPersonReservationLifecycle;
  attemptedForOwner: boolean;
  observedConsumption?: number | null;
  providerViolation?: "provider-credit-model-exceeded";
  retainedRecord?: CandidateSourceRecord;
  retainedResultFingerprint?: string;
  importedCandidateId?: string;
  updatedAt: string;
  audit: ApolloPersonReservationAuditEvent[];
};

type ReservationRow = {
  id: string;
  batch_id: string;
  state: "authorized" | "completed" | "failed";
  attempt_count: number;
  observed_consumption: number | null;
  failure_reason: string | null;
  occurred_at_utc: string;
  bucket_scope_json: string | null;
};

export interface ApolloParentOperationAccounting {
  childCount: number;
  attemptCount: number;
  knownConsumptionLowerBound: number;
  hasUnknownConsumption: boolean;
  hasProviderViolation: boolean;
  observedConsumption: number | null;
}

export const apolloPersonReservationId = (personId: string): string =>
  `apollo-person:${createHash("sha256").update(personId).digest("hex")}`;

const fingerprint = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

function systemAudit(input: {
  personId: string;
  operationId: string;
  previousState: ApolloPersonReservationLifecycle | null;
  resultingState: ApolloPersonReservationLifecycle;
  at: Date;
  reason: string;
  observedConsumption?: number;
}): ApolloPersonReservationAuditEvent {
  const commandId = `system:${fingerprint({
    ...input,
    at: input.at.toISOString(),
  }).slice(0, 32)}`;
  return {
    commandId,
    commandFingerprint: fingerprint({ commandId, reason: input.reason }),
    actor: "scoped-apollo-provider",
    mechanism: "canonical-person-reservation",
    evidence: input.reason,
    reason: input.reason,
    previousState: input.previousState,
    resultingState: input.resultingState,
    ...(input.observedConsumption !== undefined
      ? { observedConsumption: input.observedConsumption }
      : {}),
    occurredAt: input.at.toISOString(),
  };
}

function operationState(
  lifecycle: ApolloPersonReservationLifecycle,
): ReservationRow["state"] {
  if (
    lifecycle === "reserved-never-attempted" ||
    lifecycle === "attempted-result-usable"
  )
    return "authorized";
  if (lifecycle === "reconciliation-required") return "failed";
  return "completed";
}

/**
 * Canonical person coordination and reconciliation reuse zero-exposure
 * provider operation rows. Versioned metadata lives only on candidate_count=0
 * rows; ordinary scoped operation scope JSON keeps its original meaning.
 */
export class SqliteApolloPersonReservationStore
  implements ApolloPersonReservationStore, ApolloPersonReconciliationRepository
{
  constructor(
    private readonly repository: SqliteSimulationRepository,
    private readonly staleAfterMs = DEFAULT_STALE_AFTER_MS,
    private readonly options: {
      companies?: readonly TargetCompany[];
      companyDomains?: Readonly<Record<string, string>>;
    } = {},
  ) {
    if (!Number.isFinite(staleAfterMs) || staleAfterMs < 1)
      throw new Error("apollo-person-reservation-stale-window-invalid");
  }

  claim(input: {
    personId: string;
    operationId: string;
    at: Date;
  }): boolean {
    const reservationId = apolloPersonReservationId(input.personId);
    return this.repository.transaction(() => {
      const lifecycle: ApolloPersonReservationLifecycle =
        "reserved-never-attempted";
      const metadata: ReservationMetadata = {
        version: APOLLO_PERSON_RESERVATION_VERSION,
        personId: input.personId,
        ownerOperationId: input.operationId,
        lifecycle,
        attemptedForOwner: false,
        updatedAt: input.at.toISOString(),
        audit: [
          systemAudit({
            personId: input.personId,
            operationId: input.operationId,
            at: input.at,
            previousState: null,
            resultingState: lifecycle,
            reason: "provider-person-reserved-before-attempt",
          }),
        ],
      };
      const inserted = this.repository.native
        .prepare(
          "INSERT OR IGNORE INTO provider_operations(id,provider_id,batch_id,operation,state,candidate_count,estimated_max_exposure,observed_consumption,attempt_count,failure_reason,occurred_at_utc,bucket_scope_json) VALUES(?,'apollo',?,'enrichment','authorized',0,0,NULL,0,NULL,?,?)",
        )
        .run(
          reservationId,
          input.operationId,
          input.at.toISOString(),
          JSON.stringify(metadata),
        );
      if (inserted.changes === 1) return true;

      const row = this.readRow(input.personId);
      if (!row) throw new Error("apollo-person-reservation-missing");
      const existing = this.metadata(row, input.personId);
      const stale =
        existing.lifecycle === "reserved-never-attempted" &&
        Date.parse(existing.updatedAt) <=
          input.at.getTime() - this.staleAfterMs;
      const explicitlyReleased =
        existing.lifecycle === "released-no-consumption";
      if (!stale && !explicitlyReleased) return false;

      const next: ReservationMetadata = {
        ...existing,
        ownerOperationId: input.operationId,
        lifecycle,
        attemptedForOwner: false,
        observedConsumption: undefined,
        providerViolation: undefined,
        retainedRecord: undefined,
        retainedResultFingerprint: undefined,
        importedCandidateId: undefined,
        updatedAt: input.at.toISOString(),
        audit: [
          ...existing.audit,
          systemAudit({
            ...input,
            previousState: existing.lifecycle,
            resultingState: lifecycle,
            reason: stale
              ? "stale-never-attempted-reservation-reclaimed"
              : "explicit-no-consumption-release-reused",
          }),
        ],
      };
      this.persist(row, next, { batchId: input.operationId });
      return true;
    });
  }

  markAttempted(input: {
    personId: string;
    operationId: string;
    at: Date;
  }): void {
    this.repository.transaction(() => {
      const row = this.requiredOwnedRow(input);
      const metadata = this.metadata(row, input.personId);
      if (metadata.lifecycle !== "reserved-never-attempted")
        throw new Error("apollo-person-reservation-attempt-unavailable");
      const lifecycle: ApolloPersonReservationLifecycle =
        "reconciliation-required";
      const next: ReservationMetadata = {
        ...metadata,
        lifecycle,
        attemptedForOwner: true,
        observedConsumption: null,
        updatedAt: input.at.toISOString(),
        audit: [
          ...metadata.audit,
          systemAudit({
            personId: input.personId,
            operationId: input.operationId,
            at: input.at,
            previousState: metadata.lifecycle,
            resultingState: lifecycle,
            reason: "provider-request-dispatched-outcome-not-yet-known",
          }),
        ],
      };
      this.persist(row, next, { attemptDelta: 1 });
      this.recomputeParentAccounting(input.operationId, input.at);
    });
  }

  retainAttempted(input: {
    personId: string;
    operationId: string;
    at: Date;
    outcome: "usable" | "uncertain";
    record?: CandidateSourceRecord;
    observedConsumption: number | null;
    providerViolation?: "provider-credit-model-exceeded";
  }): void {
    this.repository.transaction(() => {
      const row = this.requiredOwnedRow(input);
      const metadata = this.metadata(row, input.personId);
      if (metadata.lifecycle !== "reconciliation-required")
        throw new Error("apollo-person-reservation-completion-unavailable");
      if (
        input.outcome === "usable" &&
        (!input.record ||
          input.record.sourceProviderId !== "apollo" ||
          input.record.providerRecordId !== input.personId)
      )
        throw new Error("apollo-person-reservation-result-invalid");
      if (
        input.observedConsumption !== null &&
        (!Number.isInteger(input.observedConsumption) ||
          input.observedConsumption < 0)
      )
        throw new Error("apollo-person-reservation-consumption-invalid");
      const lifecycle: ApolloPersonReservationLifecycle =
        input.outcome === "usable"
          ? "attempted-result-usable"
          : "reconciliation-required";
      const providerViolation =
        input.providerViolation ??
        (input.observedConsumption !== null && input.observedConsumption > 1
          ? "provider-credit-model-exceeded"
          : metadata.providerViolation);
      const next: ReservationMetadata = {
        ...metadata,
        lifecycle,
        observedConsumption: input.observedConsumption,
        ...(providerViolation ? { providerViolation } : {}),
        ...(input.outcome === "usable"
          ? {
              retainedRecord: structuredClone(input.record!),
              retainedResultFingerprint: input.record!.sourceFingerprint,
            }
          : { retainedRecord: undefined, retainedResultFingerprint: undefined }),
        updatedAt: input.at.toISOString(),
        audit: [
          ...metadata.audit,
          systemAudit({
            personId: input.personId,
            operationId: input.operationId,
            at: input.at,
            previousState: metadata.lifecycle,
            resultingState: lifecycle,
            ...(input.observedConsumption !== null
              ? { observedConsumption: input.observedConsumption }
              : {}),
            reason:
              providerViolation
                ? providerViolation
                : input.outcome === "usable"
                ? "normalized-enrichment-result-retained"
                : "provider-outcome-remains-uncertain",
          }),
        ],
      };
      this.persist(row, next);
      this.recomputeParentAccounting(input.operationId, input.at);
    });
  }

  releaseUnattempted(input: {
    personId: string;
    operationId: string;
    at: Date;
  }): void {
    this.repository.transaction(() => {
      const row = this.requiredOwnedRow(input);
      const metadata = this.metadata(row, input.personId);
      if (metadata.lifecycle !== "reserved-never-attempted")
        throw new Error("apollo-person-reservation-release-unavailable");
      const lifecycle: ApolloPersonReservationLifecycle =
        "released-no-consumption";
      const next: ReservationMetadata = {
        ...metadata,
        lifecycle,
        updatedAt: input.at.toISOString(),
        audit: [
          ...metadata.audit,
          systemAudit({
            personId: input.personId,
            operationId: input.operationId,
            previousState: metadata.lifecycle,
            resultingState: lifecycle,
            at: input.at,
            reason: "local-failure-before-provider-attempt",
          }),
        ],
      };
      this.persist(row, next);
      const parent = this.repository.native
        .prepare(
          "SELECT 1 present FROM provider_operations WHERE id=? AND provider_id='apollo' AND candidate_count>0",
        )
        .get(input.operationId);
      if (parent) this.recomputeParentAccounting(input.operationId, input.at);
    });
  }

  markImported(input: {
    personId: string;
    operationId: string;
    importedCandidateId: string;
    at: Date;
  }): void {
    this.repository.transaction(() => {
      const row = this.requiredOwnedRow(input);
      const metadata = this.metadata(row, input.personId);
      if (
        metadata.lifecycle === "completed-imported" &&
        metadata.importedCandidateId === input.importedCandidateId
      ) {
        this.recomputeParentAccounting(input.operationId, input.at);
        return;
      }
      if (metadata.lifecycle !== "attempted-result-usable")
        throw new Error("apollo-person-reservation-import-state-invalid");
      const lifecycle: ApolloPersonReservationLifecycle = "completed-imported";
      const next: ReservationMetadata = {
        ...metadata,
        lifecycle,
        retainedRecord: undefined,
        importedCandidateId: input.importedCandidateId,
        updatedAt: input.at.toISOString(),
        audit: [
          ...metadata.audit,
          systemAudit({
            ...input,
            previousState: metadata.lifecycle,
            resultingState: lifecycle,
            reason: "canonical-candidate-import-confirmed",
          }),
        ],
      };
      this.persist(row, next);
      this.recomputeParentAccounting(input.operationId, input.at);
    });
  }

  inspectApolloPersonReservation(input: {
    personId: string;
    operationId: string;
  }): ApolloPersonReservationInspection | null {
    const row = this.readRow(input.personId);
    if (!row) return null;
    const metadata = this.metadata(row, input.personId);
    if (metadata.ownerOperationId !== input.operationId)
      throw new Error("apollo-person-reservation-operation-mismatch");
    return this.inspection(row, metadata);
  }

  reconcileApolloPersonReservation(
    command: ApolloPersonReconciliationCommand,
  ): ApolloPersonReconciliationResult {
    return this.repository.transaction(() => {
      const row = this.readRow(command.personId);
      if (!row) throw new Error("apollo-person-reservation-missing");
      const metadata = this.metadata(row, command.personId);
      const commandFingerprint = fingerprint({
        commandId: command.commandId,
        personId: command.personId,
        operationId: command.operationId,
        actor: command.actor.trim(),
        mechanism: command.mechanism.trim(),
        evidence: command.evidence.trim(),
        reason: command.reason.trim(),
        outcome: command.outcome,
        observedConsumption:
          command.outcome === "consumed-no-import"
            ? command.observedConsumption
            : null,
      });
      const priorCommand = metadata.audit.find(
        (event) => event.commandId === command.commandId,
      );
      if (priorCommand) {
        if (priorCommand.commandFingerprint !== commandFingerprint)
          throw new Error("apollo-person-reconciliation-command-conflict");
        const existing = this.inspection(row, metadata);
        return { status: "existing", before: existing, after: existing };
      }
      if (metadata.ownerOperationId !== command.operationId)
        throw new Error("apollo-person-reservation-operation-mismatch");

      const before = this.inspection(row, metadata);
      let resultingState: ApolloPersonReservationLifecycle;
      let importedCandidateId = metadata.importedCandidateId;
      let observedConsumption = metadata.observedConsumption;
      if (command.outcome === "resume-retained-result") {
        if (
          metadata.lifecycle !== "attempted-result-usable" ||
          !metadata.retainedRecord
        )
          throw new Error("apollo-person-reconciliation-result-unavailable");
        importedCandidateId = this.resumeRetainedResult(
          command,
          metadata.retainedRecord,
        );
        resultingState = "completed-imported";
      } else if (command.outcome === "no-consumption-safe-release") {
        if (metadata.lifecycle !== "reconciliation-required")
          throw new Error("apollo-person-reconciliation-release-unavailable");
        if (
          metadata.observedConsumption !== null &&
          metadata.observedConsumption !== undefined &&
          metadata.observedConsumption !== 0
        )
          throw new Error("apollo-person-reconciliation-consumption-conflict");
        observedConsumption = 0;
        resultingState = "released-no-consumption";
      } else {
        if (
          metadata.lifecycle !== "reconciliation-required" &&
          metadata.lifecycle !== "attempted-result-usable"
        )
          throw new Error("apollo-person-reconciliation-consumed-unavailable");
        if (
          metadata.observedConsumption !== null &&
          metadata.observedConsumption !== undefined &&
          metadata.observedConsumption !== command.observedConsumption
        )
          throw new Error("apollo-person-reconciliation-consumption-conflict");
        observedConsumption = command.observedConsumption;
        resultingState = "consumed-no-import";
      }

      const event: ApolloPersonReservationAuditEvent = {
        commandId: command.commandId,
        commandFingerprint,
        actor: command.actor.trim(),
        mechanism: command.mechanism.trim(),
        evidence: command.evidence.trim(),
        reason: command.reason.trim(),
        previousState: metadata.lifecycle,
        resultingState,
        ...(observedConsumption !== null && observedConsumption !== undefined
          ? { observedConsumption }
          : {}),
        occurredAt: command.at.toISOString(),
      };
      const next: ReservationMetadata = {
        ...metadata,
        lifecycle: resultingState,
        observedConsumption,
        ...(typeof observedConsumption === "number" && observedConsumption > 1
          ? { providerViolation: "provider-credit-model-exceeded" as const }
          : {}),
        retainedRecord: undefined,
        importedCandidateId,
        updatedAt: command.at.toISOString(),
        audit: [...metadata.audit, event],
      };
      this.persist(row, next);
      this.recomputeParentAccounting(metadata.ownerOperationId, command.at);
      return {
        status: "applied",
        before,
        after: this.inspection(
          { ...row, state: operationState(resultingState) },
          next,
        ),
      };
    });
  }

  private resumeRetainedResult(
    command: ApolloPersonReconciliationCommand,
    record: CandidateSourceRecord,
  ): string {
    if (record.providerRecordId !== command.personId)
      throw new Error("apollo-person-reconciliation-result-identity-invalid");
    const stable = fingerprint({
      personId: command.personId,
      sourceFingerprint: record.sourceFingerprint,
    });
    const scope = this.parentScope(command.operationId);
    completeScopedCandidateRecords({
      repository: this.repository,
      operationId: `apollo-reconcile:${stable.slice(0, 32)}`,
      scope,
      records: [record],
      adapterVersion: "scoped-reconciliation-v1",
      sourceFingerprint: `apollo-reconcile:${stable}`,
      at: command.at,
      companies: this.options.companies,
      companyDomains: this.options.companyDomains,
    });
    const imported = this.repository.findImportedCandidate(
      "apollo",
      command.personId,
    );
    if (!imported)
      throw new Error("apollo-person-reconciliation-import-failed");
    return imported.id;
  }

  private parentScope(operationId: string) {
    const operation = this.repository.native
      .prepare(
        "SELECT bucket_scope_json FROM provider_operations WHERE id=? AND provider_id='apollo' AND candidate_count>0",
      )
      .get(operationId) as { bucket_scope_json: string | null } | undefined;
    if (!operation?.bucket_scope_json)
      throw new Error("apollo-person-reconciliation-scope-missing");
    try {
      const value = JSON.parse(operation.bucket_scope_json) as {
        bucket?: unknown;
        earlyCareerOnly?: unknown;
      };
      const scope = parseBucketScope(value);
      if (!scope) throw new Error("scope-missing");
      return scope;
    } catch {
      throw new Error("apollo-person-reconciliation-scope-invalid");
    }
  }

  /** Recomputes, rather than increments, one parent from current child truth. */
  recomputeParentAccounting(
    operationId: string,
    at: Date,
  ): ApolloParentOperationAccounting {
    return this.repository.transaction(() => {
      const parent = this.repository.native
        .prepare(
          "SELECT occurred_at_utc FROM provider_operations WHERE id=? AND provider_id='apollo' AND candidate_count>0",
        )
        .get(operationId) as { occurred_at_utc: string } | undefined;
      if (!parent)
        throw new Error("apollo-person-reconciliation-operation-missing");
      const children = this.repository.native
        .prepare(
          "SELECT batch_id,attempt_count,bucket_scope_json FROM provider_operations WHERE provider_id='apollo' AND operation='enrichment' AND candidate_count=0 AND estimated_max_exposure=0 AND batch_id=?",
        )
        .all(operationId) as Array<{
        batch_id: string;
        attempt_count: number;
        bucket_scope_json: string | null;
      }>;
      if (children.length === 0)
        return {
          childCount: 0,
          attemptCount: 0,
          knownConsumptionLowerBound: 0,
          hasUnknownConsumption: false,
          hasProviderViolation: false,
          observedConsumption: null,
        };
      let attemptCount = 0;
      let knownConsumptionLowerBound = 0;
      let hasUnknownConsumption = false;
      let hasProviderViolation = false;
      for (const child of children) {
        let attempted = child.attempt_count > 0;
        let observed: number | null | undefined;
        if (child.bucket_scope_json) {
          try {
            const parsed = JSON.parse(
              child.bucket_scope_json,
            ) as Partial<ReservationMetadata>;
            if (
              parsed.version === APOLLO_PERSON_RESERVATION_VERSION &&
              parsed.ownerOperationId === operationId
            ) {
              attempted = parsed.attemptedForOwner ?? attempted;
              observed = Object.hasOwn(parsed, "observedConsumption")
                ? parsed.observedConsumption
                : undefined;
              hasProviderViolation ||=
                parsed.providerViolation === "provider-credit-model-exceeded" ||
                (typeof observed === "number" && observed > 1);
            }
          } catch {
            // A legacy attempted child remains unknown and conservatively held.
          }
        }
        if (!attempted) continue;
        attemptCount += 1;
        if (observed === null || observed === undefined)
          hasUnknownConsumption = true;
        else knownConsumptionLowerBound += observed;
      }
      const observedConsumption = hasUnknownConsumption
        ? null
        : knownConsumptionLowerBound;
      this.repository.native
        .prepare(
          "UPDATE provider_operations SET attempt_count=?,observed_consumption=?,state=CASE WHEN ?=1 THEN 'failed' ELSE state END,failure_reason=CASE WHEN ?=1 THEN 'provider-credit-model-exceeded' ELSE failure_reason END WHERE id=? AND provider_id='apollo' AND candidate_count>0",
        )
        .run(
          attemptCount,
          observedConsumption,
          hasProviderViolation ? 1 : 0,
          hasProviderViolation ? 1 : 0,
          operationId,
        );
      const date = new Date(parent.occurred_at_utc).toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      });
      reconcileApolloDailyObservedConsumption(this.repository.native, date, at);
      return {
        childCount: children.length,
        attemptCount,
        knownConsumptionLowerBound,
        hasUnknownConsumption,
        hasProviderViolation,
        observedConsumption,
      };
    });
  }

  private readRow(personId: string): ReservationRow | undefined {
    return this.repository.native
      .prepare(
        "SELECT id,batch_id,state,attempt_count,observed_consumption,failure_reason,occurred_at_utc,bucket_scope_json FROM provider_operations WHERE id=? AND provider_id='apollo' AND operation='enrichment' AND candidate_count=0 AND estimated_max_exposure=0",
      )
      .get(apolloPersonReservationId(personId)) as ReservationRow | undefined;
  }

  private requiredOwnedRow(input: {
    personId: string;
    operationId: string;
  }): ReservationRow {
    const row = this.readRow(input.personId);
    if (!row) throw new Error("apollo-person-reservation-missing");
    const metadata = this.metadata(row, input.personId);
    if (metadata.ownerOperationId !== input.operationId)
      throw new Error("apollo-person-reservation-operation-mismatch");
    return row;
  }

  private metadata(row: ReservationRow, personId: string): ReservationMetadata {
    if (row.bucket_scope_json) {
      try {
        const parsed = JSON.parse(row.bucket_scope_json) as ReservationMetadata;
        if (
          parsed.version === APOLLO_PERSON_RESERVATION_VERSION &&
          parsed.personId === personId &&
          Array.isArray(parsed.audit)
        )
          return {
            ...parsed,
            attemptedForOwner:
              parsed.attemptedForOwner ?? row.attempt_count > 0,
            ...(Object.hasOwn(parsed, "observedConsumption")
              ? {}
              : row.attempt_count > 0
                ? { observedConsumption: null }
                : {}),
          };
      } catch {
        // Legacy rows below remain locked and require explicit reconciliation.
      }
    }
    const lifecycle: ApolloPersonReservationLifecycle =
      row.attempt_count === 0
        ? "reserved-never-attempted"
        : "reconciliation-required";
    return {
      version: APOLLO_PERSON_RESERVATION_VERSION,
      personId,
      ownerOperationId: row.batch_id,
      lifecycle,
      attemptedForOwner: row.attempt_count > 0,
      ...(row.attempt_count > 0 ? { observedConsumption: null } : {}),
      updatedAt: row.occurred_at_utc,
      audit: [],
    };
  }

  private persist(
    row: ReservationRow,
    metadata: ReservationMetadata,
    input: { batchId?: string; attemptDelta?: number } = {},
  ): void {
    const result = this.repository.native
      .prepare(
        "UPDATE provider_operations SET batch_id=?,state=?,attempt_count=attempt_count+?,failure_reason=?,occurred_at_utc=?,bucket_scope_json=? WHERE id=? AND COALESCE(bucket_scope_json,'')=COALESCE(?,'')",
      )
      .run(
        input.batchId ?? metadata.ownerOperationId,
        metadata.providerViolation ? "failed" : operationState(metadata.lifecycle),
        input.attemptDelta ?? 0,
        metadata.providerViolation ??
          `scoped-person-reservation:${metadata.lifecycle}`,
        metadata.updatedAt,
        JSON.stringify(metadata),
        row.id,
        row.bucket_scope_json,
      );
    if (result.changes !== 1)
      throw new Error("apollo-person-reservation-concurrent-transition");
  }

  private inspection(
    row: ReservationRow,
    metadata: ReservationMetadata,
  ): ApolloPersonReservationInspection {
    const operation = this.repository.native
      .prepare(
        "SELECT observed_consumption FROM provider_operations WHERE id=? AND candidate_count>0",
      )
      .get(metadata.ownerOperationId) as
      | { observed_consumption: number | null }
      | undefined;
    return {
      personId: metadata.personId,
      operationId: metadata.ownerOperationId,
      lifecycle: metadata.lifecycle,
      attemptCount: row.attempt_count,
      resultRetained: Boolean(metadata.retainedRecord),
      retainedResultFingerprint: metadata.retainedResultFingerprint ?? null,
      importedCandidateId: metadata.importedCandidateId ?? null,
      personObservedConsumption: metadata.observedConsumption ?? null,
      consumptionKnown:
        metadata.attemptedForOwner &&
        metadata.observedConsumption !== null &&
        metadata.observedConsumption !== undefined,
      providerViolation: metadata.providerViolation ?? null,
      observedConsumption: operation?.observed_consumption ?? null,
      reusable: metadata.lifecycle === "released-no-consumption",
      requiresReconciliation:
        metadata.lifecycle === "reconciliation-required" ||
        metadata.lifecycle === "attempted-result-usable",
      updatedAt: metadata.updatedAt,
      audit: metadata.audit.map((event) => ({ ...event })),
    };
  }
}

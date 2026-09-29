import { createHash } from "node:crypto";
import type { CandidateSourceRecord } from "@/domain/candidates";
import type { TargetCompany } from "@/domain/targeting";
import { importCandidateBatch } from "@/application/ingestion";
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

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;

type ReservationMetadata = {
  version: typeof APOLLO_PERSON_RESERVATION_VERSION;
  personId: string;
  ownerOperationId: string;
  lifecycle: ApolloPersonReservationLifecycle;
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
        updatedAt: input.at.toISOString(),
        audit: [
          systemAudit({
            ...input,
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
        updatedAt: input.at.toISOString(),
        audit: [
          ...metadata.audit,
          systemAudit({
            ...input,
            previousState: metadata.lifecycle,
            resultingState: lifecycle,
            reason: "provider-request-dispatched-outcome-not-yet-known",
          }),
        ],
      };
      this.persist(row, next, { attemptDelta: 1 });
    });
  }

  retainAttempted(input: {
    personId: string;
    operationId: string;
    at: Date;
    outcome: "usable" | "uncertain";
    record?: CandidateSourceRecord;
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
      const lifecycle: ApolloPersonReservationLifecycle =
        input.outcome === "usable"
          ? "attempted-result-usable"
          : "reconciliation-required";
      const next: ReservationMetadata = {
        ...metadata,
        lifecycle,
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
            ...input,
            previousState: metadata.lifecycle,
            resultingState: lifecycle,
            reason:
              input.outcome === "usable"
                ? "normalized-enrichment-result-retained"
                : "provider-outcome-remains-uncertain",
          }),
        ],
      };
      this.persist(row, next);
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
    });
  }

  markImported(input: {
    personId: string;
    operationId: string;
    importedCandidateId: string;
    at: Date;
  }): void {
    const row = this.requiredOwnedRow(input);
    const metadata = this.metadata(row, input.personId);
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
      const row = this.requiredOwnedRow(command);
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

      const before = this.inspection(row, metadata);
      let resultingState: ApolloPersonReservationLifecycle;
      let importedCandidateId = metadata.importedCandidateId;
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
        this.recordOuterConsumption(metadata.ownerOperationId, 0, command.at);
        resultingState = "released-no-consumption";
      } else {
        if (
          metadata.lifecycle !== "reconciliation-required" &&
          metadata.lifecycle !== "attempted-result-usable"
        )
          throw new Error("apollo-person-reconciliation-consumed-unavailable");
        this.recordOuterConsumption(
          metadata.ownerOperationId,
          command.observedConsumption,
          command.at,
        );
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
        occurredAt: command.at.toISOString(),
      };
      const next: ReservationMetadata = {
        ...metadata,
        lifecycle: resultingState,
        retainedRecord: undefined,
        importedCandidateId,
        updatedAt: command.at.toISOString(),
        audit: [...metadata.audit, event],
      };
      this.persist(row, next);
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
    const existing = this.repository.findImportedCandidate(
      "apollo",
      command.personId,
    );
    if (existing) return existing.id;
    const stable = fingerprint({
      personId: command.personId,
      sourceFingerprint: record.sourceFingerprint,
    });
    importCandidateBatch(
      this.repository,
      this.options.companies ?? this.repository.listTargetCompanies(),
      {
        batchId: `apollo-reconcile:${stable.slice(0, 32)}`,
        adapterId: "apollo",
        adapterVersion: "scoped-reconciliation-v1",
        datasetClassification: record.datasetClassification,
        sourceFingerprint: `apollo-reconcile:${stable}`,
        records: [record],
        strategyCompanyDomains: this.options.companyDomains,
        ...(record.datasetClassification === "authorized-provider"
          ? {
              authorizedProviderAccess: {
                enabled: true as const,
                providerId: "apollo",
              },
            }
          : {}),
      },
      command.at,
    );
    const imported = this.repository.findImportedCandidate(
      "apollo",
      command.personId,
    );
    if (!imported)
      throw new Error("apollo-person-reconciliation-import-failed");
    return imported.id;
  }

  private recordOuterConsumption(
    operationId: string,
    observedConsumption: number,
    at: Date,
  ): void {
    const operation = this.repository.native
      .prepare(
        "SELECT observed_consumption,occurred_at_utc FROM provider_operations WHERE id=? AND provider_id='apollo' AND candidate_count>0",
      )
      .get(operationId) as
      | { observed_consumption: number | null; occurred_at_utc: string }
      | undefined;
    if (!operation)
      throw new Error("apollo-person-reconciliation-operation-missing");
    if (
      observedConsumption === 0 &&
      operation.observed_consumption !== null &&
      operation.observed_consumption > 0
    )
      throw new Error("apollo-person-reconciliation-consumption-conflict");
    this.repository.native
      .prepare(
        "UPDATE provider_operations SET observed_consumption=CASE WHEN observed_consumption IS NULL THEN ? ELSE MAX(observed_consumption,?) END WHERE id=?",
      )
      .run(observedConsumption, observedConsumption, operationId);
    const date = new Date(operation.occurred_at_utc).toLocaleDateString(
      "en-CA",
      { timeZone: "America/New_York" },
    );
    reconcileApolloDailyObservedConsumption(this.repository.native, date, at);
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
          return parsed;
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
        operationState(metadata.lifecycle),
        input.attemptDelta ?? 0,
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

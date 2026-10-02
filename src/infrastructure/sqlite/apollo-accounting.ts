import type Database from "better-sqlite3";

type DailyBudgetRow = {
  attempted_candidates: number;
  estimated_max_exposure: number;
};

type OperationAccountingRow = {
  id: string;
  estimated_max_exposure: number;
  observed_consumption: number | null;
  attempt_count: number;
  bucket_scope_json: string | null;
  occurred_at_utc: string;
};

type PersonAccountingMetadata = {
  version?: string;
  ownerOperationId?: string;
  attemptedForOwner?: boolean;
  observedConsumption?: number | null;
};

function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

/**
 * Reads the conservative Apollo hold for one NetworkPilot budget day.
 * Overspend is calculated per operation so a known overage cannot be hidden
 * by a separate operation whose reserved consumption is still unknown.
 */
export function readPersistedApolloDailyAccounting(
  database: Database.Database,
  date: string,
): {
  attempted: number;
  reservedExposure: number;
  effectiveExposure: number;
  observedConsumption: number | null;
  knownObservedConsumption: number;
  hasUnknownConsumption: boolean;
} {
  const budget = database
      .prepare(
        "SELECT attempted_candidates,estimated_max_exposure FROM provider_daily_budgets WHERE provider_id='apollo' AND local_date=?",
      )
      .get(date) as DailyBudgetRow | undefined,
    hasBucketScope = (
      database.prepare("PRAGMA table_info(provider_operations)").all() as Array<{
        name: string;
      }>
    ).some((column) => column.name === "bucket_scope_json"),
    operations = (
      database
        .prepare(
          `SELECT id,estimated_max_exposure,observed_consumption,attempt_count,${hasBucketScope ? "bucket_scope_json" : "NULL AS bucket_scope_json"},occurred_at_utc FROM provider_operations WHERE provider_id='apollo' AND candidate_count>0`,
        )
        .all() as OperationAccountingRow[]
    ).filter((operation) => localDate(operation.occurred_at_utc) === date),
    personLowerBounds = new Map<string, number>();
  if (hasBucketScope) {
    const rows = database
      .prepare(
        "SELECT bucket_scope_json FROM provider_operations WHERE provider_id='apollo' AND candidate_count=0 AND estimated_max_exposure=0 AND bucket_scope_json IS NOT NULL",
      )
      .all() as Array<{ bucket_scope_json: string }>;
    for (const row of rows) {
      try {
        const metadata = JSON.parse(
          row.bucket_scope_json,
        ) as PersonAccountingMetadata;
        if (
          metadata.version !== "apollo-person-reservation-v1" ||
          !metadata.ownerOperationId ||
          metadata.attemptedForOwner !== true ||
          typeof metadata.observedConsumption !== "number" ||
          !Number.isFinite(metadata.observedConsumption) ||
          metadata.observedConsumption < 0
        )
          continue;
        personLowerBounds.set(
          metadata.ownerOperationId,
          (personLowerBounds.get(metadata.ownerOperationId) ?? 0) +
            metadata.observedConsumption,
        );
      } catch {
        // Invalid/legacy child metadata contributes no asserted lower bound.
      }
    }
  }
  const knownObservedConsumption = operations.reduce(
      (sum, operation) =>
        sum +
        (operation.observed_consumption ??
          personLowerBounds.get(operation.id) ??
          0),
      0,
    ),
    hasUnknownConsumption = operations.some(
      (operation) =>
        operation.attempt_count > 0 && operation.observed_consumption === null,
    ),
    hasConsumptionEvidence = operations.some(
      (operation) =>
        operation.attempt_count > 0 || operation.observed_consumption !== null,
    ),
    observedConsumption = hasUnknownConsumption
      ? null
      : hasConsumptionEvidence
        ? knownObservedConsumption
        : null,
    overage = operations.reduce((sum, operation) => {
      // Scoped sourcing uses a one-credit-per-enrichment model. When exact
      // provider consumption is unavailable, truthful attempts are therefore
      // still a conservative exposure signal. Legacy operations retain their
      // persisted reservation unless the provider supplied exact consumption.
      const evidence = Math.max(
        operation.observed_consumption ?? 0,
        operation.bucket_scope_json === null ? 0 : operation.attempt_count,
      );
      return (
        sum + Math.max(0, evidence - operation.estimated_max_exposure)
      );
    }, 0),
    reservedExposure = budget?.estimated_max_exposure ?? 0;
  return {
    attempted: budget?.attempted_candidates ?? 0,
    reservedExposure,
    effectiveExposure: reservedExposure + overage,
    observedConsumption,
    knownObservedConsumption,
    hasUnknownConsumption,
  };
}

/** Recomputes the compatibility aggregate; repeated reconciliation is safe. */
export function reconcileApolloDailyObservedConsumption(
  database: Database.Database,
  date: string,
  at: Date,
): void {
  const { observedConsumption } = readPersistedApolloDailyAccounting(
    database,
    date,
  );
  database
    .prepare(
      "UPDATE provider_daily_budgets SET observed_consumption=?,updated_at_utc=? WHERE provider_id='apollo' AND local_date=?",
    )
    .run(observedConsumption, at.toISOString(), date);
}

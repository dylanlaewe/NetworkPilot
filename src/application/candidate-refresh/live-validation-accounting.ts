export function stagedAccountUsageAnomalies(input: {
  authorizedAttempts: number;
  observedConsumption: number | null | undefined;
  accountUsageDelta: number;
}): string[] {
  const anomalies: string[] = [];
  if (
    !Number.isInteger(input.authorizedAttempts) ||
    input.authorizedAttempts < 0 ||
    !Number.isInteger(input.accountUsageDelta)
  )
    return ["live-validation-accounting-input-invalid"];

  if (input.observedConsumption === null || input.observedConsumption === undefined) {
    // Account usage is supporting evidence only. It cannot be attributed to this
    // operation in general, so an absent response scalar remains canonically unknown.
    if (
      input.accountUsageDelta < 0 ||
      input.accountUsageDelta > input.authorizedAttempts
    )
      anomalies.push("apollo-account-usage-outside-authorization");
    return anomalies;
  }

  if (
    !Number.isInteger(input.observedConsumption) ||
    input.observedConsumption < 0
  )
    return ["provider-consumption-invalid"];
  if (input.accountUsageDelta !== input.observedConsumption)
    anomalies.push("apollo-account-usage-disagreement");
  return anomalies;
}

export function reservationAccountingMatches(input: {
  childObservedConsumption: number | null;
  metadataObservedConsumption: unknown;
  parentObservedConsumption: number | null | undefined;
}): boolean {
  // The reservation row deliberately keeps its scalar NULL. Its versioned
  // metadata carries exact or unknown person-level consumption, which the
  // parent operation aggregates canonically.
  return (
    input.childObservedConsumption === null &&
    input.metadataObservedConsumption === input.parentObservedConsumption
  );
}

export function scopedClassificationBypassAnomalies(input: {
  expectedBucket: string;
  actualBucket: string | null | undefined;
  reviewState: string | null | undefined;
  lifecycle: string;
  gateFailures: readonly string[];
  qualifiedCandidatesAdded: number;
  draftPresent: boolean;
}): string[] {
  if (input.actualBucket === input.expectedBucket) return [];
  const mismatchEnforced =
    input.reviewState === "review-required" &&
    input.lifecycle !== "eligible" &&
    input.gateFailures.includes("discovery-scope-mismatch") &&
    input.qualifiedCandidatesAdded === 0 &&
    !input.draftPresent;
  return mismatchEnforced ? [] : ["recipient-bucket-scope-mismatch-bypass"];
}

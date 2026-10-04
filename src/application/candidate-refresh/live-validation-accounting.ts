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

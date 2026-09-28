/**
 * Account-level provider spend produced outside the canonical operational ledger.
 * These entries are safety holds, not claims that candidates were imported.
 */
export const EXTERNAL_PROVIDER_SPEND = [
  {
    provider: "apollo",
    localDate: "2026-09-27",
    credits: 20,
    evidence: "five-bucket-preactivation-validation:usage-220-to-240",
    outcome: "classification-persistence-rolled-back",
  },
] as const;

export function externalApolloSpend(localDate: string): number {
  return EXTERNAL_PROVIDER_SPEND.filter(
    (entry) => entry.provider === "apollo" && entry.localDate === localDate,
  ).reduce((total, entry) => total + entry.credits, 0);
}

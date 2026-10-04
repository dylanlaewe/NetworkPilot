import { describe, expect, it } from "vitest";
import { stagedAccountUsageAnomalies } from "./live-validation-accounting";

describe("staged Apollo account-usage evidence", () => {
  it("accepts missing response consumption while retaining unknown attribution", () => {
    expect(
      stagedAccountUsageAnomalies({
        authorizedAttempts: 1,
        observedConsumption: null,
        accountUsageDelta: 1,
      }),
    ).toEqual([]);
  });

  it("stops when account usage exceeds the authorized exposure", () => {
    expect(
      stagedAccountUsageAnomalies({
        authorizedAttempts: 1,
        observedConsumption: undefined,
        accountUsageDelta: 2,
      }),
    ).toEqual(["apollo-account-usage-outside-authorization"]);
  });

  it("requires exact agreement when the provider reports consumption", () => {
    expect(
      stagedAccountUsageAnomalies({
        authorizedAttempts: 1,
        observedConsumption: 1,
        accountUsageDelta: 1,
      }),
    ).toEqual([]);
    expect(
      stagedAccountUsageAnomalies({
        authorizedAttempts: 1,
        observedConsumption: 1,
        accountUsageDelta: 0,
      }),
    ).toEqual(["apollo-account-usage-disagreement"]);
  });
});

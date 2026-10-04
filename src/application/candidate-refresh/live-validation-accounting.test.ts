import { describe, expect, it } from "vitest";
import {
  reservationAccountingMatches,
  scopedClassificationBypassAnomalies,
  stagedAccountUsageAnomalies,
} from "./live-validation-accounting";

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

  it("validates exact and unknown reservation accounting without copying metadata into the child scalar", () => {
    expect(
      reservationAccountingMatches({
        childObservedConsumption: null,
        metadataObservedConsumption: 1,
        parentObservedConsumption: 1,
      }),
    ).toBe(true);
    expect(
      reservationAccountingMatches({
        childObservedConsumption: null,
        metadataObservedConsumption: null,
        parentObservedConsumption: null,
      }),
    ).toBe(true);
    expect(
      reservationAccountingMatches({
        childObservedConsumption: 1,
        metadataObservedConsumption: 1,
        parentObservedConsumption: 1,
      }),
    ).toBe(false);
  });

  it("accepts a fail-closed scoped classification mismatch", () => {
    expect(
      scopedClassificationBypassAnomalies({
        expectedBucket: "managers",
        actualBucket: null,
        reviewState: "review-required",
        lifecycle: "review-required",
        gateFailures: [
          "recipient-bucket:responsibility-evidence-missing",
          "discovery-scope-mismatch",
        ],
        qualifiedCandidatesAdded: 0,
        draftPresent: false,
      }),
    ).toEqual([]);
  });

  it.each([
    { lifecycle: "eligible" },
    { gateFailures: [] },
    { qualifiedCandidatesAdded: 1 },
    { draftPresent: true },
  ])("stops when a scope mismatch bypasses a fail-closed gate", (override) => {
    expect(
      scopedClassificationBypassAnomalies({
        expectedBucket: "executives",
        actualBucket: null,
        reviewState: "review-required",
        lifecycle: "review-required",
        gateFailures: ["discovery-scope-mismatch"],
        qualifiedCandidatesAdded: 0,
        draftPresent: false,
        ...override,
      }),
    ).toEqual(["recipient-bucket-scope-mismatch-bypass"]);
  });
});

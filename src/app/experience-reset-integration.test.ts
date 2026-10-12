import { describe, expect, it } from "vitest";
import { recipientBucketHref } from "./recipient-bucket-navigation";
import { draftsForBucket, normalizedDraftAdditionState } from "./drafts/drafts-workspace";
import { initialDraftAdditionActionState } from "./today/actions";
import { matchesCandidateBucket } from "./candidates/candidates-workspace";
import { draftAdditionFeedback } from "@/application/daily-refresh/addition-feedback";

describe("real-data experience reset contracts", () => {
  it("filters classified All, scoped and Legacy draft views without a route request", () => {
    const rows = [
      { candidateId: "peer", recipientBucket: { bucket: "peers", earlyCareer: true } },
      { candidateId: "manager", recipientBucket: { bucket: "managers", earlyCareer: false } },
      { candidateId: "legacy", recipientBucket: null },
    ] as never[];
    expect(draftsForBucket(rows, "all").map((row) => row.candidateId)).toEqual(["peer", "manager"]);
    expect(draftsForBucket(rows, "peers", true).map((row) => row.candidateId)).toEqual(["peer"]);
    expect(draftsForBucket(rows, "legacy").map((row) => row.candidateId)).toEqual(["legacy"]);
    expect(recipientBucketHref("drafts", "peers", { earlyCareerOnly: "true" })).toBe("/drafts?bucket=peers&earlyCareerOnly=true");
  });

  it("keeps five-bucket Candidate All separate from explicit Legacy", () => {
    const navigation = { enabled: true, current: "candidates", selected: "all", counts: {}, total: 1 } as const;
    const classified = { recipientBucket: { bucket: "executives", earlyCareer: false } } as never;
    const legacy = { recipientBucket: null } as never;
    expect(matchesCandidateBucket(classified, navigation)).toBe(true);
    expect(matchesCandidateBucket(legacy, navigation)).toBe(false);
    expect(matchesCandidateBucket(legacy, navigation, "legacy")).toBe(true);
  });

  it("returns reasoned full, partial and zero Add Drafts feedback", () => {
    const base = { additionalDraftCount: 5, activeBefore: 1, activeAfter: 1, eligibleReserveRemaining: 0, scope: { bucket: "recruiters" as const } };
    expect(draftAdditionFeedback({ ...base, addedCount: 5 })).toMatchObject({ status: "success", message: "5 drafts added" });
    expect(draftAdditionFeedback({ ...base, addedCount: 2, blockCounts: { reviewRequired: 3, alreadyDraftedOrContacted: 0, companyCooldown: 0, suppressed: 0, unresolvedEvidence: 0, noQualifiedReserve: 0 } })).toMatchObject({ status: "partial", message: "2 of 5 drafts added", recovery: { label: "Review candidates" } });
    expect(draftAdditionFeedback({ ...base, addedCount: 0, blockCounts: { reviewRequired: 0, alreadyDraftedOrContacted: 0, companyCooldown: 0, suppressed: 0, unresolvedEvidence: 0, noQualifiedReserve: 1 } })).toMatchObject({ status: "zero", message: "No drafts could be added", recovery: { label: "Find more people" } });
  });

  it("keeps Drafts render-safe when a client navigation has no action state", () => {
    expect(normalizedDraftAdditionState(undefined)).toEqual(initialDraftAdditionActionState);
    expect(normalizedDraftAdditionState(null)).toEqual(initialDraftAdditionActionState);
    expect(normalizedDraftAdditionState({ status: "success", message: "1 draft added", reasons: [], recovery: null })).toMatchObject({ status: "success" });
  });
});

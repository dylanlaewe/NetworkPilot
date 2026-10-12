import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { recipientBucketHref } from "./recipient-bucket-navigation";
import { draftsForBucket, normalizedDraftAdditionState } from "./drafts/drafts-workspace";
import { initialDraftAdditionActionState } from "./drafts/draft-addition-state";
import { candidateEmptyState, matchesCandidateBucket } from "./candidates/candidates-workspace";
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

  it("offers a truthful recovery from empty classified and filtered candidate views", () => {
    expect(candidateEmptyState({ hasFilters: false, selection: "all", legacyCount: 117 })).toEqual({
      title: "No classified candidates yet",
      detail: "117 legacy or unclassified candidates are still available in the explicit Legacy view.",
      action: "legacy",
    });
    expect(candidateEmptyState({ hasFilters: true, selection: "managers", legacyCount: 117 })).toMatchObject({ action: "clear" });
    expect(candidateEmptyState({ hasFilters: false, selection: "managers", legacyCount: 0 })).toMatchObject({ action: "groups" });
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

  it("keeps the initial action-state value outside the use-server boundary", () => {
    const actions = readFileSync(join(process.cwd(), "src/app/today/actions.ts"), "utf8");
    const workspace = readFileSync(join(process.cwd(), "src/app/drafts/drafts-workspace.tsx"), "utf8");
    expect(actions).not.toContain("export const initialDraftAdditionActionState");
    expect(workspace).toContain('from "./draft-addition-state"');
  });
});

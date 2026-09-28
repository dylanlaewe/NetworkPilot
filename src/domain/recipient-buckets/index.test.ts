import { describe, expect, it } from "vitest";
import { bucketAwareGateFailures, bucketLabel, classifyRecipientBucket, fiveBucketEnabled, matchesBucketScope, parseBucketScope } from ".";
import { bucketFixture, fixtureEvidence } from "./test-fixtures";
import { classifyRecruiter } from "@/domain/recruiters";

describe("provider-independent relationship buckets", () => {
  it("is default-off and leaves legacy records explicitly unclassified", () => {
    expect(fiveBucketEnabled({})).toBe(false);
    expect(fiveBucketEnabled({ NETWORKPILOT_FIVE_BUCKET_ENABLED: "true" })).toBe(true);
    expect(bucketLabel()).toBe("Legacy / unclassified");
    expect(matchesBucketScope(undefined, { bucket: "peers" })).toBe(false);
    expect(parseBucketScope({ bucket: "peers", earlyCareerOnly: "true" })).toEqual({ bucket: "peers", earlyCareerOnly: true });
    expect(() => parseBucketScope({ bucket: "ceos", earlyCareerOnly: "true" })).toThrow();
  });
  it.each(["peers", "managers", "executives", "ceos"] as const)("requires supported scope for %s without changing target-role matching", bucket => {
    const { source } = bucketFixture(bucket);
    const input = { title: source.currentTitle, outreachTrack: "professional" as const, evidence: source.responsibilityEvidence };
    expect(classifyRecipientBucket(input)).toMatchObject({ bucket, reviewState: "accepted" });
    expect(classifyRecipientBucket({ ...input, evidence: [] })).toMatchObject({ bucket: null, reviewState: "review-required" });
  });
  it("distinguishes division scope and rejects contradictory responsibility", () => {
    const { source } = bucketFixture("executives");
    const base = source.responsibilityEvidence!.filter(e => e.kind !== "functional-leadership");
    expect(classifyRecipientBucket({ title: "President, Energy Division", outreachTrack: "professional", evidence: [...base, fixtureEvidence("division-leadership", "the Energy Division")] })).toMatchObject({ bucket: "executives", reviewState: "accepted" });
    expect(classifyRecipientBucket({ title: "VP", outreachTrack: "professional", evidence: [...base, fixtureEvidence("individual-contributor"), fixtureEvidence("team-leadership")] }).reviewState).toBe("review-required");
  });
  it.each([
    ["President", "accepted"],
    ["Company President", "accepted"],
    ["President, East Region", "review-required"],
    ["Regional President", "review-required"],
    ["Division President", "review-required"],
    ["Divisional President", "review-required"],
    ["Business Unit President", "review-required"],
  ] as const)(
    "normalizes company-wide president scope for %s",
    (title, reviewState) => {
      const { source } = bucketFixture("ceos");
      expect(
        classifyRecipientBucket({
          title,
          outreachTrack: "professional",
          evidence: source.responsibilityEvidence,
        }),
      ).toMatchObject({
        bucket: reviewState === "accepted" ? "ceos" : null,
        reviewState,
      });
    },
  );
  it("does not let human-reviewed company leadership bypass a regional-title contradiction", () => {
    const { source } = bucketFixture("ceos");
    const evidence = source.responsibilityEvidence!.map((item) => ({
      ...item,
      reviewedBy: "local-operator",
    }));
    expect(
      classifyRecipientBucket({
        title: "President, East Region",
        outreachTrack: "professional",
        evidence,
      }),
    ).toMatchObject({
      bucket: null,
      reviewState: "review-required",
      explanationCodes: ["company-and-division-scope-conflicting"],
    });
  });
  it("accepts supported internal Executive Recruiter evidence without admitting agencies or unsupported domains", () => {
    const input = { title: "Executive Recruiter", employerName: "Fictional Juniper", internalCompanyMatch: true, minimumExperience: 8, maximumExperience: 8 };
    expect(classifyRecruiter(input).accepted).toBe(false);
    expect(classifyRecruiter({ ...input, reviewedInternalRecruiting: true, reviewedRecruitingDomain: "technical-data-ai" }).accepted).toBe(true);
    expect(classifyRecruiter({ ...input, employerName: "Fictional Executive Search", reviewedInternalRecruiting: true, reviewedRecruitingDomain: "technical-data-ai" }).accepted).toBe(false);
    const { source } = bucketFixture("recruiters");
    expect(classifyRecipientBucket({ title: source.currentTitle, outreachTrack: "recruiter", recruiterAccepted: true, evidence: source.responsibilityEvidence })).toMatchObject({ bucket: "recruiters", reviewState: "accepted" });
    expect(classifyRecipientBucket({ title: source.currentTitle, outreachTrack: "recruiter", recruiterAccepted: false, evidence: source.responsibilityEvidence }).reviewState).toBe("review-required");
  });
  it.each(["managers", "executives", "ceos"] as const)("uses reviewed field relevance for %s without removing contradictory or unrelated safety gates", bucket => {
    const { source } = bucketFixture(bucket);
    const classification = classifyRecipientBucket({ title: source.currentTitle, outreachTrack: "professional", evidence: source.responsibilityEvidence });
    const gates = ["recipient-function-unknown", "recipient-function-unrelated", "recipient-function-contradictory", "email-unverified", "prohibited-seniority"];
    expect(bucketAwareGateFailures({ classification, gateFailures: gates, minimumYears: 8 })).toEqual(bucket==="managers"?["recipient-function-contradictory","email-unverified","prohibited-seniority"]:["recipient-function-contradictory","email-unverified"]);
  });
  it("removes only the reviewed early-career exception while retaining shared safety gates", () => {
    const { source } = bucketFixture("peers", 1, true);
    const classification = classifyRecipientBucket({ title: source.currentTitle, outreachTrack: "professional", evidence: source.responsibilityEvidence });
    const gates = ["suppressed", "opted-out", "email-unverified", "company-unreviewed", "insufficient-or-unknown-experience"];
    expect(bucketAwareGateFailures({ classification, gateFailures: gates, minimumYears: 1 })).toEqual(gates.slice(0, 4));
    expect(bucketAwareGateFailures({ classification, gateFailures: gates, minimumYears: null })).toEqual(gates);
    const unreviewed = classifyRecipientBucket({ title: "Junior analyst", outreachTrack: "professional", evidence: source.responsibilityEvidence!.map(e => ({ ...e, reviewedBy: undefined })) });
    expect(unreviewed.earlyCareer).toBe(false);
    expect(bucketAwareGateFailures({ classification: unreviewed, gateFailures: gates, minimumYears: 1 })).toEqual(gates);
  });
});

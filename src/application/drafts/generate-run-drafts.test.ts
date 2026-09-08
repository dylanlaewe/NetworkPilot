import { describe, expect, it } from "vitest";
import { scoreTarget } from "@/domain/targeting";
import { candidateFromProfile, FICTIONAL_TARGETING_PROFILE_INVALID } from "./generate-run-drafts";
import type { SelectedDraftRecipient } from "./types";

const recipient = (): SelectedDraftRecipient => ({ id: "fictional-person", firstName: "Fictional", prospectName: "Fictional Person", companyId: "fictional-company", companyName: "Imaginary Venture", industryId: "technology-ai", roleFamilyId: "data-analytics", personaId: "experienced-practitioner", yearsExperience: 10, relevanceScore: 90, targetingProfile: { prospectId: "fictional-person", professionalTitle: "Senior Data Engineer", roleFamilyId: "data-analytics", desiredRoleId: "data-1", personaId: "experienced-practitioner", geographyId: "boston-ma", industryId: "technology-ai", roleAlignment: 95, functionalRelevance: 96, sharedSignal: 70, dataQuality: 100, roleSpecificUpside: 90, profileVersion: "fictional-targeting-profile-v1" }, companyProfile: { companyId: "fictional-company", industryId: "technology-ai", scenarioTier: "tier-2", recognitionScore: 70, careerUpsideScore: 80, technicalInterestScore: 90, profileVersion: "fictional-company-profile-v1" } });

describe("recipient-specific candidate validation", () => {
  it.each([
    ["role family", (item: SelectedDraftRecipient) => { item.targetingProfile.roleFamilyId = "unknown"; }],
    ["desired role", (item: SelectedDraftRecipient) => { item.targetingProfile.desiredRoleId = "unknown"; }],
    ["persona", (item: SelectedDraftRecipient) => { item.targetingProfile.personaId = "unknown"; }],
    ["industry", (item: SelectedDraftRecipient) => { item.targetingProfile.industryId = "unknown"; }],
    ["geography", (item: SelectedDraftRecipient) => { item.targetingProfile.geographyId = "unknown"; }],
    ["company industry", (item: SelectedDraftRecipient) => { item.companyProfile.industryId = "consulting"; }],
    ["company", (item: SelectedDraftRecipient) => { item.companyId = "microsoft"; item.companyProfile.companyId = "microsoft"; }],
  ] as const)("fails closed for an invalid %s reference", (_label, mutate) => {
    const item = recipient(); mutate(item);
    try { candidateFromProfile(item); throw new Error("expected failure"); } catch (error) { expect((error as {code?:string}).code).toBe(FICTIONAL_TARGETING_PROFILE_INVALID); }
  });

  it("derives scoring only from the persisted fictional profile", () => {
    const high = recipient(); const low = recipient(); low.id = "low"; low.targetingProfile.roleAlignment = 20; low.targetingProfile.functionalRelevance = 15; low.targetingProfile.sharedSignal = 5; low.targetingProfile.dataQuality = 45; low.companyProfile.recognitionScore = 40;
    expect(scoreTarget(candidateFromProfile(high).candidate).total).toBeGreaterThan(scoreTarget(candidateFromProfile(low).candidate).total);
  });

  it("makes an entry-level peer ineligible for the experienced-practitioner persona", () => {
    const item = recipient(); item.yearsExperience = 1;
    expect(scoreTarget(candidateFromProfile(item).candidate)).toMatchObject({ eligible: false, rejectionCode: "recipient-insufficient-experience" });
  });
});

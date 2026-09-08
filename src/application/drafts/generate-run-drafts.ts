import { renderDraft, selectTemplate } from "@/domain/drafting";
import { CONTACT_PERSONAS, GEOGRAPHY_PREFERENCES, INDUSTRY_PREFERENCES, ROLE_FAMILIES, TARGET_COMPANIES, TARGET_ROLES, scoreTarget } from "@/domain/targeting";
import type { TargetCandidate, TargetCompany } from "@/domain/targeting";
import type { DraftRecord, DraftStudioRepository, RecipientTargetingSnapshot, SelectedDraftRecipient } from "./types";

export const FICTIONAL_TARGETING_PROFILE_INVALID = "FICTIONAL_TARGETING_PROFILE_INVALID" as const;
export class InvalidFictionalTargetingProfileError extends Error {
  readonly code = FICTIONAL_TARGETING_PROFILE_INVALID;
  constructor(detail: string) { super(`Invalid fictional targeting profile: ${detail}`); this.name = "InvalidFictionalTargetingProfileError"; }
}

export function candidateFromProfile(recipient: SelectedDraftRecipient): { candidate: TargetCandidate; snapshot: RecipientTargetingSnapshot } {
  const profile = recipient.targetingProfile;
  const companyProfile = recipient.companyProfile;
  const numericInputs = [profile.roleAlignment, profile.functionalRelevance, profile.sharedSignal, profile.dataQuality, profile.roleSpecificUpside, companyProfile.recognitionScore, companyProfile.careerUpsideScore, companyProfile.technicalInterestScore];
  if (!profile.professionalTitle || !profile.profileVersion || !companyProfile.profileVersion || numericInputs.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) throw new InvalidFictionalTargetingProfileError("missing or out-of-range fictional attributes");
  const roleFamily = ROLE_FAMILIES.find((item) => item.id === profile.roleFamilyId && item.enabled);
  const role = TARGET_ROLES.find((item) => item.id === profile.desiredRoleId && item.enabled);
  const persona = CONTACT_PERSONAS.find((item) => item.id === profile.personaId && item.enabled);
  const industry = INDUSTRY_PREFERENCES.find((item) => item.id === profile.industryId && item.enabled);
  const geography = GEOGRAPHY_PREFERENCES.find((item) => item.id === profile.geographyId && item.enabled);
  if (!roleFamily) throw new InvalidFictionalTargetingProfileError("unknown or disabled role family");
  if (!role || role.familyId !== roleFamily.id) throw new InvalidFictionalTargetingProfileError("desired role does not match role family");
  if (!persona) throw new InvalidFictionalTargetingProfileError("unknown or disabled persona");
  if (!industry) throw new InvalidFictionalTargetingProfileError("unknown or disabled industry");
  if (!geography) throw new InvalidFictionalTargetingProfileError("unknown or disabled geography");
  if (companyProfile.industryId !== industry.id) throw new InvalidFictionalTargetingProfileError("fictional company industry is inconsistent");
  if (companyProfile.companyId !== recipient.companyId || TARGET_COMPANIES.some((item) => item.id === companyProfile.companyId)) throw new InvalidFictionalTargetingProfileError("fictional company reference is inconsistent or public");
  const company: TargetCompany = { id: companyProfile.companyId, canonicalName: recipient.companyName, industryId: industry.id, tier: companyProfile.scenarioTier, enabled: true, recognitionScore: companyProfile.recognitionScore, careerUpsideScore: companyProfile.careerUpsideScore, technicalInterestScore: companyProfile.technicalInterestScore, geographicRelevance: [geography.id], rationale: "Persisted fictional simulation profile", provenance: "fictional-targeting-profile", lastReviewedDate: "2026-09-07", operatorNotes: "Fictional scoring input; not a real-world claim." };
  const candidate: TargetCandidate = { id: recipient.id, company, role, persona, industry, geographyScore: geography.score, roleAlignment: profile.roleAlignment, functionalRelevance: profile.functionalRelevance, yearsExperience: recipient.yearsExperience, sharedSignal: profile.sharedSignal, dataQuality: profile.dataQuality, roleSpecificUpside: profile.roleSpecificUpside };
  const snapshot: RecipientTargetingSnapshot = { fictional: true, prospectId: recipient.id, prospectName: recipient.prospectName, professionalTitle: profile.professionalTitle, companyId: recipient.companyId, companyName: recipient.companyName, companyTier: companyProfile.scenarioTier, roleFamilyId: roleFamily.id, desiredRoleId: role.id, personaId: persona.id, industryId: industry.id, industryDisplayName: industry.displayName, geographyId: geography.id, geographyDisplayName: geography.displayName, yearsExperience: recipient.yearsExperience, roleAlignment: profile.roleAlignment, functionalRelevance: profile.functionalRelevance, sharedSignal: profile.sharedSignal, dataQuality: profile.dataQuality, roleSpecificUpside: profile.roleSpecificUpside, companyRecognition: companyProfile.recognitionScore, companyCareerUpside: companyProfile.careerUpsideScore, companyTechnicalInterest: companyProfile.technicalInterestScore, targetingProfileVersion: profile.profileVersion, companyProfileVersion: companyProfile.profileVersion };
  return { candidate, snapshot };
}

export function generateDraftsForRun(repository: DraftStudioRepository, runId: string, now: () => Date): DraftRecord[] {
  if (!repository.listCompletedRuns().some((run) => run.id === runId)) throw new Error(`Completed fictional simulation run not found: ${runId}`);
  const prepared = repository.listSelectedRecipients(runId).map((recipient) => {
    const { candidate, snapshot } = candidateFromProfile(recipient);
    const template = selectTemplate(recipient, { runId });
    const rendered = renderDraft(recipient, repository.listEvidence(recipient.id), now, template);
    const score = scoreTarget(candidate);
    if (!score.eligible) throw new InvalidFictionalTargetingProfileError(score.rejectionCode ?? "target failed scoring gate");
    return { id: `draft-${runId}-${recipient.id}-${template.id}-${template.version}`, recipient, runId, rendered, score, snapshot, status: "generated" as const };
  });
  return repository.transaction(() => prepared.map((draft) => repository.saveDraft(draft)));
}
export function getDraftStudioData(repository: DraftStudioRepository): import("./types").DraftStudioData { return { runs: repository.listCompletedRuns(), drafts: repository.listDrafts(), companies: repository.listTargetCompanies() }; }
export const ENABLED_ROLE_FAMILIES = ROLE_FAMILIES.filter((family) => family.enabled);

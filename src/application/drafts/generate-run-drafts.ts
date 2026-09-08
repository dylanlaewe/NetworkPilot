import { renderDraft, selectTemplate } from "@/domain/drafting";
import { GEOGRAPHY_PREFERENCES, INDUSTRY_PREFERENCES, ROLE_FAMILIES } from "@/domain/targeting";
import type { DraftRecord, DraftStudioRepository, RecipientTargetingSnapshot } from "./types";

export const FICTIONAL_TARGETING_PROFILE_INVALID = "FICTIONAL_TARGETING_PROFILE_INVALID" as const;
export class InvalidFictionalTargetingProfileError extends Error {
  readonly code = FICTIONAL_TARGETING_PROFILE_INVALID;
  constructor(detail: string) { super(`Invalid fictional targeting profile: ${detail}`); this.name = "InvalidFictionalTargetingProfileError"; }
}

export function generateDraftsForRun(repository: DraftStudioRepository, runId: string, now: () => Date): DraftRecord[] {
  const plan=repository.findCampaignPlan(runId);
  if (!repository.listCompletedRuns().some((run) => run.id === runId)||!plan||!(plan.status==="planned"||plan.status==="drafted")) throw new Error(`Completed targeting-first campaign plan not found or not draft-ready: ${runId}`);
  const prepared = repository.listSelectedRecipients(runId).map((recipient) => {
    const planned=recipient.planSnapshot;
    if(!planned||!planned.selected||planned.hardGateRejectionCode)throw new InvalidFictionalTargetingProfileError("recipient is not eligible in the persisted plan");
    const snapshot:RecipientTargetingSnapshot={fictional:true,prospectId:planned.prospectId,prospectName:planned.prospectName,professionalTitle:planned.professionalTitle,normalizedTitle:planned.normalizedTitle,classificationVersion:planned.classificationVersion,classificationExplanationCodes:planned.classificationExplanationCodes,classificationReviewCode:planned.classificationReviewCode,companyId:planned.companyId,companyName:planned.fictionalEmployer.name,strategyCompanyName:planned.strategyCompanyMatch?.canonicalName??null,companyMatchMethod:planned.matchMethod,companyTier:planned.companyTier as RecipientTargetingSnapshot["companyTier"],roleFamilyId:planned.desiredRoleFamily,desiredRoleId:planned.desiredRoleId,personaId:planned.recipientPersona,industryId:planned.industry,industryDisplayName:INDUSTRY_PREFERENCES.find((item)=>item.id===planned.industry)?.displayName??planned.industry,geographyId:planned.geography,geographyDisplayName:GEOGRAPHY_PREFERENCES.find((item)=>item.id===planned.geography)?.displayName??planned.geography,yearsExperience:planned.yearsExperience,roleAlignment:planned.roleAlignment,functionalRelevance:planned.functionalRelevance,sharedSignal:planned.sharedSignal,dataQuality:planned.dataQuality,roleSpecificUpside:planned.roleSpecificUpside,companyRecognition:planned.companyRecognition,companyCareerUpside:planned.companyCareerUpside,companyTechnicalInterest:planned.companyTechnicalInterest,targetingProfileVersion:planned.targetingProfileVersion,companyProfileVersion:planned.companyProfileVersion};
    const template = selectTemplate(recipient, { runId });
    const rendered = renderDraft(recipient, repository.listEvidence(recipient.id), now, template);
    const score = {eligible:true,total:planned.totalScore,version:planned.targetingVersion,components:planned.components,explanationCodes:planned.explanationCodes} as const;
    return { id: `draft-${runId}-${recipient.id}-${template.id}-${template.version}`, recipient, runId, rendered, score, snapshot, status: "generated" as const };
  });
  return repository.transaction(() => {const drafts=prepared.map((draft) => repository.saveDraft(draft));repository.updateCampaignPlanStatus(runId,"drafted",now());return drafts;});
}
export function getDraftStudioData(repository: DraftStudioRepository): import("./types").DraftStudioData { return { runs: repository.listCompletedRuns(), drafts: repository.listDrafts(), companies: repository.listTargetCompanies() }; }
export const ENABLED_ROLE_FAMILIES = ROLE_FAMILIES.filter((family) => family.enabled);

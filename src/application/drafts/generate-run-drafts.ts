import { renderDraft, selectTemplate } from "@/domain/drafting";
import { CONTACT_PERSONAS, INDUSTRY_PREFERENCES, ROLE_FAMILIES, TARGET_ROLES, scoreTarget } from "@/domain/targeting";
import type { TargetCandidate, TargetCompany } from "@/domain/targeting";
import type { DraftRecord, DraftStudioRepository, SelectedDraftRecipient } from "./types";

const industryMap:Record<string,string>={Consulting:"consulting",Finance:"financial-services",Commodities:"commodities-energy",Technology:"technology-ai",Defense:"defense-aerospace"};
const familyMap:Record<string,string>={Consulting:"industry-professional",Finance:"industry-professional",Commodities:"industry-professional",Technology:"data-analytics",Defense:"technical-product"};
export function strategyForRecipient(recipient:SelectedDraftRecipient):TargetCandidate {
  const industryId=industryMap[recipient.industry]??"complex-operations";
  const familyId=familyMap[recipient.industry]??"data-analytics";
  const role=TARGET_ROLES.find((item)=>item.familyId===familyId&&item.enabled)!;
  const persona=CONTACT_PERSONAS.find((item)=>item.id==="experienced-practitioner")!;
  const industry=INDUSTRY_PREFERENCES.find((item)=>item.id===industryId)!;
  const company:TargetCompany={id:`fictional-scenario-${recipient.id}`,canonicalName:recipient.companyName,industryId,tier:"tier-2",enabled:true,recognitionScore:72,careerUpsideScore:78,technicalInterestScore:82,geographicRelevance:["remote-us"],rationale:"Fictional simulation-only company scenario.",provenance:"Deterministic fictional dataset",lastReviewedDate:"2026-09-07",operatorNotes:"Not part of the real target-company registry."};
  return {id:recipient.id,company,role,persona,industry,geographyScore:70,roleAlignment:88,functionalRelevance:85,yearsExperience:recipient.yearsExperience,sharedSignal:55,dataQuality:100,roleSpecificUpside:90};
}
export function generateDraftsForRun(repository:DraftStudioRepository,runId:string,now:()=>Date):DraftRecord[] {
  if(!repository.listCompletedRuns().some((run)=>run.id===runId))throw new Error(`Completed fictional simulation run not found: ${runId}`);
  return repository.listSelectedRecipients(runId).map((recipient)=>{
    const familyId=familyMap[recipient.industry]??"data-analytics";
    const enriched={...recipient,roleFamilyId:familyId,industryId:industryMap[recipient.industry]??"complex-operations",personaId:"experienced-practitioner"};
    const template=selectTemplate(enriched);
    const rendered=renderDraft(enriched,repository.listEvidence(recipient.id),now,template);
    const score=scoreTarget(strategyForRecipient(enriched));
    return repository.saveDraft({id:`draft-${runId}-${recipient.id}-${template.id}-${template.version}`,recipient:enriched,runId,rendered,score,status:"generated"});
  });
}
export function getDraftStudioData(repository:DraftStudioRepository):import("./types").DraftStudioData { return {runs:repository.listCompletedRuns(),drafts:repository.listDrafts(),companies:repository.listTargetCompanies()}; }
export const ENABLED_ROLE_FAMILIES=ROLE_FAMILIES.filter((family)=>family.enabled);

import type { DraftRecipient, PersonalizationEvidence, RenderedDraft } from "@/domain/drafting";
import type { ScoreComponent, TargetCompany, TargetingScore } from "@/domain/targeting";
import type { RunSummary } from "@/application/simulation/types";
export type DraftStatus="generated"|"needs-review"|"approved-for-simulation"|"rejected"|"superseded";
export interface DraftRecord { id:string; prospectId:string; runId:string|null; templateId:string; templateVersion:string; subject:string; body:string; factIds:string[]; evidenceIds:string[]; evidence:PersonalizationEvidence[]; scoreVersion:string; score:number; scoreComponents:ScoreComponent[]; status:DraftStatus; createdAt:string; updatedAt:string; industry:string; roleFamilyId:string; companyName:string; prospectName:string; }
export interface SelectedDraftRecipient extends DraftRecipient { prospectName:string; industry:string; yearsExperience:number; relevanceScore:number; }
export interface DraftStudioRepository {
  listCompletedRuns():RunSummary[];
  listSelectedRecipients(runId:string):SelectedDraftRecipient[];
  listEvidence(prospectId:string):PersonalizationEvidence[];
  saveDraft(input:{id:string;recipient:SelectedDraftRecipient;runId:string;rendered:RenderedDraft;score:TargetingScore;status:DraftStatus}):DraftRecord;
  listDrafts(filters?:{runId?:string;industry?:string;roleFamilyId?:string;templateId?:string;status?:DraftStatus}):DraftRecord[];
  updateDraftStatus(id:string,status:"approved-for-simulation"|"rejected",at:Date):void;
  listTargetCompanies():TargetCompany[];
}
export interface DraftStudioData { runs:RunSummary[]; drafts:DraftRecord[]; companies:TargetCompany[]; }

import type { DraftRecipient, PersonalizationEvidence, RenderedDraft } from "@/domain/drafting";
import type { CompanyTier, ScoreComponent, TargetCompany, TargetingScore } from "@/domain/targeting";
import type { RunSummary } from "@/application/simulation/types";
import type { TargetingPlanSnapshot } from "@/domain/planning";
export type DraftStatus = "generated" | "needs-review" | "approved-for-simulation" | "rejected" | "superseded";
export interface RecipientTargetingSnapshot { fictional: true; prospectId: string; prospectName: string; professionalTitle: string; normalizedTitle?:string; classificationVersion?:string; classificationExplanationCodes?:string[]; classificationReviewCode?:string|null;recipientFunctionVersion?:string;recipientRelevanceVersion?:string;primaryRecipientFunction?:string;secondaryRecipientFunctions?:string[];preciseTargetRoleId?:string|null; companyId: string; companyName: string; strategyCompanyName?:string|null; companyMatchMethod?:TargetingPlanSnapshot["matchMethod"]; companyTier: Exclude<CompanyTier,"excluded"|"unreviewed">; roleFamilyId: string; desiredRoleId: string; personaId: string; industryId: string; industryDisplayName: string; geographyId: string; geographyDisplayName: string; yearsExperience: number; roleAlignment: number; functionalRelevance: number; sharedSignal: number; dataQuality: number; roleSpecificUpside: number; companyRecognition: number; companyCareerUpside: number; companyTechnicalInterest: number; targetingProfileVersion: string; companyProfileVersion: string; }
export interface DraftRecord { id: string; prospectId: string; runId: string | null; templateId: string; templateVersion: string; templateCatalogVersion: string; subject: string; body: string; factIds: string[]; evidenceIds: string[]; evidence: PersonalizationEvidence[]; scoreVersion: string; score: number; scoreComponents: ScoreComponent[]; explanationCodes: string[]; rejectionCode: string | null; recipientSnapshot: RecipientTargetingSnapshot; industry: string; roleFamilyId: string; companyName: string; prospectName: string; status: DraftStatus; createdAt: string; updatedAt: string; }
export interface SelectedDraftRecipient extends DraftRecipient { prospectName: string; companyId: string; yearsExperience: number; planSnapshot:TargetingPlanSnapshot; }
export interface DraftStudioRepository {
  transaction<T>(work: () => T): T;
  listCompletedRuns(): RunSummary[];
  findCampaignPlan(planId:string):import("@/application/simulation/types").CampaignPlanView|null;
  updateCampaignPlanStatus(planId:string,status:import("@/domain/planning").CampaignPlanStatus,at:Date):void;
  listSelectedRecipients(runId: string): SelectedDraftRecipient[];
  listEvidence(prospectId: string): PersonalizationEvidence[];
  saveDraft(input: { id: string; recipient: SelectedDraftRecipient; runId: string; rendered: RenderedDraft; score: TargetingScore; snapshot: RecipientTargetingSnapshot; status: DraftStatus }): DraftRecord;
  listDrafts(filters?: { runId?: string; industry?: string; roleFamilyId?: string; templateId?: string; status?: DraftStatus }): DraftRecord[];
  updateDraftStatus(id: string, status: "approved-for-simulation" | "rejected", at: Date): void;
  listTargetCompanies(): TargetCompany[];
}
export interface DraftStudioData { runs: RunSummary[]; drafts: DraftRecord[]; companies: TargetCompany[]; }

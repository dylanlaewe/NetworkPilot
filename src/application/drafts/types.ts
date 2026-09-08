import type { DraftRecipient, PersonalizationEvidence, RenderedDraft } from "@/domain/drafting";
import type { CompanyTier, ScoreComponent, TargetCompany, TargetingScore } from "@/domain/targeting";
import type { RunSummary } from "@/application/simulation/types";
export type DraftStatus = "generated" | "needs-review" | "approved-for-simulation" | "rejected" | "superseded";
export interface FictionalCompanyProfile { companyId: string; industryId: string; scenarioTier: Exclude<CompanyTier, "excluded" | "unreviewed">; recognitionScore: number; careerUpsideScore: number; technicalInterestScore: number; profileVersion: string; }
export interface FictionalTargetingProfile { prospectId: string; professionalTitle: string; roleFamilyId: string; desiredRoleId: string; personaId: string; geographyId: string; industryId: string; roleAlignment: number; functionalRelevance: number; sharedSignal: number; dataQuality: number; roleSpecificUpside: number; profileVersion: string; }
export interface RecipientTargetingSnapshot { fictional: true; prospectId: string; prospectName: string; professionalTitle: string; companyId: string; companyName: string; companyTier: FictionalCompanyProfile["scenarioTier"]; roleFamilyId: string; desiredRoleId: string; personaId: string; industryId: string; industryDisplayName: string; geographyId: string; geographyDisplayName: string; yearsExperience: number; roleAlignment: number; functionalRelevance: number; sharedSignal: number; dataQuality: number; roleSpecificUpside: number; companyRecognition: number; companyCareerUpside: number; companyTechnicalInterest: number; targetingProfileVersion: string; companyProfileVersion: string; }
export interface DraftRecord { id: string; prospectId: string; runId: string | null; templateId: string; templateVersion: string; templateCatalogVersion: string; subject: string; body: string; factIds: string[]; evidenceIds: string[]; evidence: PersonalizationEvidence[]; scoreVersion: string; score: number; scoreComponents: ScoreComponent[]; explanationCodes: string[]; rejectionCode: string | null; recipientSnapshot: RecipientTargetingSnapshot; industry: string; roleFamilyId: string; companyName: string; prospectName: string; status: DraftStatus; createdAt: string; updatedAt: string; }
export interface SelectedDraftRecipient extends DraftRecipient { prospectName: string; companyId: string; yearsExperience: number; relevanceScore: number; targetingProfile: FictionalTargetingProfile; companyProfile: FictionalCompanyProfile; }
export interface DraftStudioRepository {
  transaction<T>(work: () => T): T;
  listCompletedRuns(): RunSummary[];
  listSelectedRecipients(runId: string): SelectedDraftRecipient[];
  listEvidence(prospectId: string): PersonalizationEvidence[];
  saveDraft(input: { id: string; recipient: SelectedDraftRecipient; runId: string; rendered: RenderedDraft; score: TargetingScore; snapshot: RecipientTargetingSnapshot; status: DraftStatus }): DraftRecord;
  listDrafts(filters?: { runId?: string; industry?: string; roleFamilyId?: string; templateId?: string; status?: DraftStatus }): DraftRecord[];
  updateDraftStatus(id: string, status: "approved-for-simulation" | "rejected", at: Date): void;
  listTargetCompanies(): TargetCompany[];
}
export interface DraftStudioData { runs: RunSummary[]; drafts: DraftRecord[]; companies: TargetCompany[]; }

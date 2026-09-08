import type { CandidateInput } from "@/domain/candidates";
import type { Prospect } from "@/domain/outreach";
import type { TargetCandidate, TargetingScore } from "@/domain/targeting";

export const CAMPAIGN_PLAN_VERSION = "campaign-plan-v1";
export type CampaignPlanStatus = "created"|"evaluated"|"planned"|"drafted"|"simulation-approved"|"cancelled"|"failed";
export interface CompanyMatchSnapshot { registryCompanyId: string; canonicalName: string; tier: "tier-1"|"tier-2"|"tier-3"|"excluded"|"unreviewed"; method: "domain"|"simulation-alias"; provenance: string; fictionalScenario: true; }
export interface PlanningCandidate { prospect: Prospect; normalized: CandidateInput; target: TargetCandidate; professionalTitle: string; roleFamilyId: string; desiredRoleId: string; personaId: string; industryId: string; geographyId: string; targetingProfileVersion: string; companyProfileVersion: string; companyMatch: CompanyMatchSnapshot | null; }
export interface TargetingPlanSnapshot { planVersion:string; targetingVersion:string; candidateId:string; externalSourceReference:string; sourceType:string; retrievedAt:string; rawRecordFingerprint:string; prospectId:string; prospectName:string; professionalTitle:string; companyId:string; companyName:string; companyMatch:CompanyMatchSnapshot|null; desiredRoleFamily:string; desiredRoleId:string; recipientPersona:string; industry:string; geography:string; yearsExperience:number; companyTier:string|null; companyRecognition:number; companyCareerUpside:number; companyTechnicalInterest:number; roleAlignment:number; functionalRelevance:number; roleSpecificUpside:number; dataQuality:number; sharedSignal:number; totalScore:number; components:TargetingScore["components"]; explanationCodes:string[]; hardGateRejectionCode:string|null; rankBeforeDiversification:number|null; selected:boolean; selectionReason:string; targetingProfileVersion:string; companyProfileVersion:string; }
export interface DiversificationConfig { industrySoftCap:number; roleFamilySoftCap:number; minimumScore:number; }
export interface QuotaRelaxation { code:"industry-soft-cap-relaxed"|"role-family-soft-cap-relaxed"; candidateId:string; reason:string; }
export interface DailyPlanResult { target:number; decisions:TargetingPlanSnapshot[]; selected:TargetingPlanSnapshot[]; quotaRelaxations:QuotaRelaxation[]; qualifiedPopulation:number; }

export type PriorityTier = "highest" | "secondary" | "specialized";
export type SeniorityBand = "early-career" | "associate" | "mid-level";
export interface RoleFamily { id: string; displayName: string; priorityTier: PriorityTier; enabled: boolean; industries: string[]; themes: string[]; notes: string; }
export interface TargetRole { id: string; familyId: string; displayName: string; priorityTier: PriorityTier; enabled: boolean; industries: string[]; themes: string[]; seniorityBand: SeniorityBand; notes: string; positiveTitlePatterns: string[]; negativeTitlePatterns: string[]; }
export interface ContactPersona { id: string; displayName: string; enabled: boolean; minimumYearsExperience: number; maximumYearsExperience: number; priority: number; notes: string; }
export interface IndustryPreference { id: string; displayName: string; tier: "primary" | "secondary"; enabled: boolean; score: number; }
export interface GeographyPreference { id: string; displayName: string; enabled: boolean; score: number; notes: string; }
export type CompanyTier = "tier-1" | "tier-2" | "tier-3" | "excluded" | "unreviewed";
export interface TargetCompany { id: string; canonicalName: string; industryId: string; tier: CompanyTier; enabled: boolean; recognitionScore: number; careerUpsideScore: number; technicalInterestScore: number; geographicRelevance: string[]; rationale: string; provenance: string; lastReviewedDate: string; operatorNotes: string; }
export const SCORE_COMPONENTS = ["company-desirability", "desired-role-alignment", "recipient-functional-relevance", "recipient-experience", "industry-priority", "geographic-relevance", "shared-signal", "data-quality"] as const;
export type ScoreComponentId = (typeof SCORE_COMPONENTS)[number];
export interface TargetingWeights { companyDesirability: number; desiredRoleAlignment: number; recipientFunctionalRelevance: number; recipientExperience: number; industryPriority: number; geographicRelevance: number; sharedSignal: number; dataQuality: number; }
export interface TargetCandidate { id: string; company: TargetCompany | null; role: TargetRole; preciseRoleId?:string|null; recipientRelevance?:{score:number;version:"recipient-relevance-v1"}; persona: ContactPersona; industry: IndustryPreference; geographyScore: number; roleAlignment: number; functionalRelevance: number; yearsExperience: number; sharedSignal: number; dataQuality: number; roleSpecificUpside: number; }
export interface ScoreComponent { id: ScoreComponentId; raw: number; weight: number; weighted: number; explanationCode: string; }
export interface TargetingScore { eligible: boolean; total: number; version: string; components: ScoreComponent[]; explanationCodes: string[]; rejectionCode?: string; }

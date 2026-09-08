export const CANDIDATE_SOURCE_TYPES = ["fictional-fixture", "authorized-adapter"] as const;
export type CandidateSourceType = (typeof CANDIDATE_SOURCE_TYPES)[number];
export type EmailVerificationStatus = "verified" | "unverified" | "unknown";

export interface CandidateInput {
  internalId: string;
  externalSourceReference: string;
  sourceType: CandidateSourceType;
  retrievedAt: string;
  firstName: string;
  lastName: string;
  professionalTitle: string;
  employerName: string;
  employerDomain?: string;
  industry: string;
  geography: string;
  yearsExperience?: number;
  experienceRange?: { minimum: number; maximum: number };
  professionalEmail: string;
  emailVerificationStatus: EmailVerificationStatus;
  roleSignals: string[];
  sharedSignals: string[];
  dataQualityIndicators: string[];
  publicCompanyRegistryMatch?: { companyId: string; matchedBy: "domain" | "simulation-alias"; reviewed: boolean };
  rawRecordFingerprint: string;
}

export interface CandidateClassification {
  normalizedTitle: string;
  roleFamilyId?: string;
  desiredRoleId?: string;
  personaId?: string;
  industryId?: string;
  geographyId?: string;
  yearsExperience?: number;
  explanationCodes: string[];
  reviewCode?: string;
}

export const CLASSIFICATION_VERSION = "classification-v1";
export interface SuppliedCandidateClassification { roleFamilyId:string; desiredRoleId:string; personaId:string; industryId:string; geographyId:string; }
export interface CandidateScoringSignals { roleAlignment:number; functionalRelevance:number; sharedSignal:number; roleSpecificUpside:number; }
export interface CandidateSourceRecord {
  input:CandidateInput;
  fictionalEmployer:{id:string;name:string;industryId:string};
  suppliedClassification:SuppliedCandidateClassification;
  scoringSignals:CandidateScoringSignals;
  controls:{suppressed:boolean;optedOut:boolean};
  targetingProfileVersion:string;
  companyProfileVersion:string;
}
export interface NormalizedCandidateRecord {
  source:CandidateInput;
  fictionalEmployer:{id:string;name:string;industryId:string};
  stableFingerprint:string;
  normalizedTitle:string;
  yearsExperience:number|null;
  roleFamilyId:string|null;
  desiredRoleId:string|null;
  recipientPersonaId:string|null;
  industryId:string|null;
  geographyId:string|null;
  companyMatch:{companyId:string;canonicalName:string;tier:string;enabled:boolean;industryId:string;recognitionScore:number;careerUpsideScore:number;technicalInterestScore:number;reviewStatus:"reviewed"|"unreviewed";method:"domain"|"exact-name"|"simulation-alias";provenance:string}|null;
  dataQualityScore:number;
  sharedSignal:number;
  roleAlignment:number;
  functionalRelevance:number;
  roleSpecificUpside:number;
  explanationCodes:string[];
  reviewCode:string|null;
  rejectionCode:string|null;
  classificationVersion:typeof CLASSIFICATION_VERSION;
  targetingProfileVersion:string;
  companyProfileVersion:string;
}

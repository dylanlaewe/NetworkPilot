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

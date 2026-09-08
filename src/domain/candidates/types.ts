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
/** Legacy simulation planning envelope. Provider-shaped input uses CandidateSourceRecord below. */
export interface SimulationCandidateSourceRecord {
  input:CandidateInput;
  fictionalEmployer:{id:string;name:string;industryId:string};
  suppliedClassification:SuppliedCandidateClassification;
  scoringSignals:CandidateScoringSignals;
  controls:{suppressed:boolean;optedOut:boolean};
  targetingProfileVersion:string;
  companyProfileVersion:string;
}
export type DatasetClassification="fictional"|"provider-shaped-fixture"|"authorized-provider";
export type CandidateLifecycleState="imported"|"normalized"|"review-required"|"eligible"|"rejected"|"suppressed"|"planned";
export interface FieldProvenance { sourceField:string; observedAt:string; confidence:"high"|"medium"|"low"; }
export interface EmploymentPeriod {startDate?:string;endDate?:string;current?:boolean;}
export type ExperienceEvidence={kind:"exact";years:number;sourceField:string}|{kind:"range";minimum:number;maximum:number;sourceField:string}|{kind:"approximate";years:number;sourceField:string}|{kind:"employment-history";periods:EmploymentPeriod[];referenceDate:string;sourceField:string}|{kind:"unknown";sourceField:string};
export interface CandidateSourceRecord {
  sourceProviderId:string; providerRecordId:string; datasetClassification:DatasetClassification;
  person:{firstName:string;lastName:string}; currentTitle:string; currentOrganization:{name:string;domain?:string};
  location:string; industrySignals:string[]; experienceEvidence:ExperienceEvidence[];
  email:{address:string;verificationStatus:EmailVerificationStatus}; sourceTimestamps:{retrievedAt:string;updatedAt?:string};
  fieldProvenance:Record<string,FieldProvenance>; consent:{suppressed:boolean;optedOut:boolean;evidence?:string};
  sourceFingerprint:string; simulationAlias?:{strategyCompanyId:string;reviewed:boolean;note:string};
  providerMetadata?:{adapterVersion:string;responseMappingVersion:string;requestContractVersion:string;importArchitectureVersion:string;providerSeniority?:string};
}
export interface ExperienceInterpretation { minimumSupportedYears:number|null; maximumSupportedYears:number|null; kind:"exact"|"bounded"|"inferred"|"unknown"; evidence:ExperienceEvidence[]; interpretationVersion:"experience-v1"; confidence:"high"|"medium"|"low"; reviewState:"accepted"|"review-required"; explanationCodes:string[]; }
export interface SpecificRoleClassification { normalizedTitle:string; specificRoleId:string|null; roleFamilyId:string|null; matchedSignals:string[]; classificationVersion:"role-classification-v2"; reviewCode:string|null; }
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

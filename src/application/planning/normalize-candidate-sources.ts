import { CANDIDATE_SOURCE_TYPES, classifyCandidate, CLASSIFICATION_VERSION, matchCompanyRegistry, scoreCandidateDataQuality, type CandidateSourceRecord, type NormalizedCandidateRecord } from "@/domain/candidates";
import type { Prospect } from "@/domain/outreach";
import type { PlanningCandidate } from "@/domain/planning";
import { CONTACT_PERSONAS, DEFAULT_TARGETING_WEIGHTS, GEOGRAPHY_PREFERENCES, INDUSTRY_PREFERENCES, TARGET_ROLES, validateWeights, type TargetCompany, type TargetingWeights } from "@/domain/targeting";

export interface CandidatePipelineConfig { classificationVersion:string; minimumScore:number; weights:TargetingWeights; companyDomains:Readonly<Record<string,string>>; }
export const DEFAULT_CANDIDATE_PIPELINE_CONFIG:Readonly<CandidatePipelineConfig>={classificationVersion:CLASSIFICATION_VERSION,minimumScore:55,weights:DEFAULT_TARGETING_WEIGHTS,companyDomains:{}};
const fingerprintPattern=/^[a-zA-Z0-9][a-zA-Z0-9:._-]{7,127}$/;
const bounded=(value:number)=>Number.isFinite(value)&&value>=0&&value<=100;

export function validateCandidatePipelineConfig(config:CandidatePipelineConfig):void{
  if(config.classificationVersion!==CLASSIFICATION_VERSION)throw new RangeError(`Unsupported classification version: ${config.classificationVersion}`);
  if(!Number.isFinite(config.minimumScore)||config.minimumScore<0||config.minimumScore>100)throw new RangeError("minimumScore must be finite and between 0 and 100");
  validateWeights(config.weights);
}

export function normalizeCandidateSources(records:readonly CandidateSourceRecord[],registry:readonly TargetCompany[],config:CandidatePipelineConfig=DEFAULT_CANDIDATE_PIPELINE_CONFIG):PlanningCandidate[]{
  validateCandidatePipelineConfig(config);
  const fingerprints=new Set<string>(),people=new Set<string>(),sourceIds=new Map<string,string>();
  const ordered=[...records].sort((a,b)=>a.input.internalId.localeCompare(b.input.internalId)||a.input.externalSourceReference.localeCompare(b.input.externalSourceReference));
  const results:PlanningCandidate[]=[];
  for(const record of ordered){
    const {input}=record;
    const existingFingerprint=sourceIds.get(input.internalId);
    if(existingFingerprint===input.rawRecordFingerprint)continue;
    if(existingFingerprint)throw new RangeError(`Conflicting source records for internal ID: ${input.internalId}`);
    sourceIds.set(input.internalId,input.rawRecordFingerprint);
    const classification=classifyCandidate(input);
    const companyResult=matchCompanyRegistry(input,registry,config.companyDomains);
    const malformedFingerprint=!fingerprintPattern.test(input.rawRecordFingerprint);
    const invalidTimestamp=Number.isNaN(new Date(input.retrievedAt).getTime());
    const required=[input.internalId,input.externalSourceReference,input.sourceType,input.firstName,input.lastName,input.professionalTitle,input.employerName,input.industry,input.geography,input.professionalEmail];
    const invalidInput=required.some((value)=>!String(value).trim())||!CANDIDATE_SOURCE_TYPES.includes(input.sourceType)||!(["verified","unverified","unknown"] as const).includes(input.emailVerificationStatus)||!input.professionalEmail.includes("@")||!Object.values(record.scoringSignals).every(bounded);
    const personKey=`${input.firstName.trim().toLowerCase()}|${input.lastName.trim().toLowerCase()}|${record.fictionalEmployer.id}`;
    let rejectionCode:string|null=invalidInput?"candidate-input-invalid":invalidTimestamp?"provenance-timestamp-invalid":malformedFingerprint?"fingerprint-invalid":null;
    if(!rejectionCode&&fingerprints.has(input.rawRecordFingerprint))rejectionCode="duplicate-fingerprint";
    if(!rejectionCode&&people.has(personKey))rejectionCode="duplicate-person";
    fingerprints.add(input.rawRecordFingerprint);people.add(personKey);
    const supplied=record.suppliedClassification;
    const derived=[classification.roleFamilyId,classification.desiredRoleId,classification.personaId,classification.industryId,classification.geographyId];
    const claimed=[supplied.roleFamilyId,supplied.desiredRoleId,supplied.personaId,supplied.industryId,supplied.geographyId];
    if(!rejectionCode&&derived.some((value,index)=>value!==claimed[index]))rejectionCode="classification-conflict";
    if(!rejectionCode&&classification.reviewCode)rejectionCode=classification.reviewCode;
    if(!rejectionCode&&!companyResult.company)rejectionCode=companyResult.explanationCode;
    if(!rejectionCode&&(classification.industryId!==record.fictionalEmployer.industryId||classification.industryId!==companyResult.company?.industryId))rejectionCode="industry-conflict";
    if(!rejectionCode&&record.controls.suppressed)rejectionCode="suppressed";
    if(!rejectionCode&&record.controls.optedOut)rejectionCode="opted-out";
    if(!rejectionCode&&input.emailVerificationStatus!=="verified")rejectionCode="email-unverified";
    if(!rejectionCode&&(classification.yearsExperience??0)<5)rejectionCode="insufficient-experience";
    const normalized:NormalizedCandidateRecord={source:input,fictionalEmployer:record.fictionalEmployer,stableFingerprint:input.rawRecordFingerprint,normalizedTitle:classification.normalizedTitle,yearsExperience:classification.yearsExperience??null,roleFamilyId:classification.roleFamilyId??null,desiredRoleId:classification.desiredRoleId??null,recipientPersonaId:classification.personaId??null,industryId:classification.industryId??null,geographyId:classification.geographyId??null,companyMatch:companyResult.company?{companyId:companyResult.company.id,canonicalName:companyResult.company.canonicalName,tier:companyResult.company.tier,enabled:companyResult.company.enabled,industryId:companyResult.company.industryId,recognitionScore:companyResult.company.recognitionScore,careerUpsideScore:companyResult.company.careerUpsideScore,technicalInterestScore:companyResult.company.technicalInterestScore,reviewStatus:companyResult.company.tier==="unreviewed"?"unreviewed":"reviewed",method:companyResult.method!,provenance:companyResult.company.provenance}:null,dataQualityScore:scoreCandidateDataQuality(input),sharedSignal:record.scoringSignals.sharedSignal,roleAlignment:record.scoringSignals.roleAlignment,functionalRelevance:record.scoringSignals.functionalRelevance,roleSpecificUpside:record.scoringSignals.roleSpecificUpside,explanationCodes:[...classification.explanationCodes,companyResult.explanationCode,"data-quality-derived"],reviewCode:classification.reviewCode??null,rejectionCode,classificationVersion:CLASSIFICATION_VERSION,targetingProfileVersion:record.targetingProfileVersion,companyProfileVersion:record.companyProfileVersion};
    const role=TARGET_ROLES.find((item)=>item.id===normalized.desiredRoleId),persona=CONTACT_PERSONAS.find((item)=>item.id===normalized.recipientPersonaId),industry=INDUSTRY_PREFERENCES.find((item)=>item.id===normalized.industryId),geography=GEOGRAPHY_PREFERENCES.find((item)=>item.id===normalized.geographyId),matched=companyResult.company;
    const company=matched?{...matched}:null;
    const prospect:Prospect={id:input.internalId,firstName:input.firstName,lastName:input.lastName,companyId:record.fictionalEmployer.id,companyName:record.fictionalEmployer.name,industry:({consulting:"Consulting","financial-services":"Finance","commodities-energy":"Commodities","technology-ai":"Technology","defense-aerospace":"Defense"}[record.fictionalEmployer.industryId]??"Technology") as Prospect["industry"],email:input.professionalEmail,emailVerified:input.emailVerificationStatus==="verified",yearsExperience:normalized.yearsExperience??0,suppressed:record.controls.suppressed,optedOut:record.controls.optedOut,relevanceScore:0};
    const target=!rejectionCode&&company&&role&&persona&&industry?{id:input.internalId,company,role,persona,industry,geographyScore:geography?.score??0,roleAlignment:normalized.roleAlignment,functionalRelevance:normalized.functionalRelevance,yearsExperience:normalized.yearsExperience??0,sharedSignal:normalized.sharedSignal,dataQuality:normalized.dataQualityScore,roleSpecificUpside:normalized.roleSpecificUpside}:null;
    results.push({prospect,normalized:input,normalizedRecord:normalized,target,professionalTitle:normalized.normalizedTitle,roleFamilyId:normalized.roleFamilyId??"",desiredRoleId:normalized.desiredRoleId??"",personaId:normalized.recipientPersonaId??"",industryId:normalized.industryId??"",geographyId:normalized.geographyId??"",targetingProfileVersion:normalized.targetingProfileVersion,companyProfileVersion:normalized.companyProfileVersion,companyMatch:matched&&companyResult.method?{registryCompanyId:matched.id,canonicalName:matched.canonicalName,tier:matched.tier,method:companyResult.method,provenance:matched.provenance,fictionalScenario:true}:null});
  }
  return results;
}

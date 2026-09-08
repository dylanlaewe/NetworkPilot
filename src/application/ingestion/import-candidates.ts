import {classifySpecificRole,interpretExperience,SPECIFIC_ROLE_TAXONOMY,type CandidateSourceRecord} from "@/domain/candidates";
import type {TargetCompany} from "@/domain/targeting";
import type {ImportBatch,ImportBatchInput,ImportedCandidateSnapshot,IngestionRepository} from "./types";
const idPattern=/^[a-z0-9][a-z0-9._:-]{2,127}$/i;
const fingerprintPattern=/^[a-z0-9][a-z0-9._:-]{7,127}$/i;
const canonical=(value:string)=>value.trim().toLowerCase().replace(/^www\./,"");
const safeSnapshot=(records:CandidateSourceRecord[])=>JSON.stringify(records.map((record)=>({provider:record.sourceProviderId,recordId:record.providerRecordId,dataset:record.datasetClassification,fingerprint:record.sourceFingerprint,retrievedAt:record.sourceTimestamps.retrievedAt})).sort((a,b)=>a.recordId.localeCompare(b.recordId)));
export function importCandidateBatch(repository:IngestionRepository,companies:readonly TargetCompany[],input:ImportBatchInput,now=new Date()):ImportBatch{
  if(input.datasetClassification==="authorized-provider")throw new Error("live-provider-import-disabled");
  if(!idPattern.test(input.batchId)||!idPattern.test(input.adapterId)||!fingerprintPattern.test(input.sourceFingerprint))throw new Error("import-identity-invalid");
  const existing=repository.findImportBatchByFingerprint(input.sourceFingerprint);if(existing)return existing;
  const identities=new Map<string,string>();let duplicates=0;
  const candidates:ImportedCandidateSnapshot[]=[];
  for(const source of input.records){
    if(!idPattern.test(source.sourceProviderId)||!idPattern.test(source.providerRecordId)||!fingerprintPattern.test(source.sourceFingerprint)||source.datasetClassification!==input.datasetClassification)throw new Error("source-record-invalid");
    const key=`${source.sourceProviderId}:${source.providerRecordId}`,known=identities.get(key)??repository.findImportedCandidate(source.sourceProviderId,source.providerRecordId)?.source.sourceFingerprint;
    if(known===source.sourceFingerprint){duplicates++;continue;}if(known)throw new Error(`source-record-conflict:${key}`);identities.set(key,source.sourceFingerprint);
    const classification=classifySpecificRole(source.currentTitle),experience=interpretExperience(source.experienceEvidence);
    const name=canonical(source.currentOrganization.name),domain=source.currentOrganization.domain&&canonical(source.currentOrganization.domain);
    const alias=source.simulationAlias?.reviewed?companies.find((c)=>c.id===source.simulationAlias?.strategyCompanyId):undefined;
    const byName=companies.find((c)=>canonical(c.canonicalName)===name),byDomain=domain?companies.find((c)=>canonical(`${c.id}.example.test`)===domain):undefined;
    const company=alias??byDomain??byName;const method=alias?"simulation-alias":byDomain?"domain":byName?"exact-name":null;
    const hard:string[]=[];if(source.consent.suppressed)hard.push("suppressed");if(source.consent.optedOut)hard.push("opted-out");if(source.email.verificationStatus!=="verified")hard.push("email-unverified");if(experience.minimumSupportedYears===null||experience.minimumSupportedYears<5)hard.push("insufficient-or-unknown-experience");if(!company||!company.enabled||company.tier==="excluded"||company.tier==="unreviewed")hard.push("company-unreviewed");
    const review=[classification.reviewCode,...experience.reviewState==="review-required"?experience.explanationCodes:[]].filter(Boolean) as string[];
    const state=source.consent.suppressed?"suppressed":hard.length?"rejected":review.length?"review-required":"eligible";
    candidates.push({id:`zz-import:${source.sourceProviderId}:${source.providerRecordId}`,batchId:input.batchId,source,classification,experience,personaId:experience.minimumSupportedYears!==null&&experience.minimumSupportedYears>=8?"senior-ic":experience.minimumSupportedYears!==null&&experience.minimumSupportedYears>=5?"experienced-practitioner":null,strategyCompanyMatch:company&&method?{companyId:company.id,canonicalName:company.canonicalName,method}:null,dataQualityScore:Math.round([source.person.firstName,source.person.lastName,source.currentTitle,source.currentOrganization.name,source.location,source.email.address].filter(Boolean).length/6*100),gateFailures:[...hard,...review],state,reviewState:"pending"});
  }
  const batch:ImportBatch={id:input.batchId,adapterId:input.adapterId,adapterVersion:input.adapterVersion,datasetClassification:input.datasetClassification,state:"completed",recordCount:input.records.length,acceptedCount:candidates.filter((c)=>c.state==="eligible").length,duplicateCount:duplicates,reviewRequiredCount:candidates.filter((c)=>c.state==="review-required").length,rejectedCount:candidates.filter((c)=>c.state==="rejected"||c.state==="suppressed").length,sourceFingerprint:input.sourceFingerprint,safeSourceSnapshot:safeSnapshot(input.records),normalizationVersion:"provider-normalization-v1",classificationVersion:"role-classification-v2",validationOutcomes:["fixture-only","atomic-import"],failureReasonCodes:[],startedAt:now.toISOString(),completedAt:now.toISOString()};
  repository.transaction(()=>repository.saveImport(batch,candidates));return batch;
}
export function isApprovedSpecificRole(value:string):value is keyof typeof SPECIFIC_ROLE_TAXONOMY{return value in SPECIFIC_ROLE_TAXONOMY;}

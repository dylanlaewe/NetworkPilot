import {importCandidateBatch} from "@/application/ingestion";
import type {CandidateSourceRecord} from "@/domain/candidates";
import {TARGET_COMPANIES} from "@/domain/targeting";
import {SqliteSimulationRepository} from "@/infrastructure/sqlite/database";
import {seedTargetCompanyRegistry} from "@/infrastructure/sqlite/seed";

export const QA_PROFESSIONAL_TITLES=["Data Analyst","Analytics Engineer","Data Engineer","Software Engineer","Machine Learning Engineer","Product Manager","Associate Product Manager","Technical Product Manager","Product Analyst","Product Operations","AI Product Manager","Data Product Manager","Platform Product Manager","Project Manager","Program Manager","Financial Analyst","Strategy Analyst"];
export const QA_RECRUITER_TITLES=["Technical Recruiter","Engineering Recruiter","Campus Recruiter","Product Recruiter","Early Career Recruiter","University Recruiter","Data Recruiter","AI Recruiter"];
// Entirely synthetic identities and reserved domains; never live-provider inputs.
export function seedOfflineReserve(repository:SqliteSimulationRepository,at=new Date("2026-09-21T14:00:00Z")){
  repository.migrate();seedTargetCompanyRegistry(repository);
  const preferred=TARGET_COMPANIES.filter(c=>c.enabled&&c.tier!=="excluded"&&c.tier!=="unreviewed").slice(0,20);
  const records:CandidateSourceRecord[]=Array.from({length:90},(_,i)=>{
    const recruiter=i>=60,known=i<15?preferred[i]:i>=60&&i<65?preferred[i-45]:undefined,id=`offline-qa-${i}`;
    return {sourceProviderId:"apollo",providerRecordId:id,datasetClassification:"authorized-provider",person:{firstName:"Fictional",lastName:`Person ${i}`},currentTitle:recruiter?QA_RECRUITER_TITLES[(i-60)%QA_RECRUITER_TITLES.length]!:QA_PROFESSIONAL_TITLES[i%QA_PROFESSIONAL_TITLES.length]!,currentOrganization:{name:known?.canonicalName??`Fixture ${["Regional Systems","Startup Analytics","Private Software","Midmarket Data"][i%4]} ${i}`,domain:`employer-${i}.example.invalid`,providerId:`fixture-org-${i}`},location:"Boston, Massachusetts, United States",industrySignals:["Software"],experienceEvidence:[{kind:"exact",years:10,sourceField:"fictional-fixture"}],email:{address:`person-${i}@example.invalid`,verificationStatus:"verified"},sourceTimestamps:{retrievedAt:at.toISOString()},fieldProvenance:{},consent:{suppressed:false,optedOut:false},sourceFingerprint:id,...known?{simulationAlias:{strategyCompanyId:known.id,reviewed:true,note:"Fictional QA employer alias; no real person."}}:{}};
  });
  importCandidateBatch(repository,TARGET_COMPANIES,{batchId:"offline-qa-reserve",adapterId:"apollo",adapterVersion:"fictional-qa",datasetClassification:"authorized-provider",sourceFingerprint:"offline-qa-reserve-v1",records,authorizedProviderAccess:{enabled:true,providerId:"apollo"}},at);
  return repository.listImportedCandidates();
}

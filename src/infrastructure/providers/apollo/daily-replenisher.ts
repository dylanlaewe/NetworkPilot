import {createHash} from "node:crypto";
import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {importCandidateBatch,type ImportedCandidateSnapshot} from "@/application/ingestion";
import type {DailyRefreshReplenisher,RefreshCandidate} from "@/application/daily-refresh";
import {TARGET_COMPANIES} from "@/domain/targeting";
import {classifyDiscoveredCompany} from "@/domain/targeting";
import {OPERATIONAL_COMPANIES} from "@/application/providers/run-operational-scale-batch";
import {SqliteSimulationRepository} from "@/infrastructure/sqlite/database";
import {seedTargetCompanyRegistry} from "@/infrastructure/sqlite/seed";
import {ApolloAdapter} from "./adapter";
import {readApolloConfig,assertApolloEnabled} from "./config";
import {broadCompanyDiscoveryQueries} from "./discovery-strategy";
import {FetchApolloTransport} from "./http";

const SEARCH_DATABASES=["data/apollo-operational-scale-search.sqlite","data/apollo-recruiter-search.sqlite"] as const;
const domains=Object.fromEntries(OPERATIONAL_COMPANIES),digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const localDate=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
export type EnrichmentCompanyKind="preferred"|"discovered";
export function preEnrichmentCompanyKind(candidate:ImportedCandidateSnapshot):EnrichmentCompanyKind|null{
  if(!candidate.source.providerRecordId)return null;
  if(candidate.strategyCompanyMatch)return candidate.strategyCompanyMatch.method==="discovered-provider"?"discovered":"preferred";
  if(candidate.source.datasetClassification!=="authorized-provider")return null;
  const discovery=classifyDiscoveredCompany({name:candidate.source.currentOrganization.name,...candidate.source.currentOrganization.domain?{domain:candidate.source.currentOrganization.domain}:{},industrySignal:candidate.source.industrySignals?.[0]});
  // Search responses can omit domain/industry. A legitimate-looking employer may
  // enter enrichment as unverified, but it cannot become outreach-eligible until
  // enrichment supplies evidence that passes classifyDiscoveredCompany.
  const plausibleName=candidate.source.currentOrganization.name.trim(),ambiguous=/^(unknown|confidential|stealth|self[- ]employed|n\/a)$/i.test(plausibleName);
  return discovery.eligible||(!ambiguous&&plausibleName.length>=3&&["company-identity-unverifiable","company-industry-unsupported"].includes(discovery.reason??""))?"discovered":null;
}
const preEnrichmentEligible=(candidate:ImportedCandidateSnapshot)=>Boolean(preEnrichmentCompanyKind(candidate))&&Boolean(candidate.source.providerRecordId)&&(candidate.outreachTrack==="recruiter"?["internal","ambiguous"].includes(candidate.recruiterClassification?.internalStatus??""):candidate.recipientFunction.reviewState==="accepted"&&candidate.recipientRelevance.score>=40);
const candidateScore=(candidate:ImportedCandidateSnapshot)=>candidate.outreachTrack==="recruiter"?candidate.recruiterClassification?.score??0:candidate.recipientRelevance.score;
const uniquePeople=(candidates:readonly ImportedCandidateSnapshot[])=>{const first=new Map<string,ImportedCandidateSnapshot>();for(const candidate of candidates)if(!first.has(candidate.source.providerRecordId))first.set(candidate.source.providerRecordId,candidate);return[...first.values()];};

function diversifiedShortlist(candidates:readonly ImportedCandidateSnapshot[],maximum:number):ImportedCandidateSnapshot[]{
  const ranked=[...candidates].sort((a,b)=>candidateScore(b)-candidateScore(a)||a.id.localeCompare(b.id)),selected:ImportedCandidateSnapshot[]=[],companies=new Map<string,number>(),people=new Set<string>(),discoveredTarget=Math.ceil(maximum*.6),preferredMaximum=maximum-discoveredTarget;
  const companyKey=(candidate:ImportedCandidateSnapshot)=>candidate.strategyCompanyMatch?.companyId??candidate.source.currentOrganization.name.trim().toLowerCase();
  const add=(predicate:(candidate:ImportedCandidateSnapshot)=>boolean,limit:number)=>{for(const candidate of ranked){if(limit<=0||selected.length>=maximum)break;const company=companyKey(candidate),id=candidate.source.providerRecordId;if(!predicate(candidate)||!company||(companies.get(company)??0)>=2||people.has(id))continue;selected.push(candidate);companies.set(company,(companies.get(company)??0)+1);people.add(id);limit--;}};
  add((candidate)=>candidate.outreachTrack==="recruiter"&&preEnrichmentCompanyKind(candidate)==="discovered",Math.min(5,maximum));
  add((candidate)=>candidate.outreachTrack==="recruiter",Math.min(5,maximum)-selected.filter((item)=>item.outreachTrack==="recruiter").length);
  add((candidate)=>preEnrichmentCompanyKind(candidate)==="discovered",discoveredTarget-selected.filter((item)=>preEnrichmentCompanyKind(item)==="discovered").length);
  add((candidate)=>candidate.outreachTrack!=="recruiter"&&preEnrichmentCompanyKind(candidate)==="preferred",preferredMaximum-selected.filter((item)=>preEnrichmentCompanyKind(item)==="preferred").length);
  add(()=>true,maximum-selected.length);
  return selected;
}
export function selectDailyEnrichmentShortlist(candidates:readonly ImportedCandidateSnapshot[],existingProviderIds:ReadonlySet<string>,maximum:number):ImportedCandidateSnapshot[]{return diversifiedShortlist(uniquePeople(candidates).filter((candidate)=>preEnrichmentEligible(candidate)&&!existingProviderIds.has(candidate.source.providerRecordId)),maximum);}

export class ApolloDailyReplenisher implements DailyRefreshReplenisher{
 constructor(private readonly repository:SqliteSimulationRepository,private readonly environment:Readonly<Record<string,string|undefined>>=process.env,private readonly now:()=>Date=()=>new Date()){}
 async replenish(maximum:number):Promise<{candidates:RefreshCandidate[];attempts:number;searchCalls:number;searchRawPeople:number;searchValidNormalized:number;searchUniquePeople:number;preferredAttempts:number;discoveredAttempts:number;recruiterAttempts:number;creditBefore:number|null;creditAfter:number|null}>{
  if(!Number.isInteger(maximum)||maximum<1||maximum>20)throw new Error("daily-refresh-enrichment-cap-invalid");const startedAt=this.now(),runKey=digest(startedAt.toISOString()).slice(0,12),config=readApolloConfig({...this.environment,NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_BATCH:String(maximum),NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_DAY:String(maximum),NETWORKPILOT_APOLLO_HARD_STOP:"true"});assertApolloEnabled(config);
  const existing=new Set(this.repository.listImportedCandidates().map((candidate)=>candidate.source.providerRecordId)),pool:ImportedCandidateSnapshot[]=[];
  for(const relative of SEARCH_DATABASES){const path=resolve(/*turbopackIgnore: true*/ process.cwd(),relative);if(!existsSync(/*turbopackIgnore: true*/ path))continue;const search=new SqliteSimulationRepository(path);try{pool.push(...search.listImportedCandidates());}finally{search.close();}}
  const adapter=new ApolloAdapter(config,new FetchApolloTransport(),this.repository,{now:this.now,sleep:(milliseconds)=>new Promise((done)=>setTimeout(done,milliseconds)),datasetClassification:"authorized-provider",localDate});let searchCalls=0,searchRawPeople=0,searchValidNormalized=0;const searchedPeople=new Set<string>();
  if(selectDailyEnrichmentShortlist(pool,existing,maximum).length<maximum){
    const searchRepository=new SqliteSimulationRepository(":memory:");try{searchRepository.migrate();seedTargetCompanyRegistry(searchRepository);for(const [index,query] of broadCompanyDiscoveryQueries().entries()){const batchId=`daily-refresh-search-${localDate(startedAt)}-${runKey}-${index+1}`,result=await adapter.search({...query,batchId}),rejections=result.recordRejections??[];searchCalls++;searchRawPeople+=result.records.length+rejections.length;searchValidNormalized+=result.records.length;for(const record of result.records)searchedPeople.add(record.providerRecordId);if(!result.records.length&&!rejections.length)continue;importCandidateBatch(searchRepository,TARGET_COMPANIES,{batchId,adapterId:"apollo",adapterVersion:result.requestVersion,datasetClassification:"authorized-provider",sourceFingerprint:`daily-search:${digest(`${query.batchId}:${result.records.map((record)=>record.sourceFingerprint).join(":")}`)}`,records:result.records,providerRecordRejections:rejections,authorizedProviderAccess:{enabled:true,providerId:"apollo"},strategyCompanyDomains:domains},this.now());}pool.push(...searchRepository.listImportedCandidates());}finally{searchRepository.close();}
  }
  const shortlist=selectDailyEnrichmentShortlist(pool,existing,maximum);
  if(!shortlist.length)return{candidates:[],attempts:0,searchCalls,searchRawPeople,searchValidNormalized,searchUniquePeople:searchedPeople.size,preferredAttempts:0,discoveredAttempts:0,recruiterAttempts:0,creditBefore:null,creditAfter:null};
  const before=await adapter.creditUsage(),imported:ImportedCandidateSnapshot[]=[];
  for(const [index,candidate] of shortlist.entries()){const at=this.now(),id=candidate.source.providerRecordId,batchId=`daily-refresh-enrichment-${localDate(startedAt)}-${runKey}-${index+1}`;const records=await adapter.enrich({batchId,personIds:[id],persistedSearchPersonIds:[id],creditCostPolicy:"disabled-phone-v1"});if(records.length!==1||records[0]?.providerRecordId!==id)throw new Error("daily-refresh-enrichment-identity-invalid");importCandidateBatch(this.repository,TARGET_COMPANIES,{batchId,adapterId:"apollo",adapterVersion:records[0].providerMetadata?.adapterVersion??"apollo-adapter-v1",datasetClassification:"authorized-provider",sourceFingerprint:`daily-refresh:${digest(records[0].sourceFingerprint)}`,records,authorizedProviderAccess:{enabled:true,providerId:"apollo"},strategyCompanyDomains:domains},at);const saved=this.repository.findImportedCandidate("apollo",id);if(saved)imported.push(saved);const checkpoint=await adapter.creditUsage();if(before.leadCreditsConsumed!==null&&checkpoint.leadCreditsConsumed!==null&&checkpoint.leadCreditsConsumed-before.leadCreditsConsumed>imported.length)break;}
  const attempted=shortlist.slice(0,imported.length),after=await adapter.creditUsage();return{candidates:imported.map((candidate)=>({id:candidate.id,company:candidate.strategyCompanyMatch?.companyId??candidate.source.currentOrganization.name,companyKind:candidate.strategyCompanyMatch?.method==="discovered-provider"?"discovered":"preferred",track:candidate.outreachTrack??"professional",score:candidate.outreachTrack==="recruiter"?candidate.recruiterClassification?.score??0:candidate.dataQualityScore,available:candidate.state==="eligible"&&candidate.source.email.verificationStatus==="verified"&&candidate.gateFailures.length===0})),attempts:imported.length,searchCalls,searchRawPeople,searchValidNormalized,searchUniquePeople:searchedPeople.size,preferredAttempts:attempted.filter((candidate)=>preEnrichmentCompanyKind(candidate)==="preferred").length,discoveredAttempts:attempted.filter((candidate)=>preEnrichmentCompanyKind(candidate)==="discovered").length,recruiterAttempts:attempted.filter((candidate)=>candidate.outreachTrack==="recruiter").length,creditBefore:before.leadCreditsConsumed,creditAfter:after.leadCreditsConsumed};
 }
}

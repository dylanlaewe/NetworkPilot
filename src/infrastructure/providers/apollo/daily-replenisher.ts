import {createHash} from "node:crypto";
import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {importCandidateBatch,type ImportedCandidateSnapshot} from "@/application/ingestion";
import type {DailyRefreshReplenisher,RefreshCandidate} from "@/application/daily-refresh";
import {TARGET_COMPANIES} from "@/domain/targeting";
import {OPERATIONAL_COMPANIES} from "@/application/providers/run-operational-scale-batch";
import {SqliteSimulationRepository} from "@/infrastructure/sqlite/database";
import {ApolloAdapter} from "./adapter";
import {readApolloConfig,assertApolloEnabled} from "./config";
import {FetchApolloTransport} from "./http";

const SEARCH_DATABASES=["data/apollo-operational-scale-search.sqlite","data/apollo-recruiter-search.sqlite"] as const;
const domains=Object.fromEntries(OPERATIONAL_COMPANIES),digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const localDate=(date:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const preEnrichmentEligible=(candidate:ImportedCandidateSnapshot)=>candidate.strategyCompanyMatch&&candidate.source.providerRecordId&&(candidate.outreachTrack==="recruiter"?candidate.recruiterClassification?.internalStatus==="internal":candidate.recipientFunction.reviewState==="accepted"&&candidate.recipientRelevance.score>=40);

export class ApolloDailyReplenisher implements DailyRefreshReplenisher{
 constructor(private readonly repository:SqliteSimulationRepository,private readonly environment:Readonly<Record<string,string|undefined>>=process.env,private readonly now:()=>Date=()=>new Date()){}
 async replenish(maximum:number):Promise<{candidates:RefreshCandidate[];attempts:number;creditBefore:number|null;creditAfter:number|null}>{
  if(!Number.isInteger(maximum)||maximum<1||maximum>20)throw new Error("daily-refresh-enrichment-cap-invalid");const config=readApolloConfig({...this.environment,NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_BATCH:String(maximum),NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_DAY:String(maximum),NETWORKPILOT_APOLLO_HARD_STOP:"true"});assertApolloEnabled(config);
  const existing=new Set(this.repository.listImportedCandidates().map((candidate)=>candidate.source.providerRecordId)),pool:ImportedCandidateSnapshot[]=[];
  for(const relative of SEARCH_DATABASES){const path=resolve(/*turbopackIgnore: true*/ process.cwd(),relative);if(!existsSync(/*turbopackIgnore: true*/ path))continue;const search=new SqliteSimulationRepository(path);try{pool.push(...search.listImportedCandidates());}finally{search.close();}}
  const shortlist=pool.filter((candidate)=>preEnrichmentEligible(candidate)&&!existing.has(candidate.source.providerRecordId)).sort((a,b)=>(b.outreachTrack==="recruiter"?b.recruiterClassification?.score??0:b.recipientRelevance.score)-(a.outreachTrack==="recruiter"?a.recruiterClassification?.score??0:a.recipientRelevance.score)||a.id.localeCompare(b.id)).filter((candidate,index,all)=>index===all.findIndex((other)=>other.strategyCompanyMatch?.companyId===candidate.strategyCompanyMatch?.companyId)).slice(0,maximum);
  if(!shortlist.length)return{candidates:[],attempts:0,creditBefore:null,creditAfter:null};
  const adapter=new ApolloAdapter(config,new FetchApolloTransport(),this.repository,{now:this.now,sleep:(milliseconds)=>new Promise((done)=>setTimeout(done,milliseconds)),datasetClassification:"authorized-provider",localDate}),before=await adapter.creditUsage(),imported:ImportedCandidateSnapshot[]=[];
  for(const [index,candidate] of shortlist.entries()){const at=this.now(),id=candidate.source.providerRecordId,batchId=`daily-refresh-enrichment-${localDate(at)}-${index+1}`;const records=await adapter.enrich({batchId,personIds:[id],persistedSearchPersonIds:[id],creditCostPolicy:"disabled-phone-v1"});if(records.length!==1||records[0]?.providerRecordId!==id)throw new Error("daily-refresh-enrichment-identity-invalid");importCandidateBatch(this.repository,TARGET_COMPANIES,{batchId,adapterId:"apollo",adapterVersion:records[0].providerMetadata?.adapterVersion??"apollo-adapter-v1",datasetClassification:"authorized-provider",sourceFingerprint:`daily-refresh:${digest(records[0].sourceFingerprint)}`,records,authorizedProviderAccess:{enabled:true,providerId:"apollo"},strategyCompanyDomains:domains},at);const saved=this.repository.findImportedCandidate("apollo",id);if(saved)imported.push(saved);const checkpoint=await adapter.creditUsage();if(before.leadCreditsConsumed!==null&&checkpoint.leadCreditsConsumed!==null&&checkpoint.leadCreditsConsumed-before.leadCreditsConsumed>imported.length)break;}
  const after=await adapter.creditUsage();return{candidates:imported.map((candidate)=>({id:candidate.id,company:candidate.strategyCompanyMatch?.companyId??candidate.source.currentOrganization.name,track:candidate.outreachTrack??"professional",score:candidate.outreachTrack==="recruiter"?candidate.recruiterClassification?.score??0:candidate.dataQualityScore,available:candidate.state==="eligible"&&candidate.source.email.verificationStatus==="verified"&&candidate.gateFailures.length===0})),attempts:imported.length,creditBefore:before.leadCreditsConsumed,creditAfter:after.leadCreditsConsumed};
 }
}

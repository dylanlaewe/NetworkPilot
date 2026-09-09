import {createHash} from "node:crypto";
import {importCandidateBatch,type ImportedCandidateSnapshot,type IngestionRepository} from "@/application/ingestion";
import type {CandidateSourceRecord} from "@/domain/candidates";
import {TARGET_COMPANIES,type TargetCompany} from "@/domain/targeting";
import type {ApolloCreditUsage,ApolloEnrichmentOptions,ApolloHttpResponse,ApolloHttpTransport,ApolloSearchOptions,ApolloSearchResult} from "@/infrastructure/providers/apollo";

export const CONTROLLED_REAL_BATCH_MAX_SEARCH_REQUESTS=16;
export const CONTROLLED_REAL_BATCH_MAX_RAW_RECORDS=200;
export const CONTROLLED_REAL_BATCH_MAX_ENRICHMENTS=20;
export const CONTROLLED_REAL_BATCH_MAX_PER_COMPANY=3;
export const CONTROLLED_REAL_BATCH_COMPANIES=[
  {id:"microsoft",domain:"microsoft.com",reason:"Tier 1 technology and AI"},{id:"goldman-sachs",domain:"goldmansachs.com",reason:"Tier 1 finance"},
  {id:"bloomberg",domain:"bloomberg.com",reason:"Tier 1 financial data and technology"},{id:"accenture",domain:"accenture.com",reason:"Tier 2 consulting and implementation"},
  {id:"deloitte",domain:"deloitte.com",reason:"Tier 2 consulting"},{id:"rtx",domain:"rtx.com",reason:"Tier 1 defense and aerospace"},
  {id:"lockheed-martin",domain:"lockheedmartin.com",reason:"Tier 1 defense technology"},{id:"shell",domain:"shell.com",reason:"Tier 2 commodities and energy"},
] as const;
export const CONTROLLED_REAL_BATCH_TITLES=["data","analytics","software engineer","AI","security","product manager","program manager","operations"] as const;

interface ControlledBatchAdapter{search(options:ApolloSearchOptions):Promise<ApolloSearchResult>;enrich(options:ApolloEnrichmentOptions):Promise<CandidateSourceRecord[]>;creditUsage():Promise<ApolloCreditUsage>;}
export interface ControlledBatchTransportCounts {search:number;enrichment:number;usage:number;}
export class ControlledRealBatchTransport implements ApolloHttpTransport{
  readonly counts:ControlledBatchTransportCounts={search:0,enrichment:0,usage:0};
  constructor(private readonly delegate:ApolloHttpTransport){}
  request(input:Parameters<ApolloHttpTransport["request"]>[0]):Promise<ApolloHttpResponse>{
    const kind=input.path==="/api/v1/mixed_people/api_search"?"search":input.path==="/api/v1/people/match"?"enrichment":input.path==="/api/v1/usage_stats/credit_usage_stats"?"usage":null;
    if(!kind)throw new Error("controlled-real-endpoint-not-authorized");
    const maximum=kind==="search"?CONTROLLED_REAL_BATCH_MAX_SEARCH_REQUESTS:kind==="enrichment"?CONTROLLED_REAL_BATCH_MAX_ENRICHMENTS:2;
    if(this.counts[kind]>=maximum)throw new Error(`controlled-real-${kind}-http-cap-exceeded`);
    this.counts[kind]++;
    return this.delegate.request(input);
  }
}
export interface ControlledProviderFailure{stage:"usage-before"|"search"|"enrichment"|"usage-after";companyId?:string;candidateReference?:string;reason:string;}
export interface ControlledRealBatchOutcome{companies:Array<{id:string;domain:string;tier:string;industryId:string;reason:string}>;searchRequests:number;rawRecords:number;uniqueSearchCandidates:number;shortlist:ImportedCandidateSnapshot[];enriched:ImportedCandidateSnapshot[];failures:ControlledProviderFailure[];usageBefore:ApolloCreditUsage|null;usageAfter:ApolloCreditUsage|null;leadCreditDelta:number|null;}

const domains=Object.fromEntries(CONTROLLED_REAL_BATCH_COMPANIES.map((item)=>[item.id,item.domain]));
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const safeFailure=(error:unknown)=>error instanceof Error?error.message:"provider-operation-failed";
const selectedRegistry=(registry:readonly TargetCompany[])=>CONTROLLED_REAL_BATCH_COMPANIES.map((item)=>{const company=registry.find((candidate)=>candidate.id===item.id&&candidate.enabled&&(candidate.tier==="tier-1"||candidate.tier==="tier-2"));if(!company)throw new Error(`controlled-real-company-unavailable:${item.id}`);return{...item,company};});
const rankValue=(candidate:ImportedCandidateSnapshot,registry:readonly TargetCompany[])=>{const company=registry.find((item)=>item.id===candidate.strategyCompanyMatch?.companyId),persona={"functional-director":80,"team-manager":90,"senior-ic":85,"project-leader":88,"experienced-practitioner":75}[candidate.personaId??""]??40;return(candidate.recipientFunction.reviewState==="accepted"?1000:0)+candidate.recipientRelevance.score*5+persona+(company?.tier==="tier-1"?80:50)+(candidate.geographyId?30:0);};

export function selectControlledEnrichmentShortlist(candidates:readonly ImportedCandidateSnapshot[],registry:readonly TargetCompany[]=TARGET_COMPANIES,maximum=CONTROLLED_REAL_BATCH_MAX_ENRICHMENTS):ImportedCandidateSnapshot[]{
  if(!Number.isInteger(maximum)||maximum<0||maximum>CONTROLLED_REAL_BATCH_MAX_ENRICHMENTS)throw new Error("controlled-real-enrichment-cap-invalid");
  const eligible=candidates.filter((candidate)=>candidate.recipientFunction.reviewState==="accepted"&&candidate.recipientRelevance.score>0&&!candidate.gateFailures.includes("prohibited-seniority")&&Boolean(candidate.strategyCompanyMatch)).sort((a,b)=>rankValue(b,registry)-rankValue(a,registry)||a.source.currentTitle.localeCompare(b.source.currentTitle)||a.source.providerRecordId.localeCompare(b.source.providerRecordId));
  const selected:ImportedCandidateSnapshot[]=[],counts=new Map<string,number>();
  for(let round=0;round<CONTROLLED_REAL_BATCH_MAX_PER_COMPANY&&selected.length<maximum;round++)for(const company of CONTROLLED_REAL_BATCH_COMPANIES){const candidate=eligible.find((item)=>item.strategyCompanyMatch?.companyId===company.id&&!selected.includes(item)&&(counts.get(company.id)??0)===round);if(candidate){selected.push(candidate);counts.set(company.id,round+1);if(selected.length===maximum)break;}}
  return selected;
}

export async function runControlledRealCandidateBatch(input:{adapter:ControlledBatchAdapter;searchRepository:IngestionRepository;enrichmentRepository:IngestionRepository;registry?:readonly TargetCompany[];now?:()=>Date}):Promise<ControlledRealBatchOutcome>{
  const registry=input.registry??TARGET_COMPANIES,companies=selectedRegistry(registry),now=input.now??(()=>new Date()),failures:ControlledProviderFailure[]=[];let usageBefore:ApolloCreditUsage|null=null,usageAfter:ApolloCreditUsage|null=null;
  try{usageBefore=await input.adapter.creditUsage();}catch(error){failures.push({stage:"usage-before",reason:safeFailure(error)});}
  const unique=new Map<string,ImportedCandidateSnapshot>();let searchRequests=0,rawRecords=0;
  for(const {id,domain} of companies){if(searchRequests>=CONTROLLED_REAL_BATCH_MAX_SEARCH_REQUESTS||rawRecords>=CONTROLLED_REAL_BATCH_MAX_RAW_RECORDS)break;const at=now(),search: ApolloSearchOptions={batchId:`controlled-real-search-${id}`,companyDomains:[domain],seniorities:["manager","director","senior"],personLocations:["Boston","Massachusetts","New York","New Jersey","United States"],specificTitles:[...CONTROLLED_REAL_BATCH_TITLES],includeSimilarTitles:true,controlledDiagnosticAuthorization:"milestone-6.3",page:1,perPage:25};try{searchRequests++;const result=await input.adapter.search(search);if(result.records.length>25||rawRecords+result.records.length>CONTROLLED_REAL_BATCH_MAX_RAW_RECORDS)throw new Error("controlled-real-search-result-cap-exceeded");rawRecords+=result.records.length;importCandidateBatch(input.searchRepository,registry,{batchId:`controlled-real-search-${id}-${at.toISOString().replace(/\D/g,"").slice(0,14)}`,adapterId:"apollo",adapterVersion:result.requestVersion,datasetClassification:"authorized-provider",sourceFingerprint:`controlled-real-search:${digest(JSON.stringify(search)+result.records.map((record)=>record.sourceFingerprint).sort().join("|"))}`,records:result.records,authorizedProviderAccess:{enabled:true,providerId:"apollo"},strategyCompanyDomains:domains},at);for(const record of result.records){const candidate=input.searchRepository.findImportedCandidate("apollo",record.providerRecordId);if(candidate&&!unique.has(record.providerRecordId))unique.set(record.providerRecordId,candidate);}}catch(error){failures.push({stage:"search",companyId:id,reason:safeFailure(error)});}}
  const shortlist=selectControlledEnrichmentShortlist([...unique.values()],registry),enriched:ImportedCandidateSnapshot[]=[];
  for(const [index,candidate] of shortlist.entries()){const id=candidate.source.providerRecordId,at=now(),batchId=`controlled-real-enrichment-${index+1}-${at.toISOString().replace(/\D/g,"").slice(0,14)}`;try{const records=await input.adapter.enrich({batchId,personIds:[id],persistedSearchPersonIds:[id],creditCostPolicy:"disabled-phone-v1"});if(records.length!==1||records[0].providerRecordId!==id)throw new Error("controlled-real-enrichment-identity-invalid");importCandidateBatch(input.enrichmentRepository,registry,{batchId,adapterId:"apollo",adapterVersion:records[0].providerMetadata?.adapterVersion??"apollo-adapter-v1",datasetClassification:"authorized-provider",sourceFingerprint:`controlled-real-enrichment:${digest(records[0].sourceFingerprint)}`,records,authorizedProviderAccess:{enabled:true,providerId:"apollo"},strategyCompanyDomains:domains},at);const imported=input.enrichmentRepository.findImportedCandidate("apollo",id);if(!imported)throw new Error("controlled-real-enrichment-import-missing");enriched.push(imported);}catch(error){failures.push({stage:"enrichment",candidateReference:digest(id).slice(0,12),reason:safeFailure(error)});}}
  try{usageAfter=await input.adapter.creditUsage();}catch(error){failures.push({stage:"usage-after",reason:safeFailure(error)});}
  const leadCreditDelta=usageBefore?.leadCreditsConsumed!=null&&usageAfter?.leadCreditsConsumed!=null?usageAfter.leadCreditsConsumed-usageBefore.leadCreditsConsumed:null;
  return{companies:companies.map(({company,domain,reason})=>({id:company.id,domain,tier:company.tier,industryId:company.industryId,reason})),searchRequests,rawRecords,uniqueSearchCandidates:unique.size,shortlist,enriched,failures,usageBefore,usageAfter,leadCreditDelta};
}

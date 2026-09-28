import type Database from "better-sqlite3";
import {refreshScopedCandidateReserve,type ScopedDiscoveryProvider} from "@/application/candidate-refresh/scoped";
import {SqliteScopedDiscoveryStore} from "./scoped-discovery";
import {bucketReserve} from "./bucket-reserve";
import {assertFiveBucketEnabled,type BucketScope} from "@/domain/recipient-buckets";
import {refreshCandidateReserve,type CandidateRefreshRepository,type CandidateRefreshResult} from "@/application/candidate-refresh";
import {loadDailyCommandCenter} from "./daily-command-center";
import {resolveManualOutreachDatabaseSelection} from "./manual-outreach-operator";
import {SqliteSimulationRepository} from "./database";
import {ApolloDailyReplenisher} from "@/infrastructure/providers/apollo/daily-replenisher";
import {readApolloConfig} from "@/infrastructure/providers/apollo/config";
import type {ScopedDiscoveryReadiness} from "@/application/candidate-refresh/scoped-readiness";
import {resolveDatastoreTopology} from "./datastore-topology";
import {
  createServerScopedApolloProvider,
  scopedApolloProviderConfigured,
} from "@/infrastructure/providers/apollo/scoped-runtime";

export class SqliteCandidateRefreshRepository implements CandidateRefreshRepository{constructor(private readonly db:Database.Database){}saveCandidateRefresh(result:CandidateRefreshResult){this.db.prepare("INSERT INTO candidate_refresh_events(id,created_at_utc,usable_before,target_reserve,provider_cap,search_calls,enrichment_credits_used,candidates_added,qualified_candidates_added,professional_candidates_added,recruiter_candidates_added,companies_added,usable_after,preferred_enrichment_attempts,discovered_enrichment_attempts,recruiter_enrichment_attempts,diagnostics_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(result.id,result.createdAt,result.usableBefore,result.target,result.providerCap,result.searchCalls,result.enrichmentCreditsUsed,result.candidatesAdded,result.qualifiedCandidatesAdded,result.professionalCandidatesAdded,result.recruiterCandidatesAdded,result.companiesAdded,result.usableAfter,result.preferredEnrichmentAttempts??0,result.discoveredEnrichmentAttempts??0,result.recruiterEnrichmentAttempts??0,result.diagnostics?JSON.stringify(result.diagnostics):null);}}
export function loadScopedDiscoveryReadiness(scope:BucketScope,at=new Date(),providerConfigured?:boolean):ScopedDiscoveryReadiness{
  const topology=resolveDatastoreTopology();let repository:SqliteSimulationRepository|undefined;
  try{
    repository=new SqliteSimulationRepository(topology.canonical.path,{readonly:true,fileMustExist:true});
    let config:ReturnType<typeof readApolloConfig>,configError:string|undefined;
    try{config=readApolloConfig(process.env);}catch(error){config=readApolloConfig({});configError=error instanceof Error?error.message:"apollo-config-invalid";}
    const readiness=new SqliteScopedDiscoveryStore(repository,{topology}).preflight({scope,requested:Math.max(1,Math.min(config.maxEnrichmentsPerBatch,20)),policy:{maximumPerBatch:config.maxEnrichmentsPerBatch,maximumPerDay:config.maxEnrichmentsPerDay,maximumSearchCalls:5,hardStop:config.hardStop},at});
    const configured=!configError&&(providerConfigured??scopedApolloProviderConfigured(process.env));
    return readiness.ready&&!configured?{ready:false,reason:"provider-not-configured",technicalDetail:configError??"scoped-provider-not-configured"}:readiness;
  }catch(error){return{ready:false,reason:"canonical-store-unavailable",technicalDetail:error instanceof Error?error.message:"canonical-store-unavailable"};}
  finally{repository?.close();}
}
export async function runCandidateRefresh(input:{allowProvider:boolean;now?:()=>Date;scope?:BucketScope;requestId?:string;requested?:number;scopedProvider?:ScopedDiscoveryProvider}){if(input.scope)assertFiveBucketEnabled();const repository=new SqliteSimulationRepository(resolveManualOutreachDatabaseSelection().path);try{repository.assertRuntimeSchema();if(input.scope){const now=input.now??(()=>new Date()),config=readApolloConfig(process.env),provider=input.scopedProvider??(scopedApolloProviderConfigured(process.env)?createServerScopedApolloProvider(repository,process.env,now):undefined);return await refreshScopedCandidateReserve({scope:input.scope,requestId:input.requestId??"",requested:input.requested??5,usableBefore:bucketReserve(repository,input.scope,now()).actionableCapacity,store:new SqliteScopedDiscoveryStore(repository),provider,allowProvider:input.allowProvider,now,policy:{maximumPerBatch:config.maxEnrichmentsPerBatch,maximumPerDay:config.maxEnrichmentsPerDay,maximumSearchCalls:5,hardStop:config.hardStop}});}const state=loadDailyCommandCenter(),now=input.now??(()=>new Date()),provider=new ApolloDailyReplenisher(repository,process.env,now);return await refreshCandidateReserve({usableBefore:state.pipeline.available,repository:new SqliteCandidateRefreshRepository(repository.native),provider,providerCap:Math.max(0,20-state.safety.apolloExposure),allowProvider:input.allowProvider,now});}finally{repository.close();}}

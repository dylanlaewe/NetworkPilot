import {describe,expect,it,vi} from "vitest";
import {SqliteSimulationRepository} from "@/infrastructure/sqlite/database";
import {seedTargetCompanyRegistry} from "@/infrastructure/sqlite/seed";
import {ApolloDailyReplenisher} from "./daily-replenisher";
import type {ApolloHttpTransport} from "./types";
import {APOLLO_PEOPLE} from "./fixtures";
import {refreshCandidateReserve} from "@/application/candidate-refresh";
import {SqliteCandidateRefreshRepository} from "@/infrastructure/sqlite/candidate-refresh";
import type {RefreshDiagnostics} from "@/application/candidate-refresh/diagnostics";
import Database from "better-sqlite3";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {seedOfflineReserve} from "@/infrastructure/fixtures/offline-reserve";

function setup(fail=false,searchPaths:readonly string[]=[]){
  const repository=new SqliteSimulationRepository(":memory:");repository.migrate();seedTargetCompanyRegistry(repository);
  let searches=0,credits=0;
  const people=new Map<string,Record<string,unknown>>();
  const transport:ApolloHttpTransport={request:vi.fn(async input=>{
    if(input.path.includes("api_search")){
      searches++;const rows=Array.from({length:8},(_,i)=>{const n=(searches-1)*8+i,id=`fixture-refresh-${n}`,recruiter=searches===4,title=recruiter?"Product Recruiter":i===0?"Product Analyst":"Data Engineer";
        const person={...APOLLO_PEOPLE.senior,id,title,first_name:"Fictional",last_name:"Person",last_name_obfuscated:"P.",email:`${id}@example.invalid`,organization:{name:`Fixture Discovered Systems ${n}`,primary_domain:`fixture-${n}.example.invalid`,id:`fixture-org-${n}`,industry:recruiter?"":"Software"}};
        people.set(id,person);return {...person,email:undefined};});
      // This malformed person is rejected by normalization, but its employer must still be counted.
      return {status:200,headers:{},body:JSON.stringify({people:[...rows,{id:"rejected-repeat",organization:{name:"Microsoft"}}],total_entries:100})};
    }
    if(input.path.includes("people/match")){
      if(fail&&credits===2)return{status:400,headers:{},body:"{}"};
      credits++;const id=(input.body as {id:string}).id;return{status:200,headers:{},body:JSON.stringify({person:people.get(id),credits_consumed:1})};
    }
    return {status:200,headers:{},body:JSON.stringify({current_credit_cycle:{start_date:"2026-09-01",end_date:"2026-10-01"},credit_usage_stats:{lead_credit:{limit:100,consumed:credits,left_over:100-credits}}})};
  })};
  const provider=new ApolloDailyReplenisher(repository,{NETWORKPILOT_APOLLO_ENABLED:"true",APOLLO_API_KEY:"fixture-only",NETWORKPILOT_APOLLO_MAX_RETRIES:"0"},()=>new Date("2026-09-21T14:00:00Z"),{transport,searchPaths});
  return{repository,provider,transport};
}
describe("one-run refresh evidence with mocked Apollo transport",()=>{
  it("does not let a full preferred-only cache bypass broad discovery, and keeps the cache byte-identical",async()=>{
    const dir=mkdtempSync(join(tmpdir(),"np-offline-search-cache-")),path=join(dir,"fixture.sqlite"),fixtures=new SqliteSimulationRepository(":memory:");
    const candidates=seedOfflineReserve(fixtures).filter(c=>c.strategyCompanyMatch?.method!=="discovered-provider");fixtures.close();
    const cache=new Database(path);cache.exec("CREATE TABLE imported_candidates(normalized_snapshot_json TEXT NOT NULL)");
    for(const c of candidates)cache.prepare("INSERT INTO imported_candidates VALUES(?)").run(JSON.stringify(c));cache.close();
    const before=readFileSync(path),{repository,provider,transport}=setup(false,[path]);
    try{expect(candidates).toHaveLength(20);await provider.replenish(1);expect(vi.mocked(transport.request).mock.calls.filter(([input])=>input.path.includes("api_search"))).toHaveLength(4);expect(readFileSync(path).equals(before)).toBe(true);}finally{repository.close();rmSync(dir,{recursive:true,force:true});}
  });
  it("retains raw search employer aggregates including rejected people and persists the complete report",async()=>{
    const {repository,provider}=setup();try{
      const result=await refreshCandidateReserve({usableBefore:18,repository:new SqliteCandidateRefreshRepository(repository.native),provider,allowProvider:true,now:()=>new Date("2026-09-21T14:00:00Z")});
      expect(result.diagnostics).toMatchObject({searchCalls:4,rawCandidates:36,normalizedCandidates:32,uniqueCandidates:33,rawUniqueEmployers:33,rawPreferredEmployers:1,rawDiscoveredEmployers:32,shortlistSize:20,enrichmentAttempts:20,verifiedEmails:20,qualifiedRecruiters:5,qualifiedProfessionals:15,qualifiedDiscovered:20,candidatesAdded:20,observedCreditsUsed:20,estimatedCreditsUsed:20});
      expect(result.diagnostics!.searchPages.map(p=>p.page)).toEqual([1,2,3,2]);expect(result.diagnostics!.productCandidatesAdded).toBeGreaterThan(0);
      expect(result.diagnostics!.rejectionReasons["apollo-required-field-missing:person.first_name"]).toBe(4);
      const saved=repository.native.prepare("SELECT diagnostics_json FROM candidate_refresh_events").get() as {diagnostics_json:string};expect(JSON.parse(saved.diagnostics_json)).toEqual(result.diagnostics);
      expect(saved.diagnostics_json).not.toContain("@");expect(saved.diagnostics_json).not.toContain("fixture-org-");
      expect(repository.native.prepare("SELECT status FROM candidate_refresh_observations").get()).toEqual({status:"completed"});
    }finally{repository.close();}
  });
  it("retains partial evidence on failure without retrying a refresh",async()=>{
    const {repository,provider,transport}=setup(true);try{
      await expect(provider.replenish(20)).rejects.toThrow("provider-request-rejected");
      const row=repository.native.prepare("SELECT status,diagnostics_json FROM candidate_refresh_observations").get() as {status:string;diagnostics_json:string},d=JSON.parse(row.diagnostics_json) as RefreshDiagnostics;
      expect(row.status).toBe("failed");expect(d.rawUniqueEmployers).toBe(33);expect(d.candidatesAdded).toBe(2);expect(d.enrichmentAttempts).toBe(3);expect(d.failure).toBe("provider-request-rejected");
      expect(vi.mocked(transport.request).mock.calls.filter(([input])=>input.path.includes("people/match"))).toHaveLength(3);
    }finally{repository.close();}
  });
  it("stops before search, usage lookup, or state writes when the daily budget is exhausted",async()=>{
    const {repository,provider,transport}=setup();try{
      repository.native.prepare("INSERT INTO provider_daily_budgets(provider_id,local_date,attempted_candidates,estimated_max_exposure,updated_at_utc) VALUES('apollo','2026-09-21',20,20,'2026-09-21T13:00:00Z')").run();
      await expect(provider.replenish(20)).rejects.toThrow("apollo-daily-budget-exhausted");expect(transport.request).not.toHaveBeenCalled();
      expect(repository.native.prepare("SELECT COUNT(*) count FROM candidate_refresh_observations").get()).toEqual({count:0});
    }finally{repository.close();}
  });
});

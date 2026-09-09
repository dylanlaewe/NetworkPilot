import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach,describe,expect,it,vi} from "vitest";
import type {CandidateSourceRecord} from "@/domain/candidates";
import {SqliteSimulationRepository} from "@/infrastructure/sqlite/database";
import {seedTargetCompanyRegistry} from "@/infrastructure/sqlite/seed";
import {TARGET_COMPANIES} from "@/domain/targeting";
import type {ApolloHttpTransport} from "@/infrastructure/providers/apollo";
import {CONTROLLED_REAL_BATCH_COMPANIES,CONTROLLED_REAL_BATCH_FUNCTION_SOFT_CAP,CONTROLLED_REAL_BATCH_MAX_ENRICHMENTS,ControlledRealBatchTransport,runControlledRealCandidateBatch,selectControlledEnrichmentShortlist,selectControlledEnrichmentShortlistDetailed} from "./run-controlled-real-batch";
import {prepareControlledRealCampaign} from "./prepare-controlled-real-campaign";

const dirs:string[]=[];
const repository=()=>{const directory=mkdtempSync(join(tmpdir(),"networkpilot-controlled-batch-"));dirs.push(directory);const repo=new SqliteSimulationRepository(join(directory,"test.sqlite"));repo.migrate();return repo;};
afterEach(()=>dirs.splice(0).forEach((directory)=>rmSync(directory,{recursive:true,force:true})));
const source=(id:string,domain:string,index:number,stage:"search"|"enrichment"):CandidateSourceRecord=>({sourceProviderId:"apollo",providerRecordId:id,datasetClassification:"authorized-provider",person:{firstName:"Fixture",lastName:stage==="search"?"C.":"Candidate"},currentTitle:index%2===0?"Senior Data Engineer":"Analytics Manager",currentOrganization:{name:CONTROLLED_REAL_BATCH_COMPANIES.find((item)=>item.domain===domain)!.id.replaceAll("-"," "),domain},location:"Boston, Massachusetts, United States",industrySignals:["technology"],experienceEvidence:stage==="search"?[{kind:"unknown",sourceField:"person.employment_history"}]:[{kind:"exact",years:9,sourceField:"fixture"}],email:{address:stage==="search"?"":`fictional-${id}@example.invalid`,verificationStatus:stage==="search"?"unknown":"verified"},sourceTimestamps:{retrievedAt:"2026-09-09T12:00:00.000Z"},fieldProvenance:{},consent:{suppressed:false,optedOut:false},sourceFingerprint:`fixture-${stage}-${id}-fingerprint`,providerMetadata:{adapterVersion:"fixture",responseMappingVersion:"fixture",requestContractVersion:"fixture",importArchitectureVersion:"fixture",providerSeniority:"senior",matchConfidence:"high",identityEvidenceBasis:"provider-native-id-exact",providerNativeRequestId:id,providerNativeReturnedId:id}});

describe("controlled real candidate batch",()=>{
  it("diversifies before enrichment and enforces immutable HTTP endpoint caps",async()=>{
    const functions=["data-analytics","software-engineering","project-program","ai-ml"];
    const snapshots=CONTROLLED_REAL_BATCH_COMPANIES.flatMap((company,index)=>Array.from({length:4},(_,person)=>({source:source(`${company.id}-${person}`,company.domain,index+person,"search"),recipientFunction:{reviewState:"accepted",primaryFunction:functions[person]},recipientRelevance:{score:80-person},personaId:person%2?"senior-ic":"team-manager",geographyId:"boston-ma",strategyCompanyMatch:{companyId:company.id},gateFailures:[]}))) as never[];
    const shortlist=selectControlledEnrichmentShortlist(snapshots);
    expect(shortlist).toHaveLength(CONTROLLED_REAL_BATCH_MAX_ENRICHMENTS);
    expect(Math.max(...CONTROLLED_REAL_BATCH_COMPANIES.map((company)=>shortlist.filter((item)=>item.strategyCompanyMatch?.companyId===company.id).length))).toBeLessThanOrEqual(3);
    expect(new Set(shortlist.map((item)=>item.strategyCompanyMatch?.companyId)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(shortlist.map((item)=>TARGET_COMPANIES.find((company)=>company.id===item.strategyCompanyMatch?.companyId)?.industryId)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(shortlist.map((item)=>item.personaId)).size).toBeGreaterThanOrEqual(2);
    expect(Math.max(...functions.map((fn)=>shortlist.filter((item)=>item.recipientFunction.primaryFunction===fn).length))).toBeLessThanOrEqual(CONTROLLED_REAL_BATCH_FUNCTION_SOFT_CAP);
    const delegate={request:vi.fn(async()=>({status:200,headers:{},body:"{}"}))} satisfies ApolloHttpTransport,transport=new ControlledRealBatchTransport(delegate);
    await expect(transport.request({path:"/api/v1/usage_stats/credit_usage_stats",body:{},apiKey:"fixture",timeoutMs:1,maxResponseBytes:1})).resolves.toBeDefined();
    expect(transport.counts).toEqual({search:0,enrichment:0,usage:1});
  });

  it("relaxes the function cap deterministically only when a relevant pool cannot fill otherwise",()=>{const candidates=CONTROLLED_REAL_BATCH_COMPANIES.flatMap((company,index)=>Array.from({length:3},(_,person)=>({source:source(`${company.id}-same-${person}`,company.domain,index+person,"search"),recipientFunction:{reviewState:"accepted",primaryFunction:"project-program"},recipientRelevance:{score:100},personaId:"team-manager",geographyId:"boston-ma",strategyCompanyMatch:{companyId:company.id},gateFailures:[]}))) as never[];const first=selectControlledEnrichmentShortlistDetailed(candidates),second=selectControlledEnrichmentShortlistDetailed(candidates);expect(first).toEqual(second);expect(first.selected).toHaveLength(20);expect(first.functionCapRelaxations).toHaveLength(15);expect(first.functionCapRelaxations.every((item)=>item.functionId==="project-program")).toBe(true);});

  it("caps search/enrichment, preserves exact IDs, and computes the observed credit delta",async()=>{
    const searchRepository=repository(),enrichmentRepository=repository(),searched:string[]=[],enriched:string[]=[];seedTargetCompanyRegistry(enrichmentRepository);
    const adapter={creditUsage:vi.fn().mockResolvedValueOnce({cycleStart:"2026-09-01",cycleEnd:"2026-10-01",leadCreditsLimit:100,leadCreditsConsumed:10,leadCreditsRemaining:90,observedAt:"2026-09-09",adapterVersion:"apollo-adapter-v1"}).mockResolvedValueOnce({cycleStart:"2026-09-01",cycleEnd:"2026-10-01",leadCreditsLimit:100,leadCreditsConsumed:30,leadCreditsRemaining:70,observedAt:"2026-09-09",adapterVersion:"apollo-adapter-v1"}),search:vi.fn(async(options:{companyDomains?:string[]})=>{const domain=options.companyDomains![0]!;searched.push(domain);return{records:Array.from({length:3},(_,index)=>source(`${domain.replaceAll(".","-")}-${index}`,domain,index,"search")),totalAvailable:3,requestVersion:"fixture-version"};}),enrich:vi.fn(async(options:{personIds:string[];persistedSearchPersonIds?:string[];creditCostPolicy?:string})=>{expect(options.personIds).toEqual(options.persistedSearchPersonIds);expect(options.creditCostPolicy).toBe("disabled-phone-v1");enriched.push(options.personIds[0]!);const company=CONTROLLED_REAL_BATCH_COMPANIES.find((item)=>options.personIds[0]!.startsWith(item.domain.replaceAll(".","-")))!;return[source(options.personIds[0]!,company.domain,enriched.length,"enrichment")];})};
    const result=await runControlledRealCandidateBatch({adapter,searchRepository,enrichmentRepository,now:()=>new Date("2026-09-09T12:00:00.000Z")});
    expect(result.failures).toEqual([]);expect(result.searchRequests).toBe(8);expect(result.rawRecords).toBe(24);expect(result.shortlist).toHaveLength(20);expect(result.enriched).toHaveLength(20);expect(result.leadCreditDelta).toBe(20);expect(searched).toHaveLength(8);expect(new Set(enriched).size).toBe(20);
    const preview=prepareControlledRealCampaign(result.enriched,{now:new Date("2026-09-09T12:00:00.000Z")});
    expect(preview.plan.selected.length).toBeGreaterThan(0);expect(preview.plan.selected.length).toBeLessThanOrEqual(8);expect(preview.capacity).toMatchObject({desiredVolume:15,actualPlanned:preview.plan.selected.length});expect(preview.capacity.qualificationShortfall+preview.capacity.companyCapacityShortfall).toBe(preview.plan.target-preview.plan.selected.length);expect(preview.drafts).toHaveLength(preview.plan.selected.length);expect(preview.drafts.every((item)=>item.draft.status==="draft-only-simulation")).toBe(true);expect(new Set(preview.drafts.map((item)=>item.lane)).size).toBeGreaterThan(1);
    const snapshot=structuredClone(preview.drafts[0]!.snapshot);result.enriched[0]!.source.currentTitle="Mutated after planning";expect(preview.drafts[0]!.snapshot).toEqual(snapshot);
    searchRepository.close();enrichmentRepository.close();
  });
});

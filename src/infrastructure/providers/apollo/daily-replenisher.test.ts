import {describe,expect,it} from "vitest";
import type {ImportedCandidateSnapshot} from "@/application/ingestion";
import {selectDailyEnrichmentShortlist} from "./daily-replenisher";

const candidate=(id:string,company:string,track:"professional"|"recruiter",score:number):ImportedCandidateSnapshot=>({
  id:`zz-import:apollo:${id}`,source:{providerRecordId:id},strategyCompanyMatch:{companyId:company},outreachTrack:track,
  recipientFunction:{reviewState:"accepted"},recipientRelevance:{score},recruiterClassification:track==="recruiter"?{internalStatus:"internal",score}:null,
} as ImportedCandidateSnapshot);

describe("daily Apollo replenishment shortlist",()=>{
  it("deduplicates known people, never re-enriches them, and bounds enrichment to two people per company",()=>{const rows=[candidate("known","one","professional",100),candidate("duplicate-company","two","professional",99),candidate("lower-company","two","professional",80),candidate("third-company","two","professional",70),candidate("recruiter","three","recruiter",90),candidate("duplicate-company","four","professional",60)];const selected=selectDailyEnrichmentShortlist(rows,new Set(["known"]),20);expect(selected.map((item)=>item.source.providerRecordId)).toEqual(["recruiter","duplicate-company","lower-company"]);const counts=selected.reduce<Record<string,number>>((all,item)=>({...all,[item.strategyCompanyMatch!.companyId]:(all[item.strategyCompanyMatch!.companyId]??0)+1}),{});expect(Math.max(...Object.values(counts))).toBe(2);});
  it("reserves recruiter representation before filling professional capacity",()=>{const rows=[...Array.from({length:20},(_,index)=>candidate(`p${index}`,`pc${index}`,"professional",100-index)),...Array.from({length:6},(_,index)=>candidate(`r${index}`,`rc${index}`,"recruiter",50-index))];const selected=selectDailyEnrichmentShortlist(rows,new Set(),20);expect(selected).toHaveLength(20);expect(selected.filter((item)=>item.outreachTrack==="recruiter")).toHaveLength(5);expect(selected.filter((item)=>item.outreachTrack==="professional")).toHaveLength(15);});
});

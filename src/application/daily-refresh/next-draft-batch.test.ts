import {describe,expect,it} from "vitest";
import {planNextDraftBatch,type RefreshCandidate} from ".";

const row=(id:string,track:"professional"|"recruiter",companyKind:"preferred"|"discovered",score:number):RefreshCandidate=>({id,track,companyKind,company:`company-${id}`,score,available:true});

describe("next draft batch",()=>{
  it("targets three professionals, two recruiters, and at least three discovered employers",()=>{const selected=planNextDraftBatch([row("p1","professional","discovered",90),row("p2","professional","discovered",89),row("p3","professional","discovered",88),row("r1","recruiter","discovered",80),row("r2","recruiter","preferred",79),row("preferred-high","professional","preferred",100)]);expect(selected).toHaveLength(5);expect(selected.filter((item)=>item.track==="professional")).toHaveLength(3);expect(selected.filter((item)=>item.track==="recruiter")).toHaveLength(2);expect(selected.filter((item)=>item.companyKind==="discovered").length).toBeGreaterThanOrEqual(3);expect(selected.filter((item)=>item.companyKind==="preferred").length).toBeLessThanOrEqual(2);});
  it("falls back to the best qualified supply",()=>{const selected=planNextDraftBatch(Array.from({length:5},(_,index)=>row(`p${index}`,"professional","preferred",100-index)));expect(selected).toHaveLength(5);});
  it("keeps one person per company",()=>{const duplicate={...row("duplicate","professional","discovered",99),company:"company-p1"};const selected=planNextDraftBatch([row("p1","professional","discovered",100),duplicate,row("p2","professional","discovered",98),row("p3","professional","discovered",97),row("r1","recruiter","discovered",96),row("r2","recruiter","preferred",95)]);expect(new Set(selected.map((item)=>item.company)).size).toBe(selected.length);});
});

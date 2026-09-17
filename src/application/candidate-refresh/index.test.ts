import {describe,expect,it,vi} from "vitest";
import {planCandidateRefresh,refreshCandidateReserve} from ".";
describe("candidate reserve refresh",()=>{
  it("uses reserve first and targets forty",()=>{expect(planCandidateRefresh(42)).toMatchObject({target:40,providerRequired:false,maximumProviderUsage:0});});
  it("bounds provider usage by the deficit and cap",()=>{expect(planCandidateRefresh(10,40,12).maximumProviderUsage).toBe(12);expect(planCandidateRefresh(35,40,20).maximumProviderUsage).toBe(5);});
  it("persists logical accounting and does not call a provider when reserve is full",async()=>{const saveCandidateRefresh=vi.fn(),replenish=vi.fn();await refreshCandidateReserve({usableBefore:40,repository:{saveCandidateRefresh},provider:{replenish},allowProvider:true,now:()=>new Date("2026-09-17T12:00:00Z")});expect(replenish).not.toHaveBeenCalled();expect(saveCandidateRefresh).toHaveBeenCalledWith(expect.objectContaining({usableAfter:40,enrichmentCreditsUsed:0,searchCalls:0}));});
  it("records each explicit repeat as a logical refresh event",async()=>{const saved:unknown[]=[];const repository={saveCandidateRefresh:(event:unknown)=>saved.push(event)};await refreshCandidateReserve({usableBefore:40,repository,allowProvider:false,now:()=>new Date("2026-09-17T12:00:00Z")});await refreshCandidateReserve({usableBefore:40,repository,allowProvider:false,now:()=>new Date("2026-09-17T12:01:00Z")});expect(saved).toHaveLength(2);});
});

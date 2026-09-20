import {afterEach,describe,expect,it,vi} from "vitest";
import {generateMoreDrafts} from "./today/actions";

const mocks=vi.hoisted(()=>({run:vi.fn(),revalidate:vi.fn(),redirect:vi.fn((path:string)=>{throw new Error(`redirect:${path}`);})}));
vi.mock("@/infrastructure/sqlite/daily-refresh",()=>({runNextDraftBatchFromReserve:mocks.run}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});

describe("actual Add Drafts server action",()=>{
  it.each([[10,10,4],[10,6,0],[10,0,0]])("treats %i as additional, reports %i, stays on Drafts",async(requested,added,remaining)=>{
    const network=vi.fn(()=>{throw new Error("provider-network-prohibited");});vi.stubGlobal("fetch",network);
    mocks.run.mockReturnValue({addition:{additionalDraftCount:requested,addedCount:added,activeBefore:5,activeAfter:5+added,eligibleReserveRemaining:remaining}});
    const form=new FormData();form.set("additionalDraftCount",String(requested));
    await expect(generateMoreDrafts(form)).rejects.toThrow(`redirect:/drafts?added=${added}&requested=${requested}&reserveRemaining=${remaining}`);
    expect(mocks.run).toHaveBeenCalledExactlyOnceWith(requested);
    expect(mocks.revalidate.mock.calls.map(([path])=>path)).toEqual(["/today","/drafts","/sent","/candidates"]);
    expect(mocks.redirect.mock.calls.every(([path])=>path.startsWith("/drafts?"))).toBe(true);expect(network).not.toHaveBeenCalled();
  });
});

import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
import {AddDraftsControl} from "./drafts/add-drafts-control";
import {CandidateRefreshControl} from "./candidates/refresh-control";
import {DraftAdditionFeedback} from "./drafts/addition-feedback";
import {draftAdditionDestination} from "@/application/daily-refresh/addition-feedback";
vi.mock("./candidates/actions",()=>({refreshCandidates:vi.fn()}));
describe("offline operator controls",()=>{
  it.each([[10,10,4,"10 drafts created."],[6,10,0,"6 of 10 drafts created. No more candidates are ready."],[0,10,0,"No drafts could be created. No candidates are ready right now."]])("keeps Create drafts feedback persistent (%i created / %i requested)",(added,requested,remaining,message)=>{
    const html=renderToStaticMarkup(createElement(DraftAdditionFeedback,{added,requested,remaining}));
    expect(html).toContain('role="status"');expect(html).toContain(message);
    expect(draftAdditionDestination({addedCount:added,additionalDraftCount:requested,activeBefore:5,activeAfter:5+added,eligibleReserveRemaining:remaining})).toMatch(/^\/drafts\?/);
    if(added<requested){expect(html).toContain('href="/candidates"');expect(html).toContain("Find people");}
  });
  it("separates quick counts from the custom count so form data cannot silently submit five for every request",()=>{
    const html=renderToStaticMarkup(createElement(AddDraftsControl,{action:vi.fn()}));
    const forms=html.match(/<form[\s\S]*?<\/form>/g)!;
    expect(forms).toHaveLength(2);expect(forms[0]).toContain('value="5"');expect(forms[0]).toContain('value="10"');expect(forms[0]).not.toContain('type="number"');
    expect(forms[1]).toContain('min="1"');expect(forms[1]).toContain('max="20"');expect(forms[1]!.match(/name="additionalDraftCount"/g)).toHaveLength(1);
  });
  it("renders exhausted sourcing separately from existing outreach without a refresh form",()=>{
    const html=renderToStaticMarkup(createElement(CandidateRefreshControl,{available:4,exposure:20}));
    expect(html).toContain("local daily allowance is fully accounted or held");expect(html).toContain("separate from the Apollo account balance");expect(html).not.toContain("<form");
  });
  it("shows only remaining daily exposure as maximum credits",()=>{
    const html=renderToStaticMarkup(createElement(CandidateRefreshControl,{available:4,exposure:17,maximumPerDay:20}));
    expect(html).toContain("<dt>Maximum credits this run</dt><dd>3</dd>");
  });
});

import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
import {AddDraftsControl} from "./drafts/add-drafts-control";
import {CandidateRefreshControl} from "./candidates/refresh-control";
vi.mock("./candidates/actions",()=>({refreshCandidates:vi.fn()}));
describe("offline operator controls",()=>{
  it("separates quick counts from the custom count so form data cannot silently submit five for every request",()=>{
    const html=renderToStaticMarkup(createElement(AddDraftsControl,{action:vi.fn()}));
    const forms=html.match(/<form[\s\S]*?<\/form>/g)!;
    expect(forms).toHaveLength(2);expect(forms[0]).toContain('value="5"');expect(forms[0]).toContain('value="10"');expect(forms[0]).not.toContain('type="number"');
    expect(forms[1]).toContain('min="1"');expect(forms[1]).toContain('max="20"');expect(forms[1]!.match(/name="count"/g)).toHaveLength(1);
  });
  it("renders exhausted sourcing separately from existing outreach without a refresh form",()=>{
    const html=renderToStaticMarkup(createElement(CandidateRefreshControl,{available:4,exposure:20}));
    expect(html).toContain("Candidate refresh is available again tomorrow.");expect(html).toContain("Your drafts and outreach are still available.");expect(html).not.toContain("<form");
  });
  it("shows only remaining daily exposure as maximum credits",()=>{
    const html=renderToStaticMarkup(createElement(CandidateRefreshControl,{available:4,exposure:17}));
    expect(html).toContain("<dt>Maximum credits</dt><dd>3</dd>");
  });
});

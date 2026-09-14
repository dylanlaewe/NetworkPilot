import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
import {GmailDraftControl} from "./gmail-draft-control";

describe("GmailDraftControl",()=>{
  it("shows the reason next to a disabled action",()=>{const html=renderToStaticMarkup(<GmailDraftControl snapshotId="fixture" readiness={{available:false,reason:"gmail-feature-disabled"}} action={vi.fn()}/>);expect(html).toContain("disabled");expect(html).toContain("local Gmail draft feature is disabled");expect(html).toContain('role="status"');});
  it("enables the action when runtime readiness passes",()=>{const html=renderToStaticMarkup(<GmailDraftControl snapshotId="fixture" readiness={{available:true,reason:null}} action={vi.fn()}/>);expect(html).not.toContain("disabled");expect(html).toContain("never sends email");});
});

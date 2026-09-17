import {describe,expect,it} from "vitest";
import {activeDrafts,sentOutreach} from ".";
import type {CommandCenterDraftReview} from "@/application/command-center-drafts";
import type {ManualDraftOperatorEntry} from "@/application/manual-outreach";

const review=(state?:string,sendState?:string)=>({snapshotId:"snapshot-1",operation:state?{state,sendState}:null} as unknown as CommandCenterDraftReview);
const outreach=(manualSendConfirmed:boolean,outcome:ManualDraftOperatorEntry["outcome"]="awaiting-response")=>({snapshotId:"snapshot-1",manualSendConfirmed,outcome} as ManualDraftOperatorEntry);
describe("simplified product workflow",()=>{
  it("removes sent outreach from Drafts and includes it in Sent",()=>{expect(activeDrafts([review("gmail-draft-created","sent")],[outreach(true)])).toEqual([]);expect(sentOutreach([outreach(true)])).toHaveLength(1);});
  it("keeps uncertain sends actionable with one primary action",()=>{expect(activeDrafts([review("gmail-draft-created","send-status-uncertain")],[])[0]).toMatchObject({state:"needs-send-verification",primaryAction:"verify-send"});});
  it("shows hard bounces in Sent",()=>{expect(sentOutreach([outreach(true,"hard-bounce")])[0]?.outcome).toBe("hard-bounce");});
  it.each([[undefined,undefined,"review-and-approve"],["approved-for-gmail-draft",undefined,"create-gmail-draft"],["gmail-draft-created","not-sent","send-email"]])("projects one action for %s",(state,sendState,action)=>{expect(activeDrafts([review(state,sendState)],[])[0]?.primaryAction).toBe(action);});
});

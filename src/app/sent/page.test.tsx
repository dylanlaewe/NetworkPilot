import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach,describe,expect,it,vi} from "vitest";
import type {ManualDraftOperatorEntry} from "@/application/manual-outreach";
import SentPage from "./page";
const fixtures=vi.hoisted(()=>({drafts:[] as ManualDraftOperatorEntry[]}));
vi.mock("@/infrastructure/sqlite/daily-command-center",()=>({loadDailyCommandCenter:()=>({drafts:fixtures.drafts})}));
vi.mock("@/app/today/actions",()=>({recordOutcome:vi.fn()}));
const entry:ManualDraftOperatorEntry={operatorId:"fixture-operation",snapshotId:"fixture-snapshot",operationId:"fictional",redactedRecipient:"F*** P.",company:"Fictional company",title:"Product Analyst",subject:"Product work",gmailDraftCreated:true,manualSendConfirmed:true,effectiveSentAt:"2026-09-01T12:00:00Z",outcome:"awaiting-response",suppressed:false,responseState:"awaiting-response",outreachTrack:"professional",confirmationSource:"operator"};
const render=async(outcome?:string)=>renderToStaticMarkup(await SentPage({searchParams:Promise.resolve({outcome})}));
describe("Sent compact outreach list",()=>{
  beforeEach(()=>{fixtures.drafts=[{...entry}];});
  it("renders expandable identity, dates, outcome and labelled outcome editing",async()=>{
    const html=await render();
    for(const text of ['<details class="outreach-record"','<summary>','F*** P.','Fictional company','Product Analyst','Awaiting reply','Elapsed','Subject','Operator-confirmed manual send','<label>Outcome<select','Update outcome'])expect(html).toContain(text);
    expect(html).not.toContain("provider-confirmed");
  });
  it("distinguishes an empty filter from an empty outreach history",async()=>{
    expect(await render("replied")).toContain("No conversations match this filter.");
    fixtures.drafts=[];
    expect(await render()).toContain("No outreach sent yet.");
  });
  it("keeps unconfirmed Gmail drafts out of Sent",async()=>{
    fixtures.drafts=[{...entry,manualSendConfirmed:false}];
    expect(await render()).not.toContain('class="outreach-record"');
  });
  it("shows suppression and does not offer outcome editing for a hard bounce",async()=>{
    fixtures.drafts=[{...entry,outcome:"hard-bounce",suppressed:true,responseState:"delivery-failed"}];
    const html=await render("hard-bounce");
    expect(html).toContain("Suppressed");expect(html).toContain("Delivery failed. This address is suppressed.");
    expect(html).not.toContain("Update outcome");
  });
  it("shows only the attachment label for sent outreach and never a local storage path",async()=>{fixtures.drafts=[{...entry,resumeLabel:"Product Resume"}];const html=await render();expect(html).toContain("Resume:");expect(html).toContain("Product Resume");expect(html).not.toContain("data/resumes");expect(html).not.toContain(".sqlite");});
  it("retains all six outcome filters with accessible current selection",async()=>{
    const html=await render("replied");
    for(const outcome of ["awaiting-response","replied","meeting-scheduled","declined","hard-bounce","opt-out"])expect(html).toContain(`/sent?outcome=${outcome}`);
    expect(html).toContain('aria-current="page" href="/sent?outcome=replied"');
  });
});

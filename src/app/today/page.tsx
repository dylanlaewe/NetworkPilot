import Link from "next/link";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {loadCommandCenterDraftReviews} from "@/infrastructure/sqlite/command-center-drafts";
import {activeDrafts} from "@/application/product-workflow";
import {ProductNav} from "@/app/product-nav";
import {CandidateRefreshControl} from "@/app/candidates/refresh-control";
import {isDemoMode} from "@/demo/mode";
import {DemoToday} from "./demo-today";
import {AddDraftsControl} from "@/app/drafts/add-drafts-control";
import {generateMoreDrafts} from "./actions";

export const dynamic="force-dynamic";
const greeting=()=>{const hour=Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour:"numeric",hour12:false}).format(new Date()));return hour<12?"Good morning":hour<18?"Good afternoon":"Good evening";};
export default async function TodayPage(){
  if(isDemoMode())return <DemoToday/>;
  const data=loadDailyCommandCenter(),workflow=await loadCommandCenterDraftReviews(),drafts=activeDrafts(workflow.items,data.drafts),uncertain=drafts.filter(item=>item.state==="needs-send-verification").length,o=data.outreach.outcomes,hasAttention=drafts.length>0||o.replied>0||!workflow.gmail.readiness.available;
  return <main className="product-shell today-page"><ProductNav current="today"/>
    <header id="workspace-content" tabIndex={-1} className="product-header today-summary"><div><p className="kicker">Today</p><h1>{greeting()}, Dylan</h1><p>{drafts.length} drafts · {o["awaiting-response"]} awaiting replies · {data.pipeline.available} candidates available</p></div><span className={workflow.gmail.readiness.available?"connection-status connected":"connection-status needs-attention"}>{workflow.gmail.readiness.available?"Gmail connected":"Gmail needs attention"}</span></header>
    <div className="today-workspace">
      <section className="product-section next-actions"><div className="section-heading"><h2>{hasAttention?"Next actions":"You’re caught up."}</h2></div>
        {!hasAttention?<p className="muted">No drafts or responses need your attention.</p>:null}
        <div className="action-list">
          {uncertain>0?<Link href="/drafts"><strong>{uncertain} to verify</strong><span>Record the result before trying again</span><b>Verify send →</b></Link>:null}
          {drafts.length>0?<Link href="/drafts"><strong>Review drafts</strong><span>{drafts.length} messages in your queue</span><b>Open Drafts →</b></Link>:null}
          {o.replied>0?<Link href="/sent?outcome=replied"><strong>Review replies</strong><span>{o.replied} {o.replied===1?"response":"responses"} to follow up</span><b>Open Sent →</b></Link>:null}
          {!workflow.gmail.readiness.available?<Link href="/drafts"><strong>Gmail needs attention</strong><span>Check connection and setup details</span><b>View status →</b></Link>:null}
        </div>
      </section>
      <section className="product-section outreach-summary"><h2>Outreach status</h2><dl>
        <div><dt>Awaiting reply</dt><dd><Link href="/sent?outcome=awaiting-response">{o["awaiting-response"]}</Link></dd></div>
        <div><dt>Replied</dt><dd><Link href="/sent?outcome=replied">{o.replied}</Link></dd></div>
        <div><dt>Meetings</dt><dd><Link href="/sent?outcome=meeting-scheduled">{o["meeting-scheduled"]}</Link></dd></div>
      </dl></section>
      <section className="product-section supply-strip"><div><h2>Candidate supply</h2><p><strong>{data.pipeline.available}</strong> available for future outreach.</p><p className="form-help">Company protections still apply when adding drafts.</p></div>{data.pipeline.available>0?<AddDraftsControl action={generateMoreDrafts}/>:null}{data.pipeline.available<10?<CandidateRefreshControl available={data.pipeline.available} exposure={data.safety.apolloExposure}/>:null}</section>
    </div>
  </main>;
}

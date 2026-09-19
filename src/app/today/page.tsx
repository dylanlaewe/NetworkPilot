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
export default async function TodayPage(){if(isDemoMode())return <DemoToday/>;const data=loadDailyCommandCenter(),workflow=await loadCommandCenterDraftReviews(),drafts=activeDrafts(workflow.items,data.drafts),ready=drafts.filter((item)=>item.state==="ready"||item.state==="approved").length,uncertain=drafts.filter((item)=>item.state==="needs-send-verification").length,o=data.outreach.outcomes,hasAttention=drafts.length>0||o.replied>0||uncertain>0||!workflow.gmail.readiness.available;return <main><ProductNav current="today"/>
  <header className="product-header today-summary"><div><p className="kicker">Today</p><h1>{greeting()}, Dylan</h1><p>{ready} drafts ready · {o["awaiting-response"]} awaiting replies · {o.replied} replied</p></div><span className={workflow.gmail.readiness.available?"connection-status connected":"connection-status needs-attention"}>{workflow.gmail.readiness.available?"Gmail connected":"Gmail needs attention"}</span></header>
  <section className="product-section next-actions"><div className="section-heading"><div><h2>{hasAttention?"Needs attention":"You’re caught up."}</h2><p>{hasAttention?"The next useful actions, in order.":"No drafts or responses need action right now."}</p></div></div><div className="action-list">
    {drafts.length>0?<Link href="/drafts"><strong>{drafts.length} drafts</strong><span>Review, approve, or send the next message</span><b>Open Drafts</b></Link>:null}
    {uncertain>0?<Link href="/drafts"><strong>{uncertain} to verify</strong><span>Check Gmail, then record what happened</span><b>Verify send</b></Link>:null}
    {o.replied>0?<Link href="/sent?outcome=replied"><strong>{o.replied} replies</strong><span>Review responses and update outcomes</span><b>Open Sent</b></Link>:null}
    {!workflow.gmail.readiness.available?<Link href="/drafts"><strong>Gmail needs attention</strong><span>Reconnect Gmail before creating or sending drafts</span><b>View status</b></Link>:null}
  </div></section>
  <section className="product-section supply-strip"><div><h2>Candidate supply</h2><p><strong>{data.pipeline.available}</strong> usable candidates are ready for future outreach.</p></div>{data.pipeline.available>0?<AddDraftsControl action={generateMoreDrafts}/>:null}{data.pipeline.available<10?<CandidateRefreshControl available={data.pipeline.available} exposure={data.safety.apolloExposure}/>:null}</section>
 </main>}

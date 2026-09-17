import Link from "next/link";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {loadCommandCenterDraftReviews} from "@/infrastructure/sqlite/command-center-drafts";
import {activeDrafts} from "@/application/product-workflow";
import {ProductNav} from "@/app/product-nav";
import {CandidateRefreshControl} from "@/app/candidates/refresh-control";
import {isDemoMode} from "@/demo/mode";
import {DemoToday} from "./demo-today";

export const dynamic="force-dynamic";
const greeting=()=>{const hour=Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour:"numeric",hour12:false}).format(new Date()));return hour<12?"Good morning":hour<18?"Good afternoon":"Good evening";};
export default async function TodayPage(){if(isDemoMode())return <DemoToday/>;const data=loadDailyCommandCenter(),workflow=await loadCommandCenterDraftReviews(),drafts=activeDrafts(workflow.items,data.drafts),ready=drafts.filter((item)=>item.state==="ready"||item.state==="approved").length,o=data.outreach.outcomes;return <main><ProductNav current="today"/>
  <header className="product-header today-summary"><div><p className="kicker">Today</p><h1>{greeting()}, Dylan</h1><p>{o["awaiting-response"]} awaiting replies · {ready} ready drafts · {o["meeting-scheduled"]} meetings</p></div><CandidateRefreshControl available={data.pipeline.available}/></header>
  <section className="product-section next-actions"><div className="section-heading"><div><h2>Next actions</h2><p>Only the work that needs your attention now.</p></div></div><div className="action-list">
    <Link href="/drafts"><strong>{drafts.length} drafts</strong><span>Review, approve, or send the next message</span><b>Open Drafts</b></Link>
    <Link href="/sent?outcome=replied"><strong>{o.replied} replies</strong><span>Review responses and update outcomes</span><b>Open Sent</b></Link>
    <Link href="/sent?outcome=meeting-scheduled"><strong>{o["meeting-scheduled"]} meetings</strong><span>See scheduled conversations</span><b>Open Sent</b></Link>
    <Link href="/candidates"><strong>{data.pipeline.available} available candidates</strong><span>Browse the reserve or refresh supply</span><b>Open Candidates</b></Link>
  </div></section>
  <section className="product-section daily-note"><h2>Daily summary</h2><p>{data.outreach.replyEligible} contacts can still reply. {o["hard-bounce"]} hard bounces and {data.safety.suppressed} suppressed candidates are safely excluded from new outreach.</p><p>Gmail: {workflow.gmail.readiness.available?"ready for approved drafts":"needs attention"}. Apollo: {data.safety.apolloReady?"ready when you explicitly refresh":"disabled or unavailable"}.</p></section>
 </main>}

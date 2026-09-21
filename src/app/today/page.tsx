import Link from "next/link";
import {activeDrafts} from "@/application/product-workflow";
import {humanDraftError} from "@/application/command-center-drafts";
import {NetworkCommandShell} from "@/app/network-command-shell";
import {AddDraftsControl} from "@/app/drafts/add-drafts-control";
import {CandidateRefreshControl} from "@/app/candidates/refresh-control";
import {isDemoMode} from "@/demo/mode";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {loadCommandCenterDraftReviews} from "@/infrastructure/sqlite/command-center-drafts";
import {generateMoreDrafts} from "./actions";
import {DemoToday} from "./demo-today";
import styles from "./today-command.module.css";

export const dynamic="force-dynamic";

export default async function TodayPage(){
  if(isDemoMode())return <DemoToday/>;
  const data=loadDailyCommandCenter(),workflow=await loadCommandCenterDraftReviews();
  const drafts=activeDrafts(workflow.items,data.drafts),uncertain=drafts.filter((item)=>item.state==="needs-send-verification").length;
  const reviewable=drafts.filter((item)=>item.state==="ready").length,o=data.outreach.outcomes,relationships=o.replied+o["no-response"];
  const gmailReady=workflow.gmail.readiness.available,apolloExhausted=data.safety.apolloExposure>=20,lowSupply=data.pipeline.available<10;
  const gmailReason=workflow.gmail.readiness.reason?humanDraftError(workflow.gmail.readiness.reason):"Gmail is ready.";
  const date=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"long",month:"long",day:"numeric"}).format(new Date());
  const hasWork=uncertain>0||reviewable>0||relationships>0||!gmailReady||lowSupply;
  const health=`${gmailReady?"Gmail ready":"Gmail needs attention"} · ${apolloExhausted?"Candidate refresh tomorrow":`${Math.max(0,20-data.safety.apolloExposure)} refresh credits available`}`;
  const tasks:Array<{href:string;title:string;detail:string;count:string|number;attention?:boolean}>=[];
  if(uncertain>0)tasks.push({href:"/drafts",title:`Resolve ${uncertain} uncertain ${uncertain===1?"send":"sends"}`,detail:"Confirm the existing result before any retry.",count:uncertain});
  if(!gmailReady)tasks.push({href:workflow.gmail.connectionState==="reauthorization-required"?"/gmail/reconnect":"/drafts",title:workflow.gmail.connectionState==="reauthorization-required"?"Reconnect Gmail":"Gmail needs attention",detail:gmailReason,count:"!"});
  if(drafts.length>0)tasks.push({href:"/drafts",title:reviewable>0?`Review ${reviewable} prepared ${reviewable===1?"draft":"drafts"}`:`Continue ${drafts.length} active ${drafts.length===1?"draft":"drafts"}`,detail:"The next message is ready with intent, evidence, and safety checks.",count:drafts.length});
  if(relationships>0)tasks.push({href:"/sent",title:`${relationships} ${relationships===1?"relationship needs":"relationships need"} attention`,detail:"Review replies and follow-up decisions in Sent.",count:relationships});
  tasks.push({href:"/candidates",title:lowSupply?"Candidate supply needs attention":"Candidate supply is healthy",detail:`${data.pipeline.available} qualified candidates are available for future outreach.`,count:data.pipeline.available,attention:lowSupply});
  return <NetworkCommandShell current="today" status={health}>
    <div className={styles.today}>
      <section className={styles.now}>
        <header><p>{date}</p><h1>{hasWork?"Now":"All caught up"}</h1><span>{hasWork?"Prepared work, ordered by consequence.":"No prepared work needs attention."}</span></header>
        <div className={styles.tasks}>
          {tasks.map((task,index)=><Link key={`${task.href}-${task.title}`} href={task.href} className={task.attention?styles.attention:undefined}><i>{String(index+1).padStart(2,"0")}</i><span><strong>{task.title}</strong><small>{task.detail}</small></span><b>{task.count}</b></Link>)}
        </div>
        <div className={styles.preview}>
          <div><small>Next workspace</small><strong>{drafts.length?"Draft review":"Candidate supply"}</strong><p>{drafts.length?"Continue the active queue without losing your place.":"Review available people or replenish the bounded reserve."}</p>{drafts.length&&data.recommendation[0]?<div><span>{data.recommendation[0].recipient}</span><em>{data.recommendation[0].title}</em><b>{data.recommendation[0].company}</b></div>:null}</div>
          <Link href={drafts.length?"/drafts":"/candidates"}>Open workspace ↗</Link>
        </div>
        <div className={styles.supplyActions}>
          <div><small>Candidate supply</small><strong>{data.pipeline.available} usable · target 40</strong><p>Company protections are rechecked when drafts are added.</p></div>
          {data.pipeline.available>0?<AddDraftsControl action={generateMoreDrafts}/>:null}
          {lowSupply?<CandidateRefreshControl available={data.pipeline.available} exposure={data.safety.apolloExposure}/>:null}
        </div>
      </section>
      <aside className={styles.live}>
        <header><h2>Live state</h2><span>Local production</span></header>
        <dl>
          <div className={uncertain>0?styles.alert:undefined}><dt>Queue</dt><dd>{drafts.length} active</dd></div>
          <div className={relationships>0?styles.attentionState:undefined}><dt>Relationships</dt><dd>{data.outreach.replyEligible} awaiting</dd></div>
          <div className={lowSupply?styles.attentionState:undefined}><dt>Supply</dt><dd>{data.pipeline.available} available</dd></div>
          <div className={!gmailReady?styles.alert:undefined}><dt>Gmail</dt><dd>{gmailReady?"Ready":"Action required"}</dd></div>
          <div className={apolloExhausted?styles.attentionState:undefined}><dt>Apollo</dt><dd>{apolloExhausted?"Available tomorrow":`${data.safety.apolloExposure} of 20 used`}</dd></div>
        </dl>
        <p>{apolloExhausted?"Candidate refresh is available again tomorrow. Drafts, Gmail, and relationship work remain available.":!gmailReady?"Review remains available. Gmail actions stay safely blocked until the connection is ready.":"Healthy systems recede until they need attention."}</p>
      </aside>
    </div>
  </NetworkCommandShell>;
}

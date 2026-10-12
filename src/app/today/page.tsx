import Link from "next/link";
import {activeDrafts} from "@/application/product-workflow";
import {humanDraftError} from "@/application/command-center-drafts";
import {NetworkCommandShell} from "@/app/network-command-shell";
import {isDemoMode} from "@/demo/mode";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {loadCommandCenterDraftReviews} from "@/infrastructure/sqlite/command-center-drafts";
import {DemoToday} from "./demo-today";
import styles from "./today-command.module.css";
import {migrationRequiredView} from "@/app/migration-required";
import {fiveBucketEnabled,RECIPIENT_BUCKETS} from "@/domain/recipient-buckets";
import {loadBucketReserveMetricsForScopes} from "@/infrastructure/sqlite/bucket-reserve";

export const dynamic="force-dynamic";

async function renderTodayPage(){
  if(isDemoMode())return <DemoToday/>;
  const workflowPromise=loadCommandCenterDraftReviews(),data=loadDailyCommandCenter(),workflow=await workflowPromise;
  const drafts=activeDrafts(workflow.items,data.drafts),uncertain=drafts.filter((item)=>item.state==="needs-send-verification").length;
  const reviewable=drafts.filter((item)=>item.state==="ready").length,o=data.outreach.outcomes,relationships=o.replied+o["no-response"];
  const bucketEnabled=fiveBucketEnabled(),reserveMetrics=bucketEnabled?loadBucketReserveMetricsForScopes(RECIPIENT_BUCKETS.map((bucket)=>({bucket}))):null,available=reserveMetrics?.actionableCapacity??data.pipeline.available;
  const gmailReady=workflow.gmail.readiness.available,apolloExhausted=data.safety.apolloExposure>=20,lowSupply=available<10;
  const gmailReason=workflow.gmail.readiness.reason?humanDraftError(workflow.gmail.readiness.reason):"Gmail is ready.";
  const date=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"long",month:"long",day:"numeric"}).format(new Date());
  const health=`${gmailReady?"Gmail ready":"Gmail needs attention"} · ${apolloExhausted?"Candidate refresh tomorrow":`${Math.max(0,20-data.safety.apolloExposure)} refresh credits available`}`;
  const tasks:Array<{href:string;title:string;detail:string;count:string|number;attention?:boolean;actionLabel?:string}>=[];
  if(uncertain>0)tasks.push({href:"/drafts",title:`Resolve ${uncertain} uncertain ${uncertain===1?"send":"sends"}`,detail:"Confirm the existing result before any retry.",count:uncertain});
  if(!gmailReady)tasks.push({href:workflow.gmail.connectionState==="reauthorization-required"?"/gmail/reconnect":"/",title:workflow.gmail.connectionState==="reauthorization-required"?"Reconnect Gmail":"Gmail needs attention",detail:gmailReason,count:"!",actionLabel:workflow.gmail.connectionState==="reauthorization-required"?"Reconnect Gmail":"Open System"});
  if(drafts.length>0)tasks.push({href:"/drafts",title:reviewable>0?`Review ${reviewable} prepared ${reviewable===1?"draft":"drafts"}`:`Continue ${drafts.length} active ${drafts.length===1?"draft":"drafts"}`,detail:"The next message is ready with intent, evidence, and safety checks.",count:drafts.length});
  if(relationships>0)tasks.push({href:"/sent",title:`${relationships} ${relationships===1?"relationship needs":"relationships need"} attention`,detail:"Review replies and follow-up decisions in Sent.",count:relationships});
  tasks.push({href:"/candidates",title:lowSupply?"Candidate supply needs attention":"Candidate supply is healthy",detail:`${available} actionable ${available===1?"person is":"people are"} available across the reviewed recipient groups.`,count:available,attention:lowSupply});
  const hasWork=tasks.length>0;
  const primary=tasks[0];
  const later=tasks.slice(1).filter((task)=>task.attention||task.href!=="/candidates");
  return <NetworkCommandShell current="today" status={health}>
    <div className={styles.today}>
      <section className={styles.now}>
        <header><p>{date}</p><h1>{hasWork?"Today":"All caught up"}</h1><span>{hasWork?"One clear next step.":"No prepared work needs attention."}</span></header>
        {primary?<article className={styles.primaryTask}>
          <div><span>{primary.count}</span><div><h2>{primary.title}</h2><p>{primary.detail}</p></div></div>
          <Link href={primary.href}>{primary.actionLabel??"Continue"}</Link>
        </article>:null}
        {later.length?<section className={styles.later}><h2>After that</h2>{later.map(task=><Link key={`${task.href}-${task.title}`} href={task.href}><span><strong>{task.title}</strong><small>{task.detail}</small></span><b>{task.count}</b></Link>)}</section>:null}
      </section>
      {uncertain>0||!gmailReady?<details className={styles.live} open>
        <summary>{uncertain>0||!gmailReady?"System attention required":"Systems healthy"}</summary>
        <header><h2>Operational state</h2><span>Local production</span></header>
        <dl>
          <div className={uncertain>0?styles.alert:undefined}><dt>Queue</dt><dd>{drafts.length} active</dd></div>
          <div className={relationships>0?styles.attentionState:undefined}><dt>Relationships</dt><dd>{data.outreach.replyEligible} awaiting</dd></div>
          <div className={lowSupply?styles.attentionState:undefined}><dt>Supply</dt><dd>{available} actionable</dd></div>
          <div className={!gmailReady?styles.alert:undefined}><dt>Gmail</dt><dd>{gmailReady?"Ready":"Action required"}</dd></div>
          <div className={apolloExhausted?styles.attentionState:undefined}><dt>Apollo</dt><dd>{apolloExhausted?"Available tomorrow":`${data.safety.apolloExposure} of 20 used`}</dd></div>
        </dl>
        <p>{apolloExhausted?"Candidate refresh is available again tomorrow. Drafts, Gmail, and relationship work remain available.":!gmailReady?"Review remains available. Gmail actions stay safely blocked until the connection is ready.":"Healthy systems recede until they need attention."}</p>
      </details>:null}
    </div>
  </NetworkCommandShell>;
}
export default async function TodayPage(){try{return await renderTodayPage();}catch(error){return migrationRequiredView(error);}}

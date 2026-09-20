import Link from "next/link";
import {sentOutreach} from "@/application/product-workflow";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {ProductNav} from "@/app/product-nav";
import {recordOutcome} from "@/app/today/actions";
export const dynamic="force-dynamic";
const label=(value:string)=>({"awaiting-response":"Awaiting reply","replied":"Replied","meeting-scheduled":"Meeting","declined":"Declined","hard-bounce":"Bounced","opt-out":"Opt-out","no-response":"No response"}[value]??value.replaceAll("-"," "));
const elapsed=(sent:string|null)=>{if(!sent)return "—";const days=Math.max(0,Math.floor((Date.now()-new Date(sent).getTime())/86400000));return days===0?"Today":days===1?"1 day ago":`${days} days ago`;};
const filters=["awaiting-response","replied","meeting-scheduled","declined","hard-bounce","opt-out"];
export default async function SentPage({searchParams}:{searchParams:Promise<{outcome?:string}>}){
  const params=await searchParams,all=sentOutreach(loadDailyCommandCenter().drafts),rows=params.outcome?all.filter(row=>row.outcome===params.outcome):all;
  return <main className="product-shell sent-page"><ProductNav current="sent"/>
    <header id="workspace-content" tabIndex={-1} className="product-header compact-header"><div><h1>Sent</h1><p>Conversations and their latest outcome.</p></div><strong>{all.length} contacted</strong></header>
    <section className="product-section">
      <nav className="crm-filters" aria-label="Outcome filters"><Link aria-current={!params.outcome?"page":undefined} href="/sent">All</Link>{filters.map(filter=><Link aria-current={params.outcome===filter?"page":undefined} key={filter} href={`/sent?outcome=${filter}`}>{label(filter)}</Link>)}</nav>
      {rows.length===0?<div className="empty"><strong>{all.length?"No conversations match this filter.":"No outreach sent yet."}</strong><p>{all.length?"Choose another outcome to see your conversations.":"Sent messages will appear here automatically."}</p><Link className="text-action" href={all.length?"/sent":"/drafts"}>{all.length?"View all outreach":"Open Drafts"}</Link></div>:<div className="outreach-list">
        <div className="outreach-columns" aria-hidden="true"><span>Person / role</span><span>Company</span><span>Sent</span><span>Outcome</span><span>Elapsed</span><span/></div>
        {rows.map(row=><details className="outreach-record" key={row.operatorId}><summary>
          <span className="outreach-person"><strong>{row.redactedRecipient}</strong><small>{row.title}</small></span><span className="outreach-company">{row.company}</span>
          <span className="outreach-date"><span className="mobile-label">Sent </span>{row.effectiveSentAt?new Date(row.effectiveSentAt).toLocaleDateString():"—"}</span>
          <span className="outcome-label" data-outcome={row.outcome}>{label(row.outcome??"awaiting-response")}{row.suppressed?<small>Suppressed</small>:null}</span><span className="elapsed">{elapsed(row.effectiveSentAt)}</span><span className="detail-chevron" aria-hidden="true">⌄</span>
        </summary><div className="outreach-detail">
          <div><span className="field-caption">Subject</span><p>{row.subject}</p><p className="form-help">{row.outreachTrack??"professional"} · {row.confirmationSource==="networkpilot-gmail-send"?"Sent through NetworkPilot Gmail":"Operator-confirmed manual send"}</p></div>
          {row.outcome==="hard-bounce"?<p className="block-message">Delivery failed. This address is suppressed.</p>:<form action={recordOutcome} className="compact-action"><input type="hidden" name="id" value={row.operatorId}/><label>Outcome<select name="outcome" defaultValue={row.outcome??"awaiting-response"}><option value="awaiting-response">Awaiting reply</option><option value="replied">Replied</option><option value="meeting-scheduled">Meeting</option><option value="declined">Declined</option><option value="opt-out">Opt-out</option><option value="no-response">No response</option></select></label><button>Update outcome</button></form>}
        </div></details>)}
      </div>}
    </section>
  </main>;
}

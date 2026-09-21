"use client";
import Link from "next/link";
import {useMemo,useState} from "react";
import {recordOutcome} from "@/app/today/actions";
import type {RelationshipWorkspaceEntry} from "@/infrastructure/sqlite/relationship-workspace";
import styles from "./sent-command.module.css";

const labels:Record<string,string>={"awaiting-response":"Awaiting reply",replied:"Replied","meeting-scheduled":"Meeting",declined:"Declined","hard-bounce":"Bounced","opt-out":"Opt-out","no-response":"No response"};
const filters=["awaiting-response","replied","meeting-scheduled","declined","hard-bounce","opt-out"];
const date=(value:string|null)=>value?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value)):"—";
const elapsed=(sent:string|null)=>{if(!sent)return "—";const days=Math.max(0,Math.floor((Date.now()-new Date(sent).getTime())/86400000));return days===0?"Today":days===1?"1 day ago":`${days} days ago`;};

export function RelationshipWorkspace({rows,total,outcome,initialSelectedId}:{rows:RelationshipWorkspaceEntry[];total:number;outcome?:string;initialSelectedId?:string}){
  const [selectedId,setSelectedId]=useState<string|null>(initialSelectedId??null),selected=useMemo(()=>rows.find(row=>row.operatorId===selectedId)??null,[rows,selectedId]);
  return <div className={styles.page} data-detail-open={Boolean(selected)}>
    <header className={styles.header}><div><p>Relationship memory</p><h1>Sent</h1><span>Who you contacted, what you sent, and what happened next.</span></div><strong>{total} contacted</strong></header>
    <div className={styles.filterBar}>
      <nav className={styles.filters} aria-label="Outcome filters"><Link aria-current={!outcome?"page":undefined} href="/sent">All</Link>{filters.map(filter=><Link aria-current={outcome===filter?"page":undefined} key={filter} href={`/sent?outcome=${filter}`}>{labels[filter]}</Link>)}</nav>
      <label className={styles.mobileFilter}><span>Relationship view</span><select aria-label="Filter relationships by outcome" defaultValue={outcome??""} onChange={event=>{window.location.assign(event.currentTarget.value?`/sent?outcome=${event.currentTarget.value}`:"/sent");}}><option value="">All relationships</option>{filters.map(filter=><option key={filter} value={filter}>{labels[filter]}</option>)}</select></label>
    </div>
    {!rows.length?<section className={styles.empty}><strong>{total?"No relationships match this view.":"No outreach sent yet."}</strong><p>{total?"Choose another outcome to continue.":"Sent messages will appear here as relationship history."}</p></section>:<div className={styles.workspace}>
      <section className={styles.list} aria-label="Relationships">{rows.map(row=><button key={row.operatorId} type="button" aria-pressed={selected?.operatorId===row.operatorId} onClick={()=>setSelectedId(row.operatorId)}><span className={styles.avatar} aria-hidden="true">{row.redactedRecipient.charAt(0)}</span><span className={styles.identity}><strong>{row.redactedRecipient}</strong><small>{row.title}</small><em>{row.company}</em></span><span className={styles.state} data-outcome={row.outcome}>{labels[row.outcome??"awaiting-response"]}<small>{elapsed(row.effectiveSentAt)}</small></span></button>)}</section>
      {selected?<aside className={styles.inspector} aria-label={`Relationship with ${selected.redactedRecipient}`}><button className={styles.mobileBack} onClick={()=>setSelectedId(null)}>← Relationships</button><header><span className={styles.avatar}>{selected.redactedRecipient.charAt(0)}</span><div><p>{labels[selected.outcome??"awaiting-response"]}</p><h2>{selected.redactedRecipient}</h2><span>{selected.title}<br/>{selected.company}</span></div></header>
        <dl className={styles.facts}><div><dt>Sent</dt><dd>{date(selected.effectiveSentAt)}</dd></div><div><dt>Track</dt><dd>{selected.outreachTrack==="recruiter"?"Recruiter":"Professional"}</dd></div><div><dt>Provenance</dt><dd>{selected.confirmationSource==="networkpilot-gmail-send"?"Sent through NetworkPilot Gmail":"Operator-confirmed manual send"}</dd></div>{selected.resumeLabel?<div><dt>Attachment</dt><dd>{selected.resumeLabel}</dd></div>:null}</dl>
        <section className={styles.message}><small>Message sent</small><strong>{selected.subject}</strong><p>{selected.body}</p></section>
        <section className={styles.timeline}><h3>Timeline</h3><ol>{selected.timeline.map((event,index)=><li key={`${event.at}-${index}`}><i/><div><strong>{event.label}</strong>{event.detail?<span>{event.detail}</span>:null}<time>{date(event.at)}</time></div></li>)}</ol></section>
        {selected.outcome==="hard-bounce"?<p className={styles.blocked}>Delivery failed. This address remains suppressed.</p>:<form action={recordOutcome} className={styles.outcome}><input type="hidden" name="id" value={selected.operatorId}/><label htmlFor="relationship-outcome">Current outcome</label><div><select id="relationship-outcome" name="outcome" defaultValue={selected.outcome??"awaiting-response"}><option value="awaiting-response">Awaiting reply</option><option value="replied">Replied</option><option value="meeting-scheduled">Meeting</option><option value="declined">Declined</option><option value="opt-out">Opt-out</option><option value="no-response">No response</option></select><button>Update outcome</button></div></form>}
      </aside>:<aside className={styles.placeholder}><span>Relationship detail</span><strong>Select a person</strong><p>Review the sent message, timeline, and current outcome without losing your place.</p></aside>}
    </div>}
  </div>;
}

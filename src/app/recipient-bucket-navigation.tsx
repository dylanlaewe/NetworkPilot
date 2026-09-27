"use client";

import Link from "next/link";
import {useEffect,useState,type ChangeEvent,type MouseEvent} from "react";
import styles from "./recipient-bucket-navigation.module.css";

export const recipientBuckets=[
  {id:"recruiters",label:"Recruiters"},
  {id:"peers",label:"Peers & practitioners"},
  {id:"managers",label:"Managers & team leaders"},
  {id:"executives",label:"Executives"},
  {id:"ceos",label:"CEOs & presidents"},
] as const;
export type RecipientBucket=(typeof recipientBuckets)[number]["id"];
export type BucketSelection="all"|"legacy"|RecipientBucket;
export type BucketSection="drafts"|"sent"|"candidates";
export type RecipientBucketCounts=Partial<Record<RecipientBucket,number>>;

export interface BucketNavigationData {
  enabled:true;
  current:BucketSection;
  selected:BucketSelection;
  counts:RecipientBucketCounts;
  legacyCount?:number;
  earlyCareerOnly?:boolean;
  total:number;
  preservedQuery?:Record<string,string|undefined>;
}

const sections:BucketSection[]=["drafts","sent","candidates"];
const title=(value:string)=>value.charAt(0).toUpperCase()+value.slice(1);
const contextKey="networkpilot.bucket-context.v1";

function withBucket(path:BucketSection,bucket:BucketSelection,query:BucketNavigationData["preservedQuery"]){
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(query??{}))if(key!=="bucket"&&key!=="earlyCareerOnly"&&value!==undefined)params.set(key,value);
  if(bucket!=="all")params.set("bucket",bucket);
  if(bucket==="peers"&&query?.earlyCareerOnly==="true")params.set("earlyCareerOnly","true");
  const suffix=params.toString();return `/${path}${suffix?`?${suffix}`:""}`;
}

function storedContext():Partial<Record<BucketSection,BucketSelection>>{
  try{return JSON.parse(sessionStorage.getItem(contextKey)??"{}");}catch{return {};}
}

function remember(path:BucketSection,bucket:BucketSelection){
  try{sessionStorage.setItem(contextKey,JSON.stringify({...storedContext(),[path]:bucket}));}catch{/* Storage may be unavailable in a private browsing context. */}
}

export function RecipientBucketNavigation({data}:{data:BucketNavigationData}){
  const [open,setOpen]=useState<Partial<Record<BucketSection,boolean>>>(()=>({[data.current]:true}));
  const selectedLabel=data.selected==="all"?"All":data.selected==="legacy"?"Legacy / unclassified":recipientBuckets.find(bucket=>bucket.id===data.selected)?.label??"All";
  const current=data.current,selected=data.selected;
  useEffect(()=>{remember(current,selected);},[current,selected]);
  const chooseWorkspace=(event:MouseEvent<HTMLAnchorElement>,path:BucketSection)=>{
    if(path===data.current)return;
    event.preventDefault();
    const remembered=storedContext()[path]??"all";
    window.location.assign(withBucket(path,remembered,path===data.current?data.preservedQuery:undefined));
  };
  const selectBucket=(event:ChangeEvent<HTMLSelectElement>)=>{
    const bucket=event.currentTarget.value as BucketSelection;remember(data.current,bucket);
    window.location.assign(withBucket(data.current,bucket,data.preservedQuery));
  };
  return <>
    <nav className={styles.desktop} aria-label="Primary navigation">
      <Link className={styles.today} href="/today" aria-current={undefined}><span aria-hidden="true">○</span><b>Today</b></Link>
      {sections.map(section=>{
        const active=section===data.current,expanded=Boolean(open[section]),sectionId=`bucket-links-${section}`;
        return <section className={styles.section} key={section} data-active={active?"true":undefined}>
          <div className={styles.sectionHeader}>
            <Link href={withBucket(section,active?data.selected:"all",section===data.current?data.preservedQuery:undefined)} aria-current={active&&data.selected==="all"?"page":undefined} onClick={event=>chooseWorkspace(event,section)}>
              <span>{title(section)}</span>{active?<small>{data.total}</small>:null}
            </Link>
            <button type="button" aria-label={`${expanded?"Collapse":"Expand"} ${section} bucket navigation`} aria-expanded={expanded} aria-controls={sectionId} onClick={()=>setOpen(value=>({...value,[section]:!value[section]}))}>{expanded?"⌄":"›"}</button>
          </div>
          <div id={sectionId} className={styles.bucketLinks} hidden={!expanded}>
            <Link href={withBucket(section,"all",section===data.current?data.preservedQuery:undefined)} aria-current={section===data.current&&data.selected==="all"?"page":undefined} onClick={()=>remember(section,"all")}><span>All {section}</span><small>{section===data.current?data.total:0}</small></Link>
            {recipientBuckets.map(bucket=><Link key={bucket.id} href={withBucket(section,bucket.id,section===data.current?data.preservedQuery:undefined)} aria-current={section===data.current&&data.selected===bucket.id?"page":undefined} onClick={()=>remember(section,bucket.id)}><span>{bucket.label}</span><small>{section===data.current?data.counts[bucket.id]??0:0}</small></Link>)}
            <Link href={withBucket(section,"legacy",section===data.current?data.preservedQuery:undefined)} aria-current={section===data.current&&data.selected==="legacy"?"page":undefined} onClick={()=>remember(section,"legacy")}><span>Legacy / unclassified</span><small>{section===data.current?data.legacyCount??0:0}</small></Link>
          </div>
        </section>;
      })}
      <div className={styles.secondary}><Link href="/resumes">Resumes</Link><Link href="/">System</Link></div>
    </nav>
    <div className={styles.mobile} aria-label="Workspace and recipient bucket">
      <label><span>Workspace</span><select aria-label="Select workspace" value={data.current} onChange={event=>window.location.assign(withBucket(event.currentTarget.value as BucketSection,storedContext()[event.currentTarget.value as BucketSection]??"all",undefined))}>{sections.map(section=><option key={section} value={section}>{title(section)}</option>)}</select></label>
      <label><span>Bucket</span><select aria-label="Select recipient bucket" value={data.selected} onChange={selectBucket}><option value="all">All {data.current} · {data.total}</option>{recipientBuckets.map(bucket=><option key={bucket.id} value={bucket.id}>{bucket.label} · {data.counts[bucket.id]??0}</option>)}<option value="legacy">Legacy / unclassified · {data.legacyCount??0}</option></select></label>
      {data.current==="drafts"&&data.selected==="peers"?<label className={styles.earlyCareer}><input type="checkbox" checked={Boolean(data.earlyCareerOnly)} onChange={event=>{const query={...data.preservedQuery,earlyCareerOnly:event.currentTarget.checked?"true":undefined};window.location.assign(withBucket(data.current,"peers",query));}}/><span>Early-career only</span></label>:null}
      <span className={styles.mobileCount} aria-live="polite">{selectedLabel} · {data.selected==="all"?data.total:data.selected==="legacy"?data.legacyCount??0:data.counts[data.selected]??0}</span>
    </div>
  </>;
}

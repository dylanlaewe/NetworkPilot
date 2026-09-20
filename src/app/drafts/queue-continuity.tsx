"use client";

import {useEffect} from "react";
import {queueScrollTop,readQueuePosition} from "./queue-position";

const storageKey="networkpilot:draft-queue-position";

// Browser-only reading position. No action arguments, lifecycle state or records change.
export function QueueContinuity({completionKey}:{completionKey:string}){
  useEffect(()=>{
    let frame=0;
    try{
      const saved=sessionStorage.getItem(storageKey);
      if(saved){
        sessionStorage.removeItem(storageKey);
        const position=readQueuePosition(saved,Date.now());
        if(position){
          frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
            const rows=document.querySelectorAll<HTMLElement>(".draft-table-row");
            const row=position.index>=0?rows[Math.min(position.index,rows.length-1)]:undefined;
            window.scrollTo({top:queueScrollTop(position,window.scrollY,row?.getBoundingClientRect().top),behavior:"instant"});
            row?.querySelector<HTMLElement>('a.primary-action,button:not(:disabled)')?.focus({preventScroll:true});
          });});
        }
      }
    }catch{/* Storage may be unavailable; normal browser navigation remains usable. */}
    const remember=(event:Event)=>{
      const target=event.target instanceof Element?event.target:null;
      if(event.type==="click"&&!target?.closest('a[href^="/drafts/review"]'))return;
      const row=target?.closest<HTMLElement>(".draft-table-row"),rows=Array.from(document.querySelectorAll(".draft-table-row"));
      try{sessionStorage.setItem(storageKey,JSON.stringify({index:row?rows.indexOf(row):-1,top:row?.getBoundingClientRect().top??0,y:window.scrollY,at:Date.now()}));}catch{}
    };
    document.addEventListener("submit",remember,true);document.addEventListener("click",remember,true);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener("submit",remember,true);document.removeEventListener("click",remember,true);};
  },[completionKey]);
  return null;
}

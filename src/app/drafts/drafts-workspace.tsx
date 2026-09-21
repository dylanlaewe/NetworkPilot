"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState,type ReactNode,type RefObject} from "react";
import {
  approveEditedDraft,
  confirmAlreadySent,
  createGmailDraft,
  generateMoreDrafts,
  permanentlyExcludeDraft,
  reconcileGmailSendStatus,
  replaceDraft,
  sendGmailDraft,
  skipDraft,
} from "@/app/today/actions";
import {workspacePrimaryBlockReason,type WorkspaceDraft,type WorkspaceDraftState,type WorkspaceResume} from "./workspace-data";
import styles from "./drafts-workspace.module.css";

const stateOrder:WorkspaceDraftState[]=["ready","approved","gmail-draft-created","needs-send-verification"];
const stateLabels:Record<WorkspaceDraftState,string>={ready:"Needs review",approved:"Approved","gmail-draft-created":"Gmail created","needs-send-verification":"Needs verification"};
const stateGlyph:Record<WorkspaceDraftState,string>={ready:"○",approved:"✓","gmail-draft-created":"▣","needs-send-verification":"?"};
const actionLabels:Record<WorkspaceDraftState,string>={ready:"Approve draft",approved:"Create Gmail Draft","gmail-draft-created":"Send email","needs-send-verification":"Resolve send status"};

type Feedback={tone:"success"|"caution"|"error";message:string}|null;

function isTypingTarget(target:EventTarget|null){return target instanceof HTMLElement&&target.matches("input,textarea,select,[contenteditable='true']");}

function useDialogFocus(open:boolean,onClose:()=>void,returnFocus?:RefObject<HTMLElement|null>){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null,fallback=returnFocus?.current,root=ref.current,focusable=()=>Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')??[]),frame=requestAnimationFrame(()=>focusable()[0]?.focus());
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();onClose();return;}
      if(event.key!=="Tab")return;
      const items=focusable();if(!items.length)return;
      const first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener("keydown",key);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener("keydown",key);const target=previous&&previous!==document.body?previous:fallback;requestAnimationFrame(()=>target?.focus());};
  },[onClose,open,returnFocus]);
  return ref;
}

function SafeDialog({open,label,onClose,children,className,returnFocus}:{open:boolean;label:string;onClose:()=>void;children:ReactNode;className:string;returnFocus?:RefObject<HTMLElement|null>}){
  const ref=useDialogFocus(open,onClose,returnFocus);
  if(!open)return null;
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target)onClose();}}><div ref={ref} className={className} role="dialog" aria-modal="true" aria-label={label}>{children}</div></div>;
}

export function DraftsWorkspace({drafts,resumes,gmailAvailable,gmailReason,hasReserve,initialCandidateId,initialMobileReview=false,feedback}:{drafts:WorkspaceDraft[];resumes:WorkspaceResume[];gmailAvailable:boolean;gmailReason:string|null;hasReserve:boolean;initialCandidateId?:string;initialMobileReview?:boolean;feedback:Feedback}){
  const initial=drafts.find((draft)=>draft.candidateId===initialCandidateId)??drafts[0]??null;
  const [selectedId,setSelectedId]=useState(initial?.candidateId??"");
  const [mobileReview,setMobileReview]=useState(initialMobileReview);
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [sendOpen,setSendOpen]=useState(false);
  const [reconcileOpen,setReconcileOpen]=useState(false);
  const queueRef=useRef<HTMLDivElement>(null);
  const subjectRef=useRef<HTMLInputElement>(null);
  const approveRef=useRef<HTMLFormElement>(null);
  const skipRef=useRef<HTMLFormElement>(null);
  const replaceRef=useRef<HTMLFormElement>(null);
  const createRef=useRef<HTMLFormElement>(null);
  const addRef=useRef<HTMLDetailsElement>(null);
  const commandTriggerRef=useRef<HTMLButtonElement>(null);
  const primaryRef=useRef<HTMLButtonElement>(null);
  const closePalette=useCallback(()=>{setPaletteOpen(false);requestAnimationFrame(()=>commandTriggerRef.current?.focus());},[]);
  const closeSend=useCallback(()=>{setSendOpen(false);requestAnimationFrame(()=>primaryRef.current?.focus());},[]);
  const closeReconcile=useCallback(()=>{setReconcileOpen(false);requestAnimationFrame(()=>primaryRef.current?.focus());},[]);
  const selected=drafts.find((draft)=>draft.candidateId===selectedId)??drafts[0]??null;
  const selectedIndex=selected?drafts.findIndex((draft)=>draft.candidateId===selected.candidateId):-1;
  const counts=useMemo(()=>Object.fromEntries(stateOrder.map((state)=>[state,drafts.filter((draft)=>draft.state===state).length])) as Record<WorkspaceDraftState,number>,[drafts]);
  const nextCandidateId=selectedIndex>=0?(drafts[selectedIndex+1]??drafts[selectedIndex-1])?.candidateId??"":"";
  const primaryReason=workspacePrimaryBlockReason(selected,gmailAvailable,gmailReason);
  const primaryBlocked=Boolean(primaryReason);

  const select=useCallback((candidateId:string,openReview=false)=>{
    setSelectedId(candidateId);if(openReview)setMobileReview(true);
    const url=new URL(window.location.href);url.searchParams.set("candidate",candidateId);window.history.replaceState(null,"",url);
  },[]);
  const move=useCallback((step:1|-1)=>{
    if(!drafts.length)return;
    const index=Math.max(0,drafts.findIndex((draft)=>draft.candidateId===selectedId));
    const next=drafts[Math.min(drafts.length-1,Math.max(0,index+step))];
    if(next){select(next.candidateId);requestAnimationFrame(()=>document.getElementById(`queue-${next.candidateId}`)?.scrollIntoView({block:"nearest"}));}
  },[drafts,select,selectedId]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        if(sendOpen)closeSend();else if(reconcileOpen)closeReconcile();else if(paletteOpen)closePalette();else if(mobileReview)setMobileReview(false);
        return;
      }
      if(sendOpen||reconcileOpen||paletteOpen)return;
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setPaletteOpen(true);return;}
      if(isTypingTarget(event.target)||event.metaKey||event.ctrlKey||event.altKey)return;
      const key=event.key.toLowerCase();
      if(key==="j"||key==="k"){event.preventDefault();move(key==="j"?1:-1);}
      else if(key==="enter"){event.preventDefault();setMobileReview(true);subjectRef.current?.focus();}
      else if(key==="e"&&selected?.state==="ready"){event.preventDefault();subjectRef.current?.focus();}
      else if(key==="a"&&selected?.state==="ready"&&!selected.blockedReason){event.preventDefault();approveRef.current?.requestSubmit();}
      else if(key==="r"&&selected?.state!=="needs-send-verification"){event.preventDefault();replaceRef.current?.requestSubmit();}
      else if(key==="x"&&selected?.state!=="needs-send-verification"){event.preventDefault();skipRef.current?.requestSubmit();}
      else if(key==="n"){event.preventDefault();if(addRef.current)addRef.current.open=true;}
    };
    document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);
  },[closePalette,closeReconcile,closeSend,mobileReview,move,paletteOpen,reconcileOpen,selected,sendOpen]);

  const runPrimary=()=>{
    if(!selected)return;
    if(selected.state==="ready")approveRef.current?.requestSubmit();
    else if(selected.state==="approved")createRef.current?.requestSubmit();
    else if(selected.state==="gmail-draft-created")setSendOpen(true);
    else setReconcileOpen(true);
  };

  return <main className={styles.shell} data-mobile-review={mobileReview?"true":undefined}>
    <a className={styles.skipLink} href="#draft-message">Skip to selected message</a>
    <header className={styles.commandBar}>
      <Link className={styles.brand} href="/today"><span>N</span><strong>NetworkPilot</strong><em>Command</em></Link>
      <button ref={commandTriggerRef} className={styles.commandTrigger} onClick={()=>setPaletteOpen(true)}>Jump or run a command <kbd>⌘ K</kbd></button>
      <span className={styles.gmailState}>{gmailAvailable?"Gmail ready":"Gmail unavailable"}</span>
      <Link className={styles.supportLink} href="/">System</Link>
    </header>
    <nav className={styles.rail} aria-label="Primary navigation">
      <Link href="/today"><span>○</span><b>Today</b></Link>
      <Link href="/drafts" aria-current="page"><span>⌁</span><small>{drafts.length}</small><b>Drafts</b></Link>
      <Link href="/sent"><span>✓</span><b>Sent</b></Link>
      <Link href="/candidates"><span>◇</span><b>Candidates</b></Link>
    </nav>
    <section id="workspace-content" className={styles.workspace}>
      <header className={styles.contextBar}>
        <div><h1>Drafts</h1><span>{drafts.length} active · {counts.ready} need review</span></div>
        <div className={styles.counts} aria-label="Draft state counts">{stateOrder.map((state)=><span key={state}>{stateLabels[state]} <b>{counts[state]}</b></span>)}</div>
        <details className={styles.addDrafts} ref={addRef}>
          <summary>Add drafts <kbd>N</kbd></summary>
          <div><strong>Add from reserve</strong><p>Adds candidates without replacing the queue or calling a provider.</p>{hasReserve?<><form action={generateMoreDrafts}><input type="hidden" name="candidateId" value={selected?.candidateId??""}/><button name="additionalDraftCount" value="5">Add 5</button><button name="additionalDraftCount" value="10">Add 10</button></form><form action={generateMoreDrafts}><input type="hidden" name="candidateId" value={selected?.candidateId??""}/><label>Custom, 1–20<input name="additionalDraftCount" type="number" min="1" max="20" defaultValue="5" required/></label><button>Add custom</button></form></>:<p role="status">The qualified reserve is empty. <Link href="/candidates">Refresh Candidates</Link> when provider use is appropriate.</p>}</div>
        </details>
      </header>
      {feedback?<p className={styles.feedback} data-tone={feedback.tone} role={feedback.tone==="error"?"alert":"status"}>{feedback.message}</p>:null}
      {drafts.length===0?<div className={styles.empty}><span>—</span><h2>No drafts waiting for review</h2><p>{hasReserve?"Add another bounded batch from the qualified reserve.":"The queue and qualified reserve are both empty."}</p>{!hasReserve?<Link href="/candidates">Refresh Candidates</Link>:null}</div>:<>
        <div className={styles.queue} ref={queueRef} role="listbox" aria-label="Active draft queue" tabIndex={-1}>
          <div className={styles.planeLabel}><span>Queue</span><kbd>J / K</kbd></div>
          {stateOrder.map((state)=>{const group=drafts.filter((draft)=>draft.state===state);return group.length?<section key={state}><h2><span>{stateGlyph[state]} {stateLabels[state]}</span><b>{group.length}</b></h2>{group.map((draft)=><button id={`queue-${draft.candidateId}`} key={draft.candidateId} role="option" aria-selected={selected?.candidateId===draft.candidateId} data-state={draft.state} onClick={()=>select(draft.candidateId,window.matchMedia("(max-width: 860px)").matches)}><span><strong>{draft.recipient}</strong><small>{draft.company}</small></span><em>{draft.title}</em><i>{stateGlyph[draft.state]} {stateLabels[draft.state]}</i></button>)}</section>:null;})}
        </div>
        {selected?<>
          <article id="draft-message" className={styles.message} data-state={selected.state} tabIndex={-1}>
            <button className={styles.mobileBack} onClick={()=>setMobileReview(false)}>← Queue <span>{selectedIndex+1} of {drafts.length}</span></button>
            <div className={styles.planeLabel}><span>Message</span><em>{stateGlyph[selected.state]} {stateLabels[selected.state]}</em></div>
            <form id={`approve-${selected.candidateId}`} ref={approveRef} action={approveEditedDraft} onSubmit={(event)=>{if(selected.state!=="ready")event.preventDefault();}} className={styles.editor} key={`${selected.candidateId}-${selected.state}`}>
              <input type="hidden" name="snapshotId" value={selected.snapshotId}/><input type="hidden" name="candidateId" value={selected.candidateId}/>
              <header className={styles.messageHeader}><div><small>To</small><strong>{selected.recipient}</strong><span>{selected.title}</span><b>{selected.company}</b></div><label className={styles.resume}><span>Attachment</span>{selected.state==="ready"?<select name="resumeId" defaultValue="" aria-label="Resume attachment"><option value="">None</option>{resumes.map((resume)=><option key={resume.id} value={resume.id}>{resume.label} · {resume.lane}</option>)}</select>:<><strong>{selected.attachment?.label??"None"}</strong><small>{selected.attachment?.filename??"No attachment"}</small></>}</label></header>
              {selected.state!=="ready"?<div className={styles.sealed}><span>{stateGlyph[selected.state]} Approved snapshot</span><small>{selected.approvedAt?`Locked ${new Date(selected.approvedAt).toLocaleDateString()}`:"Immutable approved content"}</small></div>:null}
              {selected.blockedMessage?<p className={styles.blocked} role="alert">{selected.blockedMessage}</p>:null}
              <label className={styles.subject}><span>Subject</span><input ref={subjectRef} name="subject" defaultValue={selected.subject} readOnly={selected.state!=="ready"} required maxLength={64}/></label>
              <label className={styles.body}><span className={styles.srOnly}>Message body</span><textarea name="body" defaultValue={selected.body} readOnly={selected.state!=="ready"} required rows={14}/></label>
              <details className={styles.mobileEvidence}><summary>Context and evidence</summary><Inspector draft={selected}/></details>
            </form>
          </article>
          <aside className={styles.inspector}><div className={styles.planeLabel}><span>Inspector</span><em>Secondary</em></div><Inspector draft={selected}/>{selected.manualOperatorId?<details className={styles.manualFallback}><summary>Sent outside NetworkPilot?</summary><form action={confirmAlreadySent}><input type="hidden" name="id" value={selected.manualOperatorId}/><label>Sent time<input type="datetime-local" name="sentAt" required/></label><button name="confirmation" value="confirmed">Record manual send</button></form></details>:null}</aside>
          <footer className={styles.dock} data-state={selected.state}>
            <div className={styles.secondaryActions}>
              {selected.state!=="needs-send-verification"?<><form ref={skipRef} action={skipDraft}><input type="hidden" name="candidateId" value={selected.candidateId}/><input type="hidden" name="nextCandidateId" value={nextCandidateId}/><button>Skip <kbd>X</kbd></button></form><form ref={replaceRef} action={replaceDraft}><input type="hidden" name="candidateId" value={selected.candidateId}/><input type="hidden" name="nextCandidateId" value={nextCandidateId}/><button>Replace <kbd>R</kbd></button></form><details><summary>More</summary><form action={permanentlyExcludeDraft}><input type="hidden" name="candidateId" value={selected.candidateId}/><input type="hidden" name="nextCandidateId" value={nextCandidateId}/><p>Remove this person from all future outreach?</p><button name="confirmation" value="do-not-show-again">Don&apos;t show this person again</button></form></details></>:null}
            </div>
            <span className={styles.progress}><i>{stateGlyph[selected.state]}</i><b>{stateLabels[selected.state]}</b><small>{selectedIndex+1} of {drafts.length}</small></span>
            <div className={styles.primaryArea}>
              {selected.state==="approved"?<form ref={createRef} action={createGmailDraft}><input type="hidden" name="snapshotId" value={selected.snapshotId}/></form>:null}
              {selected.state==="approved"&&!gmailAvailable?<small role="status">{gmailReason}</small>:selected.state==="gmail-draft-created"&&selected.sendBlockedMessage?<small role="status">{selected.sendBlockedMessage}</small>:null}
              <button ref={primaryRef} type="button" className={styles.primary} onClick={runPrimary} disabled={primaryBlocked}>{actionLabels[selected.state]} <kbd>{selected.state==="ready"?"A":selected.state==="approved"?"G":selected.state==="gmail-draft-created"?"S":"U"}</kbd></button>
            </div>
          </footer>
        </>:null}
      </>}
    </section>
    <nav className={styles.mobileNav} aria-label="Mobile navigation"><Link href="/today">Today</Link><Link href="/drafts" aria-current="page">Drafts</Link><Link href="/sent">Sent</Link><Link href="/candidates">Candidates</Link></nav>
    <SafeDialog open={sendOpen} onClose={closeSend} label="Confirm real email send" className={styles.sendDialog} returnFocus={primaryRef}>
      <small>Final review · external consequence</small><h2>Send email</h2><div className={styles.sendRecipient}><small>To</small><span>{selected?.recipient}</span><em>{selected?.title}</em><strong>{selected?.company}</strong></div><div className={styles.sendSubject}><small>Subject</small><p>{selected?.subject}</p></div><p>This sends the immutable approved Gmail draft now. The message will leave NetworkPilot and cannot be recalled here.</p><dl><div><dt>Attachment</dt><dd>{selected?.attachment?.label??"None"}</dd></div><div><dt>Approved snapshot</dt><dd>{selected?.catalogVersion}</dd></div></dl><form action={sendGmailDraft}><input type="hidden" name="snapshotId" value={selected?.snapshotId??""}/><input type="hidden" name="nextCandidateId" value={nextCandidateId}/><button autoFocus type="button" onClick={closeSend}>Cancel</button><button name="confirmation" value="send-approved-draft-now">Send email</button></form>
    </SafeDialog>
    <SafeDialog open={reconcileOpen} onClose={closeReconcile} label="Resolve uncertain send status" className={styles.reconcileDialog} returnFocus={primaryRef}>
      <small>Operator verification required</small><h2>Resolve send status</h2><p>NetworkPilot could not confirm whether Gmail sent this message. Check Gmail before recording an outcome.</p><form action={reconcileGmailSendStatus}><input type="hidden" name="snapshotId" value={selected?.snapshotId??""}/><input type="hidden" name="candidateId" value={selected?.candidateId??""}/><input type="hidden" name="nextCandidateId" value={nextCandidateId}/><label>What happened?<select autoFocus name="outcome" required defaultValue="still-uncertain"><option value="still-uncertain">I still cannot tell</option><option value="sent">It was sent</option><option value="not-sent">It was not sent</option></select></label><label>Actual sent time<input name="sentAt" type="datetime-local"/></label><label className={styles.confirmCheck}><input name="confirmation" type="checkbox" value="confirmed" required/>I checked Gmail and confirm this outcome.</label><div><button type="button" onClick={closeReconcile}>Cancel</button><button>Save status</button></div></form>
    </SafeDialog>
    <CommandPalette open={paletteOpen} onClose={closePalette} returnFocus={commandTriggerRef} selected={selected} primaryBlocked={primaryBlocked} primaryReason={primaryReason} runPrimary={runPrimary} onSkip={()=>skipRef.current?.requestSubmit()} onReplace={()=>replaceRef.current?.requestSubmit()} onAdd={()=>{if(addRef.current)addRef.current.open=true;closePalette();}}/>
  </main>;
}

function Inspector({draft}:{draft:WorkspaceDraft}){
  return <div className={styles.inspectorContent}><section><h3>Outreach intent</h3><p>{draft.intent}</p></section><section><h3>Why this person</h3><p>{draft.selectionReason}</p></section><section><h3>Role relevance</h3><p>{draft.roleRelevance} · {draft.lane}</p></section><section><h3>Company evidence</h3><p>{draft.companyEvidence}</p></section><section><h3>Context</h3><dl><div><dt>Track</dt><dd>{draft.track}</dd></div><div><dt>Location</dt><dd>{draft.location}</dd></div><div><dt>Industry</dt><dd>{draft.industry}</dd></div></dl></section><section className={draft.blockedReason?styles.caution:styles.safe}><h3>Safety state</h3><strong>{draft.blockedReason?"Action blocked":"Eligible at last check"}</strong><p>{draft.blockedMessage??"Mutable gates are rechecked by the server before externalization."}</p></section><section className={styles.version}><span>Methodology</span><b>{draft.catalogVersion}</b><small>{draft.factCount} approved evidence references</small></section></div>;
}

function CommandPalette({open,onClose,returnFocus,selected,primaryBlocked,primaryReason,runPrimary,onSkip,onReplace,onAdd}:{open:boolean;onClose:()=>void;returnFocus:RefObject<HTMLElement|null>;selected:WorkspaceDraft|null;primaryBlocked:boolean;primaryReason:string|null|undefined;runPrimary:()=>void;onSkip:()=>void;onReplace:()=>void;onAdd:()=>void}){
  const ref=useDialogFocus(open,onClose,returnFocus);
  if(!open)return null;
  const commands=[
    ["Today","Open today’s command center","G T","/today"],
    ["Drafts","Current workspace","G D","/drafts"],
    ["Sent","Open sent outreach","G S","/sent"],
    ["Candidates","Open candidate supply","G C","/candidates"],
  ] as const;
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target)onClose();}}><section ref={ref} className={styles.palette} role="dialog" aria-modal="true" aria-label="Network command palette"><header><strong>Network command</strong><span>Drafts / {selected?.recipient??"No selection"}</span></header><label><span className={styles.srOnly}>Search commands</span><input autoFocus placeholder="Where do you want to work?"/><kbd>Esc</kbd></label><div><section><h2>Navigation</h2>{commands.map(([name,description,key,href])=><Link key={href} href={href} aria-current={href==="/drafts"?"page":undefined}><span><strong>{name}</strong><small>{description}</small></span><kbd>{key}</kbd></Link>)}</section><section><h2>Selected work</h2><button onClick={()=>{runPrimary();onClose();}} disabled={!selected||primaryBlocked}><span><strong>{selected?actionLabels[selected.state]:"No draft selected"}</strong><small>{primaryBlocked?primaryReason:selected?stateLabels[selected.state]:"Select a draft first"}</small></span></button><button onClick={()=>{onSkip();onClose();}} disabled={!selected||selected.state==="needs-send-verification"}><span><strong>Skip selected draft</strong><small>{selected?.state==="needs-send-verification"?"Resolve the uncertain send first":"Remove without contact or cooldown"}</small></span><kbd>X</kbd></button><button onClick={()=>{onReplace();onClose();}} disabled={!selected||selected.state==="needs-send-verification"}><span><strong>Replace selected person</strong><small>Use the qualified reserve without a provider call</small></span><kbd>R</kbd></button><button onClick={onAdd}><span><strong>Add drafts from reserve</strong><small>Choose 5, 10, or a custom bounded count</small></span><kbd>N</kbd></button></section></div><footer>↑↓ choose · Enter run · Esc close</footer></section></div>;
}

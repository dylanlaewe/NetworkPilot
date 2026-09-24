"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ACTIVE_LIMIT, BUDGET, BUCKETS, addDrafts, approve, capacity, correctBucket, findMore, initialState, lifecycle, queueAction, rows, unavailableReason, validation, type Bucket, type Person, type Section, type State } from "./model";
import { TEMPLATE_VERSION } from "./templates";
import styles from "./prototype.module.css";

type View = Section | "Today" | "Preferences";
type Modal = "add" | "find" | "approve" | "send" | "exclude" | "correct" | null;
const SECTIONS: Section[] = ["Drafts", "Sent", "Candidates"];
const label = (bucket: Bucket | "all") => bucket === "all" ? "All people" : BUCKETS.find(b => b.id === bucket)!.label;

function Dialog({ title, onClose, onReturnFocus, children }: { title: string; onClose: () => void; onReturnFocus: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      // Native restoration happens before React removes the dialog; restore again after that commit.
      requestAnimationFrame(onReturnFocus);
    };
  }, [onReturnFocus]);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="dialog-title" onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className={styles.dialogHeader}><h2 id="dialog-title">{title}</h2><button aria-label="Close dialog" onClick={onClose}>×</button></div>{children}
  </dialog>;
}

export default function FiveBucketPrototype() {
  const [state, setState] = useState(initialState);
  const [view, setView] = useState<View>("Drafts");
  const [buckets, setBuckets] = useState<Record<Section, Bucket | "all">>({ Drafts: "all", Sent: "all", Candidates: "all" });
  const [expanded, setExpanded] = useState<Record<Section, boolean>>({ Drafts: true, Sent: false, Candidates: false });
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [earlyFilters, setEarlyFilters] = useState<Record<Section, boolean>>({ Drafts: false, Sent: false, Candidates: false });
  const [mobileReview, setMobileReview] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [actionBucket, setActionBucket] = useState<Bucket>("recruiters");
  const [count, setCount] = useState(5);
  const [confirmedEvidence, setConfirmedEvidence] = useState(false);
  const [pending, setPending] = useState(false);
  const [reservedBudget, setReservedBudget] = useState(0);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const queueRows = useRef(new Map<string, HTMLButtonElement>());
  const queueScroll = useRef(0);
  const modalTrigger = useRef<HTMLElement | null>(null);
  const restoreModalFocus = useCallback(() => {
    const trigger = modalTrigger.current;
    if (trigger?.isConnected && !trigger.matches(":disabled")) trigger.focus({ preventScroll: true });
    else reviewHeading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const section: Section = SECTIONS.includes(view as Section) ? view as Section : "Drafts";
  const bucket = buckets[section];
  const selectionKey = `${section}:${bucket}`;
  const visible = rows(state, section, bucket).filter(p => !(bucket === "peers" && earlyFilters[section]) || p.earlyCareer);
  const person = visible.find(p => p.id === selected[selectionKey]) ?? visible[0];
  const info = BUCKETS.find(b => b.id === (bucket === "all" ? person?.bucket ?? "recruiters" : bucket))!;
  const issues = person ? validation(person, state.resumes) : [];
  const frozen = person && (section === "Sent" ? person.history.find(h => bucket === "all" || h.bucket === bucket) : person.approved);
  const editable = section === "Drafts" && person?.stage === "editing";
  const earlyCareerOnly = bucket === "peers" && earlyFilters[section];
  const actionEarlyCareerOnly = actionBucket === "peers" && earlyCareerOnly;
  const availableBudget = Math.max(0, BUDGET - state.budgetUsed - reservedBudget);
  const update = (fn: (state: State) => State) => setState(fn);
  function navigate(next: View, nextBucket?: Bucket | "all") {
    setView(next); setMobileReview(false);
    if (SECTIONS.includes(next as Section)) { setExpanded(s => ({ ...s, [next]: true })); if (nextBucket) setBuckets(b => ({ ...b, [next]: nextBucket })); }
  }
  function patchPerson(patch: Partial<Person>) {
    if (!person || !editable) return;
    update(s => ({ ...s, people: s.people.map(p => p.id === person.id ? { ...p, ...patch, userEdited: true } : p) }));
  }
  function openPerson(id: string) {
    queueScroll.current = window.scrollY;
    setSelected(s => ({ ...s, [selectionKey]: id }));
    setMobileReview(true);
    if (window.matchMedia("(max-width: 760px)").matches) requestAnimationFrame(() => reviewHeading.current?.focus());
  }
  function returnToQueue() {
    setMobileReview(false);
    requestAnimationFrame(() => {
      if (person) queueRows.current.get(person.id)?.focus({ preventScroll: true });
      window.scrollTo({ top: queueScroll.current, behavior: "instant" });
    });
  }
  function openAction(kind: Modal) {
    modalTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActionBucket(bucket === "all" ? "recruiters" : bucket); setConfirmedEvidence(false); setModal(kind);
  }
  function runSearch() {
    if (busy.current || state.budgetUsed >= BUDGET) return;
    busy.current = true; setPending(true); setReservedBudget(Math.min(5, BUDGET - state.budgetUsed)); setModal(null);
    const scopedBucket = actionBucket;
    const scopedEarlyCareer = actionEarlyCareerOnly;
    update(s => ({ ...s, notice: `Simulated search pending for ${label(scopedBucket)}. ${Math.min(5, BUDGET - s.budgetUsed)} shared allowance units reserved. No provider is contacted.` }));
    timer.current = setTimeout(() => { update(s => findMore(s, scopedBucket, scopedEarlyCareer)); busy.current = false; setPending(false); setReservedBudget(0); }, 650);
  }
  function leaveQueue(action: "skip" | "replace" | "exclude") {
    if (!person) return;
    const next = queueAction(state, person.id, action, earlyCareerOnly);
    const index = visible.findIndex(p => p.id === person.id);
    const nextVisible = rows(next, section, bucket);
    setSelected(s => ({ ...s, [selectionKey]: nextVisible[Math.min(index, nextVisible.length - 1)]?.id ?? "" }));
    setState(next); setModal(null);
    requestAnimationFrame(() => reviewHeading.current?.focus({ preventScroll: true }));
  }
  const bucketSelect = <label className={styles.field}>Bucket<select value={actionBucket} onChange={e => setActionBucket(e.target.value as Bucket)}>{BUCKETS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>;
  const attachmentLabel = frozen ? frozen.attachment ? `${frozen.attachment.label} · ${frozen.attachment.version}` : "None" : state.resumes.find(r => r.id === person?.attachment) ? `${state.resumes.find(r => r.id === person?.attachment)!.label} · ${state.resumes.find(r => r.id === person?.attachment)!.version}` : "None";

  return <main className={styles.shell} data-mobile-review={mobileReview}>
    <a className={styles.skipLink} href="#prototype-content">Skip to workspace</a>
    <header className={styles.topbar}><div className={styles.brand}><span>N</span><strong>NetworkPilot</strong><small>DESIGN LAB</small></div><span className={styles.safety}>Fictional · simulated · browser memory only</span><button onClick={() => navigate("Preferences")}>Resumes & preferences</button></header>
    <aside className={styles.sidebar}><nav aria-label="Workspace navigation"><button className={styles.todayLink} aria-current={view === "Today" ? "page" : undefined} onClick={() => navigate("Today")}>○ <span>Today</span></button>
      {SECTIONS.map(s => <div className={styles.navSection} key={s}><div className={styles.sectionRow}><button aria-current={view === s ? "page" : undefined} onClick={() => navigate(s)}><span>{s}</span><small>{rows(state, s, "all").length}</small></button><button aria-label={`${expanded[s] ? "Collapse" : "Expand"} ${s} buckets`} aria-expanded={expanded[s]} aria-controls={`nav-${s}`} onClick={() => setExpanded(e => ({ ...e, [s]: !e[s] }))}>{expanded[s] ? "⌄" : "›"}</button></div>
        {expanded[s] && <div id={`nav-${s}`} className={styles.bucketNav}><button aria-current={view === s && buckets[s] === "all" ? "page" : undefined} onClick={() => navigate(s, "all")}><span>All {s.toLowerCase()}</span><small>{rows(state, s, "all").length}</small></button>{BUCKETS.map(b => <button key={b.id} aria-current={view === s && buckets[s] === b.id ? "page" : undefined} onClick={() => navigate(s, b.id)}><span>{b.label}</span><small>{rows(state, s, b.id).length}</small></button>)}</div>}
      </div>)}
    </nav><div className={styles.sidebarFoot}><span>One relationship, one person.</span><p>Five reasons to connect. Shared history and contact rules.</p><button onClick={() => navigate("Preferences")}>Resume preferences</button></div></aside>
    <div id="prototype-content" className={styles.workspace}>
      <div className={styles.mobilePicker}><label>Workspace<select aria-label="Workspace section" value={view} onChange={e => navigate(e.target.value as View)}>{["Today", ...SECTIONS, "Preferences"].map(s => <option key={s}>{s}</option>)}</select></label>{SECTIONS.includes(view as Section) && <label>Bucket<select aria-label="Selected bucket" value={bucket} onChange={e => navigate(section, e.target.value as Bucket | "all")}><option value="all">All {section.toLowerCase()} ({rows(state, section, "all").length})</option>{BUCKETS.map(b => <option key={b.id} value={b.id}>{b.label} ({rows(state, section, b.id).length})</option>)}</select></label>}</div>
      <div className={styles.notice} role="status" aria-live="polite" aria-atomic="true"><span>{pending ? "◌" : "·"}</span>{state.notice}</div>
      {view === "Today" ? <section className={styles.simplePage}><small>YOUR FICTIONAL WORKSPACE</small><h1>A little progress, person by person.</h1><p>{state.queue.length} messages in your queue. Pick a relationship strategy, shape the message, and review it before each simulated next step.</p><button className={styles.primary} onClick={() => navigate("Drafts")}>Review drafts</button><h2>Keep your purpose in view</h2>{BUCKETS.map(b => <button className={styles.strategy} key={b.id} onClick={() => navigate("Drafts", b.id)}><strong>{b.label}</strong><span>{b.intent}</span></button>)}</section>
      : view === "Preferences" ? <section className={styles.simplePage}><small>LOCAL PROTOTYPE PREFERENCES</small><h1>Resumes, with a clear default.</h1><p>These are synthetic labels and version metadata. No resume files exist here.</p><label className={styles.field}>Default resume for future recruiter drafts<select value={state.defaultResume} onChange={e => update(s => ({ ...s, defaultResume: e.target.value, notice: "Default updated for future recruiter drafts. Existing drafts and frozen approvals are unchanged." }))}>{state.resumes.map(r => <option key={r.id} value={r.id}>{r.label} · {r.version}{r.active ? "" : " · inactive"}</option>)}<option value="missing">Missing default (test state)</option></select></label><p>Other buckets start with no attachment. An inactive or missing default requires an explicit choice.</p>{state.resumes.map(r => <div className={styles.resumeRow} key={r.id}><div><strong>{r.label}</strong><p>{r.version} · {r.size}</p><span>{r.active ? "Active" : "Inactive"}</span></div><button onClick={() => update(s => ({ ...s, resumes: s.resumes.map(item => item.id === r.id ? { ...item, active: !item.active } : item), notice: "Resume availability updated. Historical attachment evidence remains frozen." }))}>{r.active ? "Deactivate" : "Activate"}</button></div>)}<p>Simulation resets on reload. Shared search allowance: {state.budgetUsed}/{BUDGET} used · {reservedBudget} reserved · {availableBudget} available across all buckets.</p></section>
      : <><header className={styles.context}><div><small>{section.toUpperCase()} / {visible.length} {visible.length === 1 ? "PERSON" : "PEOPLE"}</small><h1>{bucket === "all" ? `All ${section.toLowerCase()}` : label(bucket)}</h1><p>{bucket === "all" ? "Different people. A thoughtful reason to reach out to each." : info.intent}</p></div>{section !== "Sent" && <button className={styles.primary} disabled={pending || (section === "Candidates" && state.budgetUsed >= BUDGET)} onClick={() => openAction(section === "Drafts" ? "add" : "find")}>{section === "Drafts" ? bucket === "all" ? "Add drafts" : `Add ${info.singular} drafts` : pending ? "Simulated search pending…" : bucket === "all" ? "Find more people" : `Find more ${info.find}`}</button>}</header>
        {(section === "Candidates" || bucket !== "all") && section !== "Sent" && <div className={styles.capacityBar}>{bucket !== "all" && <span>{state.people.filter(p => p.bucket === bucket && p.stage === "reserve" && (!earlyCareerOnly || p.earlyCareer)).length} {earlyCareerOnly ? "early-career peers" : info.find} in reserve. <strong>{Math.min(capacity(state, bucket, earlyCareerOnly).length, Math.max(0, ACTIVE_LIMIT - state.queue.length))} available for new drafts.</strong></span>}{section === "Candidates" && <span className={styles.allowance}>Shared search allowance: {availableBudget}/{BUDGET} available · {reservedBudget} reserved{state.budgetUsed >= BUDGET ? " · Exhausted" : ""}</span>}{bucket === "peers" && <label><input type="checkbox" checked={earlyFilters[section]} onChange={e => setEarlyFilters(f => ({ ...f, [section]: e.target.checked }))} /> Early-career only</label>}</div>}
        <div className={styles.workpanes}><section className={styles.queue} aria-label={`${section} people`}><div className={styles.queueHeading}><span>{section === "Sent" ? "RELATIONSHIPS" : "PEOPLE"}</span><small>{visible.length} shown</small></div>{visible.map((p, index) => <button key={p.id} ref={node => { if (node) queueRows.current.set(p.id, node); else queueRows.current.delete(p.id); }} data-person-id={p.id} aria-pressed={person?.id === p.id} className={styles.personRow} onClick={() => openPerson(p.id)}><span className={styles.avatar}>{p.name.split(" ").map(n => n[0]).slice(0, 2).join("")}</span><span><strong>{p.name}</strong><small>{p.title}</small><small>{p.company}</small><em>{section === "Sent" ? p.history.map(h => h.outcome).join(", ") : p.reviewNeeded ? "Classification needs review" : section === "Candidates" ? unavailableReason(state, p) ?? "Available for a draft" : p.stage === "editing" ? p.userEdited ? "Edited · saved in this tab" : "Ready for review" : p.stage === "uncertain" ? "Uncertain · verify before retry" : `Simulated ${p.stage}`}</em></span><small className={styles.position}>{index + 1}</small></button>)}{!visible.length && <div className={styles.empty}><h2>No people in this view</h2><p>{section === "Sent" ? "Confirmed simulated sends will appear here once." : "Your selection is unchanged. Review the reserve or find more people in this bucket."}</p>{section === "Drafts" && <button onClick={() => navigate("Candidates", bucket)}>Review candidates</button>}{bucket === "peers" && earlyFilters[section] && <button onClick={() => setEarlyFilters(f => ({ ...f, [section]: false }))}>Include experienced practitioners</button>}</div>}</section>
          <article className={styles.review} aria-label="Person and message review"><button className={styles.back} onClick={returnToQueue}>← Back to {section.toLowerCase()}</button>{person ? <><div className={styles.reviewContent}><header className={styles.personHeader}><small>{section === "Sent" ? "RELATIONSHIP HISTORY" : section === "Candidates" ? "GET TO KNOW" : "WRITING TO"}</small><h2 ref={reviewHeading} tabIndex={-1}>{person.name}</h2><p>{person.title} · {person.company}</p><span>{person.email}</span></header>
            {section === "Candidates" ? <><div className={styles.candidateIntro}><span className={styles.tag}>{label(person.bucket)}</span><h3>{person.reviewNeeded ? "The title needs context." : "A reason to connect."}</h3><p>{BUCKETS.find(b => b.id === person.bucket)!.intent}</p><p>{person.evidence}</p><p>{person.context} · Target field: {person.field}</p>{unavailableReason(state, person) ? <div className={styles.warning}><strong>Not available for a new draft</strong><p>{unavailableReason(state, person)}</p>{person.stage === "skipped" && <p>Skipped for the remainder of this session. No cooldown began.</p>}</div> : <button className={styles.primary} onClick={() => { update(s => { const others = s.people.filter(p => p.id !== person.id); const prioritized = { ...s, people: [person, ...others] }; const result = addDrafts(prioritized, person.bucket, 1); return { ...result, people: s.people.map(original => result.people.find(p => p.id === original.id)!) }; }); }}>Add this person as a draft</button>}{person.reviewNeeded && <button className={styles.primary} onClick={() => openAction("correct")}>Review bucket correction</button>}</div></>
            : <><div className={styles.attachment}><label htmlFor="attachment">{frozen ? "Frozen attachment evidence" : "Resume attachment"}</label>{editable ? <select id="attachment" value={person.attachment ?? "none"} onChange={e => patchPerson({ attachment: e.target.value === "none" ? null : e.target.value, resumeDecisionNeeded: false })}><option value="none">None</option>{state.resumes.map(r => <option key={r.id} value={r.id} disabled={!r.active}>{r.label} · {r.version}{r.active ? "" : " · inactive"}</option>)}</select> : <strong id="attachment">{attachmentLabel}</strong>}<small>Synthetic metadata only{frozen ? " · frozen at approval" : " · review before approval"}</small></div>
              {editable && person.resumeDecisionNeeded && <div className={styles.warning}><p>The configured default is missing or inactive. Choose an active resume, or explicitly continue without one.</p><button onClick={() => patchPerson({ attachment: null, resumeDecisionNeeded: false })}>Continue without attachment</button></div>}
              {editable && !person.attachment && /I've attached my resume\./.test(person.body) && <div className={styles.warning}><strong>Attachment and message do not match</strong><p>Proposed change: remove “I&apos;ve attached my resume.” Your message stays unchanged until you accept.</p><button onClick={() => patchPerson({ body: person.body.replace(" I've attached my resume.", "") })}>Accept copy adjustment</button></div>}
              {frozen && <div className={styles.sealed}>{section === "Sent" ? "Historical message · immutable" : person.stage === "uncertain" ? "Uncertain result · verify before retry" : `Simulated ${person.stage} · content frozen`}</div>}
              <label className={styles.subject}>Subject<input aria-label="Message subject" value={frozen?.subject ?? person.subject} readOnly={!editable} onChange={e => patchPerson({ subject: e.target.value })} /></label>
              <label className={styles.bodyLabel}><span>Message{editable && person.userEdited ? " · your edits saved in this tab" : ""}</span><textarea aria-label="Message body" value={frozen?.body ?? person.body} readOnly={!editable} onChange={e => patchPerson({ body: e.target.value })} spellCheck={false} /></label>
              {editable && issues.length > 0 && <div className={styles.warning}><strong>Resolve before approval</strong><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
            </>}
            <details className={styles.inspector}><summary>Context, evidence & relationship history</summary><dl><div><dt>Current bucket</dt><dd>{label(person.bucket)}</dd></div><div><dt>Function</dt><dd>{person.function}</dd></div><div><dt>Target field</dt><dd>{person.field}</dd></div><div><dt>Company context</dt><dd>{person.context}</dd></div><div><dt>Experience evidence</dt><dd>{person.evidence}</dd></div><div><dt>Message source</dt><dd>{frozen?.templateVersion ?? TEMPLATE_VERSION}{person.userEdited ? " · personalized + user edits" : " · personalized fixture"}</dd></div></dl>{person.block && <p className={styles.warning}>{person.block}</p>}{person.corrections.map(c => <p key={c}>{c}</p>)}{person.history.length ? person.history.map((h, i) => <details key={i} className={styles.history}><summary>{h.at} · {h.outcome} · historical {label(h.bucket)}</summary><p>Historical attachment: {h.attachment ? `${h.attachment.label} · ${h.attachment.version}` : "None"}</p><strong>{h.subject}</strong><pre>{h.body}</pre></details>) : <p>No previous contact. Approval and send actions below are simulated.</p>}</details></div>
            {section === "Drafts" && <div className={styles.actions}>{editable && <><div className={styles.secondaryActions}><button onClick={() => leaveQueue("skip")}>Skip for now</button><button onClick={() => leaveQueue("replace")}>Replace</button><button onClick={() => openAction("exclude")}>Don&apos;t show again</button></div><button className={styles.primary} disabled={issues.length > 0} onClick={() => openAction("approve")}>Review simulated approval</button></>}{person.stage === "approved" && <button className={styles.primary} onClick={() => update(s => lifecycle(s, person.id, "create"))}>Create simulated draft</button>}{person.stage === "created" && <button className={styles.primary} onClick={() => openAction("send")}>Review simulated send</button>}{person.stage === "uncertain" && <><p>The fictional fixture has an uncertain outcome. No retry is available until verified.</p><button className={styles.primary} onClick={() => update(s => lifecycle(s, person.id, "verify"))}>Simulate verification: sent</button></>}</div>}
          </> : <div className={styles.empty}><h2>Your next conversation starts here.</h2><p>Select a person to review their context and message.</p></div>}</article>
        </div></>}
    </div>
    {modal && <Dialog title={{ add: "Add from qualified reserve", find: "Find more · simulated search", approve: "Approve this simulated message", send: "Final simulated send confirmation", exclude: "Exclude this person?", correct: "Review the bucket correction" }[modal]} onClose={() => setModal(null)} onReturnFocus={restoreModalFocus}>
      {(modal === "add" || modal === "find") && <>{bucket === "all" ? bucketSelect : <p><strong>{label(actionBucket)}</strong></p>}{actionEarlyCareerOnly && <p><strong>Scope: Early-career peers only.</strong> Additions and search results stay inside this filter.</p>}{modal === "add" ? <><p>{state.people.filter(p => p.bucket === actionBucket && p.stage === "reserve" && (!actionEarlyCareerOnly || p.earlyCareer)).length} in reserve. {capacity(state, actionBucket, actionEarlyCareerOnly).length} qualified; {Math.max(0, ACTIVE_LIMIT - state.queue.length)} shared active-draft slots available.</p><p>Requested count means additional drafts. Existing edits, attachments, and queue order stay intact.</p><div className={styles.countChoices}><button aria-pressed={count === 5} onClick={() => setCount(5)}>Add 5</button><button aria-pressed={count === 10} onClick={() => setCount(10)}>Add 10</button></div><label className={styles.field}>Custom count (1–20)<input type="number" min={1} max={20} step={1} value={Number.isNaN(count) ? "" : count} onChange={e => setCount(e.target.valueAsNumber)} /></label><div className={styles.dialogActions}><button onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={!Number.isInteger(count) || count < 1 || count > 20} onClick={() => { update(s => addDrafts(s, actionBucket, count, actionEarlyCareerOnly)); setModal(null); }}>Add {Number.isInteger(count) ? count : ""} additional drafts</button></div></> : <><p>This simulated discovery uses up to <strong>{Math.min(5, BUDGET - state.budgetUsed)} of {BUDGET - state.budgetUsed} remaining shared allowance units</strong> to request new {BUCKETS.find(b => b.id === actionBucket)!.find}. Results may be partial.</p><p>The allowance is shared across all five buckets. Existing practitioner supply never prevents a recruiter search. No provider, billing, or network request is involved.</p><div className={styles.dialogActions}><button onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={pending || state.budgetUsed >= BUDGET} onClick={runSearch}>Confirm simulated search</button></div></>}</>}
      {person && (modal === "approve" || modal === "send") && <><p>{person.name}<br />{person.email}</p><div className={styles.confirmation}><strong>{frozen?.subject ?? person.subject}</strong><p>Attachment: <b>{attachmentLabel}</b></p><pre>{frozen?.body ?? person.body}</pre></div>{modal === "approve" && <label className={styles.check}><input type="checkbox" checked={confirmedEvidence} onChange={e => setConfirmedEvidence(e.target.checked)} /> I reviewed the fictional evidence, personalization, and attachment. This message makes one primary invitation and contains no unsupported claims.</label>}<p>{modal === "approve" ? "Approval freezes this exact message and synthetic resume version." : "This only creates an in-memory sent record. No message or attachment will leave this browser."}</p><div className={styles.dialogActions}><button onClick={() => setModal(null)}>Cancel</button><button className={styles.primary} disabled={modal === "approve" && !confirmedEvidence} onClick={() => { update(s => modal === "approve" ? approve(s, person.id) : lifecycle(s, person.id, "send")); setModal(null); }}>{modal === "approve" ? "Confirm simulated approval" : "Confirm simulated send"}</button></div></>}
      {person && modal === "exclude" && <><p>Exclude <strong>{person.name}</strong> from new work across all five buckets. This does not mark them contacted or erase history.</p><div className={styles.dialogActions}><button onClick={() => setModal(null)}>Keep in queue</button><button className={styles.primary} onClick={() => leaveQueue("exclude")}>Confirm exclusion</button></div></>}
      {person && modal === "correct" && <><p><strong>{person.name}</strong><br />{person.title}</p><p>{person.evidence}</p><div className={styles.confirmation}><p>{label(person.bucket)} → Peers & practitioners</p><p>Same person ID: {person.id}. Their prior sent message remains attributed to Executives. Prior contact and cooldown remain authoritative.</p></div><label className={styles.check}><input type="checkbox" checked={confirmedEvidence} onChange={e => setConfirmedEvidence(e.target.checked)} /> I reviewed the fictional individual-contributor scope evidence.</label><div className={styles.dialogActions}><button onClick={() => setModal(null)}>Cancel</button><button disabled={!confirmedEvidence} className={styles.primary} onClick={() => { update(s => correctBucket(s, person.id, "peers")); setModal(null); }}>Confirm reviewed correction</button></div></>}
    </Dialog>}
  </main>;
}

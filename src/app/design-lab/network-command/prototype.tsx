"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CandidateFixture, DraftFixture, DraftState } from "./fixtures";
import { candidateFixtures, draftFixtures, stateLabels } from "./fixtures";
import styles from "./prototype.module.css";

type View = "today" | "drafts" | "candidates";
type Scenario = "standard" | "gmail-reconnect" | "apollo-exhausted" | "no-reserve" | "no-drafts" | "all-caught-up" | "no-candidates";
type Density = "comfortable" | "compact";
type PrototypeInitialState = {
  view: View;
  queueSize: 5 | 15 | 30;
  scenario: Scenario;
  selectedState: DraftState;
  density: Density;
  paletteOpen: boolean;
  filterOpen: boolean;
  mobileReview: boolean;
  sendConfirmation: boolean;
  showSuccess: boolean;
  forceHover: boolean;
};

const queueSizes = [5, 15, 30] as const;
const scenarioLabels: Record<Scenario, string> = {
  standard: "Standard",
  "gmail-reconnect": "Gmail reconnect",
  "apollo-exhausted": "Apollo exhausted",
  "no-reserve": "No reserve",
  "no-drafts": "No drafts",
  "all-caught-up": "All caught up",
  "no-candidates": "No candidates",
};

function stateAction(state: DraftState) {
  if (state === "needs-review") return { label: "Approve draft", key: "A" };
  if (state === "approved") return { label: "Create Gmail draft", key: "G" };
  if (state === "gmail-created") return { label: "Send approved email", key: "S" };
  return { label: "Resolve send status", key: "U" };
}

function stateGlyph(state: DraftState) {
  if (state === "needs-review") return "○";
  if (state === "approved") return "✓";
  if (state === "gmail-created") return "▣";
  return "?";
}

const resumeOptions = [
  { value: "None", label: "None", meta: "No attachment" },
  { value: "General Resume · v3", label: "General Resume", meta: "General · v3" },
  { value: "Product Resume · v4", label: "Product Resume", meta: "Product · v4" },
  { value: "Data & AI Resume · v6", label: "Data & AI Resume", meta: "Data + AI · v6" },
  { value: "Software Resume · v5", label: "Software Resume", meta: "Software · v5" },
] as const;

function candidateCue(candidate: CandidateFixture) {
  if (candidate.track === "Recruiter") return `Internal ${candidate.lane.toLowerCase()} perspective`;
  if (candidate.lane === "Product") return "Technical path into product judgment";
  if (candidate.lane === "Data") return "Data systems and decision infrastructure";
  if (candidate.lane === "AI / ML") return "Applied AI reliability and platform work";
  if (candidate.lane === "Software") return "Developer platforms and internal users";
  if (candidate.lane === "Finance") return "Technology decisions in investment work";
  if (candidate.lane === "Energy / commodities") return "Market decisions shaped by analytics";
  return "Cross-functional technical operating experience";
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, [contenteditable='true']");
}

export function NetworkCommandPrototype({ initial }: { initial: PrototypeInitialState }) {
  const initialDrafts = useMemo(() => draftFixtures.slice(0, initial.queueSize), [initial.queueSize]);
  const initialSelected = initialDrafts.find((draft) => draft.state === initial.selectedState) ?? initialDrafts[0];
  const [view, setView] = useState<View>(initial.view);
  const [queueSize, setQueueSize] = useState<(typeof queueSizes)[number]>(initial.queueSize);
  const [drafts, setDrafts] = useState(() => initialDrafts.map((draft) => ({ ...draft })));
  const [selectedId, setSelectedId] = useState(initialSelected.id);
  const [candidateId, setCandidateId] = useState(candidateFixtures[0].id);
  const [candidateMobileOpen, setCandidateMobileOpen] = useState(false);
  const [density, setDensity] = useState<Density>(initial.density);
  const [scenario, setScenario] = useState<Scenario>(initial.scenario);
  const [mobileReview, setMobileReview] = useState(initial.mobileReview);
  const [paletteOpen, setPaletteOpen] = useState(initial.paletteOpen);
  const [filterOpen, setFilterOpen] = useState(initial.filterOpen);
  const [labOpen, setLabOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmSend, setConfirmSend] = useState(initial.sendConfirmation);
  const [search, setSearch] = useState("");
  const [candidateTrack, setCandidateTrack] = useState<"All" | "Professional" | "Recruiter">("All");
  const [candidateLanes, setCandidateLanes] = useState<string[]>([]);
  const [northeastOnly, setNortheastOnly] = useState(false);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(initial.showSuccess ? "Send simulation complete. The fictional row moved to Sent." : null);
  const [sentCount, setSentCount] = useState(initial.showSuccess ? 23 : 22);
  const [draftsAdded, setDraftsAdded] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);

  const visibleDrafts = useMemo(
    () => (scenario === "no-drafts" || scenario === "all-caught-up" ? [] : drafts),
    [drafts, scenario],
  );
  const selected = visibleDrafts.find((draft) => draft.id === selectedId) ?? visibleDrafts[0] ?? null;

  const updateDraft = useCallback((id: string, update: Partial<DraftFixture>) => {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...update } : draft)));
  }, []);

  const selectNext = useCallback((direction: 1 | -1 = 1) => {
    if (visibleDrafts.length === 0) return;
    const currentIndex = Math.max(0, visibleDrafts.findIndex((draft) => draft.id === selectedId));
    const nextIndex = Math.min(visibleDrafts.length - 1, Math.max(0, currentIndex + direction));
    setSelectedId(visibleDrafts[nextIndex].id);
  }, [selectedId, visibleDrafts]);

  const removeSelected = useCallback((message: string) => {
    if (!selected) return;
    const currentIndex = visibleDrafts.findIndex((draft) => draft.id === selected.id);
    const next = visibleDrafts[currentIndex + 1] ?? visibleDrafts[currentIndex - 1] ?? null;
    setLeavingId(selected.id);
    window.setTimeout(() => {
      setDrafts((current) => current.filter((draft) => draft.id !== selected.id));
      setSelectedId(next?.id ?? "");
      setLeavingId(null);
      setToast(message);
      queueRef.current?.focus();
    }, 170);
  }, [selected, visibleDrafts]);

  const approve = useCallback(() => {
    if (!selected || selected.state !== "needs-review") return;
    setPending("Approving…");
    window.setTimeout(() => {
      updateDraft(selected.id, { state: "approved" });
      setPending(null);
      setToast("Draft approved. The immutable prototype snapshot is ready for Gmail creation.");
      selectNext(1);
    }, 210);
  }, [selectNext, selected, updateDraft]);

  const replace = useCallback(() => {
    if (!selected) return;
    const used = new Set(drafts.map((draft) => draft.id));
    const replacement = draftFixtures.find((draft) => !used.has(draft.id));
    if (!replacement) {
      setToast("No fictional reserve remains for replacement.");
      return;
    }
    setReplacingId(selected.id);
    window.setTimeout(() => {
      setDrafts((current) => current.map((draft) => (draft.id === selected.id ? { ...replacement, state: "needs-review" } : draft)));
      setSelectedId(replacement.id);
      setReplacingId(null);
      setToast(`${selected.person} was replaced in the same queue position.`);
    }, 170);
  }, [drafts, selected]);

  const addDrafts = useCallback(() => {
    if (scenario === "no-reserve") {
      setToast("No fictional reserve is available. Refresh Candidates is the correct next action.");
      return;
    }
    const used = new Set(drafts.map((draft) => draft.id));
    const additions = draftFixtures.filter((draft) => !used.has(draft.id)).slice(0, 3).map((draft) => ({ ...draft, state: "needs-review" as const }));
    setDrafts((current) => [...current, ...additions]);
    setDraftsAdded(additions.length);
    setAddOpen(false);
    setToast(`${additions.length} fictional drafts added from reserve. No provider was called.`);
  }, [drafts, scenario]);

  const primaryAction = useCallback(() => {
    if (!selected) return;
    if (selected.state === "needs-review") approve();
    else if (selected.state === "approved") {
      if (scenario === "gmail-reconnect") {
        setToast("Gmail reconnect is required before draft creation can continue.");
      } else {
        setPending("Creating…");
        window.setTimeout(() => {
          updateDraft(selected.id, { state: "gmail-created" });
          setPending(null);
          setToast("Prototype Gmail draft created locally. Zero provider calls occurred.");
        }, 210);
      }
    } else if (selected.state === "gmail-created") setConfirmSend(true);
    else setToast("Send status remains uncertain. Reconciliation is required before any retry.");
  }, [approve, scenario, selected, updateDraft]);

  const simulateSend = useCallback(() => {
    setConfirmSend(false);
    setPending("Recording…");
    window.setTimeout(() => {
      setSentCount((count) => count + 1);
      setPending(null);
      removeSelected("Send simulation complete. The fictional row moved out and Sent incremented.");
    }, 210);
  }, [removeSelected]);

  const navigate = useCallback((nextView: View) => {
    setView(nextView);
    setMobileReview(false);
    setPaletteOpen(false);
  }, []);

  const changeQueueSize = useCallback((size: (typeof queueSizes)[number]) => {
    const next = draftFixtures.slice(0, size).map((draft) => ({ ...draft }));
    setQueueSize(size);
    setDrafts(next);
    setSelectedId(next[0]?.id ?? "");
    setDraftsAdded(0);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (isTypingTarget(event.target)) {
        if (event.key === "Escape") (event.target as HTMLElement).blur();
        return;
      }
      if (event.key === "Escape") {
        if (confirmSend) setConfirmSend(false);
        else if (paletteOpen) setPaletteOpen(false);
        else if (filterOpen) setFilterOpen(false);
        else if (mobileReview) setMobileReview(false);
        else queueRef.current?.focus();
        return;
      }
      if (view !== "drafts") return;
      const key = event.key.toLowerCase();
      if (key === "j" || key === "k") {
        event.preventDefault();
        selectNext(key === "j" ? 1 : -1);
      } else if (key === "enter") {
        setMobileReview(true);
        editorRef.current?.focus();
      } else if (key === "e") editorRef.current?.focus();
      else if (key === "a") approve();
      else if (key === "r") replace();
      else if (key === "x") removeSelected("Draft skipped. No contact, cooldown, or suppression was created.");
      else if (key === "n") setAddOpen(true);
      else if (key === "g" && selected?.state === "approved") primaryAction();
      else if (key === "s" && selected?.state === "gmail-created") setConfirmSend(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [approve, confirmSend, filterOpen, mobileReview, paletteOpen, primaryAction, removeSelected, replace, selectNext, selected, view]);

  const filteredCandidates = useMemo(() => {
    if (scenario === "no-candidates") return [];
    const query = search.trim().toLowerCase();
    return candidateFixtures.filter((candidate) => {
      if (candidateTrack !== "All" && candidate.track !== candidateTrack) return false;
      if (candidateLanes.length && !candidateLanes.some((lane) => candidate.lane.includes(lane))) return false;
      if (northeastOnly && !/(New York|Boston)/.test(candidate.location)) return false;
      if (query && !`${candidate.person} ${candidate.company} ${candidate.role} ${candidate.lane}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [candidateLanes, candidateTrack, northeastOnly, scenario, search]);

  const selectedCandidate = filteredCandidates.find((candidate) => candidate.id === candidateId) ?? filteredCandidates[0] ?? null;
  const filterSummary = [candidateTrack !== "All" ? candidateTrack : null, candidateLanes.length ? candidateLanes.join(" + ") : null, northeastOnly ? "Northeast" : null]
    .filter(Boolean)
    .join(" · ") || "All eligible tracks, lanes, and regions";

  const stateCounts = visibleDrafts.reduce<Record<DraftState, number>>(
    (counts, draft) => ({ ...counts, [draft.state]: counts[draft.state] + 1 }),
    { "needs-review": 0, approved: 0, "gmail-created": 0, uncertain: 0 },
  );

  return (
    <main className={styles.prototype} data-density={density}>
      <a className={styles.skipLink} href="#prototype-workspace">Skip to prototype workspace</a>
      <header className={styles.commandBar}>
        <button className={styles.brand} onClick={() => navigate("today")} aria-label="NetworkPilot prototype home">
          <span aria-hidden="true">N</span><strong>NetworkPilot</strong><em>Design lab</em>
        </button>
        <button className={styles.commandTrigger} onClick={() => setPaletteOpen(true)}>
          <span>Jump or run a command</span><kbd>⌘ K</kbd>
        </button>
        <div className={styles.healthLine} data-alert={scenario === "gmail-reconnect" ? "true" : undefined}>
          <span>{scenario === "gmail-reconnect" ? "Gmail reconnect" : "Gmail ready"}</span>
          <i aria-hidden="true" />
          <span>{scenario === "apollo-exhausted" ? "Apollo exhausted" : "Apollo 10/20"}</span>
        </div>
        <button className={styles.labButton} onClick={() => setLabOpen((open) => !open)} aria-expanded={labOpen}>Lab controls</button>
        {labOpen ? (
          <div className={styles.labPanel}>
            <strong>Prototype state</strong>
            <label>Scenario<select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)}>{Object.entries(scenarioLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Draft count<select value={queueSize} onChange={(event) => changeQueueSize(Number(event.target.value) as 5 | 15 | 30)}>{queueSizes.map((size) => <option key={size}>{size}</option>)}</select></label>
            <small>Deterministic fictional fixtures only. Zero providers and zero persistence.</small>
          </div>
        ) : null}
      </header>

      <nav className={styles.rail} aria-label="Prototype navigation">
        <button className={view === "today" ? styles.activeNav : ""} onClick={() => navigate("today")}><span aria-hidden="true">◎</span><b>Today</b></button>
        <button className={view === "drafts" ? styles.activeNav : ""} onClick={() => navigate("drafts")}><span aria-hidden="true">✎</span><b>Drafts</b><small>{visibleDrafts.length}</small></button>
        <button disabled title="Sent is outside Phase B"><span aria-hidden="true">✓</span><b>Sent</b><small>{sentCount}</small></button>
        <button className={view === "candidates" ? styles.activeNav : ""} onClick={() => navigate("candidates")}><span aria-hidden="true">◇</span><b>Candidates</b></button>
      </nav>

      <section id="prototype-workspace" className={styles.workspace}>
        {view === "today" ? <TodayView scenario={scenario} drafts={visibleDrafts} sentCount={sentCount} onNavigate={navigate} /> : null}
        {view === "drafts" ? (
          <DraftsView
            drafts={visibleDrafts}
            selected={selected}
            selectedId={selectedId}
            stateCounts={stateCounts}
            scenario={scenario}
            leavingId={leavingId}
            replacingId={replacingId}
            forceHover={initial.forceHover}
            pending={pending}
            draftsAdded={draftsAdded}
            addOpen={addOpen}
            mobileReview={mobileReview}
            queueRef={queueRef}
            editorRef={editorRef}
            onSelect={(id) => { setSelectedId(id); setMobileReview(true); }}
            onUpdate={updateDraft}
            onPrimary={primaryAction}
            onApprove={approve}
            onSkip={() => removeSelected("Draft skipped. No contact, cooldown, or suppression was created.")}
            onReplace={replace}
            onAdd={() => setAddOpen((open) => !open)}
            onConfirmAdd={addDrafts}
            onCloseAdd={() => setAddOpen(false)}
            onBack={() => setMobileReview(false)}
          />
        ) : null}
        {view === "candidates" ? (
          <CandidatesView
            candidates={filteredCandidates}
            selected={selectedCandidate}
            selectedId={candidateId}
            mobileDetail={candidateMobileOpen}
            density={density}
            search={search}
            filterSummary={filterSummary}
            filterOpen={filterOpen}
            track={candidateTrack}
            lanes={candidateLanes}
            northeastOnly={northeastOnly}
            onSelect={(id) => { setCandidateId(id); setCandidateMobileOpen(true); }}
            onCloseDetail={() => setCandidateMobileOpen(false)}
            onDensity={setDensity}
            onSearch={setSearch}
            onFilterOpen={setFilterOpen}
            onTrack={setCandidateTrack}
            onLanes={setCandidateLanes}
            onNortheast={setNortheastOnly}
            onClear={() => { setCandidateTrack("All"); setCandidateLanes([]); setNortheastOnly(false); setSearch(""); }}
          />
        ) : null}
      </section>

      <nav className={styles.mobileNav} aria-label="Mobile prototype navigation">
        <button onClick={() => navigate("today")} aria-current={view === "today" ? "page" : undefined}>Today</button>
        <button onClick={() => navigate("drafts")} aria-current={view === "drafts" ? "page" : undefined}>Drafts</button>
        <button disabled>Sent</button>
        <button onClick={() => navigate("candidates")} aria-current={view === "candidates" ? "page" : undefined}>Candidates</button>
      </nav>

      {paletteOpen ? <CommandPalette view={view} selected={selected} onClose={() => setPaletteOpen(false)} onNavigate={navigate} onApprove={approve} onSkip={() => removeSelected("Draft skipped from the command palette.")} onReplace={replace} onAdd={() => { navigate("drafts"); setAddOpen(true); }} onFilter={() => { navigate("candidates"); setFilterOpen(true); }} onSearch={() => { navigate("candidates"); window.setTimeout(() => document.getElementById("prototype-candidate-search")?.focus(), 0); }} /> : null}
      {confirmSend ? <SendConfirmation selected={selected} onCancel={() => setConfirmSend(false)} onConfirm={simulateSend} /> : null}
      {toast ? <div className={styles.toast} role="status" onAnimationEnd={() => window.setTimeout(() => setToast(null), 1200)}>{toast}<button onClick={() => setToast(null)} aria-label="Dismiss feedback">×</button></div> : null}
    </main>
  );
}

function TodayView({ scenario, drafts, sentCount, onNavigate }: { scenario: Scenario; drafts: DraftFixture[]; sentCount: number; onNavigate: (view: View) => void }) {
  const reviewCount = drafts.filter((draft) => draft.state === "needs-review").length;
  const allCaughtUp = scenario === "all-caught-up";
  const providerIssue = scenario === "gmail-reconnect" || scenario === "apollo-exhausted";
  const [selectedTask, setSelectedTask] = useState("drafts");
  const tasks = allCaughtUp ? [] : [
    { id: "drafts", title: `Review ${reviewCount || 5} prepared drafts`, detail: "The next message is ready with intent, evidence, and safety checks.", count: reviewCount || 5, action: () => onNavigate("drafts") },
    { id: "relationships", title: "2 relationships need attention", detail: "One reply and one follow-up decision are waiting in relationship memory.", count: 2 },
    { id: "candidates", title: scenario === "no-reserve" ? "Candidate reserve needs attention" : "Candidate supply is healthy", detail: scenario === "no-reserve" ? "No reserve remains; a bounded candidate refresh is the correct next step." : "44 fictional candidates are ready across multiple target lanes.", count: 44, action: () => onNavigate("candidates") },
    ...(providerIssue ? [{ id: "provider", title: scenario === "gmail-reconnect" ? "Reconnect Gmail to continue" : "Apollo budget resets tomorrow", detail: scenario === "gmail-reconnect" ? "Draft review remains available; external draft creation is blocked." : "Drafts and outreach remain available. Candidate refresh is paused.", count: 1 }] : []),
  ];
  const active = tasks.find((task) => task.id === selectedTask) ?? tasks[0];
  const focusPerson = drafts.find((draft) => draft.state === "needs-review") ?? drafts[0];
  return (
    <div className={styles.todayView}>
      <section className={styles.nowPlane}>
        <header><p>Sunday · September 20</p><h1>{allCaughtUp ? "All caught up" : "Now"}</h1><span>{allCaughtUp ? "Today’s prepared work is complete." : "Prepared work, ordered by consequence."}</span></header>
        {allCaughtUp ? <EmptyState title="Your active queue is clear" body="Relationship memory remains available, and the next candidate refresh can begin when needed." action="Review candidates" onAction={() => onNavigate("candidates")} /> : (
          <div className={styles.taskList}>
            {tasks.map((task, index) => <button key={task.id} className={selectedTask === task.id ? styles.selectedTask : ""} onClick={() => setSelectedTask(task.id)}><i>{String(index + 1).padStart(2, "0")}</i><span><strong>{task.title}</strong><small>{task.detail}</small></span><b>{task.count}</b></button>)}
          </div>
        )}
        {active ? <div className={styles.taskPreview}><div><small>Selected work</small><strong>{active.title}</strong><p>{active.detail}</p>{active.id === "drafts" && focusPerson ? <div className={styles.taskPreviewIdentity}><span>{focusPerson.person}</span><em>{focusPerson.role}</em><b>{focusPerson.company}</b></div> : null}</div>{active.action ? <button onClick={active.action}>Open workspace <span>↗</span></button> : <button disabled>Outside Phase B</button>}</div> : null}
      </section>
      <aside className={styles.liveState}>
        <header><h2>Live state</h2><span>Fictional prototype</span></header>
        <dl>
          <div><dt>Queue</dt><dd>{drafts.length} active</dd></div>
          <div><dt>Relationships</dt><dd>{sentCount} contacted</dd></div>
          <div><dt>Supply</dt><dd>{scenario === "no-reserve" ? "Reserve empty" : "44 available"}</dd></div>
          <div className={scenario === "gmail-reconnect" ? styles.alertState : ""}><dt>Gmail</dt><dd>{scenario === "gmail-reconnect" ? "Reconnect required" : "Ready"}</dd></div>
          <div className={scenario === "apollo-exhausted" ? styles.cautionState : ""}><dt>Apollo</dt><dd>{scenario === "apollo-exhausted" ? "Budget exhausted" : "10 of 20"}</dd></div>
        </dl>
        <p>{scenario === "apollo-exhausted" ? "Candidate refresh resumes after the daily reset. Existing work is unaffected." : scenario === "gmail-reconnect" ? "Review and approval remain available. Gmail actions are safely blocked." : "Healthy systems recede until they need operator attention."}</p>
      </aside>
    </div>
  );
}

type DraftsViewProps = {
  drafts: DraftFixture[]; selected: DraftFixture | null; selectedId: string; stateCounts: Record<DraftState, number>; scenario: Scenario;
  leavingId: string | null; replacingId: string | null; forceHover: boolean; pending: string | null; draftsAdded: number; addOpen: boolean; mobileReview: boolean;
  queueRef: React.RefObject<HTMLDivElement | null>; editorRef: React.RefObject<HTMLTextAreaElement | null>;
  onSelect: (id: string) => void; onUpdate: (id: string, update: Partial<DraftFixture>) => void; onPrimary: () => void; onApprove: () => void;
  onSkip: () => void; onReplace: () => void; onAdd: () => void; onConfirmAdd: () => void; onCloseAdd: () => void; onBack: () => void;
};

function DraftsView(props: DraftsViewProps) {
  const { drafts, selected, selectedId, stateCounts, scenario, leavingId, replacingId, forceHover, pending, draftsAdded, addOpen, mobileReview, queueRef, editorRef } = props;
  const blocked = selected?.state === "approved" && scenario === "gmail-reconnect";
  if (!selected) return <div className={styles.fullEmpty}><EmptyState title="No drafts are waiting" body={scenario === "no-reserve" ? "The reserve is empty. Refresh Candidates is the correct next action." : "The queue is clear. Add drafts from the fictional reserve when you are ready."} action={scenario === "no-reserve" ? "Open Candidates" : "Add drafts"} /></div>;
  const action = stateAction(selected.state);
  const sealed = selected.state !== "needs-review";
  return (
    <div className={`${styles.draftsView} ${mobileReview ? styles.mobileReviewOpen : ""}`}>
      <header className={styles.localBar}>
        <div><h1>Drafts</h1><span>{drafts.length} active · {stateCounts["needs-review"]} need review</span></div>
        <div className={styles.stateTabs} aria-label="Draft state counts"><span>Review <b>{stateCounts["needs-review"]}</b></span><span>Approved <b>{stateCounts.approved}</b></span><span>Gmail <b>{stateCounts["gmail-created"]}</b></span><span>Uncertain <b>{stateCounts.uncertain}</b></span></div>
        <button className={styles.addButton} onClick={props.onAdd}>Add drafts <kbd>N</kbd></button>
        {addOpen ? <div className={styles.addPopover}><strong>Add from reserve</strong><p>Three fictional people will enter Needs review. No provider call occurs.</p><div><button onClick={props.onCloseAdd}>Cancel</button><button onClick={props.onConfirmAdd}>Add 3 drafts</button></div></div> : null}
      </header>
      {draftsAdded ? <div className={styles.insertionNotice}>{draftsAdded} new drafts entered the review queue.</div> : null}
      <div className={styles.queuePlane} ref={queueRef} tabIndex={-1} aria-label="Draft queue">
        <div className={styles.planeLabel}><span>Queue</span><kbd>J / K</kbd></div>
        {(["needs-review", "approved", "gmail-created", "uncertain"] as DraftState[]).map((state) => {
          const group = drafts.filter((draft) => draft.state === state);
          if (!group.length) return null;
          return <section className={styles.queueGroup} key={state}><h2><span>{stateGlyph(state)} {stateLabels[state]}</span><b>{group.length}</b></h2>{group.map((draft, index) => <button key={draft.id} data-state={draft.state} onClick={() => props.onSelect(draft.id)} className={`${styles.queueRow} ${selectedId === draft.id ? styles.selectedRow : ""} ${forceHover && state === "needs-review" && index === 1 ? styles.forcedHover : ""} ${leavingId === draft.id ? styles.leavingRow : ""} ${replacingId === draft.id ? styles.replacingRow : ""}`} aria-current={selectedId === draft.id ? "true" : undefined}><span className={styles.rowIdentity}><strong>{draft.person}</strong><small>{draft.company}</small></span><span className={styles.rowRole}>{draft.role}</span><em><i>{stateGlyph(draft.state)}</i>{stateLabels[draft.state]}</em></button>)}</section>;
        })}
      </div>
      <div className={styles.messagePlane} data-state={selected.state}>
        <button className={styles.mobileBack} onClick={props.onBack}>← Queue <span>{drafts.findIndex((draft) => draft.id === selected.id) + 1} of {drafts.length}</span></button>
        <div className={styles.planeLabel}><span>Message</span><em>{sealed ? `${stateGlyph(selected.state)} ${stateLabels[selected.state]} · ` : ""}v{selected.version}</em></div>
        <div className={styles.messageHeader}>
          <div className={styles.recipientIdentity}><small>To</small><strong>{selected.person}</strong><span>{selected.role}</span><b>{selected.company}</b></div>
          <ResumeSelector value={selected.resume} onChange={(resume) => props.onUpdate(selected.id, { resume })} disabled={sealed} />
        </div>
        {sealed ? <div className={styles.sealLine}><span>{stateGlyph(selected.state)} Approved snapshot</span><small>{selected.state === "uncertain" ? "Content locked while send status is resolved" : `Content locked at version ${selected.version}`}</small></div> : null}
        <label className={styles.subjectField} data-sealed={sealed ? "true" : undefined}><span>Subject</span><input value={selected.subject} readOnly={sealed} onChange={(event) => props.onUpdate(selected.id, { subject: event.target.value })} /></label>
        <label className={styles.bodyField} data-sealed={sealed ? "true" : undefined}><span className={styles.srOnly}>Message body</span><textarea ref={editorRef} value={selected.body} readOnly={sealed} onChange={(event) => props.onUpdate(selected.id, { body: event.target.value })} /></label>
        <details className={styles.mobileEvidence}><summary>Context and evidence</summary><InspectorContent draft={selected} scenario={scenario} /></details>
      </div>
      <aside className={styles.inspectorPlane}>
        <div className={styles.planeLabel}><span>Inspector</span><em>Secondary</em></div>
        <InspectorContent draft={selected} scenario={scenario} />
      </aside>
      <footer className={styles.actionDock} data-state={selected.state}>
        <div><button onClick={props.onSkip}>Skip <kbd>X</kbd></button><button onClick={props.onReplace}>Replace <kbd>R</kbd></button></div>
        <span className={styles.dockProgress}><i>{stateGlyph(selected.state)}</i><b>{stateLabels[selected.state]}</b><small>{drafts.findIndex((draft) => draft.id === selected.id) + 1} of {drafts.length}</small></span>
        <div className={styles.primaryWrap}>{blocked ? <small>Gmail draft creation is unavailable until Gmail is reconnected.</small> : null}<button className={styles.primaryAction} onClick={props.onPrimary} disabled={Boolean(pending) || blocked}>{pending ?? action.label} <kbd>{action.key}</kbd></button>{blocked ? <button className={styles.repairButton}>Reconnect Gmail</button> : null}</div>
      </footer>
    </div>
  );
}

function InspectorContent({ draft, scenario }: { draft: DraftFixture; scenario: Scenario }) {
  return <div className={styles.inspectorContent}>
    <section><h3>Outreach intent</h3><p>{draft.intent}</p></section>
    <section><h3>Why this person</h3><ul>{draft.relevance.map((item) => <li key={item}>{item}</li>)}</ul></section>
    <section><h3>Evidence</h3><ul>{draft.evidence.map((item) => <li key={item}>{item}</li>)}</ul></section>
    <section className={draft.state === "uncertain" ? styles.cautionBlock : styles.safeBlock}><h3>Safety state</h3><strong>{draft.state === "uncertain" ? "Send status uncertain" : scenario === "gmail-reconnect" && draft.state === "approved" ? "Gmail action blocked" : "Eligible at last check"}</strong><p>{draft.state === "uncertain" ? "Do not retry until the existing operation is reconciled." : "Mutable gates are rechecked before externalization."}</p></section>
    <section className={styles.versionBlock}><span>Draft version</span><b>v{draft.version}</b><small>{draft.state === "approved" ? "Approved content is immutable." : "Fictional prototype content."}</small></section>
  </div>;
}

function ResumeSelector({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const selected = resumeOptions.find((option) => option.value === value) ?? resumeOptions[0];
  return <details className={styles.resumeSelector} data-disabled={disabled ? "true" : undefined}>
    <summary aria-label={`Attachment: ${selected.label}`}><span><small>Attachment</small><strong>{selected.label}</strong><em>{selected.meta}</em></span><b aria-hidden="true">⌄</b></summary>
    {!disabled ? <div>{resumeOptions.map((option) => <button key={option.value} type="button" aria-pressed={option.value === value} onClick={(event) => { onChange(option.value); event.currentTarget.closest("details")?.removeAttribute("open"); }}><span>{option.label}</span><small>{option.meta}</small></button>)}</div> : null}
  </details>;
}

type CandidateProps = {
  candidates: CandidateFixture[]; selected: CandidateFixture | null; selectedId: string; mobileDetail: boolean; density: Density; search: string; filterSummary: string; filterOpen: boolean;
  track: "All" | "Professional" | "Recruiter"; lanes: string[]; northeastOnly: boolean;
  onSelect: (id: string) => void; onCloseDetail: () => void; onDensity: (density: Density) => void; onSearch: (value: string) => void; onFilterOpen: (open: boolean) => void;
  onTrack: (track: "All" | "Professional" | "Recruiter") => void; onLanes: (lanes: string[]) => void; onNortheast: (value: boolean) => void; onClear: () => void;
};

function CandidatesView(props: CandidateProps) {
  const toggleLane = (lane: string) => props.onLanes(props.lanes.includes(lane) ? props.lanes.filter((item) => item !== lane) : [...props.lanes, lane]);
  return <div className={styles.candidatesView}>
    <header className={styles.candidateHeader}>
      <div><h1>Candidates</h1><p><strong>{props.candidates.length}</strong> available people across fictional companies</p></div>
      <div className={styles.candidateTools}><label className={styles.searchField}><span className={styles.srOnly}>Search candidates</span><input id="prototype-candidate-search" type="search" value={props.search} onChange={(event) => props.onSearch(event.target.value)} placeholder="Search people, roles, companies…" /></label><button onClick={() => props.onFilterOpen(!props.filterOpen)} aria-expanded={props.filterOpen}>Filter{props.filterSummary.startsWith("All") ? "" : ` (${props.lanes.length + (props.track !== "All" ? 1 : 0) + (props.northeastOnly ? 1 : 0)})`}</button><div className={styles.densityToggle} aria-label="Candidate density"><button aria-pressed={props.density === "comfortable"} onClick={() => props.onDensity("comfortable")}>Comfortable</button><button aria-pressed={props.density === "compact"} onClick={() => props.onDensity("compact")}>Compact</button></div></div>
      <div className={styles.filterSummary}><span>{props.filterSummary}</span>{!props.filterSummary.startsWith("All") || props.search ? <button onClick={props.onClear}>Clear</button> : null}</div>
      {props.filterOpen ? <div className={styles.filterSheet}><header><strong>Filter candidates</strong><button onClick={() => props.onFilterOpen(false)}>Done</button></header><fieldset><legend>Track</legend>{(["All", "Professional", "Recruiter"] as const).map((track) => <label key={track}><input type="radio" name="track" checked={props.track === track} onChange={() => props.onTrack(track)} />{track}</label>)}</fieldset><fieldset><legend>Role lanes</legend>{["Product", "Data", "Software", "recruiting"].map((lane) => <label key={lane}><input type="checkbox" checked={props.lanes.includes(lane)} onChange={() => toggleLane(lane)} />{lane === "recruiting" ? "Recruiting" : lane}</label>)}</fieldset><label className={styles.regionCheck}><input type="checkbox" checked={props.northeastOnly} onChange={(event) => props.onNortheast(event.target.checked)} />Northeast only</label><button className={styles.clearFilters} onClick={props.onClear}>Clear all filters</button></div> : null}
    </header>
    {props.candidates.length === 0 ? <EmptyState title="No candidates match this view" body="The current filters are still visible. Clear them to restore the fictional opportunity pool." action="Clear filters" onAction={props.onClear} /> : <div className={styles.candidateWork}><div className={styles.candidateList}><div className={styles.candidateColumns}><span>Person</span><span>Current work</span><span>Lane</span><span>Why now</span><span>Status</span></div>{props.candidates.map((candidate) => <button key={candidate.id} className={`${styles.candidateRow} ${props.selectedId === candidate.id ? styles.selectedCandidate : ""}`} onClick={() => props.onSelect(candidate.id)}><span className={styles.candidateIdentity}><strong>{candidate.person}</strong><small>{candidate.track}</small></span><span className={styles.candidateCurrent}><strong>{candidate.role}</strong><small>{candidate.company}</small></span><span className={styles.candidateLane}>{candidate.lane}</span><span className={styles.candidateCue}>{candidateCue(candidate)}</span><em data-suppressed={candidate.availability === "Suppressed" ? "true" : undefined}><i aria-hidden="true">{candidate.availability === "Suppressed" ? "×" : "·"}</i>{candidate.availability}</em></button>)}</div>{props.selected ? <aside className={`${styles.candidateInspector} ${props.mobileDetail ? styles.candidateDetailOpen : ""}`}><button className={styles.candidateClose} onClick={props.onCloseDetail}>Close</button><small>Selected candidate</small><h2>{props.selected.person}</h2><p className={styles.candidateRole}>{props.selected.role}</p><p className={styles.candidateCompany}>{props.selected.company}</p><dl><div><dt>Track</dt><dd>{props.selected.track}</dd></div><div><dt>Location</dt><dd>{props.selected.location}</dd></div><div><dt>Availability</dt><dd>{props.selected.availability}</dd></div></dl><section><h3>Why this person</h3><p>{props.selected.relevance}</p></section><section><h3>Company evidence</h3><p>{props.selected.companyEvidence}</p></section><section><h3>History</h3><p>{props.selected.history}</p></section><section className={props.selected.availability === "Suppressed" ? styles.suppressedBlock : styles.eligibleBlock}><h3>Planning eligibility</h3><strong>{props.selected.availability === "Suppressed" ? "Permanently excluded" : "Eligible for a future plan"}</strong><p>{props.selected.availability === "Suppressed" ? "Ordinary review cannot override this suppression." : "Company cooldown and one-per-company rules still apply at selection time."}</p></section></aside> : null}</div>}
  </div>;
}

function CommandPalette({ view, selected, onClose, onNavigate, onApprove, onSkip, onReplace, onAdd, onFilter, onSearch }: { view: View; selected: DraftFixture | null; onClose: () => void; onNavigate: (view: View) => void; onApprove: () => void; onSkip: () => void; onReplace: () => void; onAdd: () => void; onFilter: () => void; onSearch: () => void }) {
  const [query, setQuery] = useState("");
  const items = [
    { group: "Navigation", label: "Open Today", hint: "G T", action: () => onNavigate("today"), current: view === "today" },
    { group: "Navigation", label: "Open Drafts", hint: "G D", action: () => onNavigate("drafts"), current: view === "drafts" },
    { group: "Navigation", label: "Go to Sent", hint: "", disabled: "Sent is outside this Phase B prototype." },
    { group: "Navigation", label: "Open Candidates", hint: "G C", action: () => onNavigate("candidates"), current: view === "candidates" },
    { group: "Context", label: "Approve selected draft", hint: "A", action: onApprove, disabled: view !== "drafts" || selected?.state !== "needs-review" ? "Only a draft that needs review can be approved." : undefined },
    { group: "Context", label: "Skip selected draft", hint: "X", action: onSkip, disabled: view !== "drafts" || !selected ? "Select a draft first." : undefined },
    { group: "Context", label: "Replace selected person", hint: "R", action: onReplace, disabled: view !== "drafts" || !selected ? "Select a draft first." : undefined },
    { group: "Context", label: "Add drafts from reserve", hint: "N", action: onAdd },
    { group: "Context", label: "Filter current view", hint: "F", action: onFilter, disabled: view !== "candidates" ? "Filters are available in Candidates." : undefined },
    { group: "Context", label: "Search current view", hint: "/", action: onSearch, disabled: view !== "candidates" ? "Search is available in Candidates." : undefined },
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className={styles.commandPalette} role="dialog" aria-modal="true" aria-label="Command palette"><label><span className={styles.srOnly}>Search commands</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a place or run the next action…" /><kbd>Esc</kbd></label><div>{["Navigation", "Context"].map((group) => <section key={group}><h2>{group === "Context" ? "Selected work" : group}</h2>{items.filter((item) => item.group === group).map((item) => <button key={item.label} className={item.current ? styles.currentCommand : ""} disabled={Boolean(item.disabled)} onClick={() => { item.action?.(); onClose(); }}><span><strong>{item.label}</strong>{item.current ? <small>Current workspace</small> : item.disabled ? <small>{item.disabled}</small> : null}</span>{item.hint ? <kbd>{item.hint}</kbd> : null}</button>)}</section>)}</div><footer><span>↑↓ choose</span><span>↵ run</span><span>Esc close</span></footer></section></div>;
}

function SendConfirmation({ selected, onCancel, onConfirm }: { selected: DraftFixture | null; onCancel: () => void; onConfirm: () => void }) {
  return <div className={styles.modalBackdrop}><section className={styles.sendDialog} role="dialog" aria-modal="true" aria-labelledby="send-title"><small>Simulation only · external consequence</small><h2 id="send-title">Send this approved email?</h2><div className={styles.sendRecipient}><span>{selected?.person}</span><strong>{selected?.company}</strong><p>{selected?.subject}</p></div><p className={styles.sendConsequence}>In production, this action would place the approved message in the recipient’s inbox. It cannot be recalled from NetworkPilot.</p><dl><div><dt>Approved version</dt><dd>v{selected?.version}</dd></div><div><dt>Attachment</dt><dd>{selected?.resume}</dd></div><div><dt>This prototype</dt><dd>Zero provider calls</dd></div></dl><div><button onClick={onCancel}>Return to review</button><button onClick={onConfirm}>Simulate send</button></div></section></div>;
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction?: () => void }) {
  return <div className={styles.emptyState}><span>—</span><h2>{title}</h2><p>{body}</p><button onClick={onAction}>{action}</button></div>;
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import styles from "./experience-reset.module.css";

type Section = "today" | "drafts" | "candidates" | "sent";
type IconName = Section | "resume" | "settings" | "people" | "close" | "check" | "arrow" | "search" | "info";
type DraftStage = "local" | "pending" | "gmail" | "confirm" | "sent";
type CandidateState = "ready" | "employer-review" | "has-draft";

const nav: Array<{ id: Section; label: string }> = [
  { id: "today", label: "Today" },
  { id: "drafts", label: "Drafts" },
  { id: "candidates", label: "Candidates" },
  { id: "sent", label: "Sent" },
];

const buckets = ["All", "Recruiters", "Peers", "Managers", "Executives", "CEOs"];

const drafts = [
  {
    id: "maya",
    name: "Maya Chen",
    initials: "MC",
    company: "Northwind Health",
    role: "Technical Talent Partner",
    status: "Ready to review",
    subject: "Your path into health technology recruiting",
    body: "Hi Maya,\n\nI came across your work supporting technical teams at Northwind Health. I’m exploring product and data opportunities where thoughtful systems work has a visible impact, and your perspective on what makes candidates stand out would be genuinely useful.\n\nIf you have fifteen minutes in the next couple of weeks, I’d value hearing how you evaluate people moving into health technology.\n\nBest,\nDylan",
  },
  {
    id: "aisha",
    name: "Aisha Bell",
    initials: "AB",
    company: "Common Thread",
    role: "Senior Recruiter",
    status: "Local draft",
    subject: "A quick question about product roles at Common Thread",
    body: "Hi Aisha,\n\nYour work with product and analytics teams at Common Thread caught my attention. I’m exploring roles where I can bring together strategy, research, and technical delivery.\n\nI’d appreciate your perspective on the experiences that tend to translate best on your teams. Would you be open to a short conversation?\n\nBest,\nDylan",
  },
  {
    id: "leo",
    name: "Leo Martins",
    initials: "LM",
    company: "Harbor Systems",
    role: "Engineering Manager",
    status: "Gmail draft",
    subject: "Your transition into engineering leadership",
    body: "Hi Leo,\n\nI enjoyed reading about your progression from hands-on engineering into team leadership at Harbor Systems. I’m interested in how strong individual contributors can broaden their impact without losing touch with the work.\n\nWould you be open to a brief conversation about what helped you make that transition well?\n\nBest,\nDylan",
  },
];

const candidates: Array<{
  id: string;
  name: string;
  initials: string;
  role: string;
  company: string;
  bucket: string;
  state: CandidateState;
  why: string;
}> = [
  {
    id: "amara",
    name: "Amara Patel",
    initials: "AP",
    role: "Director, Product Strategy",
    company: "Vela Labs",
    bucket: "Executives",
    state: "ready",
    why: "Leads product strategy for data-intensive tools and has a recent history of mentoring operators moving into product leadership.",
  },
  {
    id: "marcus",
    name: "Marcus Reed",
    initials: "MR",
    role: "Engineering Director",
    company: "Northstar Auto",
    bucket: "Managers",
    state: "employer-review",
    why: "Relevant engineering leadership path, but the employer must be reviewed before any draft can be created.",
  },
  {
    id: "elena",
    name: "Elena Rossi",
    initials: "ER",
    role: "Staff Data Engineer",
    company: "Fieldnote",
    bucket: "Peers",
    state: "has-draft",
    why: "Experienced individual contributor working across data infrastructure and applied product analytics.",
  },
];

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    today: <><path d="M4 5.5h16M7 3v5M17 3v5M5 9.5h14v10H5z" /><path d="M8 13h3M8 16h6" /></>,
    drafts: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    candidates: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M16 8h5M18.5 5.5v5" /></>,
    sent: <><path d="m3 11 18-7-6.5 16-3.2-6.7z" /><path d="M11.3 13.3 21 4" /></>,
    resume: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20c.4-4.7 2.5-7 6-7s5.6 2.3 6 7M15 14c3.5-.4 5.5 1.3 6 5" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 10v7M12 7.2h.01" /></>,
  };
  return <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function Avatar({ initials }: { initials: string }) {
  return <span className={styles.avatar} aria-hidden="true">{initials}</span>;
}

export function ExperiencePrototype() {
  const [section, setSection] = useState<Section>("today");
  const [bucket, setBucket] = useState("All");
  const [selectedDraft, setSelectedDraft] = useState("maya");
  const [selectedCandidate, setSelectedCandidate] = useState("amara");
  const [subject, setSubject] = useState(drafts[0].subject);
  const [message, setMessage] = useState(drafts[0].body);
  const [draftStage, setDraftStage] = useState<DraftStage>("local");
  const [addResult, setAddResult] = useState(false);
  const [findMoreResult, setFindMoreResult] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [trustedSyntheticEmployer, setTrustedSyntheticEmployer] = useState(false);
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraft) ?? drafts[0],
    [selectedDraft],
  );
  const activeCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidate) ?? candidates[0],
    [selectedCandidate],
  );

  function navigate(next: Section) {
    setSection(next);
    setMobileQueueOpen(false);
    setNotice(null);
  }

  function chooseDraft(id: string) {
    const draft = drafts.find((item) => item.id === id) ?? drafts[0];
    setSelectedDraft(id);
    setSubject(draft.subject);
    setMessage(draft.body);
    setDraftStage(id === "leo" ? "gmail" : "local");
    setMobileQueueOpen(false);
  }

  function approveDraft() {
    setDraftStage("pending");
    window.setTimeout(() => setDraftStage("gmail"), 650);
  }

  function openEmployerReview() {
    setReviewOpen(true);
  }

  function trustSyntheticEmployer() {
    setTrustedSyntheticEmployer(true);
    setReviewOpen(false);
    setNotice("Northstar Auto is trusted in this synthetic prototype only. No production record changed.");
  }

  function markSyntheticStaffingService() {
    setReviewOpen(false);
    setNotice("Northstar Auto is marked as a recruiting service in this synthetic prototype only. No production record changed.");
  }

  function createCandidateDraft() {
    setSelectedDraft("maya");
    setSubject("A question about product strategy at Vela Labs");
    setMessage("Hi Amara,\n\nYour work leading product strategy for data-intensive tools stood out to me. I’m exploring roles that combine systems thinking, research, and hands-on delivery, and I’d value your perspective on how those skills translate into product leadership.\n\nWould you be open to a short conversation in the next couple of weeks?\n\nBest,\nDylan");
    setDraftStage("local");
    navigate("drafts");
  }

  const activeCandidateState: CandidateState =
    activeCandidate.id === "marcus" && trustedSyntheticEmployer
      ? "ready"
      : activeCandidate.state;

  return (
    <div className={styles.prototype}>
      <a className={styles.skipLink} href="#prototype-workspace">Skip to prototype</a>
      <aside className={styles.sidebar} aria-label="Prototype navigation">
        <button className={styles.brand} onClick={() => navigate("today")} aria-label="NetworkPilot home">
          <span className={styles.brandMark}><span /><span /></span>
          <strong>NetworkPilot</strong>
        </button>
        <nav className={styles.primaryNav} aria-label="Daily work">
          {nav.map((item) => (
            <button key={item.id} onClick={() => navigate(item.id)} aria-current={section === item.id ? "page" : undefined}>
              <Icon name={item.id} />
              <span>{item.label}</span>
              {item.id === "drafts" ? <small>3</small> : null}
            </button>
          ))}
        </nav>
        <nav className={styles.secondaryNav} aria-label="Supporting areas">
          <button onClick={() => setNotice("Resumes are outside this focused prototype. The active General Resume remains visible in Drafts.")}><Icon name="resume" /><span>Resumes</span></button>
          <button onClick={() => setNotice("Settings are outside this focused prototype. No configuration was changed.")}><Icon name="settings" /><span>Settings</span></button>
        </nav>
        <div className={styles.profile}>
          <Avatar initials="DL" />
          <span><strong>Dylan</strong><small>Private workspace</small></span>
        </div>
      </aside>

      <header className={styles.mobileHeader}>
        <button className={styles.brand} onClick={() => navigate("today")} aria-label="NetworkPilot home">
          <span className={styles.brandMark}><span /><span /></span><strong>NetworkPilot</strong>
        </button>
        <span>Prototype</span>
      </header>

      <main className={styles.workspace} id="prototype-workspace">
        <div className={styles.prototypeNotice} role="note">
          <Icon name="info" />
          <span><strong>Interactive prototype</strong> · Synthetic people and local UI state only. No Apollo, Gmail, email, or production data.</span>
        </div>

        {section === "today" ? (
          <Today onNavigate={navigate} />
        ) : null}

        {section === "drafts" ? (
          <section className={styles.page} aria-labelledby="drafts-heading">
            <PageHeader title="Drafts" subtitle="Review the person and message, then choose the next step.">
              <span className={styles.actionWithHint}><button className={styles.secondaryButton} onClick={() => setAddResult(true)}>Add drafts</button><small>Existing pool · no provider call</small></span>
            </PageHeader>
            <BucketSwitcher value={bucket} onChange={setBucket} />
            {addResult ? (
              <ZeroDraftResult
                onReview={() => { setAddResult(false); setSelectedCandidate("marcus"); navigate("candidates"); }}
                onDismiss={() => setAddResult(false)}
              />
            ) : null}
            <button className={styles.mobilePeopleButton} onClick={() => setMobileQueueOpen((open) => !open)} aria-expanded={mobileQueueOpen}>
              <Icon name="people" />
              <span>{activeDraft.name}</span>
              <small>People · {drafts.length}</small>
            </button>
            <div className={styles.draftsLayout}>
              <aside className={`${styles.queue} ${mobileQueueOpen ? styles.queueOpen : ""}`} aria-label="Draft queue">
                <div className={styles.queueHeading}>
                  <span>People</span><small>{drafts.length} ready</small>
                </div>
                {drafts.map((draft) => (
                  <button key={draft.id} onClick={() => chooseDraft(draft.id)} aria-current={selectedDraft === draft.id ? "true" : undefined}>
                    <Avatar initials={draft.initials} />
                    <span><strong>{draft.name}</strong><small>{draft.role}</small><em>{draft.company}</em></span>
                  </button>
                ))}
              </aside>
              <article className={styles.messageWorkspace} aria-label={`Draft for ${activeDraft.name}`}>
                <header className={styles.recipientHeader}>
                  <div><Avatar initials={activeDraft.initials} /><span><strong>{activeDraft.name}</strong><small>{activeDraft.role} · {activeDraft.company}</small></span></div>
                  <span className={styles.quietState}>{draftStage === "gmail" ? "Gmail draft" : draftStage === "sent" ? "Sent" : "Local draft"}</span>
                </header>
                <label className={styles.messageField}>
                  <span>Subject</span>
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} />
                </label>
                <label className={`${styles.messageField} ${styles.bodyField}`}>
                  <span>Message</span>
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
                </label>
                <div className={styles.resumeRow}>
                  <span><Icon name="resume" /><span><strong>General Resume</strong><small>Recruiter default · PDF</small></span></span>
                  <button className={styles.textButton} onClick={() => setNotice("Resume selection would open here. General Resume remains selected in this prototype.")}>Change</button>
                </div>
                <details className={styles.details}>
                  <summary>Details</summary>
                  <div><strong>Why this person</strong><p>Relevant recruiting experience and a verified operating employer. The message asks for perspective without claiming a prior relationship.</p></div>
                </details>
                <DraftAction stage={draftStage} onApprove={approveDraft} onConfirm={() => setDraftStage("confirm")} onCancel={() => setDraftStage("gmail")} onSend={() => setDraftStage("sent")} onNext={() => chooseDraft("aisha")} />
              </article>
            </div>
          </section>
        ) : null}

        {section === "candidates" ? (
          <section className={styles.page} aria-labelledby="candidates-heading">
            <PageHeader title="Candidates" subtitle="Choose a person, then NetworkPilot shows exactly what comes next.">
              <div className={styles.candidateHeaderActions}>
                <span><button className={styles.primaryButton} onClick={() => { setAddResult(true); setFindMoreResult(false); }}>Add drafts</button><small>Existing pool · no provider call</small></span>
                <span><button className={styles.secondaryButton} onClick={() => { setFindMoreResult(true); setAddResult(false); }}><Icon name="search" />Find more</button><small>New people · may use Apollo</small></span>
              </div>
            </PageHeader>
            <BucketSwitcher value={bucket} onChange={setBucket} />
            {addResult ? <ZeroDraftResult onReview={() => { setSelectedCandidate("marcus"); setAddResult(false); }} onDismiss={() => setAddResult(false)} /> : null}
            {findMoreResult ? (
              <div className={styles.inlineNotice} role="status">
                <Icon name="info" /><span><strong>Find more is disabled in this prototype.</strong> This action would open a scoped provider confirmation. No Apollo call was made.</span>
                <button className={styles.iconButton} onClick={() => setFindMoreResult(false)} aria-label="Dismiss"><Icon name="close" /></button>
              </div>
            ) : null}
            <div className={styles.candidateLayout}>
              <div className={styles.candidateList} role="listbox" aria-label="Candidates">
                {candidates.map((candidate) => (
                  <button key={candidate.id} role="option" aria-selected={selectedCandidate === candidate.id} onClick={() => { setSelectedCandidate(candidate.id); setReviewOpen(false); }}>
                    <Avatar initials={candidate.initials} />
                    <span><strong>{candidate.name}</strong><small>{candidate.role}</small><em>{candidate.company}</em></span>
                    <CandidateCue state={candidate.id === "marcus" && trustedSyntheticEmployer ? "ready" : candidate.state} />
                  </button>
                ))}
              </div>
              <article className={styles.candidateDetail}>
                <div className={styles.candidateIdentity}>
                  <Avatar initials={activeCandidate.initials} />
                  <div><h2>{activeCandidate.name}</h2><p>{activeCandidate.role} · {activeCandidate.company}</p></div>
                </div>
                <p className={styles.why}>{activeCandidate.why}</p>
                <details className={styles.details}>
                  <summary>Evidence and eligibility</summary>
                  <div><strong>Current scope</strong><p>{activeCandidate.bucket}. Role and employment evidence are synthetic for this prototype.</p></div>
                </details>
                <CandidateAction
                  state={activeCandidateState}
                  onCreate={createCandidateDraft}
                  onOpen={() => navigate("drafts")}
                  onReview={openEmployerReview}
                />
                {reviewOpen ? (
                  <EmployerReview onTrust={trustSyntheticEmployer} onStaffing={markSyntheticStaffingService} onClose={() => setReviewOpen(false)} />
                ) : null}
              </article>
            </div>
          </section>
        ) : null}

        {section === "sent" ? <Sent /> : null}
      </main>

      {notice ? <div className={styles.syntheticToast} role="status"><Icon name="check" /><span>{notice}</span><button className={styles.iconButton} onClick={() => setNotice(null)} aria-label="Dismiss message"><Icon name="close" /></button></div> : null}

      <nav className={styles.mobileNav} aria-label="Mobile navigation">
        {nav.map((item) => (
          <button key={item.id} onClick={() => navigate(item.id)} aria-current={section === item.id ? "page" : undefined}>
            <Icon name={item.id} /><span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  const id = `${title.toLowerCase()}-heading`;
  return <header className={styles.pageHeader}><div><h1 id={id}>{title}</h1><p>{subtitle}</p></div>{children}</header>;
}

function BucketSwitcher({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className={styles.bucketControl}>
    <div className={styles.bucketTabs} aria-label="Recipient group">
      {buckets.map((item) => <button key={item} aria-pressed={value === item} onClick={() => onChange(item)}>{item}</button>)}
    </div>
    <label className={styles.mobileBucket}><span>Recipient group</span><select value={value} onChange={(event) => onChange(event.target.value)}>{buckets.map((item) => <option key={item}>{item}</option>)}</select></label>
  </div>;
}

function Today({ onNavigate }: { onNavigate: (section: Section) => void }) {
  return <section className={`${styles.page} ${styles.today}`} aria-labelledby="today-heading">
    <div className={styles.todayLead}>
      <h1 id="today-heading">Good afternoon, Dylan</h1>
      <p>Three thoughtful messages are ready for your review.</p>
      <button className={styles.primaryButton} onClick={() => onNavigate("drafts")}>Continue reviewing <Icon name="arrow" /></button>
    </div>
    <div className={styles.taskList}>
      <button onClick={() => onNavigate("drafts")}><span><strong>3 drafts ready to review</strong><small>Start with Maya Chen</small></span><Icon name="arrow" /></button>
      <button onClick={() => onNavigate("candidates")}><span><strong>2 employers need review</strong><small>Reviewing them may unlock new drafts</small></span><Icon name="arrow" /></button>
      <button onClick={() => onNavigate("drafts")}><span><strong>1 Gmail draft ready to send</strong><small>Review once more before contacting Leo</small></span><Icon name="arrow" /></button>
    </div>
  </section>;
}

function DraftAction({ stage, onApprove, onConfirm, onCancel, onSend, onNext }: { stage: DraftStage; onApprove: () => void; onConfirm: () => void; onCancel: () => void; onSend: () => void; onNext: () => void }) {
  return <section className={styles.nextMove} aria-label="Next action" aria-live="polite">
    <div className={styles.lifecycle} aria-label="Draft lifecycle">
      <span data-active="true"><i><Icon name="check" /></i>Local draft</span>
      <b />
      <span data-active={stage === "gmail" || stage === "confirm" || stage === "sent"}><i>{stage === "gmail" || stage === "confirm" || stage === "sent" ? <Icon name="check" /> : "2"}</i>Gmail draft</span>
      <b />
      <span data-active={stage === "sent"}><i>{stage === "sent" ? <Icon name="check" /> : "3"}</i>Sent</span>
    </div>
    {stage === "local" ? <div className={styles.nextMoveBody}><span><strong>Ready for your approval</strong><small>This creates a Gmail draft. It does not send.</small></span><button className={styles.primaryButton} onClick={onApprove}>Approve &amp; create Gmail draft</button></div> : null}
    {stage === "pending" ? <div className={styles.nextMoveBody}><span><strong>Creating Gmail draft…</strong><small>Your edits are saved locally while this completes.</small></span><button className={styles.primaryButton} disabled><span className={styles.spinner} />Creating draft</button></div> : null}
    {stage === "gmail" ? <div className={styles.nextMoveBody}><span><strong>Gmail draft created</strong><small>Review once more. Sending is a separate action.</small></span><button className={styles.primaryButton} onClick={onConfirm}>Send email</button></div> : null}
    {stage === "confirm" ? <div className={styles.confirmSend}><div><strong>Send this email now?</strong><p>This would contact the recipient immediately. In this prototype, the confirmation changes synthetic UI state only.</p></div><span><button className={styles.secondaryButton} onClick={onCancel}>Cancel</button><button className={styles.dangerButton} onClick={onSend}>Confirm send</button></span></div> : null}
    {stage === "sent" ? <div className={styles.nextMoveBody}><span><strong>Email marked sent</strong><small>Prototype state only. No Gmail call or email occurred.</small></span><button className={styles.secondaryButton} onClick={onNext}>Next person <Icon name="arrow" /></button></div> : null}
  </section>;
}

function CandidateCue({ state }: { state: CandidateState }) {
  const copy = state === "ready" ? "Ready" : state === "employer-review" ? "Employer review" : "Draft created";
  return <span className={styles.candidateCue} data-state={state}>{copy}</span>;
}

function CandidateAction({ state, onCreate, onOpen, onReview }: { state: CandidateState; onCreate: () => void; onOpen: () => void; onReview: () => void }) {
  return <section className={styles.nextMove} aria-label="Candidate next action">
    {state === "ready" ? <div className={styles.nextMoveBody}><span><strong>Ready for a thoughtful introduction</strong><small>Create one local draft · no provider call</small></span><button className={styles.primaryButton} onClick={onCreate}>Create draft</button></div> : null}
    {state === "employer-review" ? <div className={styles.nextMoveBody}><span><strong>Employer review required</strong><small>A quick employer review is required before drafting.</small></span><button className={styles.warningButton} onClick={onReview}>Review employer</button></div> : null}
    {state === "has-draft" ? <div className={styles.nextMoveBody}><span><strong>Draft already created</strong><small>Continue editing the existing message.</small></span><button className={styles.primaryButton} onClick={onOpen}>Open draft</button></div> : null}
  </section>;
}

export function EmployerReview({ onTrust, onStaffing, onClose }: { onTrust: () => void; onStaffing: () => void; onClose: () => void }) {
  return <section className={styles.employerReview} aria-labelledby="employer-review-title">
    <header><div><h3 id="employer-review-title">Review Northstar Auto</h3><p>Decide whether this synthetic employer is safe to use for drafting.</p></div><button className={styles.iconButton} onClick={onClose} aria-label="Close employer review"><Icon name="close" /></button></header>
    <dl><div><dt>Company</dt><dd>Northstar Auto Group</dd></div><div><dt>Website</dt><dd>northstar-auto.example</dd></div><div><dt>Evidence</dt><dd>Operating automotive technology business</dd></div></dl>
    <label><span>Reason</span><textarea defaultValue="Official company materials describe an operating automotive technology business with direct employment opportunities." /></label>
    <div className={styles.reviewActions}><button className={styles.primaryButton} onClick={onTrust}>Trust operating employer</button><button className={styles.secondaryButton} onClick={onStaffing}>Mark recruiting service</button><button className={styles.textButton} onClick={onClose}>Leave unverified</button></div>
    <small>Prototype state only. No company-trust record will be written.</small>
  </section>;
}

export function ZeroDraftResult({ onReview, onDismiss }: { onReview: () => void; onDismiss: () => void }) {
  return <section className={styles.zeroResult} role="status" aria-live="polite">
    <div className={styles.resultIcon}><Icon name="info" /></div>
    <div><strong>No drafts could be added.</strong><p>The existing pool has no additional people ready: 2 employers need review and 1 person already has a draft.</p><button className={styles.textButton} onClick={onReview}>Review employers <Icon name="arrow" /></button></div>
    <button className={styles.iconButton} onClick={onDismiss} aria-label="Dismiss result"><Icon name="close" /></button>
  </section>;
}

function Sent() {
  return <section className={`${styles.page} ${styles.sentPage}`} aria-labelledby="sent-heading">
    <PageHeader title="Sent" subtitle="A quiet history of the people you have contacted." />
    <div className={styles.sentList}>
      <article><Avatar initials="JR" /><span><strong>Jordan Rivera</strong><small>Product Operations · Mesa</small><p>Thank you for sharing how your team approaches cross-functional planning…</p></span><time>Oct 8</time></article>
      <article><Avatar initials="SK" /><span><strong>Samira Khan</strong><small>VP, Data · Lantern</small><p>I appreciated your point about treating data quality as a product decision…</p></span><time>Oct 2</time></article>
    </div>
  </section>;
}

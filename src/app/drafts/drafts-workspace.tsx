"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  approveEditedDraft,
  confirmAlreadySent,
  createGmailDraft,
  generateMoreDrafts,
  permanentlyExcludeDraft,
  reconcileGmailSendStatus,
  replaceDraft,
  resolveBucketCorrection,
  sendGmailDraft,
  skipDraft,
} from "@/app/today/actions";
import {
  workspacePrimaryBlockReason,
  type WorkspaceDraft,
  type WorkspaceDraftState,
  type WorkspaceResume,
} from "./workspace-data";
import {
  RecipientBucketNavigation,
  type BucketNavigationData,
} from "@/app/recipient-bucket-navigation";
import { hasResumeAttachmentClaim } from "@/application/resumes/attachment-claims";
import styles from "./drafts-workspace.module.css";

const stateOrder: WorkspaceDraftState[] = [
  "ready",
  "approved",
  "gmail-draft-created",
  "needs-send-verification",
];
const stateLabels: Record<WorkspaceDraftState, string> = {
  ready: "Needs review",
  approved: "Approved",
  "gmail-draft-created": "Gmail created",
  "needs-send-verification": "Needs verification",
};
const stateGlyph: Record<WorkspaceDraftState, string> = {
  ready: "○",
  approved: "✓",
  "gmail-draft-created": "▣",
  "needs-send-verification": "?",
};
const actionLabels: Record<WorkspaceDraftState, string> = {
  ready: "Approve draft",
  approved: "Create Gmail Draft",
  "gmail-draft-created": "Send email",
  "needs-send-verification": "Resolve send status",
};

type Feedback = {
  tone: "success" | "caution" | "error";
  message: string;
} | null;
type DraftEdit = {
  subject: string;
  body: string;
  resumeId: string;
  continueWithoutAttachment: boolean;
};
const draftEditsKey = "networkpilot.draft-edits.v1";
const recipientBucketLabels = {
  recruiters: "Recruiters",
  peers: "Peers & practitioners",
  managers: "Managers & team leaders",
  executives: "Executives",
  ceos: "CEOs & presidents",
} as const;
const bucketLabel = (bucket: string | null | undefined) =>
  bucket
    ? ((recipientBucketLabels as Record<string, string>)[bucket] ?? bucket)
    : "Legacy / unclassified";

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.matches("input,textarea,select,[contenteditable='true']")
  );
}

function useDialogFocus(
  open: boolean,
  onClose: () => void,
  returnFocus?: RefObject<HTMLElement | null>,
) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      fallback = returnFocus?.current,
      root = ref.current,
      focusable = () =>
        Array.from(
          root?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])',
          ) ?? [],
        ),
      frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", key);
      const target =
        previous && previous !== document.body ? previous : fallback;
      requestAnimationFrame(() => target?.focus());
    };
  }, [onClose, open, returnFocus]);
  return ref;
}

function SafeDialog({
  open,
  label,
  onClose,
  children,
  className,
  returnFocus,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  className: string;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const ref = useDialogFocus(open, onClose, returnFocus);
  if (!open) return null;
  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={ref}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

export function DraftsWorkspace({
  drafts,
  resumes,
  gmailAvailable,
  gmailReason,
  hasReserve,
  initialCandidateId,
  initialMobileReview = false,
  feedback,
  bucketNavigation,
  addRequestId,
}: {
  drafts: WorkspaceDraft[];
  resumes: WorkspaceResume[];
  gmailAvailable: boolean;
  gmailReason: string | null;
  hasReserve: boolean;
  initialCandidateId?: string;
  initialMobileReview?: boolean;
  feedback: Feedback;
  bucketNavigation?: BucketNavigationData;
  addRequestId: string;
}) {
  const viewDrafts = useMemo(() => {
    if (!bucketNavigation || bucketNavigation.selected === "all") return drafts;
    if (bucketNavigation.selected === "legacy")
      return drafts.filter((draft) => !draft.recipientBucket?.bucket);
    return drafts.filter(
      (draft) =>
        draft.recipientBucket?.bucket === bucketNavigation.selected &&
        (!bucketNavigation.earlyCareerOnly ||
          draft.recipientBucket.earlyCareer),
    );
  }, [bucketNavigation, drafts]);
  const initial =
    viewDrafts.find((draft) => draft.candidateId === initialCandidateId) ??
    viewDrafts[0] ??
    null;
  const [selectedId, setSelectedId] = useState(initial?.candidateId ?? "");
  const [mobileReview, setMobileReview] = useState(initialMobileReview);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftEdit>>({});
  const [editsLoaded, setEditsLoaded] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<string | null>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const approveRef = useRef<HTMLFormElement>(null);
  const skipRef = useRef<HTMLFormElement>(null);
  const replaceRef = useRef<HTMLFormElement>(null);
  const createRef = useRef<HTMLFormElement>(null);
  const addRef = useRef<HTMLDetailsElement>(null);
  const commandTriggerRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    requestAnimationFrame(() => commandTriggerRef.current?.focus());
  }, []);
  const closeSend = useCallback(() => {
    setSendOpen(false);
    requestAnimationFrame(() => primaryRef.current?.focus());
  }, []);
  const closeReconcile = useCallback(() => {
    setReconcileOpen(false);
    requestAnimationFrame(() => primaryRef.current?.focus());
  }, []);
  const selected =
    viewDrafts.find((draft) => draft.candidateId === selectedId) ??
    viewDrafts[0] ??
    null;
  const selectedEdit = selected ? draftEdits[selected.snapshotId] : undefined;
  const editedSubject = selectedEdit?.subject ?? selected?.subject ?? "";
  const editedBody = selectedEdit?.body ?? selected?.body ?? "";
  const requestedResumeId =
    selectedEdit?.resumeId ?? selected?.resumeSelection?.resumeId ?? "";
  const selectedResumeId = resumes.some(
    (resume) => resume.id === requestedResumeId,
  )
    ? requestedResumeId
    : "";
  const continueWithoutAttachment = Boolean(
    selectedEdit?.continueWithoutAttachment,
  );
  const resumeDecisionRequired = Boolean(
    bucketNavigation && selected?.track === "recruiter",
  );
  const resumeDecisionResolved =
    !resumeDecisionRequired ||
    Boolean(selectedResumeId) ||
    continueWithoutAttachment;
  const selectedIndex = selected
    ? viewDrafts.findIndex(
        (draft) => draft.candidateId === selected.candidateId,
      )
    : -1;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        stateOrder.map((state) => [
          state,
          viewDrafts.filter((draft) => draft.state === state).length,
        ]),
      ) as Record<WorkspaceDraftState, number>,
    [viewDrafts],
  );
  const nextCandidateId =
    selectedIndex >= 0
      ? ((viewDrafts[selectedIndex + 1] ?? viewDrafts[selectedIndex - 1])
          ?.candidateId ?? "")
      : "";
  const primaryReason = !editsLoaded
    ? "Restoring this draft’s local edits."
    : resumeDecisionRequired && !resumeDecisionResolved
      ? "Choose an active resume or explicitly continue without an attachment before approval."
      : workspacePrimaryBlockReason(selected, gmailAvailable, gmailReason);
  const primaryBlocked = Boolean(primaryReason);

  const select = useCallback((candidateId: string, openReview = false) => {
    setSelectedId(candidateId);
    if (openReview) setMobileReview(true);
    const url = new URL(window.location.href);
    url.searchParams.set("candidate", candidateId);
    window.history.replaceState(null, "", url);
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = sessionStorage.getItem(draftEditsKey);
        if (saved)
          setDraftEdits(JSON.parse(saved) as Record<string, DraftEdit>);
      } catch {
        /* Keep editing available when session storage is unavailable. */
      }
      setEditsLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const updateSelectedEdit = useCallback(
    (patch: Partial<DraftEdit>) => {
      if (!selected) return;
      setDraftEdits((current) => {
        const next = {
          ...current,
          [selected.snapshotId]: {
            subject: current[selected.snapshotId]?.subject ?? selected.subject,
            body: current[selected.snapshotId]?.body ?? selected.body,
            resumeId:
              current[selected.snapshotId]?.resumeId ??
              selected.resumeSelection?.resumeId ??
              "",
            continueWithoutAttachment:
              current[selected.snapshotId]?.continueWithoutAttachment ?? false,
            ...patch,
          },
        };
        try {
          sessionStorage.setItem(draftEditsKey, JSON.stringify(next));
        } catch {
          /* State remains available for this mounted workspace. */
        }
        return next;
      });
      setResumePrompt(null);
    },
    [selected],
  );
  const move = useCallback(
    (step: 1 | -1) => {
      if (!viewDrafts.length) return;
      const index = Math.max(
        0,
        viewDrafts.findIndex((draft) => draft.candidateId === selectedId),
      );
      const next =
        viewDrafts[Math.min(viewDrafts.length - 1, Math.max(0, index + step))];
      if (next) {
        select(next.candidateId);
        requestAnimationFrame(() =>
          document
            .getElementById(`queue-${next.candidateId}`)
            ?.scrollIntoView({ block: "nearest" }),
        );
      }
    },
    [viewDrafts, select, selectedId],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (sendOpen) closeSend();
        else if (reconcileOpen) closeReconcile();
        else if (paletteOpen) closePalette();
        else if (mobileReview) setMobileReview(false);
        return;
      }
      if (sendOpen || reconcileOpen || paletteOpen) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (
        isTypingTarget(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "j" || key === "k") {
        event.preventDefault();
        move(key === "j" ? 1 : -1);
      } else if (key === "enter") {
        event.preventDefault();
        setMobileReview(true);
        subjectRef.current?.focus();
      } else if (key === "e" && selected?.state === "ready") {
        event.preventDefault();
        subjectRef.current?.focus();
      } else if (
        key === "a" &&
        selected?.state === "ready" &&
        !primaryBlocked
      ) {
        event.preventDefault();
        approveRef.current?.requestSubmit();
      } else if (
        key === "r" &&
        selected?.state !== "needs-send-verification" &&
        (!bucketNavigation ||
          (bucketNavigation.selected !== "all" &&
            bucketNavigation.selected !== "legacy"))
      ) {
        event.preventDefault();
        replaceRef.current?.requestSubmit();
      } else if (key === "x" && selected?.state !== "needs-send-verification") {
        event.preventDefault();
        skipRef.current?.requestSubmit();
      } else if (key === "n") {
        event.preventDefault();
        if (addRef.current) addRef.current.open = true;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    bucketNavigation,
    closePalette,
    closeReconcile,
    closeSend,
    mobileReview,
    move,
    paletteOpen,
    primaryBlocked,
    reconcileOpen,
    selected,
    sendOpen,
  ]);

  const runPrimary = () => {
    if (!selected || primaryBlocked) return;
    if (selected.state === "ready") approveRef.current?.requestSubmit();
    else if (selected.state === "approved") createRef.current?.requestSubmit();
    else if (selected.state === "gmail-draft-created") setSendOpen(true);
    else setReconcileOpen(true);
  };

  const scopeBucket =
    bucketNavigation &&
    bucketNavigation.selected !== "all" &&
    bucketNavigation.selected !== "legacy"
      ? bucketNavigation.selected
      : "";
  const scopedLegacy = bucketNavigation?.selected === "legacy";
  const chooseBucketFirst = Boolean(bucketNavigation?.selected === "all");
  const replacementBlocked = scopedLegacy || chooseBucketFirst;
  const scopeEarlyCareer = Boolean(
    bucketNavigation?.selected === "peers" && bucketNavigation.earlyCareerOnly,
  );
  const resumeOptions = resumes;
  return (
    <main
      className={styles.shell}
      data-mobile-review={mobileReview ? "true" : undefined}
      data-five-bucket={bucketNavigation ? "true" : undefined}
    >
      <a className={styles.skipLink} href="#draft-message">
        Skip to selected message
      </a>
      <header className={styles.commandBar}>
        <Link className={styles.brand} href="/today">
          <span>N</span>
          <strong>NetworkPilot</strong>
          <em>Command</em>
        </Link>
        <button
          ref={commandTriggerRef}
          className={styles.commandTrigger}
          onClick={() => setPaletteOpen(true)}
        >
          Jump or run a command <kbd>⌘ K</kbd>
        </button>
        <span className={styles.gmailState}>
          {gmailAvailable ? "Gmail ready" : "Gmail unavailable"}
        </span>
        <Link className={styles.supportLink} href="/">
          System
        </Link>
      </header>
      {bucketNavigation ? (
        <RecipientBucketNavigation data={bucketNavigation} />
      ) : null}
      {!bucketNavigation ? (
        <nav className={styles.rail} aria-label="Primary navigation">
          <Link href="/today">
            <span>○</span>
            <b>Today</b>
          </Link>
          <Link href="/drafts" aria-current="page">
            <span>⌁</span>
            <small>{drafts.length}</small>
            <b>Drafts</b>
          </Link>
          <Link href="/sent">
            <span>✓</span>
            <b>Sent</b>
          </Link>
          <Link href="/candidates">
            <span>◇</span>
            <b>Candidates</b>
          </Link>
        </nav>
      ) : null}
      <section id="workspace-content" className={styles.workspace}>
        <header className={styles.contextBar}>
          <div>
            <h1>Drafts</h1>
            <span>
              {viewDrafts.length} active · {counts.ready} need review
              {bucketNavigation && bucketNavigation.selected !== "all"
                ? ` · ${bucketNavigation.selected === "legacy" ? "Legacy / unclassified" : bucketNavigation.selected}`
                : ""}
            </span>
          </div>
          <div className={styles.counts} aria-label="Draft state counts">
            {stateOrder.map((state) => (
              <span key={state}>
                {stateLabels[state]} <b>{counts[state]}</b>
              </span>
            ))}
          </div>
          <details className={styles.addDrafts} ref={addRef}>
            <summary>
              {bucketNavigation && scopeBucket
                ? `Add ${({ recruiters: "recruiter", peers: "peer", managers: "manager", executives: "executive", ceos: "CEO/president" } as const)[scopeBucket]} drafts`
                : "Add drafts"}{" "}
              <kbd>N</kbd>
            </summary>
            <div>
              <strong>
                Add from{" "}
                {scopeBucket
                  ? (
                      {
                        recruiters: "recruiter",
                        peers: "peer and practitioner",
                        managers: "manager",
                        executives: "executive",
                        ceos: "CEO/president",
                      } as const
                    )[scopeBucket] + " reserve"
                  : "reserve"}
              </strong>
              <p>
                {scopeEarlyCareer ? "Scope: Early-career peers only. " : ""}Adds
                additional candidates without replacing the queue. This uses
                qualified reserve only.
              </p>
              {scopedLegacy ? (
                <p role="status">
                  Legacy / unclassified drafts are read-only in this view.
                  Choose a bucket to add scoped drafts.
                </p>
              ) : chooseBucketFirst ? (
                <p role="status">
                  Choose a recipient bucket to add drafts from its qualified
                  reserve.
                </p>
              ) : hasReserve ? (
                <>
                  <form action={generateMoreDrafts}>
                    <input type="hidden" name="requestId" value={addRequestId} />
                    <input
                      type="hidden"
                      name="candidateId"
                      value={selected?.candidateId ?? ""}
                    />
                    {bucketNavigation && scopeBucket ? (
                      <input type="hidden" name="bucket" value={scopeBucket} />
                    ) : null}
                    {scopeEarlyCareer ? (
                      <input
                        type="hidden"
                        name="earlyCareerOnly"
                        value="true"
                      />
                    ) : null}
                    <button name="additionalDraftCount" value="5">
                      Add 5
                    </button>
                    <button name="additionalDraftCount" value="10">
                      Add 10
                    </button>
                  </form>
                  <form action={generateMoreDrafts}>
                    <input type="hidden" name="requestId" value={addRequestId} />
                    <input
                      type="hidden"
                      name="candidateId"
                      value={selected?.candidateId ?? ""}
                    />
                    {bucketNavigation && scopeBucket ? (
                      <input type="hidden" name="bucket" value={scopeBucket} />
                    ) : null}
                    {scopeEarlyCareer ? (
                      <input
                        type="hidden"
                        name="earlyCareerOnly"
                        value="true"
                      />
                    ) : null}
                    <label>
                      Custom, 1–20
                      <input
                        name="additionalDraftCount"
                        type="number"
                        min="1"
                        max="20"
                        defaultValue="5"
                        required
                      />
                    </label>
                    <button>Add custom</button>
                  </form>
                </>
              ) : (
                <p role="status">
                  There are no available drafts in this reserve view.{" "}
                  <Link
                    href={
                      scopeBucket
                        ? `/candidates?bucket=${encodeURIComponent(scopeBucket)}${scopeEarlyCareer ? "&earlyCareerOnly=true" : ""}`
                        : "/candidates"
                    }
                  >
                    {scopeBucket
                      ? `Find more ${scopeBucket}`
                      : "Refresh Candidates"}
                  </Link>{" "}
                  for more supply.
                </p>
              )}
            </div>
          </details>
        </header>
        {bucketNavigation?.selected === "peers" ? (
          <label className={styles.earlyCareerFilter}>
            <input
              type="checkbox"
              checked={Boolean(bucketNavigation.earlyCareerOnly)}
              onChange={(event) => {
                const url = new URL(window.location.href);
                if (event.currentTarget.checked)
                  url.searchParams.set("earlyCareerOnly", "true");
                else url.searchParams.delete("earlyCareerOnly");
                window.location.assign(url.toString());
              }}
            />
            <span>Early-career only</span>
          </label>
        ) : null}
        {feedback ? (
          <p
            className={styles.feedback}
            data-tone={feedback.tone}
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        ) : null}
        {viewDrafts.length === 0 ? (
          <div className={styles.empty}>
            <span>—</span>
            <h2>
              {bucketNavigation?.selected === "legacy"
                ? "No legacy drafts in this view"
                : "No drafts waiting for review"}
            </h2>
            <p>
              {bucketNavigation?.selected === "legacy"
                ? "Legacy / unclassified records remain visible in their historical workspace and are not relabeled."
                : hasReserve
                  ? "Add another bounded batch from the qualified reserve."
                  : "The queue and qualified reserve are both empty for this view."}
            </p>
            {bucketNavigation?.selected !== "legacy" && !hasReserve ? (
              <Link href="/candidates">Review Candidates</Link>
            ) : null}
          </div>
        ) : (
          <>
            <div
              className={styles.queue}
              ref={queueRef}
              role="listbox"
              aria-label="Active draft queue"
              tabIndex={-1}
            >
              <div className={styles.planeLabel}>
                <span>Queue</span>
                <kbd>J / K</kbd>
              </div>
              {stateOrder.map((state) => {
                const group = viewDrafts.filter(
                  (draft) => draft.state === state,
                );
                return group.length ? (
                  <section key={state}>
                    <h2>
                      <span>
                        {stateGlyph[state]} {stateLabels[state]}
                      </span>
                      <b>{group.length}</b>
                    </h2>
                    {group.map((draft) => (
                      <button
                        id={`queue-${draft.candidateId}`}
                        key={draft.candidateId}
                        role="option"
                        aria-selected={
                          selected?.candidateId === draft.candidateId
                        }
                        data-state={draft.state}
                        data-review-needed={
                          draft.bucketReviewState === "review-required"
                            ? "true"
                            : undefined
                        }
                        onClick={() =>
                          select(
                            draft.candidateId,
                            window.matchMedia("(max-width: 860px)").matches,
                          )
                        }
                      >
                        <span>
                          <strong>{draft.recipient}</strong>
                          <small>{draft.company}</small>
                        </span>
                        <em>{draft.title}</em>
                        <i>
                          {draft.bucketReviewState === "review-required"
                            ? "Review needed"
                            : `${stateGlyph[draft.state]} ${stateLabels[draft.state]}`}
                        </i>
                      </button>
                    ))}
                  </section>
                ) : null;
              })}
            </div>
            {selected ? (
              <>
                <article
                  id="draft-message"
                  className={styles.message}
                  data-state={selected.state}
                  tabIndex={-1}
                >
                  <button
                    className={styles.mobileBack}
                    onClick={() => setMobileReview(false)}
                  >
                    ← Queue{" "}
                    <span>
                      {selectedIndex + 1} of {viewDrafts.length}
                    </span>
                  </button>
                  <div className={styles.planeLabel}>
                    <span>Message</span>
                    <em>
                      {stateGlyph[selected.state]} {stateLabels[selected.state]}
                    </em>
                  </div>
                  <form
                    id={`approve-${selected.candidateId}`}
                    ref={approveRef}
                    action={approveEditedDraft}
                    onSubmit={(event) => {
                      if (
                        selected.state !== "ready" ||
                        selected.bucketReviewState === "review-required" ||
                        !resumeDecisionResolved
                      ) {
                        event.preventDefault();
                        if (!resumeDecisionResolved)
                          setResumePrompt(
                            "Choose an active resume or confirm that you want to continue without an attachment.",
                          );
                      }
                    }}
                    className={styles.editor}
                    key={`${selected.candidateId}-${selected.state}`}
                    aria-busy={!editsLoaded}
                  >
                    <input
                      type="hidden"
                      name="snapshotId"
                      value={selected.snapshotId}
                    />
                    <input
                      type="hidden"
                      name="candidateId"
                      value={selected.candidateId}
                    />
                    <input
                      type="hidden"
                      name="resumeDecision"
                      value={
                        resumeDecisionRequired &&
                        !selectedResumeId &&
                        continueWithoutAttachment
                          ? "continue-without-attachment"
                          : ""
                      }
                    />
                    <header className={styles.messageHeader}>
                      <div>
                        <small>To</small>
                        <strong>{selected.recipient}</strong>
                        <span>{selected.title}</span>
                        <b>{selected.company}</b>
                      </div>
                      <label className={styles.resume}>
                        <span>Attachment</span>
                        {selected.state === "ready" ? (
                          <>
                            <select
                              name="resumeId"
                              value={selectedResumeId}
                              aria-label="Resume attachment"
                              disabled={!editsLoaded}
                              onChange={(event) =>
                                updateSelectedEdit({
                                  resumeId: event.currentTarget.value,
                                  continueWithoutAttachment: false,
                                })
                              }
                            >
                              <option value="">None</option>
                              {resumeOptions.map((resume) => (
                                <option key={resume.id} value={resume.id}>
                                  {resume.label} · {resume.lane}
                                  {selected.resumeSelection?.resumeId ===
                                  resume.id
                                    ? " · configured default"
                                    : ""}
                                </option>
                              ))}
                            </select>
                            {selected.resumeSelection?.source ===
                              "configured-default" && selectedResumeId ? (
                              <small>
                                Configured default · new recruiter drafts
                              </small>
                            ) : selected.resumeSelection?.source ===
                              "unavailable" ? (
                              <small role="status">
                                Configured default is missing or inactive.
                                Choose an active resume or continue without one.
                              </small>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <strong>
                              {selected.attachment?.label ?? "None"}
                            </strong>
                            <small>
                              {selected.attachment?.filename ?? "No attachment"}
                            </small>
                          </>
                        )}
                      </label>
                    </header>
                    {bucketNavigation ? (
                      <p
                        className={styles.bucketStamp}
                        data-review-needed={
                          selected.bucketReviewState === "review-required"
                            ? "true"
                            : undefined
                        }
                      >
                        <span>Recipient bucket</span>
                        <strong>{selected.bucketLabel}</strong>
                        <small>
                          {selected.bucketReviewState === "review-required"
                            ? "Review needed"
                            : selected.bucketReviewState ===
                                "legacy-unclassified"
                              ? "Historical / unclassified"
                              : "Evidence reviewed"}
                        </small>
                      </p>
                    ) : null}
                    {selected.state !== "ready" ? (
                      <div className={styles.sealed}>
                        <span>
                          {stateGlyph[selected.state]} Approved snapshot
                        </span>
                        <small>
                          {selected.approvedAt
                            ? `Locked ${new Date(selected.approvedAt).toLocaleDateString()}`
                            : "Immutable approved content"}
                        </small>
                      </div>
                    ) : null}
                    {selected.bucketReviewState === "review-required" ? (
                      <p className={styles.blocked} role="alert">
                        Review needed ·{" "}
                        {selected.bucketReviewReason ??
                          "Bucket evidence is insufficient."}{" "}
                        This draft cannot be approved or externalized until the
                        evidence is resolved.
                      </p>
                    ) : null}
                    {selected.blockedMessage ? (
                      <p className={styles.blocked} role="alert">
                        {selected.blockedMessage}
                      </p>
                    ) : null}
                    {resumeDecisionRequired && !selectedResumeId ? (
                      <label className={styles.resumeDecision}>
                        <input
                          type="checkbox"
                          checked={continueWithoutAttachment}
                          disabled={!editsLoaded}
                          onChange={(event) =>
                            updateSelectedEdit({
                              continueWithoutAttachment:
                                event.currentTarget.checked,
                            })
                          }
                        />
                        <span>
                          Continue without an attachment for this draft
                        </span>
                      </label>
                    ) : null}
                    {selected.track === "recruiter" &&
                    !selectedResumeId &&
                    hasResumeAttachmentClaim(editedBody) ? (
                      <p className={styles.attachmentMismatch} role="status">
                        This message says a resume is attached, but no resume is
                        selected. Review the message and remove or correct that
                        claim before approval; the copy is not changed
                        automatically.
                      </p>
                    ) : null}
                    {resumePrompt ? (
                      <p className={styles.blocked} role="alert">
                        {resumePrompt}
                      </p>
                    ) : null}
                    <label className={styles.subject}>
                      <span>Subject</span>
                      <input
                        ref={subjectRef}
                        name="subject"
                        value={editedSubject}
                        onChange={(event) =>
                          updateSelectedEdit({
                            subject: event.currentTarget.value,
                          })
                        }
                        readOnly={selected.state !== "ready" || !editsLoaded}
                        required
                        maxLength={64}
                      />
                    </label>
                    <label className={styles.body}>
                      <span className={styles.srOnly}>Message body</span>
                      <textarea
                        name="body"
                        value={editedBody}
                        onChange={(event) =>
                          updateSelectedEdit({
                            body: event.currentTarget.value,
                          })
                        }
                        readOnly={selected.state !== "ready" || !editsLoaded}
                        required
                        rows={14}
                      />
                    </label>
                    <details className={styles.mobileEvidence}>
                      <summary>Context and evidence</summary>
                      <Inspector
                        draft={selected}
                        showBucketDetails={Boolean(bucketNavigation)}
                      />
                    </details>
                  </form>
                  {selected.classificationChange?.decisionRequired ? (
                    <section className={styles.blocked} role="alert">
                      <strong>
                        Bucket corrected · message review required
                      </strong>
                      <p>
                        The recipient bucket changed from{" "}
                        {bucketLabel(
                          selected.classificationChange.previous?.bucket,
                        )}{" "}
                        to{" "}
                        {bucketLabel(
                          selected.classificationChange.current.bucket,
                        )}
                        . This draft is still unapproved. Choose how to handle
                        your current text against the updated evidence; this
                        choice does not approve or send it.
                      </p>
                      {selected.classificationChange.current.reviewState !==
                        "accepted" ||
                      !selected.classificationChange.current.bucket ? (
                        <p>
                          Bucket evidence is not yet accepted. Resolve the
                          classification before keeping edits or regenerating
                          the message.
                        </p>
                      ) : (
                        <div className={styles.correctionChoices}>
                          <form action={resolveBucketCorrection}>
                            <input
                              type="hidden"
                              name="candidateId"
                              value={selected.candidateId}
                            />
                            <input
                              type="hidden"
                              name="snapshotId"
                              value={selected.snapshotId}
                            />
                            <input
                              type="hidden"
                              name="decision"
                              value="keep-edits"
                            />
                            <input
                              type="hidden"
                              name="subject"
                              value={editedSubject}
                            />
                            <input
                              type="hidden"
                              name="body"
                              value={editedBody}
                            />
                            <button disabled={!editsLoaded}>
                              Keep my edits
                            </button>
                          </form>
                          <form action={resolveBucketCorrection}>
                            <input
                              type="hidden"
                              name="candidateId"
                              value={selected.candidateId}
                            />
                            <input
                              type="hidden"
                              name="snapshotId"
                              value={selected.snapshotId}
                            />
                            <input
                              type="hidden"
                              name="decision"
                              value="regenerate"
                            />
                            <button>Regenerate from corrected bucket</button>
                          </form>
                        </div>
                      )}
                    </section>
                  ) : null}
                </article>
                <aside className={styles.inspector}>
                  <div className={styles.planeLabel}>
                    <span>Inspector</span>
                    <em>Secondary</em>
                  </div>
                  <Inspector
                    draft={selected}
                    showBucketDetails={Boolean(bucketNavigation)}
                  />
                  {selected.manualOperatorId ? (
                    <details className={styles.manualFallback}>
                      <summary>Sent outside NetworkPilot?</summary>
                      <form action={confirmAlreadySent}>
                        <input
                          type="hidden"
                          name="id"
                          value={selected.manualOperatorId}
                        />
                        <label>
                          Sent time
                          <input type="datetime-local" name="sentAt" required />
                        </label>
                        <button name="confirmation" value="confirmed">
                          Record manual send
                        </button>
                      </form>
                    </details>
                  ) : null}
                </aside>
                <footer className={styles.dock} data-state={selected.state}>
                  <div className={styles.secondaryActions}>
                    {selected.state !== "needs-send-verification" ? (
                      <>
                        <form ref={skipRef} action={skipDraft}>
                          <input
                            type="hidden"
                            name="candidateId"
                            value={selected.candidateId}
                          />
                          <input
                            type="hidden"
                            name="nextCandidateId"
                            value={nextCandidateId}
                          />
                          <button>
                            Skip <kbd>X</kbd>
                          </button>
                        </form>
                        <form ref={replaceRef} action={replaceDraft}>
                          <input
                            type="hidden"
                            name="candidateId"
                            value={selected.candidateId}
                          />
                          <input
                            type="hidden"
                            name="nextCandidateId"
                            value={nextCandidateId}
                          />
                          {bucketNavigation && scopeBucket ? (
                            <input
                              type="hidden"
                              name="bucket"
                              value={scopeBucket}
                            />
                          ) : null}
                          {scopeEarlyCareer ? (
                            <input
                              type="hidden"
                              name="earlyCareerOnly"
                              value="true"
                            />
                          ) : null}
                          <button disabled={replacementBlocked}>
                            Replace{" "}
                            {scopeBucket
                              ? `from ${({ recruiters: "recruiters", peers: "peers", managers: "managers", executives: "executives", ceos: "CEOs / presidents" } as const)[scopeBucket]}`
                              : chooseBucketFirst
                                ? " after choosing a bucket"
                                : ""}{" "}
                            <kbd>R</kbd>
                          </button>
                        </form>
                        <details>
                          <summary>More</summary>
                          <form action={permanentlyExcludeDraft}>
                            <input
                              type="hidden"
                              name="candidateId"
                              value={selected.candidateId}
                            />
                            <input
                              type="hidden"
                              name="nextCandidateId"
                              value={nextCandidateId}
                            />
                            <p>Remove this person from all future outreach?</p>
                            <button
                              name="confirmation"
                              value="do-not-show-again"
                            >
                              Don&apos;t show this person again
                            </button>
                          </form>
                        </details>
                      </>
                    ) : null}
                  </div>
                  <span className={styles.progress}>
                    <i>{stateGlyph[selected.state]}</i>
                    <b>
                      {selected.bucketReviewState === "review-required"
                        ? "Review needed"
                        : stateLabels[selected.state]}
                    </b>
                    <small>
                      {selectedIndex + 1} of {viewDrafts.length}
                    </small>
                  </span>
                  <div className={styles.primaryArea}>
                    {selected.state === "approved" ? (
                      <form ref={createRef} action={createGmailDraft}>
                        <input
                          type="hidden"
                          name="snapshotId"
                          value={selected.snapshotId}
                        />
                      </form>
                    ) : null}
                    {selected.state === "approved" && !gmailAvailable ? (
                      <small role="status">{gmailReason}</small>
                    ) : selected.state === "gmail-draft-created" &&
                      selected.sendBlockedMessage ? (
                      <small role="status">{selected.sendBlockedMessage}</small>
                    ) : null}
                    <button
                      ref={primaryRef}
                      type="button"
                      className={styles.primary}
                      onClick={runPrimary}
                      disabled={primaryBlocked}
                    >
                      {selected.bucketReviewState === "review-required"
                        ? "Review bucket evidence"
                        : actionLabels[selected.state]}{" "}
                      <kbd>
                        {selected.state === "ready"
                          ? "A"
                          : selected.state === "approved"
                            ? "G"
                            : selected.state === "gmail-draft-created"
                              ? "S"
                              : "U"}
                      </kbd>
                    </button>
                  </div>
                </footer>
              </>
            ) : null}
          </>
        )}
      </section>
      <nav className={styles.mobileNav} aria-label="Mobile navigation">
        <Link href="/today">Today</Link>
        <Link href="/drafts" aria-current="page">
          Drafts
        </Link>
        <Link href="/sent">Sent</Link>
        <Link href="/candidates">Candidates</Link>
      </nav>
      <SafeDialog
        open={sendOpen}
        onClose={closeSend}
        label="Confirm real email send"
        className={styles.sendDialog}
        returnFocus={primaryRef}
      >
        <small>Final review · external consequence</small>
        <h2>Send email</h2>
        <div className={styles.sendRecipient}>
          <small>To</small>
          <span>{selected?.recipient}</span>
          <em>{selected?.title}</em>
          <strong>{selected?.company}</strong>
        </div>
        <div className={styles.sendSubject}>
          <small>Subject</small>
          <p>{selected?.subject}</p>
        </div>
        <p>
          This sends the immutable approved Gmail draft now. The message will
          leave NetworkPilot and cannot be recalled here.
        </p>
        <dl>
          <div>
            <dt>Attachment</dt>
            <dd>{selected?.attachment?.label ?? "None"}</dd>
          </div>
          <div>
            <dt>Approved snapshot</dt>
            <dd>{selected?.catalogVersion}</dd>
          </div>
        </dl>
        <form action={sendGmailDraft}>
          <input
            type="hidden"
            name="snapshotId"
            value={selected?.snapshotId ?? ""}
          />
          <input type="hidden" name="nextCandidateId" value={nextCandidateId} />
          <button autoFocus type="button" onClick={closeSend}>
            Cancel
          </button>
          <button name="confirmation" value="send-approved-draft-now">
            Send email
          </button>
        </form>
      </SafeDialog>
      <SafeDialog
        open={reconcileOpen}
        onClose={closeReconcile}
        label="Resolve uncertain send status"
        className={styles.reconcileDialog}
        returnFocus={primaryRef}
      >
        <small>Operator verification required</small>
        <h2>Resolve send status</h2>
        <p>
          NetworkPilot could not confirm whether Gmail sent this message. Check
          Gmail before recording an outcome.
        </p>
        <form action={reconcileGmailSendStatus}>
          <input
            type="hidden"
            name="snapshotId"
            value={selected?.snapshotId ?? ""}
          />
          <input
            type="hidden"
            name="candidateId"
            value={selected?.candidateId ?? ""}
          />
          <input type="hidden" name="nextCandidateId" value={nextCandidateId} />
          <label>
            What happened?
            <select
              autoFocus
              name="outcome"
              required
              defaultValue="still-uncertain"
            >
              <option value="still-uncertain">I still cannot tell</option>
              <option value="sent">It was sent</option>
              <option value="not-sent">It was not sent</option>
            </select>
          </label>
          <label>
            Actual sent time
            <input name="sentAt" type="datetime-local" />
          </label>
          <label className={styles.confirmCheck}>
            <input
              name="confirmation"
              type="checkbox"
              value="confirmed"
              required
            />
            I checked Gmail and confirm this outcome.
          </label>
          <div>
            <button type="button" onClick={closeReconcile}>
              Cancel
            </button>
            <button>Save status</button>
          </div>
        </form>
      </SafeDialog>
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        returnFocus={commandTriggerRef}
        selected={selected}
        primaryBlocked={primaryBlocked}
        primaryReason={primaryReason}
        replacementBlocked={replacementBlocked}
        chooseBucketFirst={chooseBucketFirst}
        runPrimary={runPrimary}
        onSkip={() => skipRef.current?.requestSubmit()}
        onReplace={() => replaceRef.current?.requestSubmit()}
        onAdd={() => {
          if (addRef.current) addRef.current.open = true;
          closePalette();
        }}
      />
    </main>
  );
}

function Inspector({
  draft,
  showBucketDetails = false,
}: {
  draft: WorkspaceDraft;
  showBucketDetails?: boolean;
}) {
  return (
    <div className={styles.inspectorContent}>
      {showBucketDetails ? (
        <section
          className={
            draft.bucketReviewState === "review-required"
              ? styles.caution
              : styles.safe
          }
        >
          <h3>Recipient bucket</h3>
          <strong>{draft.bucketLabel}</strong>
          <p>
            {draft.bucketReviewState === "review-required"
              ? (draft.bucketReviewReason ??
                "Classification needs review before action.")
              : draft.bucketReviewState === "legacy-unclassified"
                ? "This historical record has no stored bucket. It has not been inferred or relabeled."
                : "Stored classification evidence is available."}
          </p>
          {draft.bucketEvidenceReferences.length ? (
            <small>Evidence: {draft.bucketEvidenceReferences.join(", ")}</small>
          ) : null}
        </section>
      ) : null}
      <section>
        <h3>Outreach intent</h3>
        <p>{draft.intent}</p>
      </section>
      <section>
        <h3>Why this person</h3>
        <p>{draft.selectionReason}</p>
      </section>
      <section>
        <h3>Role relevance</h3>
        <p>
          {draft.roleRelevance} · {draft.lane}
        </p>
      </section>
      <section>
        <h3>Company evidence</h3>
        <p>{draft.companyEvidence}</p>
      </section>
      <section>
        <h3>Context</h3>
        <dl>
          <div>
            <dt>Track</dt>
            <dd>{draft.track}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{draft.location}</dd>
          </div>
          <div>
            <dt>Industry</dt>
            <dd>{draft.industry}</dd>
          </div>
        </dl>
      </section>
      <section
        className={
          draft.blockedReason || draft.bucketReviewState === "review-required"
            ? styles.caution
            : styles.safe
        }
      >
        <h3>Safety state</h3>
        <strong>
          {draft.blockedReason || draft.bucketReviewState === "review-required"
            ? "Action blocked"
            : "Eligible at last check"}
        </strong>
        <p>
          {draft.blockedMessage ??
            (draft.bucketReviewState === "review-required"
              ? "Bucket evidence must be reviewed before approval or externalization."
              : "Mutable gates are rechecked by the server before externalization.")}
        </p>
      </section>
      <section className={styles.version}>
        <span>Methodology</span>
        <b>{draft.catalogVersion}</b>
        <small>{draft.factCount} approved evidence references</small>
      </section>
    </div>
  );
}

function CommandPalette({
  open,
  onClose,
  returnFocus,
  selected,
  primaryBlocked,
  primaryReason,
  replacementBlocked,
  chooseBucketFirst,
  runPrimary,
  onSkip,
  onReplace,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
  selected: WorkspaceDraft | null;
  primaryBlocked: boolean;
  primaryReason: string | null | undefined;
  replacementBlocked: boolean;
  chooseBucketFirst: boolean;
  runPrimary: () => void;
  onSkip: () => void;
  onReplace: () => void;
  onAdd: () => void;
}) {
  const ref = useDialogFocus(open, onClose, returnFocus);
  if (!open) return null;
  const commands = [
    ["Today", "Open today’s command center", "G T", "/today"],
    ["Drafts", "Current workspace", "G D", "/drafts"],
    ["Sent", "Open sent outreach", "G S", "/sent"],
    ["Candidates", "Open candidate supply", "G C", "/candidates"],
  ] as const;
  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={ref}
        className={styles.palette}
        role="dialog"
        aria-modal="true"
        aria-label="Network command palette"
      >
        <header>
          <strong>Network command</strong>
          <span>Drafts / {selected?.recipient ?? "No selection"}</span>
        </header>
        <label>
          <span className={styles.srOnly}>Search commands</span>
          <input autoFocus placeholder="Where do you want to work?" />
          <kbd>Esc</kbd>
        </label>
        <div>
          <section>
            <h2>Navigation</h2>
            {commands.map(([name, description, key, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={href === "/drafts" ? "page" : undefined}
              >
                <span>
                  <strong>{name}</strong>
                  <small>{description}</small>
                </span>
                <kbd>{key}</kbd>
              </Link>
            ))}
          </section>
          <section>
            <h2>Selected work</h2>
            <button
              onClick={() => {
                runPrimary();
                onClose();
              }}
              disabled={!selected || primaryBlocked}
            >
              <span>
                <strong>
                  {selected
                    ? actionLabels[selected.state]
                    : "No draft selected"}
                </strong>
                <small>
                  {primaryBlocked
                    ? primaryReason
                    : selected
                      ? stateLabels[selected.state]
                      : "Select a draft first"}
                </small>
              </span>
            </button>
            <button
              onClick={() => {
                onSkip();
                onClose();
              }}
              disabled={
                !selected || selected.state === "needs-send-verification"
              }
            >
              <span>
                <strong>Skip selected draft</strong>
                <small>
                  {selected?.state === "needs-send-verification"
                    ? "Resolve the uncertain send first"
                    : "Remove without contact or cooldown"}
                </small>
              </span>
              <kbd>X</kbd>
            </button>
            <button
              onClick={() => {
                onReplace();
                onClose();
              }}
              disabled={
                !selected ||
                selected.state === "needs-send-verification" ||
                replacementBlocked
              }
            >
              <span>
                <strong>Replace selected person</strong>
                <small>
                  {chooseBucketFirst
                    ? "Choose a recipient bucket to replace within its reserve"
                    : "Use the qualified reserve without a provider call"}
                </small>
              </span>
              <kbd>R</kbd>
            </button>
            <button onClick={onAdd}>
              <span>
                <strong>Add drafts from reserve</strong>
                <small>Choose 5, 10, or a custom bounded count</small>
              </span>
              <kbd>N</kbd>
            </button>
          </section>
        </div>
        <footer>↑↓ choose · Enter run · Esc close</footer>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useFormStatus } from "react-dom";
import {
  confirmAlreadySent,
  generateMoreDraftsInline,
  permanentlyExcludeDraft,
  reconcileGmailSendStatus,
  replaceDraft,
  resolveBucketCorrection,
  sendDraft,
  skipDraft,
} from "@/app/today/actions";
import {
  initialDraftAdditionActionState,
  type DraftAdditionActionState,
} from "./draft-addition-state";
import {
  workspacePrimaryBlockReason,
  type WorkspaceDraft,
  type WorkspaceDraftState,
  type WorkspaceResume,
} from "./workspace-data";
import {
  RecipientBucketNavigation,
  type BucketNavigationData,
  type BucketSelection,
} from "@/app/recipient-bucket-navigation";
import { hasResumeAttachmentClaim } from "@/application/resumes/attachment-claims";
import { NetworkNavigation } from "@/app/network-command-shell";
import styles from "./drafts-workspace.module.css";

const stateOrder: WorkspaceDraftState[] = [
  "ready",
  "approved",
  "gmail-draft-created",
  "needs-send-verification",
];
const stateLabels: Record<WorkspaceDraftState, string> = {
  ready: "Drafts",
  approved: "Ready to send",
  "gmail-draft-created": "Ready to send",
  "needs-send-verification": "Needs verification",
};
const actionLabels: Record<WorkspaceDraftState, string> = {
  ready: "Send",
  approved: "Send",
  "gmail-draft-created": "Send",
  "needs-send-verification": "Resolve send status",
};
const queueGroups: {
  key: string;
  label: string;
  states: WorkspaceDraftState[];
}[] = [
  { key: "drafts", label: "Drafts", states: ["ready"] },
  {
    key: "ready-to-send",
    label: "Ready to send",
    states: ["approved", "gmail-draft-created"],
  },
  {
    key: "needs-verification",
    label: "Needs verification",
    states: ["needs-send-verification"],
  },
];

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
type DraftCreationBucket = keyof typeof recipientBucketLabels;
const draftCreationBuckets = Object.entries(recipientBucketLabels) as Array<
  [DraftCreationBucket, string]
>;
const bucketLabel = (bucket: string | null | undefined) =>
  bucket
    ? ((recipientBucketLabels as Record<string, string>)[bucket] ?? bucket)
    : "Legacy / unclassified";

export function draftsForBucket(drafts: WorkspaceDraft[], selection: BucketSelection, earlyCareerOnly = false) {
  if (selection === "all") return drafts.filter((draft) => Boolean(draft.recipientBucket?.bucket));
  if (selection === "legacy") return drafts.filter((draft) => !draft.recipientBucket?.bucket);
  return drafts.filter((draft) => draft.recipientBucket?.bucket === selection && (!earlyCareerOnly || draft.recipientBucket.earlyCareer));
}

export function normalizedDraftAdditionState(
  state: DraftAdditionActionState | null | undefined,
): DraftAdditionActionState {
  return state && Array.isArray(state.reasons)
    ? state
    : initialDraftAdditionActionState;
}

function creationLanguage(value: string) {
  return value
    .replace(/No drafts could be added/g, "No drafts could be created")
    .replace(/drafts added/g, "drafts created")
    .replace(/draft added/g, "draft created")
    .replace(/actionable reserve/gi, "ready candidate pool")
    .replace(/qualified reserve/gi, "ready candidate pool")
    .replace(/\breserve\b/gi, "candidate pool");
}

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

function SendSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button name="confirmation" value="send-draft-now" disabled={pending}>
      {pending ? "Sending…" : "Send"}
    </button>
  );
}

export function DraftCreationForm({
  action,
  requestId,
  bucketEnabled,
  bucket,
  bucketLocked,
  earlyCareerOnly,
  capacity,
  countMode,
  customCount,
  pending,
  submitRef,
  onBucketChange,
  onCountModeChange,
  onCustomCountChange,
}: {
  action: (payload: FormData) => void;
  requestId: string;
  bucketEnabled: boolean;
  bucket: DraftCreationBucket;
  bucketLocked: boolean;
  earlyCareerOnly: boolean;
  capacity: number;
  countMode: "5" | "10" | "custom";
  customCount: number;
  pending: boolean;
  submitRef?: RefObject<HTMLButtonElement | null>;
  onBucketChange: (bucket: DraftCreationBucket) => void;
  onCountModeChange: (mode: "5" | "10" | "custom") => void;
  onCustomCountChange: (count: number) => void;
}) {
  const requested = countMode === "custom" ? customCount : Number(countMode);
  return (
    <form
      className={styles.createDrafts}
      action={action}
      aria-busy={pending}
    >
      <input type="hidden" name="requestId" value={requestId} />
      {bucketEnabled ? (
        <input type="hidden" name="bucket" value={bucket} />
      ) : null}
      <input type="hidden" name="additionalDraftCount" value={requested} />
      {earlyCareerOnly ? (
        <input type="hidden" name="earlyCareerOnly" value="true" />
      ) : null}
      <div className={styles.creationIntro}>
        <strong>Create drafts</strong>
        <span>
          Uses ready candidates already in NetworkPilot. No Apollo or Gmail call.
        </span>
      </div>
      {bucketEnabled ? (
        <label className={styles.creationBucket}>
          <span>Recipient group</span>
          <select
            value={bucket}
            disabled={bucketLocked || pending}
            onChange={(event) =>
              onBucketChange(event.currentTarget.value as DraftCreationBucket)
            }
          >
            {draftCreationBuckets.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className={styles.creationBucket}>
          <span>Recipient group</span>
          <strong>All ready candidates</strong>
        </div>
      )}
      <fieldset className={styles.creationQuantity} disabled={pending}>
        <legend>Quantity</legend>
        {(["5", "10", "custom"] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="draftQuantity"
              value={value}
              checked={countMode === value}
              onChange={() => onCountModeChange(value)}
            />
            <span>{value === "custom" ? "Custom" : value}</span>
          </label>
        ))}
      </fieldset>
      {countMode === "custom" ? (
        <label className={styles.customQuantity}>
          <span>Custom, 1–20</span>
          <input
            type="number"
            min="1"
            max="20"
            value={customCount}
            required
            disabled={pending}
            onChange={(event) =>
              onCustomCountChange(Number(event.currentTarget.value))
            }
          />
        </label>
      ) : null}
      <div className={styles.creationSubmit}>
        <small>
          {capacity > 0
            ? `${capacity} ${capacity === 1 ? "candidate is" : "candidates are"} ready in this group.`
            : "No candidates are currently ready in this group."}
        </small>
        <button ref={submitRef} disabled={pending}>
          {pending ? "Creating drafts…" : "Create drafts"}
        </button>
      </div>
    </form>
  );
}

export function DraftsWorkspace({
  drafts,
  resumes,
  gmailAvailable,
  gmailReason,
  hasReserve,
  reserveCapacity,
  earlyCareerPeerCapacity,
  initialCandidateId,
  initialMobileReview = true,
  feedback,
  bucketNavigation,
  addRequestId,
  initialAddOpen = false,
}: {
  drafts: WorkspaceDraft[];
  resumes: WorkspaceResume[];
  gmailAvailable: boolean;
  gmailReason: string | null;
  hasReserve: boolean;
  reserveCapacity?: Partial<Record<Exclude<BucketSelection, "all" | "legacy">, number>>;
  earlyCareerPeerCapacity?: number;
  initialCandidateId?: string;
  initialMobileReview?: boolean;
  feedback: Feedback;
  bucketNavigation?: BucketNavigationData;
  addRequestId: string;
  initialAddOpen?: boolean;
}) {
  const [bucketSelection, setBucketSelection] = useState<BucketSelection>(bucketNavigation?.selected ?? "all");
  const [earlyCareerOnly, setEarlyCareerOnly] = useState(Boolean(bucketNavigation?.earlyCareerOnly));
  const viewDrafts = useMemo(() => {
    if (!bucketNavigation) return drafts;
    return draftsForBucket(drafts, bucketSelection, earlyCareerOnly);
  }, [bucketNavigation, bucketSelection, drafts, earlyCareerOnly]);
  const initial =
    viewDrafts.find((draft) => draft.candidateId === initialCandidateId) ??
    viewDrafts[0] ??
    null;
  const [selectedId, setSelectedId] = useState(initial?.candidateId ?? "");
  const [mobileReview, setMobileReview] = useState(initialMobileReview);
  const [sendOpen, setSendOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftEdit>>({});
  const [editsLoaded, setEditsLoaded] = useState(false);
  const [resumePrompt, setResumePrompt] = useState<string | null>(null);
  const [additionState, additionAction, additionPending] = useActionState(generateMoreDraftsInline, initialDraftAdditionActionState);
  const initialCreationBucket =
    bucketSelection !== "all" && bucketSelection !== "legacy"
      ? bucketSelection
      : initial?.recipientBucket?.bucket ??
        draftCreationBuckets.find(
          ([bucket]) => (reserveCapacity?.[bucket] ?? 0) > 0,
        )?.[0] ??
        "recruiters";
  const [creationBucket, setCreationBucket] =
    useState<DraftCreationBucket>(initialCreationBucket);
  const [creationCountMode, setCreationCountMode] = useState<
    "5" | "10" | "custom"
  >("5");
  const [customCreationCount, setCustomCreationCount] = useState(5);
  const visibleAdditionState = normalizedDraftAdditionState(additionState);
  const queueRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const skipRef = useRef<HTMLFormElement>(null);
  const replaceRef = useRef<HTMLFormElement>(null);
  const createDraftsRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (initialAddOpen) createDraftsRef.current?.focus();
  }, [initialAddOpen]);
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
  const closeMobileReview = useCallback(() => {
    const candidateId = selected?.candidateId;
    setMobileReview(false);
    requestAnimationFrame(() => {
      if (candidateId)
        document.getElementById(`queue-${candidateId}`)?.focus();
    });
  }, [selected?.candidateId]);
  const selectedEdit =
    selected?.state === "ready" ? draftEdits[selected.snapshotId] : undefined;
  const editedSubject = selectedEdit?.subject ?? selected?.subject ?? "";
  const editedBody = selectedEdit?.body ?? selected?.body ?? "";
  const requestedResumeId =
    selected?.state !== "ready"
      ? (selected?.attachment?.resumeId ?? "")
      : (selectedEdit?.resumeId ?? selected?.resumeSelection?.resumeId ?? "");
  const selectedResumeId =
    selected?.state !== "ready"
      ? requestedResumeId
      : resumes.some((resume) => resume.id === requestedResumeId)
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
  const selectBucket = useCallback((next: BucketSelection, nextEarlyCareer: boolean) => {
    setBucketSelection(next);
    setEarlyCareerOnly(nextEarlyCareer);
    if (next !== "all" && next !== "legacy") setCreationBucket(next);
    const nextDrafts = draftsForBucket(drafts, next, nextEarlyCareer);
    const nextSelected = nextDrafts.some((draft) => draft.candidateId === selectedId) ? selectedId : (nextDrafts[0]?.candidateId ?? "");
    setSelectedId(nextSelected);
    setMobileReview(false);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("bucket"); else url.searchParams.set("bucket", next);
    if (next === "peers" && nextEarlyCareer) url.searchParams.set("earlyCareerOnly", "true"); else url.searchParams.delete("earlyCareerOnly");
    if (nextSelected) url.searchParams.set("candidate", nextSelected); else url.searchParams.delete("candidate");
    window.history.replaceState(null, "", url);
  }, [drafts, selectedId]);
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
        else if (mobileReview) closeMobileReview();
        return;
      }
      if (sendOpen || reconcileOpen) return;
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
      } else if (key === "s" && selected && !primaryBlocked) {
        event.preventDefault();
        if (selected.state === "needs-send-verification") setReconcileOpen(true);
        else setSendOpen(true);
      } else if (
        key === "r" &&
        selected?.state !== "needs-send-verification" &&
        (!bucketNavigation ||
          (bucketSelection !== "all" && bucketSelection !== "legacy"))
      ) {
        event.preventDefault();
        replaceRef.current?.requestSubmit();
      } else if (key === "x" && selected?.state !== "needs-send-verification") {
        event.preventDefault();
        skipRef.current?.requestSubmit();
      } else if (key === "n") {
        event.preventDefault();
        createDraftsRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    bucketNavigation,
    bucketSelection,
    closeReconcile,
    closeSend,
    closeMobileReview,
    mobileReview,
    move,
    primaryBlocked,
    reconcileOpen,
    selected,
    sendOpen,
  ]);

  const runPrimary = () => {
    if (!selected || primaryBlocked) return;
    if (selected.state === "needs-send-verification") {
      setReconcileOpen(true);
    } else {
      setSendOpen(true);
    }
  };

  const scopeBucket =
    bucketNavigation &&
    bucketSelection !== "all" &&
    bucketSelection !== "legacy"
      ? bucketSelection
      : "";
  const scopedLegacy = bucketSelection === "legacy";
  const chooseBucketFirst = Boolean(bucketNavigation && bucketSelection === "all");
  const replacementBlocked = scopedLegacy || chooseBucketFirst;
  const scopeEarlyCareer = Boolean(
    bucketSelection === "peers" && earlyCareerOnly,
  );
  const activeHasReserve = scopeBucket ? Boolean(scopeBucket === "peers" && scopeEarlyCareer ? earlyCareerPeerCapacity : reserveCapacity?.[scopeBucket]) : hasReserve;
  const creationEarlyCareer = Boolean(
    bucketSelection === "peers" && earlyCareerOnly && creationBucket === "peers",
  );
  const creationCapacity =
    creationBucket === "peers" && creationEarlyCareer
      ? (earlyCareerPeerCapacity ?? 0)
      : (reserveCapacity?.[creationBucket] ?? (hasReserve ? 1 : 0));
  const resumeOptions = resumes;
  const confirmationAttachment =
    selected?.state === "ready"
      ? (resumeOptions.find((resume) => resume.id === selectedResumeId)?.label ??
        "None")
      : (selected?.attachment?.label ?? "None");
  const confirmationResumeDecision =
    resumeDecisionRequired && !selectedResumeId && continueWithoutAttachment
      ? "continue-without-attachment"
      : "";
  return (
    <main
      className={styles.shell}
      data-mobile-review={mobileReview ? "true" : undefined}
      data-five-bucket={bucketNavigation ? "true" : undefined}
    >
      <a className={styles.skipLink} href="#draft-message">
        Skip to selected message
      </a>
      <NetworkNavigation current="drafts" status={gmailAvailable ? `${drafts.length} active drafts · Gmail ready` : `${drafts.length} active drafts · Gmail unavailable`} />
      <section id="workspace-content" className={styles.workspace}>
        {bucketNavigation ? (
          <div className={styles.bucketNavigation}>
            <RecipientBucketNavigation data={bucketNavigation} selected={bucketSelection} earlyCareerOnly={earlyCareerOnly} onSelect={selectBucket} />
          </div>
        ) : null}
        <header className={styles.contextBar}>
          <div>
            <h1>Drafts</h1>
            <span>
              {viewDrafts.length} active · {counts.ready} need review
              {bucketNavigation && bucketSelection !== "all"
                ? ` · ${bucketSelection === "legacy" ? "Legacy / unclassified" : bucketSelection}`
                : ""}
            </span>
          </div>
          <div className={styles.counts} aria-label="Draft state counts">
            {queueGroups.map((group) => (
              <span key={group.key}>
                {group.label}{" "}
                <b>
                  {group.states.reduce((sum, state) => sum + counts[state], 0)}
                </b>
              </span>
            ))}
          </div>
        </header>
        <section className={styles.creationRegion} aria-label="Create drafts">
          <DraftCreationForm
            action={additionAction}
            requestId={addRequestId}
            bucketEnabled={Boolean(bucketNavigation)}
            bucket={creationBucket}
            bucketLocked={Boolean(
              bucketNavigation &&
                bucketSelection !== "all" &&
                bucketSelection !== "legacy",
            )}
            earlyCareerOnly={creationEarlyCareer}
            capacity={creationCapacity}
            countMode={creationCountMode}
            customCount={customCreationCount}
            pending={additionPending}
            submitRef={createDraftsRef}
            onBucketChange={setCreationBucket}
            onCountModeChange={setCreationCountMode}
            onCustomCountChange={setCustomCreationCount}
          />
          {visibleAdditionState.status !== "idle" ? (
            <div
              className={styles.additionResult}
              data-status={visibleAdditionState.status}
              role={visibleAdditionState.status === "error" ? "alert" : "status"}
            >
              <strong>{creationLanguage(visibleAdditionState.message)}</strong>
              {visibleAdditionState.reasons.length ? (
                <ul>
                  {visibleAdditionState.reasons.map((reason) => (
                    <li key={reason}>{creationLanguage(reason)}</li>
                  ))}
                </ul>
              ) : null}
              {visibleAdditionState.recovery ? (
                <Link href={visibleAdditionState.recovery.href}>
                  {visibleAdditionState.recovery.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </section>
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
              {bucketSelection === "legacy"
                ? "No legacy drafts in this view"
                : activeHasReserve
                  ? "No drafts yet"
                  : "No candidates yet. Find people first."}
            </h2>
            <p>
              {bucketSelection === "legacy"
                ? "Legacy / unclassified records remain visible in their historical workspace and are not relabeled."
                : activeHasReserve
                  ? "Candidates are ready. Create drafts to start reviewing messages."
                  : "Find people in Candidates, then return here to review and send their messages."}
            </p>
            {bucketSelection !== "legacy" && !activeHasReserve ? (
              <Link href="/candidates">Go to Candidates</Link>
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
              {queueGroups.map((queueGroup) => {
                const group = viewDrafts.filter(
                  (draft) => queueGroup.states.includes(draft.state),
                );
                return group.length ? (
                  <section key={queueGroup.key}>
                    <h2>
                      <span>{queueGroup.label}</span>
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
                            : stateLabels[draft.state]}
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
                    onClick={closeMobileReview}
                  >
                    ← Queue{" "}
                    <span>
                      {selectedIndex + 1} of {viewDrafts.length}
                    </span>
                  </button>
                  <div className={styles.planeLabel}>
                    <span>Message</span>
                    <em>{stateLabels[selected.state]}</em>
                  </div>
                  <form
                    id={`approve-${selected.candidateId}`}
                    onSubmit={(event) => event.preventDefault()}
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
                              title={
                                resumeOptions.find(
                                  (resume) => resume.id === selectedResumeId,
                                )?.label ?? "No attachment"
                              }
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
                            <strong title={selected.attachment?.label ?? "No attachment"}>
                              {selected.attachment?.label ?? "None"}
                            </strong>
                            <small>
                              {selected.attachment?.filename ?? "No attachment"}
                            </small>
                          </>
                        )}
                        <small className={styles.attachmentFullText}>
                          {selected.state === "ready"
                            ? (resumeOptions.find(
                                (resume) => resume.id === selectedResumeId,
                              )?.label ?? "No attachment")
                            : (selected.attachment?.label ?? "No attachment")}
                        </small>
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
                        <span>Saved message</span>
                        <small>
                          {selected.approvedAt
                            ? `Saved ${new Date(selected.approvedAt).toLocaleDateString()}`
                            : "Message content is preserved"}
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
                        title={editedSubject}
                        aria-describedby="draft-subject-full-text"
                        onChange={(event) =>
                          updateSelectedEdit({
                            subject: event.currentTarget.value,
                          })
                        }
                        readOnly={selected.state !== "ready" || !editsLoaded}
                        required
                        maxLength={64}
                      />
                      <small
                        id="draft-subject-full-text"
                        className={styles.subjectFullText}
                      >
                        {editedSubject}
                      </small>
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
                              <input
                                type="datetime-local"
                                name="sentAt"
                                required
                              />
                            </label>
                            <button name="confirmation" value="confirmed">
                              Record manual send
                            </button>
                          </form>
                        </details>
                      ) : null}
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
                    {primaryReason ? <small role="status">{primaryReason}</small> : null}
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
                      <kbd>{selected.state === "needs-send-verification" ? "U" : "S"}</kbd>
                    </button>
                  </div>
                </footer>
              </>
            ) : null}
          </>
        )}
      </section>
      <SafeDialog
        open={sendOpen}
        onClose={closeSend}
        label="Confirm real email send"
        className={styles.sendDialog}
        returnFocus={primaryRef}
      >
        <small>Final review · external consequence</small>
        <h2>Send this message?</h2>
        <div className={styles.sendRecipient}>
          <small>To</small>
          <span>{selected?.recipient}</span>
          <span>{selected?.recipientEmail}</span>
          <em>{selected?.title}</em>
          <strong>{selected?.company}</strong>
        </div>
        <div className={styles.sendSubject}>
          <small>Subject</small>
          <p>{editedSubject}</p>
        </div>
        <div className={styles.sendBody}>
          <small>Message</small>
          <p>{editedBody}</p>
        </div>
        <dl>
          <div>
            <dt>Attachment</dt>
            <dd>{confirmationAttachment}</dd>
          </div>
          <div>
            <dt>Email address</dt>
            <dd>{selected?.recipientEmail}</dd>
          </div>
        </dl>
        <p>
          Send is the only external action in this flow. NetworkPilot will
          preserve this exact message and attachment, create the Gmail draft
          if needed, and send it after this confirmation.
        </p>
        <form action={sendDraft}>
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
          <input type="hidden" name="subject" value={editedSubject} />
          <input type="hidden" name="body" value={editedBody} />
          <input type="hidden" name="resumeId" value={selectedResumeId} />
          <input
            type="hidden"
            name="resumeDecision"
            value={confirmationResumeDecision}
          />
          <button autoFocus type="button" onClick={closeSend}>
            Cancel
          </button>
          <SendSubmitButton />
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

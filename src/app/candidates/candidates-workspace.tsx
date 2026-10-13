"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import type {
  ReserveCandidate,
  ReserveStage,
} from "@/application/daily-command-center";
import type { DraftAdditionBlockCounts } from "@/application/daily-refresh";
import styles from "./candidates-command.module.css";
import { RecipientBucketNavigation, type BucketNavigationData, type BucketSelection, type RecipientBucket } from "@/app/recipient-bucket-navigation";
import {
  createCandidateDraft,
  permanentlyExcludeCandidate,
  skipCandidate,
} from "./actions";
import { candidateSourcingStatus } from "./sourcing-status";

export type CandidateWorkspaceRow = ReserveCandidate & {
  companyTrustReview?: { commandId: string; reviewedAt: string };
  draftRequestId?: string;
};

type Density = "comfortable" | "compact";
type Filters = {
  track: string;
  role: string;
  industry: string;
  geography: string;
  status: string;
};
const stageLabel: Record<ReserveStage, string> = {
  "in-draft-queue": "In Drafts",
  "qualified-available": "Available",
  cooldown: "Available later",
  suppressed: "Do not contact",
  "already-contacted": "Contacted",
  "enriched-unqualified": "Not eligible",
  "search-only": "Needs more evidence",
};
const roleLabel = (value: string) =>
  value === "product-management" || value === "product"
    ? "Product"
    : value
        .replaceAll("-", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
const initialFilters: Filters = {
  track: "all",
  role: "all",
  industry: "all",
  geography: "all",
  status: "all",
};

function relevance(candidate: ReserveCandidate) {
  if (candidate.whySelected) return candidate.whySelected;
  if (
    candidate.functionName === "product-management" ||
    candidate.functionName === "product"
  )
    return "Technical experience aligned with Dylan’s Product target lane.";
  return `${roleLabel(candidate.functionName)} experience in ${candidate.industry}.`;
}
function companyEvidence(candidate: ReserveCandidate) {
  if (candidate.employerTrust?.state === "unverified")
    return "Provider-backed employer identity is stored, but operating-employer trust has not been reviewed.";
  if (candidate.companyKind === "preferred")
    return "Reviewed preferred employer identity is present in the candidate record.";
  if (candidate.companyKind === "discovered")
    return "Provider-backed discovered employer identity passed company qualification.";
  return candidate.companyId
    ? "A stable employer identity is present in the reviewed candidate record."
    : "Employer evidence is limited; eligibility remains fail-closed where required.";
}
function employerReviewRequired(candidate: ReserveCandidate) {
  return (
    candidate.bucketReviewState === "review-required" &&
    candidate.recipientBucket?.bucket === "recruiters" &&
    candidate.employerTrust?.state === "unverified" &&
    Boolean(candidate.employerTrust.identityVerified) &&
    Boolean(candidate.companyId)
  );
}
function history(candidate: ReserveCandidate) {
  if (candidate.stage === "already-contacted")
    return "Previous outreach is recorded. This person cannot enter a new plan.";
  if (candidate.stage === "in-draft-queue")
    return "This person is already represented in the active draft workflow.";
  if (candidate.stage === "cooldown")
    return "A recent company contact delays this person until the cooldown clears.";
  if (candidate.stage === "suppressed")
    return "A durable suppression prevents future outreach.";
  return "No prior contact is recorded in the current planning state.";
}
function planningBlockMessage(code:string){const evidence=code.match(/^bucket-copy-evidence-required:(.+)$/)?.[1]?.replaceAll("-"," ");return evidence?`Drafting needs reviewed ${evidence} evidence before this person is actionable.`:"Draft copy could not be prepared from the reviewed evidence. Review this candidate before planning.";}
export function matchesCandidateBucket(
  row: ReserveCandidate,
  navigation: BucketNavigationData | undefined,
  selected = navigation?.selected ?? "all",
  earlyCareerOnly = Boolean(navigation?.earlyCareerOnly),
) {
  if (!navigation) return true;
  if (selected === "all") return Boolean(row.recipientBucket?.bucket);
  if (selected === "legacy") return !row.recipientBucket?.bucket;
  return (
    row.recipientBucket?.bucket === selected &&
    (!earlyCareerOnly || row.recipientBucket.earlyCareer)
  );
}

export function candidateEmptyState(input: { hasFilters: boolean; selection: BucketSelection; legacyCount: number }) {
  if (input.hasFilters)
    return { title: "No candidates match these filters", detail: "Clear the active filters to restore this recipient view.", action: "clear" as const };
  return {
    title: "No candidates yet",
    detail: "Find people to start building your networking queue.",
    showLegacy: input.selection !== "legacy" && input.legacyCount > 0,
  };
}

export interface CandidateBlockerSummary {
  employerReview: number;
  eligibilityReview: number;
  companyCooldown: number;
  alreadyContacted: number;
  alreadyInDrafts: number;
  suppressed: number;
  notEligible: number;
}

export function candidateBlockerSummary(
  candidates: CandidateWorkspaceRow[],
): CandidateBlockerSummary {
  return candidates.reduce<CandidateBlockerSummary>(
    (summary, candidate) => {
      if (employerReviewRequired(candidate)) summary.employerReview += 1;
      else if (
        candidate.bucketReviewState === "review-required" ||
        candidate.stage === "search-only" ||
        Boolean(candidate.planningBlockReason) ||
        candidate.planningReady === false
      )
        summary.eligibilityReview += 1;
      else if (candidate.stage === "cooldown") summary.companyCooldown += 1;
      else if (candidate.stage === "already-contacted")
        summary.alreadyContacted += 1;
      else if (candidate.stage === "in-draft-queue")
        summary.alreadyInDrafts += 1;
      else if (candidate.stage === "suppressed") summary.suppressed += 1;
      else if (candidate.stage === "enriched-unqualified")
        summary.notEligible += 1;
      return summary;
    },
    {
      employerReview: 0,
      eligibilityReview: 0,
      companyCooldown: 0,
      alreadyContacted: 0,
      alreadyInDrafts: 0,
      suppressed: 0,
      notEligible: 0,
    },
  );
}

export function candidateSourcingHref(
  bucket: RecipientBucket,
  earlyCareerOnly = false,
) {
  return `/candidates?bucket=${encodeURIComponent(bucket)}${bucket === "peers" && earlyCareerOnly ? "&earlyCareerOnly=true" : ""}&findMore=true`;
}

function draftBlockReason(candidate: CandidateWorkspaceRow) {
  if (candidate.bucketReviewState === "review-required")
    return "Candidate eligibility needs review before creating a draft.";
  if (!candidate.recipientBucket?.bucket)
    return "Legacy or unclassified people cannot enter the five-bucket draft queue.";
  if (candidate.planningBlockReason)
    return planningBlockMessage(candidate.planningBlockReason);
  if (!candidate.planningReady)
    return "Reviewed evidence is not sufficient to prepare truthful copy.";
  if (candidate.stage === "cooldown") return "Company cooldown is still active.";
  if (candidate.stage === "suppressed")
    return "This person is on the do-not-contact list.";
  if (candidate.stage === "already-contacted")
    return "Previous outreach is already recorded.";
  if (candidate.stage !== "qualified-available")
    return `${stageLabel[candidate.stage]} people cannot start a new draft.`;
  return null;
}

function PendingSubmit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-disabled={pending}>
      {pending ? "Creating…" : children}
    </button>
  );
}

function CandidateDispositionSubmit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Saving…" : children}</button>;
}

function CandidateDispositionActions({
  candidateId,
  nextCandidateId,
  bucket,
  earlyCareerOnly,
}: {
  candidateId: string;
  nextCandidateId: string;
  bucket: BucketSelection;
  earlyCareerOnly: boolean;
}) {
  return (
    <div className={styles.candidateDisposition}>
      <form action={skipCandidate}>
        <input type="hidden" name="candidateId" value={candidateId} />
        <input type="hidden" name="nextCandidateId" value={nextCandidateId} />
        <input type="hidden" name="bucket" value={bucket} />
        <input type="hidden" name="earlyCareerOnly" value={String(earlyCareerOnly)} />
        <CandidateDispositionSubmit>Skip</CandidateDispositionSubmit>
      </form>
      <details>
        <summary>Don&apos;t show again</summary>
        <form action={permanentlyExcludeCandidate}>
          <input type="hidden" name="candidateId" value={candidateId} />
          <input type="hidden" name="nextCandidateId" value={nextCandidateId} />
          <input type="hidden" name="bucket" value={bucket} />
          <input type="hidden" name="earlyCareerOnly" value={String(earlyCareerOnly)} />
          <p>Remove this person from all future candidate and draft queues?</p>
          <button name="confirmation" value="do-not-show-again">
            Confirm don&apos;t show again
          </button>
        </form>
      </details>
    </div>
  );
}

function CandidateDraftAction({ candidate }: { candidate: CandidateWorkspaceRow }) {
  if (candidate.stage === "in-draft-queue")
    return (
      <Link
        className={styles.primaryAction}
        href={`/drafts/review?candidate=${encodeURIComponent(candidate.id)}`}
      >
        Open draft
      </Link>
    );
  const blocked = draftBlockReason(candidate);
  if (blocked)
    return (
      <div className={styles.blockedDraftAction}>
        <button className={styles.primaryAction} disabled>
          Create draft
        </button>
        <p className={styles.blockReason}>{blocked}</p>
      </div>
    );
  return (
    <form action={createCandidateDraft} className={styles.createDraftForm}>
      <input type="hidden" name="candidateId" value={candidate.id} />
      <input
        type="hidden"
        name="requestId"
        value={candidate.draftRequestId ?? `candidate-draft-ui:${candidate.id}`}
      />
      <PendingSubmit>Create draft</PendingSubmit>
      <small>Uses this ready candidate. No Apollo call.</small>
    </form>
  );
}

export function CandidatesWorkspace({
  candidates,
  initialSelectedId,
  initialFilterOpen = false,
  refreshControl,
  refreshResult,
  bucketNavigation,
  actionableCapacity,
  actionableCapacityByBucket,
  unionActionableCapacity,
  earlyCareerPeerCapacity,
  blockCounts,
  blockCountsByBucket,
  earlyCareerPeerBlockCounts,
  refreshScope,
  refreshEarlyCareerOnly = false,
  findMoreOpen = false,
  apolloEnabled,
  apolloReady,
}: {
  candidates: CandidateWorkspaceRow[];
  initialSelectedId?: string;
  initialFilterOpen?: boolean;
  refreshControl: ReactNode;
  refreshResult: string | null;
  bucketNavigation?: BucketNavigationData;
  actionableCapacity?: number;
  actionableCapacityByBucket?: Partial<Record<RecipientBucket, number>>;
  unionActionableCapacity?: number;
  earlyCareerPeerCapacity?: number;
  blockCounts?: DraftAdditionBlockCounts;
  blockCountsByBucket?: Partial<Record<RecipientBucket, DraftAdditionBlockCounts>>;
  earlyCareerPeerBlockCounts?: DraftAdditionBlockCounts;
  refreshScope?: RecipientBucket;
  refreshEarlyCareerOnly?: boolean;
  findMoreOpen?: boolean;
  apolloEnabled: boolean;
  apolloReady: boolean;
}) {
  const [bucketSelection, setBucketSelection] = useState<BucketSelection>(bucketNavigation?.selected ?? "all"),
    [earlyCareerOnly, setEarlyCareerOnly] = useState(Boolean(bucketNavigation?.earlyCareerOnly)),
    [selectedId, setSelectedId] = useState(
      initialSelectedId ?? candidates[0]?.id ?? "",
    ),
    [mobileDetail, setMobileDetail] = useState(false),
    [density, setDensity] = useState<Density>("comfortable"),
    [filterOpen, setFilterOpen] = useState(initialFilterOpen),
    [sourcingBucket, setSourcingBucket] = useState<RecipientBucket>(
      bucketNavigation && bucketNavigation.selected !== "all" && bucketNavigation.selected !== "legacy"
        ? bucketNavigation.selected
        : "recruiters",
    ),
    [search, setSearch] = useState(""),
    [filters, setFilters] = useState<Filters>(initialFilters);
  const inspectorRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const roles = useMemo(
      () => [...new Set(candidates.map((row) => row.functionName))].sort(),
      [candidates],
    ),
    industries = useMemo(
      () => [...new Set(candidates.map((row) => row.industry))].sort(),
      [candidates],
    ),
    geographies = useMemo(
      () =>
        [
          ...new Set(
            candidates
              .map((row) => row.geography)
              .filter((value): value is string => Boolean(value)),
          ),
        ].sort(),
      [candidates],
    );
  const scopeCandidates = candidates.filter((row) =>
    matchesCandidateBucket(
      row,
      bucketNavigation,
      bucketSelection,
      earlyCareerOnly,
    ),
  );
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return candidates.filter(
      (row) =>
        matchesCandidateBucket(row, bucketNavigation, bucketSelection, earlyCareerOnly) &&
        (filters.track === "all" ||
          (row.track ?? "professional") === filters.track) &&
        (filters.role === "all" || row.functionName === filters.role) &&
        (filters.industry === "all" || row.industry === filters.industry) &&
        (filters.geography === "all" || row.geography === filters.geography) &&
        (filters.status === "all" ||
          row.stage === filters.status) &&
        (!query ||
          `${row.recipient} ${row.title} ${row.company} ${row.functionName} ${row.industry}`
            .toLowerCase()
            .includes(query)),
    );
  }, [bucketNavigation, bucketSelection, candidates, earlyCareerOnly, filters, search]);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
  const selectedIndex = selected
    ? rows.findIndex((row) => row.id === selected.id)
    : -1;
  const nextCandidateId =
    selectedIndex >= 0
      ? ((rows[selectedIndex + 1] ?? rows[selectedIndex - 1])?.id ?? "")
      : "";
  const active = [
    bucketNavigation && bucketSelection !== "all"
      ? bucketSelection === "legacy"
        ? "Legacy / unclassified"
        : roleLabel(bucketSelection)
      : null,
    earlyCareerOnly ? "Early-career only" : null,
    filters.track !== "all" ? roleLabel(filters.track) : null,
    filters.role !== "all" ? roleLabel(filters.role) : null,
    filters.industry !== "all" ? filters.industry : null,
    filters.geography !== "all" ? filters.geography : null,
    filters.status !== "all"
      ? (stageLabel[filters.status as ReserveStage] ?? filters.status)
      : null,
  ].filter(Boolean) as string[];
  const select = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 760px)").matches) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setMobileDetail(true);
    }
    const url = new URL(window.location.href);
    url.searchParams.set("selected", id);
    window.history.replaceState(null, "", url);
  };
  const selectBucket = useCallback((next: BucketSelection, nextEarlyCareer: boolean) => {
    setBucketSelection(next);
    setEarlyCareerOnly(nextEarlyCareer);
    const nextRows = candidates.filter((row) => matchesCandidateBucket(row, bucketNavigation, next, nextEarlyCareer));
    const nextSelected = nextRows.some((row) => row.id === selectedId) ? selectedId : (nextRows[0]?.id ?? "");
    setSelectedId(nextSelected);
    setMobileDetail(false);
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("bucket"); else url.searchParams.set("bucket", next);
    if (next === "peers" && nextEarlyCareer) url.searchParams.set("earlyCareerOnly", "true"); else url.searchParams.delete("earlyCareerOnly");
    if (nextSelected) url.searchParams.set("selected", nextSelected); else url.searchParams.delete("selected");
    url.searchParams.delete("findMore");
    window.history.replaceState(null, "", url);
  }, [bucketNavigation, candidates, selectedId]);
  const closeDetail = useCallback(() => {
    setMobileDetail(false);
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);
  useEffect(() => {
    if (!mobileDetail) return;
    const root = inspectorRef.current;
    const items = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],textarea:not(:disabled),select:not(:disabled),input:not([type="hidden"]):not(:disabled)',
        ) ?? [],
      );
    const frame = requestAnimationFrame(() => items()[0]?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetail();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = items();
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
    };
  }, [closeDetail, mobileDetail]);
  const clear = () => {
    setSearch("");
    setFilters(initialFilters);
  };
  const visibleActionable = !bucketNavigation
    ? (actionableCapacity ?? rows.filter((row) => row.stage === "qualified-available" && row.bucketReviewState !== "review-required").length)
    : bucketSelection === "all"
      ? (unionActionableCapacity ?? 0)
      : bucketSelection === "legacy"
        ? 0
        : (bucketSelection === "peers" && earlyCareerOnly ? earlyCareerPeerCapacity : actionableCapacityByBucket?.[bucketSelection]) ?? 0;
  const hasCandidateFilters = Boolean(search.trim() || Object.values(filters).some((value) => value !== "all"));
  const emptyState = candidateEmptyState({ hasFilters: hasCandidateFilters, selection: bucketSelection, legacyCount: bucketNavigation?.legacyCount ?? 0 });
  const selectedScope = bucketSelection !== "all" && bucketSelection !== "legacy" ? bucketSelection : null;
  const blockers = candidateBlockerSummary(scopeCandidates);
  const projectedBlockers = !bucketNavigation
    ? blockCounts
    : bucketSelection === "all"
      ? blockCounts
      : bucketSelection === "legacy"
        ? undefined
        : bucketSelection === "peers" && earlyCareerOnly
          ? earlyCareerPeerBlockCounts
          : blockCountsByBucket?.[bucketSelection];
  const reviewableCount = projectedBlockers
    ? projectedBlockers.reviewRequired + projectedBlockers.unresolvedEvidence
    : blockers.employerReview + blockers.eligibilityReview;
  const isFirstRun = scopeCandidates.length === 0 && !hasCandidateFilters;
  const isBlockedPool =
    bucketSelection !== "legacy" &&
    scopeCandidates.length > 0 &&
    visibleActionable === 0;
  const sourcingStatus = candidateSourcingStatus({
    enabled: apolloEnabled,
    ready: apolloReady,
  });
  const sourcingHref = candidateSourcingHref(
    selectedScope ?? sourcingBucket,
    Boolean(selectedScope === "peers" && earlyCareerOnly),
  );
  const showScopedConfirmation = Boolean(
    findMoreOpen &&
      selectedScope &&
      refreshScope === selectedScope &&
      refreshEarlyCareerOnly === earlyCareerOnly,
  );
  const reviewCandidates = () => {
    const candidate =
      scopeCandidates.find(
        (row) =>
          employerReviewRequired(row) ||
          row.bucketReviewState === "review-required" ||
          row.stage === "search-only" ||
          Boolean(row.planningBlockReason) ||
          row.planningReady === false,
      ) ?? scopeCandidates[0];
    if (!candidate) return;
    select(candidate.id);
    requestAnimationFrame(() =>
      document.getElementById(`candidate-${candidate.id}`)?.focus(),
    );
  };
  const sourcingAction = showScopedConfirmation ? (
    <div className={`${styles.sourcingDisclosure} ${styles.sourcingDisclosureStandalone}`}>
      {refreshControl}
    </div>
  ) : (
    <div className={styles.sourcingAction}>
      {!selectedScope ? (
        <label>
          <span>Who do you want to meet?</span>
          <select
            value={sourcingBucket}
            onChange={(event) =>
              setSourcingBucket(event.currentTarget.value as RecipientBucket)
            }
          >
            <option value="recruiters">Recruiters</option>
            <option value="peers">Peers &amp; practitioners</option>
            <option value="managers">Managers &amp; team leaders</option>
            <option value="executives">Executives</option>
            <option value="ceos">CEOs &amp; presidents</option>
          </select>
        </label>
      ) : null}
      {sourcingStatus.available ? (
        <Link className={styles.findPeopleLink} href={sourcingHref}>
          Find people
        </Link>
      ) : (
        <button className={styles.findPeopleLink} disabled>
          Find people
        </button>
      )}
      <small>
        {sourcingStatus.available
          ? "Search may use Apollo credits. You’ll review people before drafting."
          : sourcingStatus.detail}
      </small>
    </div>
  );
  const findPeopleControl = showScopedConfirmation ? (
    <div className={styles.headerSourcing}>{refreshControl}</div>
  ) : sourcingStatus.available ? (
    <Link className={styles.findPeopleHeader} href={sourcingHref}>
      <span>Find people</span>
      <small>May use Apollo credits</small>
    </Link>
  ) : (
    <button className={styles.findPeopleHeader} disabled>
      <span>Find people</span>
      <small>{sourcingStatus.detail}</small>
    </button>
  );
  return (
    <div className={styles.candidates} data-density={density}>
      {bucketNavigation ? <div className={styles.bucketNavigation}><RecipientBucketNavigation data={bucketNavigation} selected={bucketSelection} earlyCareerOnly={earlyCareerOnly} onSelect={selectBucket} /></div> : null}
      <header className={styles.header}>
        <div>
          <h1>Candidates</h1>
          <p>
            <strong>{rows.length}</strong> people in this view
            {!isFirstRun ? (
              <span>
                {" "}· {visibleActionable} ready for drafts
              </span>
            ) : null}
          </p>
        </div>
        {!isFirstRun ? (
          <div className={styles.tools}>
            <label className={styles.search}>
              <span className={styles.srOnly}>Search candidates</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search people, roles, companies…"
              />
            </label>
            <button
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              aria-expanded={filterOpen}
            >
              Filter{active.length ? ` (${active.length})` : ""}
            </button>
            <div className={styles.density} aria-label="Candidate density">
              <button
                type="button"
                aria-pressed={density === "comfortable"}
                onClick={() => setDensity("comfortable")}
              >
                Comfortable
              </button>
              <button
                type="button"
                aria-pressed={density === "compact"}
                onClick={() => setDensity("compact")}
              >
                Compact
              </button>
            </div>
            {findPeopleControl}
          </div>
        ) : null}
        {!isFirstRun ? <div className={styles.summary}>
          <span>
            {active.length
              ? active.join(" · ")
              : "Available candidates across all tracks, lanes, and regions"}
          </span>
          {active.length || search ? (
            <button type="button" onClick={clear}>
              Clear
            </button>
          ) : null}
        </div> : null}
        {filterOpen && !isFirstRun ? (
          <div
            className={styles.sheet}
            role="dialog"
            aria-label="Filter candidates"
          >
            <header>
              <div>
                <small>Candidate view</small>
                <strong>Filter candidates</strong>
              </div>
              <button type="button" onClick={() => setFilterOpen(false)}>
                Done
              </button>
            </header>
            <Filter
              label="Track"
              value={filters.track}
              active={filters.track !== "all"}
              onChange={(track) =>
                setFilters((current) => ({ ...current, track }))
              }
              options={[
                ["all", "All tracks"],
                ["professional", "Professional"],
                ["recruiter", "Recruiter"],
              ]}
            />
            <Filter
              label="Role family"
              value={filters.role}
              active={filters.role !== "all"}
              onChange={(role) =>
                setFilters((current) => ({ ...current, role }))
              }
              options={[
                ["all", "All roles"],
                ...roles.map(
                  (role) => [role, roleLabel(role)] as [string, string],
                ),
              ]}
            />
            <Filter
              label="Industry"
              value={filters.industry}
              active={filters.industry !== "all"}
              onChange={(industry) =>
                setFilters((current) => ({ ...current, industry }))
              }
              options={[
                ["all", "All industries"],
                ...industries.map(
                  (value) => [value, value] as [string, string],
                ),
              ]}
            />
            <Filter
              label="Geography"
              value={filters.geography}
              active={filters.geography !== "all"}
              onChange={(geography) =>
                setFilters((current) => ({ ...current, geography }))
              }
              options={[
                ["all", "All locations"],
                ...geographies.map(
                  (value) => [value, value] as [string, string],
                ),
              ]}
            />
            <Filter
              label="Availability"
              value={filters.status}
              active={filters.status !== "all"}
              onChange={(status) =>
                setFilters((current) => ({ ...current, status }))
              }
              options={[
                ["all", "All states"],
                ["qualified-available", "Available"],
                ["in-draft-queue", "In Drafts"],
                ["cooldown", "Available later"],
                ["suppressed", "Do not contact"],
                ["already-contacted", "Contacted"],
                ["enriched-unqualified", "Not eligible"],
                ["search-only", "Needs verification"],
              ]}
            />
            <button type="button" className={styles.clear} onClick={clear}>
              Clear all filters
            </button>
          </div>
        ) : null}
      </header>
      {refreshResult ? (
        <p className={styles.result} role="status">
          {refreshResult}
        </p>
      ) : null}
      {isBlockedPool && !hasCandidateFilters ? (
        <section className={styles.blockedPool} aria-labelledby="blocked-pool-title">
          <div>
            <h2 id="blocked-pool-title">No candidates are ready for drafts</h2>
            <p>
              These people need attention or are unavailable before a draft can
              be created.
            </p>
            {projectedBlockers ? (
              <ul>
                {projectedBlockers.reviewRequired > 0 ? (
                  <li><strong>{projectedBlockers.reviewRequired}</strong> employer or eligibility review required</li>
                ) : null}
                {projectedBlockers.unresolvedEvidence > 0 ? (
                  <li><strong>{projectedBlockers.unresolvedEvidence}</strong> missing required evidence</li>
                ) : null}
                {projectedBlockers.companyCooldown > 0 ? (
                  <li><strong>{projectedBlockers.companyCooldown}</strong> in company cooldown</li>
                ) : null}
                {projectedBlockers.alreadyDraftedOrContacted > 0 ? (
                  <li><strong>{projectedBlockers.alreadyDraftedOrContacted}</strong> already drafted or contacted</li>
                ) : null}
                {projectedBlockers.suppressed > 0 ? (
                  <li><strong>{projectedBlockers.suppressed}</strong> suppressed</li>
                ) : null}
              </ul>
            ) : (
              <ul>
                {blockers.employerReview > 0 ? (
                  <li><strong>{blockers.employerReview}</strong> employer review required</li>
                ) : null}
                {blockers.eligibilityReview > 0 ? (
                  <li><strong>{blockers.eligibilityReview}</strong> eligibility review required</li>
                ) : null}
                {blockers.companyCooldown > 0 ? (
                  <li><strong>{blockers.companyCooldown}</strong> in company cooldown</li>
                ) : null}
                {blockers.alreadyContacted > 0 ? (
                  <li><strong>{blockers.alreadyContacted}</strong> already contacted</li>
                ) : null}
                {blockers.alreadyInDrafts > 0 ? (
                  <li><strong>{blockers.alreadyInDrafts}</strong> already in Drafts</li>
                ) : null}
                {blockers.suppressed > 0 ? (
                  <li><strong>{blockers.suppressed}</strong> suppressed</li>
                ) : null}
                {blockers.notEligible > 0 ? (
                  <li><strong>{blockers.notEligible}</strong> not eligible</li>
                ) : null}
              </ul>
            )}
          </div>
          {reviewableCount > 0 ? (
            <button className={styles.reviewCandidates} type="button" onClick={reviewCandidates}>
              Review candidates
            </button>
          ) : sourcingAction}
        </section>
      ) : null}
      {rows.length === 0 ? (
        <div
          className={`${styles.empty} ${showScopedConfirmation ? styles.expandedSourcingEmpty : ""}`}
        >
          <h2>{emptyState.title}</h2>
          <p>{emptyState.detail}</p>
          {hasCandidateFilters ? (
            <button type="button" onClick={clear}>Clear filters</button>
          ) : (
            <>
              {sourcingAction}
              {emptyState.showLegacy ? (
                <button
                  className={styles.viewLegacy}
                  type="button"
                  onClick={() => selectBucket("legacy", false)}
                >
                  View Legacy
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className={styles.work}>
          <div
            className={styles.list}
            role="listbox"
            aria-label="Candidate supply"
            aria-hidden={mobileDetail ? "true" : undefined}
          >
            <div className={styles.columns}>
              <span>Person and current work</span>
              <span>Why now</span>
              <span>Context</span>
            </div>
            {rows.map((candidate) => (
              <button
                key={candidate.id}
                id={`candidate-${candidate.id}`}
                role="option"
                aria-selected={selected?.id === candidate.id}
                onClick={() => select(candidate.id)}
                onKeyDown={(event) => {
                  const index = rows.findIndex((row) => row.id === candidate.id);
                  const next =
                    event.key === "ArrowDown"
                      ? rows[index + 1]
                      : event.key === "ArrowUp"
                        ? rows[index - 1]
                        : null;
                  if (next) {
                    event.preventDefault();
                    setSelectedId(next.id);
                    document.getElementById(`candidate-${next.id}`)?.focus();
                  }
                }}
                className={styles.row}
                data-review-needed={
                  candidate.bucketReviewState === "review-required"
                    ? "true"
                    : undefined
                }
              >
                <span className={styles.profile}>
                  <span className={styles.identity}>
                    <strong>{candidate.recipient}</strong>
                    <small>
                      {candidate.track ?? "professional"} ·{" "}
                      {candidate.bucketLabel ?? "Legacy / unclassified"}
                    </small>
                  </span>
                  <span className={styles.current}>
                    <strong>{candidate.title}</strong>
                    <small>{candidate.company}</small>
                  </span>
                </span>
                <span className={styles.cue}>{relevance(candidate)}</span>
                <span className={styles.meta}>
                  <span>{roleLabel(candidate.functionName)}</span>
                  <em
                    data-suppressed={
                      candidate.stage === "suppressed" ? "true" : undefined
                    }
                    data-review-needed={
                      candidate.bucketReviewState === "review-required"
                        ? "true"
                        : undefined
                    }
                  >
                    <i aria-hidden="true">
                      {candidate.stage === "suppressed" ? "×" : "·"}
                    </i>
                      {candidate.bucketReviewState === "review-required"
                      ? "Review needed"
                      : stageLabel[candidate.stage]}
                  </em>
                </span>
              </button>
            ))}
          </div>
          {selected ? (
            <aside
              ref={inspectorRef}
              className={`${styles.inspector} ${mobileDetail ? styles.detailOpen : ""}`}
              role={mobileDetail ? "dialog" : undefined}
              aria-modal={mobileDetail ? "true" : undefined}
              aria-label={`Candidate details for ${selected.recipient}`}
            >
              <header className={styles.candidateLead}>
                <button
                  type="button"
                  className={styles.close}
                  onClick={closeDetail}
                >
                  Close
                </button>
                <small>Selected candidate</small>
                <h2>{selected.recipient}</h2>
                <p className={styles.role}>{selected.title}</p>
                <p className={styles.company}>{selected.company}</p>
                <CandidateDraftAction candidate={selected} />
                {["qualified-available", "search-only", "enriched-unqualified", "cooldown"].includes(selected.stage) ? (
                  <CandidateDispositionActions
                    candidateId={selected.id}
                    nextCandidateId={nextCandidateId}
                    bucket={bucketSelection}
                    earlyCareerOnly={earlyCareerOnly}
                  />
                ) : null}
              </header>
              <dl>
                <div>
                  <dt>Track</dt>
                  <dd>{roleLabel(selected.track ?? "professional")}</dd>
                </div>
                <div>
                  <dt>Recipient bucket</dt>
                  <dd>
                    {selected.bucketLabel ?? "Legacy / unclassified"}
                    {selected.bucketReviewState === "review-required"
                      ? " · review needed"
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{selected.geography ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>Availability</dt>
                  <dd>{stageLabel[selected.stage]}</dd>
                </div>
              </dl>
              {selected.bucketReviewState === "review-required" &&
              !employerReviewRequired(selected) ? (
                <Link
                  href={`/candidate-review?candidate=${encodeURIComponent(selected.id)}`}
                >
                  Review bucket evidence
                </Link>
              ) : null}
              <details className={styles.evidenceDisclosure}>
                <summary>Details</summary>
                <div className={styles.evidenceGroups}>
                <section>
                  <h3>Bucket evidence</h3>
                  <p>
                    {selected.bucketReviewState === "review-required"
                      ? (selected.bucketReviewReason ??
                        "Classification evidence contains a blocking conflict that needs review.")
                      : selected.bucketReviewState === "legacy-unclassified"
                        ? "No bucket was stored for this record. It has not been inferred."
                        : selected.bucketEvidenceReferences?.length
                          ? selected.bucketEvidenceReferences.join(" · ")
                          : "Reviewed classification evidence is recorded."}
                  </p>
                  {selected.planningBlockReason?<p role="alert">{planningBlockMessage(selected.planningBlockReason)}</p>:null}
                </section>
                <section>
                  <h3>Why this person</h3>
                  <p>{relevance(selected)}</p>
                </section>
                <section>
                  <h3>Role relevance</h3>
                  <p>
                    {roleLabel(selected.functionName)} · {selected.industry}
                  </p>
                </section>
                <section>
                  <h3>Company evidence</h3>
                  <p>{companyEvidence(selected)}</p>
                  {selected.employerTrust?.state === "unverified" ? (
                    <p className={styles.advisory}>
                      Employer not independently verified. Keep the message limited to the person’s verified title and company.
                    </p>
                  ) : null}
                </section>
                <section>
                  <h3>History</h3>
                  <p>{history(selected)}</p>
                </section>
                </div>
              </details>
              <section
                className={
                  selected.stage === "qualified-available" &&
                  selected.bucketReviewState !== "review-required"
                    ? styles.eligible
                    : styles.restricted
                }
              >
                <h3>Current status</h3>
                <strong>
                  {selected.bucketReviewState === "review-required"
                    ? "Review needed"
                    : selected.stage === "qualified-available"
                      ? "Ready to create a draft"
                      : stageLabel[selected.stage]}
                </strong>
                <p>
                  {selected.bucketReviewState === "review-required"
                    ? "This candidate is excluded from drafting until the blocking eligibility evidence is reviewed."
                    : selected.stage === "qualified-available"
                      ? "NetworkPilot rechecks contact history, company cooldown, and suppression before any external action."
                      : "NetworkPilot will not plan this person while the current state applies."}
                </p>
              </section>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Filter({
  label,
  value,
  active,
  onChange,
  options,
}: {
  label: string;
  value: string;
  active: boolean;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className={styles.filter} data-active={active ? "true" : undefined}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

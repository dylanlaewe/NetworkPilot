"use client";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type {
  ReserveCandidate,
  ReserveStage,
} from "@/application/daily-command-center";
import styles from "./candidates-command.module.css";
import type { BucketNavigationData } from "@/app/recipient-bucket-navigation";
import { reviewCandidateCompanyTrust } from "./actions";

export type CandidateWorkspaceRow = ReserveCandidate & {
  companyTrustReview?: { commandId: string; reviewedAt: string };
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
  "search-only": "Needs verification",
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
  status: "qualified-available",
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
function matchesBucket(
  row: ReserveCandidate,
  navigation: BucketNavigationData | undefined,
) {
  if (!navigation || navigation.selected === "all") return true;
  if (navigation.selected === "legacy") return !row.recipientBucket?.bucket;
  return (
    row.recipientBucket?.bucket === navigation.selected &&
    (!navigation.earlyCareerOnly || row.recipientBucket.earlyCareer)
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
}: {
  candidates: CandidateWorkspaceRow[];
  initialSelectedId?: string;
  initialFilterOpen?: boolean;
  refreshControl: ReactNode;
  refreshResult: string | null;
  bucketNavigation?: BucketNavigationData;
  actionableCapacity?: number;
}) {
  const [selectedId, setSelectedId] = useState(
      initialSelectedId ?? candidates[0]?.id ?? "",
    ),
    [mobileDetail, setMobileDetail] = useState(false),
    [density, setDensity] = useState<Density>("comfortable"),
    [filterOpen, setFilterOpen] = useState(initialFilterOpen),
    [search, setSearch] = useState(""),
    [filters, setFilters] = useState<Filters>(initialFilters);
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
  const employerReviewCount = candidates.filter(
    (row) => matchesBucket(row, bucketNavigation) && employerReviewRequired(row),
  ).length;
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return candidates.filter(
      (row) =>
        matchesBucket(row, bucketNavigation) &&
        (!bucketNavigation?.earlyCareerOnly ||
          bucketNavigation.selected === "peers") &&
        (filters.track === "all" ||
          (row.track ?? "professional") === filters.track) &&
        (filters.role === "all" || row.functionName === filters.role) &&
        (filters.industry === "all" || row.industry === filters.industry) &&
        (filters.geography === "all" || row.geography === filters.geography) &&
        (filters.status === "all" ||
          (filters.status === "employer-review-required"
            ? employerReviewRequired(row)
            : row.stage === filters.status)) &&
        (!query ||
          `${row.recipient} ${row.title} ${row.company} ${row.functionName} ${row.industry}`
            .toLowerCase()
            .includes(query)),
    );
  }, [bucketNavigation, candidates, filters, search]);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
  const active = [
    bucketNavigation && bucketNavigation.selected !== "all"
      ? bucketNavigation.selected === "legacy"
        ? "Legacy / unclassified"
        : roleLabel(bucketNavigation.selected)
      : null,
    bucketNavigation?.earlyCareerOnly ? "Early-career only" : null,
    filters.track !== "all" ? roleLabel(filters.track) : null,
    filters.role !== "all" ? roleLabel(filters.role) : null,
    filters.industry !== "all" ? filters.industry : null,
    filters.geography !== "all" ? filters.geography : null,
    filters.status !== "qualified-available"
      ? filters.status === "employer-review-required"
        ? "Employer review required"
        : (stageLabel[filters.status as ReserveStage] ?? filters.status)
      : null,
  ].filter(Boolean) as string[];
  const select = (id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
    const url = new URL(window.location.href);
    url.searchParams.set("selected", id);
    window.history.replaceState(null, "", url);
  };
  const clear = () => {
    setSearch("");
    setFilters(initialFilters);
  };
  return (
    <div className={styles.candidates} data-density={density}>
      <header className={styles.header}>
        <div>
          <h1>Candidates</h1>
          <p>
            <strong>{rows.length}</strong> people in this view ·{" "}
            <span>
              {actionableCapacity ??
                rows.filter(
                  (row) =>
                    row.stage === "qualified-available" &&
                    row.bucketReviewState !== "review-required",
                ).length}{" "}
              actionable draft slots
            </span>
          </p>
        </div>
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
          {refreshControl}
        </div>
        <div className={styles.summary}>
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
          {employerReviewCount > 0 ? (
            <button
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  track: "recruiter",
                  status: "employer-review-required",
                }))
              }
            >
              {employerReviewCount} employer review
              {employerReviewCount === 1 ? "" : "s"} required
            </button>
          ) : null}
        </div>
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
        {filterOpen ? (
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
              active={filters.status !== "qualified-available"}
              onChange={(status) =>
                setFilters((current) => ({ ...current, status }))
              }
              options={[
                ["qualified-available", "Available"],
                ["all", "All states"],
                ["employer-review-required", "Employer review required"],
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
      {rows.length === 0 ? (
        <div className={styles.empty}>
          <span>—</span>
          <h2>No candidates match this view</h2>
          <p>Clear the filters to restore the opportunity pool.</p>
          <button type="button" onClick={clear}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={styles.work}>
          <div
            className={styles.list}
            role="listbox"
            aria-label="Candidate supply"
          >
            <div className={styles.columns}>
              <span>Person and current work</span>
              <span>Why now</span>
              <span>Context</span>
            </div>
            {rows.map((candidate) => (
              <button
                key={candidate.id}
                role="option"
                aria-selected={selected?.id === candidate.id}
                onClick={() => select(candidate.id)}
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
                      ? employerReviewRequired(candidate)
                        ? "Employer review"
                        : "Review needed"
                      : stageLabel[candidate.stage]}
                  </em>
                </span>
              </button>
            ))}
          </div>
          {selected ? (
            <aside
              className={`${styles.inspector} ${mobileDetail ? styles.detailOpen : ""}`}
            >
              <button
                type="button"
                className={styles.close}
                onClick={() => setMobileDetail(false)}
              >
                Close
              </button>
              <small>Selected candidate</small>
              <h2>{selected.recipient}</h2>
              <p className={styles.role}>{selected.title}</p>
              <p className={styles.company}>{selected.company}</p>
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
              {employerReviewRequired(selected) &&
              selected.companyTrustReview ? (
                <section className={styles.employerReview}>
                  <h3>Employer review required</h3>
                  <strong>{selected.company}</strong>
                  <dl>
                    <div>
                      <dt>Domain</dt>
                      <dd>{selected.employerIdentity?.domain ?? "Not provided"}</dd>
                    </div>
                    <div>
                      <dt>Provider identity</dt>
                      <dd>
                        {selected.employerIdentity?.providerNamespace &&
                        selected.employerIdentity.providerEmployerId
                          ? `${selected.employerIdentity.providerNamespace} · ${selected.employerIdentity.providerEmployerId}`
                          : "Domain-backed identity"}
                      </dd>
                    </div>
                    <div>
                      <dt>Current trust</dt>
                      <dd>Unverified</dd>
                    </div>
                  </dl>
                  <p>
                    This recruiter remains review-required, non-actionable, and
                    excluded from drafting until the employer is trusted.
                  </p>
                  <form action={reviewCandidateCompanyTrust}>
                    <input type="hidden" name="candidateId" value={selected.id} />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={selected.employerTrust?.version ?? 0}
                    />
                    <input
                      type="hidden"
                      name="commandId"
                      value={selected.companyTrustReview.commandId}
                    />
                    <input
                      type="hidden"
                      name="reviewedAt"
                      value={selected.companyTrustReview.reviewedAt}
                    />
                    <label>
                      <span>Review reason</span>
                      <textarea
                        name="reason"
                        maxLength={500}
                        required
                        placeholder="Record the evidence supporting this trust decision."
                      />
                    </label>
                    <div>
                      <button name="decision" value="trusted-operating">
                        Trust operating employer
                      </button>
                      <button
                        name="decision"
                        value="disallowed-recruiting-service"
                      >
                        Mark recruiting/staffing service
                      </button>
                    </div>
                  </form>
                  <small>
                    Leave unverified by taking no action; the candidate remains
                    blocked.
                  </small>
                </section>
              ) : null}
              <div className={styles.evidenceGroups}>
                <section>
                  <h3>Bucket evidence</h3>
                  <p>
                    {selected.bucketReviewState === "review-required"
                      ? employerReviewRequired(selected)
                        ? "The recruiter bucket is supported, but the provider-only employer must be reviewed before this person is actionable."
                        : (selected.bucketReviewReason ??
                          "Classification evidence needs review; this person is not actionable.")
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
                </section>
                <section>
                  <h3>History</h3>
                  <p>{history(selected)}</p>
                </section>
              </div>
              <section
                className={
                  selected.stage === "qualified-available" &&
                  selected.bucketReviewState !== "review-required"
                    ? styles.eligible
                    : styles.restricted
                }
              >
                <h3>Planning eligibility</h3>
                <strong>
                  {selected.bucketReviewState === "review-required"
                    ? employerReviewRequired(selected)
                      ? "Employer review required"
                      : "Review needed"
                    : selected.stage === "qualified-available"
                      ? "Eligible for a future plan"
                      : stageLabel[selected.stage]}
                </strong>
                <p>
                  {selected.bucketReviewState === "review-required"
                    ? employerReviewRequired(selected)
                      ? "This candidate is excluded from actionable capacity until the audited employer review is complete."
                      : "This candidate is excluded from actionable capacity until bucket evidence is reviewed."
                    : selected.stage === "qualified-available"
                      ? "Company cooldown and one-per-company protections still apply when planning."
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

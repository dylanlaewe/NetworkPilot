import { DEFAULT_RESERVE_TARGET, planCandidateRefresh } from "@/application/candidate-refresh";
import { humanScopedDiscoveryReadiness, type ScopedDiscoveryReadiness } from "@/application/candidate-refresh/scoped-readiness";
import { refreshCandidates } from "./actions";

const labels = { recruiters: "recruiters", peers: "peers", managers: "managers", executives: "executives", ceos: "CEOs and presidents" } as const;

export function CandidateRefreshControl({ available, totalReserve = available, exposure = 0, maximumPerBatch = 20, maximumPerDay = 20, fiveBucketEnabled = false, bucket, earlyCareerOnly = false, legacyView = false, requestId, readiness, open = false }: { available: number; totalReserve?: number; exposure?: number; maximumPerBatch?: number; maximumPerDay?: number; fiveBucketEnabled?: boolean; bucket?: keyof typeof labels; earlyCareerOnly?: boolean; legacyView?: boolean; requestId?: string; readiness?: ScopedDiscoveryReadiness; open?: boolean }) {
  const remaining = Math.max(0, maximumPerDay - exposure);
  const plan = planCandidateRefresh(available, DEFAULT_RESERVE_TARGET, Math.min(maximumPerBatch, remaining));
  const label = fiveBucketEnabled && bucket ? labels[bucket] : "candidates";
  const title = "Find people";
  if (legacyView) return <p className="budget-message" role="status">Choose a recipient group before finding people. Legacy records stay unchanged.</p>;
  if (fiveBucketEnabled && !bucket) return <p className="budget-message" role="status">Choose a recipient group first. Apollo usage is shared across all groups.</p>;
  if (fiveBucketEnabled && readiness && !readiness.ready) return <div className="budget-message" role="status"><strong>Find people is unavailable</strong><small>{humanScopedDiscoveryReadiness(readiness)}</small></div>;
  if (remaining === 0) return <p className="budget-message" role="status">Candidate refresh is available again tomorrow.<small>Your drafts and outreach are still available. The shared provider allowance is exhausted across all buckets.</small></p>;
  return <details className="refresh-candidates" open={open}>
    <summary>{title}</summary>
    <div>
      <h3>{fiveBucketEnabled && bucket ? `Find ${label}?` : "Find people?"}</h3>
      <dl><div><dt>People in this group</dt><dd>{totalReserve}</dd></div><div><dt>Ready for drafts</dt><dd>{available}</dd></div><div><dt>Daily target</dt><dd>{DEFAULT_RESERVE_TARGET}</dd></div><div><dt>Maximum Apollo credits</dt><dd>{Math.min(plan.maximumProviderUsage, remaining)}</dd></div></dl>
      <p>{earlyCareerOnly ? "Scope: Early-career peers only. " : ""}{plan.providerRequired ? `This search is scoped to ${label} and may use Apollo credits. NetworkPilot uses existing candidates first, then requests only the additional people needed.` : "This group already has enough candidates. No Apollo search is needed."}</p>
      <form action={refreshCandidates}>
        <input type="hidden" name="confirmation" value="confirmed" /><input type="hidden" name="allowProvider" value="yes" /><input type="hidden" name="requested" value={plan.maximumProviderUsage} />
        {bucket ? <input type="hidden" name="bucket" value={bucket} /> : null}{earlyCareerOnly ? <input type="hidden" name="earlyCareerOnly" value="true" /> : null}{requestId ? <input type="hidden" name="requestId" value={requestId} /> : null}
        <button disabled={!plan.providerRequired}>Find {fiveBucketEnabled && bucket ? label : "people"}</button>
      </form>
    </div>
  </details>;
}

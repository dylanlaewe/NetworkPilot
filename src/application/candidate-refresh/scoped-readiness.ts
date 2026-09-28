export type ScopedDiscoveryBlockedReason =
  | "canonical-store-unavailable"
  | "canonical-schema-required"
  | "recruiter-evidence-store-unavailable"
  | "recruiter-evidence-schema-invalid"
  | "datastore-topology-invalid"
  | "provider-not-configured"
  | "provider-budget-unavailable";

export type ScopedDiscoveryReadiness =
  | { ready: true; reason: null; technicalDetail: null }
  | {
      ready: false;
      reason: ScopedDiscoveryBlockedReason;
      technicalDetail: string;
    };

export class ScopedDiscoveryReadinessError extends Error {
  readonly code = "scoped-discovery-not-ready";

  constructor(readonly readiness: Exclude<ScopedDiscoveryReadiness, { ready: true }>) {
    super(readiness.reason);
    this.name = "ScopedDiscoveryReadinessError";
  }
}
export function humanScopedDiscoveryReadiness(
  readiness: ScopedDiscoveryReadiness,
): string {
  if (readiness.ready) return "Ready";
  switch (readiness.reason) {
    case "recruiter-evidence-store-unavailable":
    case "recruiter-evidence-schema-invalid":
      return "Recruiter evidence store is unavailable.";
    case "canonical-schema-required":
      return "Five-bucket data setup must be completed before finding candidates.";
    case "provider-budget-unavailable":
      return "The shared provider allowance is unavailable for this request.";
    case "provider-not-configured":
      return "Bucket-specific candidate search is not configured yet.";
    case "canonical-store-unavailable":
    case "datastore-topology-invalid":
      return "Candidate data storage is not ready for this request.";
  }
}

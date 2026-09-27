import type { CandidateSourceRecord } from "@/domain/candidates";
import { assertFiveBucketEnabled, type BucketScope } from "@/domain/recipient-buckets";
import type { CandidateRefreshResult } from ".";

export interface ScopedDiscoveryProvider {
  discover(input: { scope: BucketScope; maximum: number; operationId: string; maximumSearchCalls: number }): Promise<{ records: CandidateSourceRecord[]; searchedCandidates: number; rejectedCandidates: number; enrichmentAttempts: number; searchCalls: number; observedCredits: number | null }>;
}
export interface ScopedDiscoveryPolicy { maximumPerBatch: number; maximumPerDay: number; maximumSearchCalls: number; hardStop: boolean; }
export interface ScopedDiscoveryStore {
  claim(input: { requestId: string; scope: BucketScope; requested: number; policy: ScopedDiscoveryPolicy; at: Date }): { operationId: string; maximum: number; existing?: CandidateRefreshResult };
  complete(input: { operationId: string; scope: BucketScope; requested: number; maximum: number; usableBefore: number; records: CandidateSourceRecord[]; searchedCandidates: number; rejectedCandidates: number; attempts: number; searchCalls: number; observedCredits: number | null; at: Date }): CandidateRefreshResult;
  fail(operationId: string, reason: string): void;
}

/** Scope travels with the request; one existing Apollo budget account authorizes every bucket. */
export async function refreshScopedCandidateReserve(input: { requestId: string; scope: BucketScope; requested: number; usableBefore: number; policy: ScopedDiscoveryPolicy; store: ScopedDiscoveryStore; provider?: ScopedDiscoveryProvider; allowProvider: boolean; now: () => Date }): Promise<CandidateRefreshResult> {
  assertFiveBucketEnabled();
  if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(input.requestId)) throw new Error("scoped-refresh-request-id-invalid");
  if (!Number.isInteger(input.requested) || input.requested < 1 || input.requested > 20) throw new Error("scoped-refresh-count-invalid");
  if (!input.allowProvider) throw new Error("scoped-refresh-confirmation-required");
  if (!input.provider) throw new Error("scoped-discovery-live-validation-required");
  const claim = input.store.claim({ requestId: input.requestId, scope: input.scope, requested: input.requested, policy: input.policy, at: input.now() });
  if (claim.existing) return claim.existing;
  try {
    const result = await input.provider.discover({ scope: input.scope, maximum: claim.maximum, operationId: claim.operationId, maximumSearchCalls: input.policy.maximumSearchCalls });
    if (!Number.isInteger(result.enrichmentAttempts) || result.enrichmentAttempts < 0 || result.enrichmentAttempts > claim.maximum || !Number.isInteger(result.searchCalls) || result.searchCalls < 0 || result.searchCalls > input.policy.maximumSearchCalls || result.records.length > result.enrichmentAttempts || !Number.isInteger(result.searchedCandidates) || result.searchedCandidates < result.records.length || !Number.isInteger(result.rejectedCandidates) || result.rejectedCandidates < 0 || result.rejectedCandidates > result.searchedCandidates) throw new Error("scoped-refresh-provider-cap-exceeded");
    if (result.observedCredits !== null && (!Number.isFinite(result.observedCredits) || result.observedCredits < 0 || result.observedCredits > claim.maximum)) throw new Error("scoped-refresh-credit-model-exceeded");
    return input.store.complete({ operationId: claim.operationId, scope: input.scope, requested: input.requested, maximum: claim.maximum, usableBefore: input.usableBefore, records: result.records, searchedCandidates: result.searchedCandidates, rejectedCandidates: result.rejectedCandidates, attempts: result.enrichmentAttempts, searchCalls: result.searchCalls, observedCredits: result.observedCredits, at: input.now() });
  } catch (error) {
    input.store.fail(claim.operationId, error instanceof Error ? error.message : "scoped-refresh-failed");
    throw error;
  }
}

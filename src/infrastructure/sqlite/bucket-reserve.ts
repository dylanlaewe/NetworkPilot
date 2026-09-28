import { SqliteSimulationRepository } from "./database";
import {
  draftCampaignDate,
  draftIsDismissed,
  loadQueueReviews,
  readDraftGenerations,
  readQueueCandidates,
  readQueueOperations,
  renderQueueReview,
} from "./draft-queue";
import {
  assertFiveBucketEnabled,
  matchesBucketScope,
  type BucketScope,
} from "@/domain/recipient-buckets";
import {
  localCampaignDate,
  planNextDraftBatch,
  type DailyRefreshResult,
} from "@/application/daily-refresh";
import { CONTACT_IMPACTING_EVENT_TYPES } from "@/domain/outreach";
import { initialResumeSelection } from "@/application/resumes/recruiter-default";
import {
  commandCenterSnapshotId,
  prepareEditedDraft,
  type CommandCenterDraftReview,
} from "@/application/command-center-drafts";
import { bucketProjection } from "@/domain/recipient-buckets";
import { resolveManualOutreachDatabaseSelection } from "./manual-outreach-operator";

/** Injected repository boundary: no provider, credentials or default database construction. */
export function bucketReserve(
  repository: SqliteSimulationRepository,
  scope: BucketScope,
  at: Date,
  options: {
    includeSecondary?: boolean;
    replacementId?: string;
    requestId?: string;
  } = {},
) {
  assertFiveBucketEnabled();
  // Bucket classification and reserve are canonical application state. The
  // legacy recruiter database is evidence-only and must never participate in
  // five-bucket persistence or capacity calculations.
  const canonicalOnly = { includeSecondary: false } as const,
    candidates = readQueueCandidates(repository.native, canonicalOnly),
    active = loadQueueReviews(repository, at, canonicalOnly).filter(
      (r) =>
        r.operation?.sendState !== "sent" &&
        !repository.findManualOutreach(r.snapshotId),
    ),
    operations = readQueueOperations(repository),
    generations = readDraftGenerations(repository.native);
  const suppressed = new Set(
    (
      repository.native
        .prepare("SELECT candidate_id FROM candidate_suppression_entries")
        .all() as { candidate_id: string }[]
    ).map((r) => r.candidate_id),
  );
  const planned = new Set(
    generations.flatMap((g) => [
      ...g.candidateIds,
      ...(g.carriedDraftReviews ?? []).map((r) => r.candidateId),
    ]),
  );
  const occupied = new Set(
    active
      .filter((r) => r.candidateId !== options.replacementId)
      .map((r) => r.companyId),
  );
  for (const operation of operations)
    if (operation.sendState !== "sent" && operation.snapshot.companyId)
      occupied.add(operation.snapshot.companyId);
  const events = repository
    .listOutreachEvents()
    .filter(
      (e) =>
        CONTACT_IMPACTING_EVENT_TYPES.has(e.type) ||
        e.type === "operator-reported-hard-bounce",
    );
  const date = localCampaignDate(at),
    today = at.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const matching = candidates.filter((c) =>
    matchesBucketScope(c.recipientBucket, scope),
  );
  const eligible = matching.filter((c) => {
    const company = c.strategyCompanyMatch?.companyId;
    return (
      c.state === "eligible" &&
      !c.gateFailures.length &&
      !c.source.consent.suppressed &&
      !c.source.consent.optedOut &&
      c.source.email.verificationStatus === "verified" &&
      company &&
      !occupied.has(company) &&
      !suppressed.has(c.id) &&
      !planned.has(c.id) &&
      !operations.some((op) => op.snapshot.candidateId === c.id) &&
      !draftIsDismissed(repository.native, c.id, date) &&
      !events.some(
        (e) =>
          e.prospectId === c.id ||
          e.prospectId === `authorized:${c.source.providerRecordId}` ||
          (e.companyId === company &&
            (e.type === "operator-reported-hard-bounce"
              ? e.occurredAt.toLocaleDateString("en-CA", {
                  timeZone: "America/New_York",
                }) === today
              : e.occurredAt.getTime() >= at.getTime() - 7 * 86400000)),
      ) &&
      renderQueueReview(c, 0, at) !== null
    );
  });
  return {
    active,
    eligible,
    totalReserve: matching.filter(
      (c) =>
        !planned.has(c.id) &&
        !operations.some((op) => op.snapshot.candidateId === c.id),
    ).length,
    actionableCapacity: new Set(
      eligible.map((c) => c.strategyCompanyMatch!.companyId),
    ).size,
  };
}

/** Authoritative, provider-free capacity projection used by operator surfaces. */
export function loadBucketReserveMetrics(
  scope: BucketScope,
  at = new Date(),
): { totalReserve: number; actionableCapacity: number } {
  assertFiveBucketEnabled();
  const repository = new SqliteSimulationRepository(
    resolveManualOutreachDatabaseSelection().path,
    {readonly:true,fileMustExist:true},
  );
  try {
    repository.assertRuntimeSchema();
    const state = bucketReserve(repository, scope, at);
    return {
      totalReserve: state.totalReserve,
      actionableCapacity: state.actionableCapacity,
    };
  } finally {
    repository.close();
  }
}

/** One datastore read for the unfiltered Drafts view across accepted buckets. */
export function hasActionableBucketReserve(
  scopes: readonly BucketScope[],
  at = new Date(),
): boolean {
  assertFiveBucketEnabled();
  const repository = new SqliteSimulationRepository(
    resolveManualOutreachDatabaseSelection().path,
    {readonly:true,fileMustExist:true},
  );
  try {
    repository.assertRuntimeSchema();
    return scopes.some(
      (scope) => bucketReserve(repository, scope, at).actionableCapacity > 0,
    );
  } finally {
    repository.close();
  }
}

export function addBucketDraftsFromRepository(
  repository: SqliteSimulationRepository,
  requested: number,
  scope: BucketScope,
  at: Date,
  options: {
    includeSecondary?: boolean;
    replacementId?: string;
    requestId?: string;
  } = {},
): DailyRefreshResult {
  assertFiveBucketEnabled();
  if (!Number.isInteger(requested) || requested < 1 || requested > 20)
    throw new Error("draft-batch-size-invalid");
  return repository.transaction(() => {
    const date = localCampaignDate(at),
      generations = readDraftGenerations(repository.native),
      prior = options.requestId
        ? generations.find((g) => g.addition?.requestId === options.requestId)
        : undefined;
    if (prior) {
      if (
        prior.addition?.additionalDraftCount !== requested ||
        JSON.stringify(prior.scope) !== JSON.stringify(scope)
      )
        throw new Error("draft-add-request-conflict");
      return prior;
    }
    const reserve = bucketReserve(repository, scope, at, options);
    const replaced = options.replacementId
      ? reserve.active.find((r) => r.candidateId === options.replacementId)
      : undefined;
    if (
      options.replacementId &&
      (!replaced ||
        replaced.operation ||
        !matchesBucketScope(replaced.recipientBucket, scope))
    )
      throw new Error("bucket-replacement-unavailable");
    const active = reserve.active.filter(
      (r) => r.candidateId !== options.replacementId,
    );
    const selected = planNextDraftBatch(
      reserve.eligible.map((c) => ({
        id: c.id,
        company: c.strategyCompanyMatch!.companyId,
        track: c.outreachTrack ?? "professional",
        score: c.recipientRelevance.score,
        available: true,
        recipientBucket: c.recipientBucket,
      })),
      requested,
      active.map((r) => ({
        id: r.candidateId,
        company: r.companyId,
        track: r.outreachTrack,
        score: r.score,
        available: true,
        recipientBucket: r.recipientBucket,
      })),
      scope,
    );
    const reviews = selected
      .map((selection, i) => {
        const c = reserve.eligible.find((c) => c.id === selection.id)!;
        return renderQueueReview(
          c,
          reserve.active.length + i,
          at,
          initialResumeSelection(c.outreachTrack ?? "professional", repository),
        );
      })
      .filter((r): r is CommandCenterDraftReview => r !== null);
    const generation =
      Math.max(
        0,
        ...generations
          .filter((g) => g.campaignDate === date)
          .map((g) => g.generation),
      ) + 1;
    const occupied = new Set(reviews.map((r) => r.companyId)),
      remaining = new Set(
        reserve.eligible
          .filter((c) => !occupied.has(c.strategyCompanyMatch!.companyId))
          .map((c) => c.strategyCompanyMatch!.companyId),
      ).size;
    const result: DailyRefreshResult = {
      id: `${date}:${generation}`,
      campaignDate: date,
      generation,
      createdAt: at.toISOString(),
      scope,
      candidateIds: reviews.map((r) => r.candidateId),
      draftReviews: reviews,
      ...(!generations.length && active.length
        ? { carriedDraftReviews: active }
        : {}),
      addition: {
        ...(options.requestId ? { requestId: options.requestId } : {}),
        scope,
        additionalDraftCount: requested,
        addedCount: reviews.length,
        activeBefore: reserve.active.length,
        activeAfter:
          reserve.active.length +
          reviews.length -
          (replaced && reviews.length ? 1 : 0),
        eligibleReserveRemaining: remaining,
        shortfallCode:
          reviews.length < requested ? "scoped-reserve-exhausted" : null,
      },
      professionalCount: reviews.filter(
        (r) => r.outreachTrack === "professional",
      ).length,
      recruiterCount: reviews.filter((r) => r.outreachTrack === "recruiter")
        .length,
      target: requested,
      shortfall: requested - reviews.length,
      reserveCount: reserve.totalReserve,
      providerUsed: false,
      enrichmentAttempts: 0,
      creditBefore: null,
      creditAfter: null,
      warning:
        reviews.length < requested
          ? "Qualified reserve in the selected bucket and filters could not fill the request."
          : null,
    };
    if (!reviews.length) {
      // A caller-supplied request ID defines an idempotency boundary even when
      // the scoped reserve is empty. Persist the empty result so a later reserve
      // change cannot turn a replay into a different operation.
      if (options.requestId) {
        repository.native
          .prepare(
            "INSERT INTO daily_refresh_runs(id,campaign_date,generation,created_at_utc,result_json,bucket_scope_json) VALUES(?,?,?,?,?,?)",
          )
          .run(
            result.id,
            date,
            generation,
            result.createdAt,
            JSON.stringify(result),
            JSON.stringify(scope),
          );
      }
      return result;
    }
    if (replaced) {
      const campaignDate = draftCampaignDate(
        generations,
        replaced.candidateId,
        undefined,
        at,
      );
      repository.native
        .prepare(
          "INSERT INTO draft_dispositions(candidate_id,campaign_date,disposition,created_at_utc) VALUES(?,?,'skipped',?) ON CONFLICT(candidate_id,campaign_date) DO NOTHING",
        )
        .run(replaced.candidateId, campaignDate, at.toISOString());
      repository.native
        .prepare(
          "INSERT INTO draft_disposition_audit(candidate_id,campaign_date,event_type,occurred_at_utc) VALUES(?,?,'draft-skipped',?)",
        )
        .run(replaced.candidateId, campaignDate, at.toISOString());
      result.replacement = {
        previousCandidateId: replaced.candidateId,
        replacementCandidateId: reviews[0].candidateId,
        queueIndex: reserve.active.findIndex(
          (r) => r.candidateId === replaced.candidateId,
        ),
      };
    }
    repository.native
      .prepare(
        "INSERT INTO daily_refresh_runs(id,campaign_date,generation,created_at_utc,result_json,bucket_scope_json) VALUES(?,?,?,?,?,?)",
      )
      .run(
        result.id,
        date,
        generation,
        result.createdAt,
        JSON.stringify(result),
        JSON.stringify(scope),
      );
    return result;
  });
}

export function resolveBucketDraftCorrectionInRepository(
  repository: SqliteSimulationRepository,
  input: {
    candidateId: string;
    snapshotId: string;
    decision: "keep-edits" | "regenerate";
    subject?: string;
    body?: string;
  },
  at: Date,
  options: { includeSecondary?: boolean } = {},
): void {
  assertFiveBucketEnabled();
  if (!["keep-edits", "regenerate"].includes(input.decision))
    throw new Error("bucket-copy-decision-invalid");
  repository.transaction(() => {
    const review = loadQueueReviews(repository, at, options).find(
      (r) => r.candidateId === input.candidateId,
    );
    if (
      !review ||
      review.operation ||
      !review.classificationChange?.decisionRequired
    )
      throw new Error("bucket-copy-decision-unavailable");
    if (input.snapshotId !== review.snapshotId)
      throw new Error("bucket-copy-decision-stale");
    const current = readQueueCandidates(repository.native, options).find(
      (c) => c.id === input.candidateId,
    )!;
    let next: CommandCenterDraftReview;
    if (input.decision === "regenerate") {
      const rendered = renderQueueReview(
        current,
        0,
        at,
        initialResumeSelection(
          current.outreachTrack ?? "professional",
          repository,
        ),
      );
      if (!rendered) throw new Error("bucket-copy-regeneration-blocked");
      next = rendered;
    } else {
      next = prepareEditedDraft(
        {
          ...review,
          ...bucketProjection(current.recipientBucket),
          classificationChange: undefined,
          blockedReason: null,
        },
        {
          subject: input.subject ?? review.subject,
          body: input.body ?? review.body,
        },
      );
      next.snapshotId = commandCenterSnapshotId({
        candidateId: next.candidateId,
        subject: next.subject,
        body: next.body,
        catalogVersion: `${next.catalogVersion}|bucket:${JSON.stringify(next.recipientBucket)}`,
      });
    }
    const generations = readDraftGenerations(repository.native),
      date = localCampaignDate(at),
      generation =
        Math.max(
          0,
          ...generations
            .filter((g) => g.campaignDate === date)
            .map((g) => g.generation),
        ) + 1;
    const result: DailyRefreshResult = {
      id: `${date}:${generation}`,
      campaignDate: date,
      generation,
      createdAt: at.toISOString(),
      candidateIds: [next.candidateId],
      draftReviews: [next],
      professionalCount: next.outreachTrack === "professional" ? 1 : 0,
      recruiterCount: next.outreachTrack === "recruiter" ? 1 : 0,
      target: 0,
      shortfall: 0,
      reserveCount: 0,
      providerUsed: false,
      enrichmentAttempts: 0,
      creditBefore: null,
      creditAfter: null,
      warning: `Reviewed bucket correction: ${input.decision}`,
    };
    repository.native
      .prepare(
        "INSERT INTO daily_refresh_runs(id,campaign_date,generation,created_at_utc,result_json) VALUES(?,?,?,?,?)",
      )
      .run(
        result.id,
        date,
        generation,
        result.createdAt,
        JSON.stringify(result),
      );
  });
}

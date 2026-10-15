import { SqliteSimulationRepository } from "./database";
import {
  draftCampaignDate,
  draftIsDismissed,
  loadQueueReviews,
  readCurrentQueueCandidates,
  readDraftGenerations,
  readQueueOperations,
  renderQueueReview,
  readConfirmedContactIndex,
  isConfirmedContact,
} from "./draft-queue";
import {
  assertFiveBucketEnabled,
  matchesBucketScope,
  type BucketScope,
} from "@/domain/recipient-buckets";
import {
  localCampaignDate,
  planNextDraftBatch,
  type DraftAdditionBlockCounts,
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

export type BucketReserveBlockCounts = DraftAdditionBlockCounts;

interface BucketReserveContext {
  repository: SqliteSimulationRepository;
  at: Date;
  candidates: ReturnType<typeof readCurrentQueueCandidates>;
  active: ReturnType<typeof loadQueueReviews>;
  operations: ReturnType<typeof readQueueOperations>;
  planned: Set<string>;
  suppressed: Set<string>;
  events: ReturnType<SqliteSimulationRepository["listOutreachEvents"]>;
  date: string;
  today: string;
}

const emptyBlockCounts = (): BucketReserveBlockCounts => ({
  reviewRequired: 0,
  alreadyDraftedOrContacted: 0,
  companyCooldown: 0,
  suppressed: 0,
  unresolvedEvidence: 0,
  noQualifiedReserve: 0,
});

function loadBucketReserveContext(repository: SqliteSimulationRepository, at: Date): BucketReserveContext {
  // Bucket classification and reserve are canonical application state. The
  // legacy recruiter database is evidence-only and never participates here.
  const canonicalOnly = { includeSecondary: false } as const;
  const active = loadQueueReviews(repository, at, canonicalOnly).filter(
    (row) => row.operation?.sendState !== "sent" && !repository.findManualOutreach(row.snapshotId),
  );
  const generations = readDraftGenerations(repository.native);
  return {
    repository,
    at,
    candidates: readCurrentQueueCandidates(repository, canonicalOnly),
    active,
    operations: readQueueOperations(repository),
    planned: new Set(generations.flatMap((generation) => [
      ...generation.candidateIds,
      ...(generation.carriedDraftReviews ?? []).map((row) => row.candidateId),
    ])),
    suppressed: new Set((repository.native.prepare("SELECT candidate_id FROM candidate_suppression_entries").all() as { candidate_id: string }[]).map((row) => row.candidate_id)),
    events: repository.listOutreachEvents().filter((event) => CONTACT_IMPACTING_EVENT_TYPES.has(event.type) || event.type === "operator-reported-hard-bounce"),
    date: localCampaignDate(at),
    today: at.toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
  };
}

function projectBucketReserve(
  context: BucketReserveContext,
  scope: BucketScope,
  options: { replacementId?: string } = {},
) {
  const { repository, at, candidates, active, operations, planned, suppressed, events, date, today } = context;
  const occupied = new Set(active.filter((row) => row.candidateId !== options.replacementId).map((row) => row.companyId));
  for (const operation of operations)
    if (operation.sendState !== "sent" && operation.snapshot.companyId) occupied.add(operation.snapshot.companyId);
  const matching = candidates.filter((candidate) => matchesBucketScope(candidate.recipientBucket, scope));
  const confirmedContacts=readConfirmedContactIndex(repository);
  const current = matching.filter((candidate)=>!isConfirmedContact(candidate,confirmedContacts));
  const blockCounts = emptyBlockCounts();
  if (!current.length) blockCounts.noQualifiedReserve = 1;
  const eligible = current.filter((candidate) => {
    const company = candidate.strategyCompanyMatch?.companyId;
    const contacted = events.some((event) => event.prospectId === candidate.id || event.prospectId === `authorized:${candidate.source.providerRecordId}`);
    const coolingDown = Boolean(company && events.some((event) => event.companyId === company && (event.type === "operator-reported-hard-bounce" ? event.occurredAt.toLocaleDateString("en-CA", { timeZone: "America/New_York" }) === today : event.occurredAt.getTime() >= at.getTime() - 7 * 86400000)));
    if (candidate.source.consent.suppressed || candidate.source.consent.optedOut || suppressed.has(candidate.id)) {
      blockCounts.suppressed += 1;
      return false;
    }
    if (planned.has(candidate.id) || operations.some((operation) => operation.snapshot.candidateId === candidate.id) || draftIsDismissed(repository.native, candidate.id, date) || contacted || Boolean(company && occupied.has(company))) {
      blockCounts.alreadyDraftedOrContacted += 1;
      return false;
    }
    if (coolingDown) {
      blockCounts.companyCooldown += 1;
      return false;
    }
    if (candidate.state === "review-required" || candidate.recipientBucket?.reviewState !== "accepted") {
      blockCounts.reviewRequired += 1;
      return false;
    }
    if (candidate.state !== "eligible" || candidate.gateFailures.length || candidate.source.email.verificationStatus !== "verified" || !company || renderQueueReview(candidate, 0, at) === null) {
      blockCounts.unresolvedEvidence += 1;
      return false;
    }
    return true;
  });
  return {
    active,
    eligible,
    totalReserve: current.filter((candidate) => !planned.has(candidate.id) && !operations.some((operation) => operation.snapshot.candidateId === candidate.id)).length,
    actionableCapacity: new Set(eligible.map((candidate) => candidate.strategyCompanyMatch!.companyId)).size,
    blockCounts,
  };
}

/** Injected repository boundary: no provider, credentials or default database construction. */
export function bucketReserve(repository: SqliteSimulationRepository, scope: BucketScope, at: Date, options: { includeSecondary?: boolean; replacementId?: string; requestId?: string } = {}) {
  assertFiveBucketEnabled();
  return projectBucketReserve(loadBucketReserveContext(repository, at), scope, options);
}

/** Authoritative, provider-free capacity projection used by operator surfaces. */
export function loadBucketReserveMetrics(
  scope: BucketScope,
  at = new Date(),
): { totalReserve: number; actionableCapacity: number; blockCounts: BucketReserveBlockCounts } {
  assertFiveBucketEnabled();
  const repository = new SqliteSimulationRepository(
    resolveManualOutreachDatabaseSelection().path,
    {readonly:true,fileMustExist:true},
  );
  try {
    repository.assertRuntimeSchema();
    const state = projectBucketReserve(loadBucketReserveContext(repository, at), scope);
    return {
      totalReserve: state.totalReserve,
      actionableCapacity: state.actionableCapacity,
      blockCounts: state.blockCounts,
    };
  } finally {
    repository.close();
  }
}

/** One canonical datastore projection shared by every recipient scope. */
export function bucketReserveMetricsForScopes(repository: SqliteSimulationRepository, scopes: readonly BucketScope[], at: Date) {
    const context = loadBucketReserveContext(repository, at);
    const projected = scopes.map((scope) => ({ scope, state: projectBucketReserve(context, scope) }));
    const baseProjected = projected.filter(({ scope }) => !scope.earlyCareerOnly);
    const byBucket = Object.fromEntries(baseProjected.map(({ scope, state }) => [scope.bucket, {
      totalReserve: state.totalReserve,
      actionableCapacity: state.actionableCapacity,
      blockCounts: state.blockCounts,
    }])) as Partial<Record<BucketScope["bucket"], { totalReserve: number; actionableCapacity: number; blockCounts: BucketReserveBlockCounts }>>;
    const byScope = Object.fromEntries(projected.map(({ scope, state }) => [`${scope.bucket}${scope.earlyCareerOnly ? ":early-career" : ""}`, { totalReserve: state.totalReserve, actionableCapacity: state.actionableCapacity, blockCounts: state.blockCounts }]));
    const eligibleCompanies = new Set(baseProjected.flatMap(({ state }) => state.eligible.map((candidate) => candidate.strategyCompanyMatch!.companyId)));
    const blockCounts = baseProjected.reduce((all, { state }) => {
      for (const key of Object.keys(all) as Array<keyof BucketReserveBlockCounts>) all[key] += state.blockCounts[key];
      return all;
    }, emptyBlockCounts());
    return { byBucket, byScope, actionableCapacity: eligibleCompanies.size, blockCounts };
}

export function loadBucketReserveMetricsForScopes(scopes: readonly BucketScope[], at = new Date()) {
  assertFiveBucketEnabled();
  const repository = new SqliteSimulationRepository(
    resolveManualOutreachDatabaseSelection().path,
    {readonly:true,fileMustExist:true},
  );
  try {
    repository.assertRuntimeSchema();
    return bucketReserveMetricsForScopes(repository, scopes, at);
  } finally {
    repository.close();
  }
}

/** Compatibility wrapper for callers that only need a yes/no union projection. */
export function hasActionableBucketReserve(scopes: readonly BucketScope[], at = new Date()): boolean {
  return loadBucketReserveMetricsForScopes(scopes, at).actionableCapacity > 0;
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
        blockCounts: reserve.blockCounts,
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

/** Add exactly the operator-selected candidate from the canonical reserve. */
export function createExactCandidateDraftFromRepository(
  repository: SqliteSimulationRepository,
  input: { candidateId: string; requestId: string },
  at: Date,
): DailyRefreshResult {
  assertFiveBucketEnabled();
  if (!input.candidateId) throw new Error("candidate-draft-candidate-required");
  if (!input.requestId) throw new Error("candidate-draft-request-required");
  return repository.transaction(() => {
    const generations = readDraftGenerations(repository.native);
    const prior = generations.find(
      (generation) => generation.addition?.requestId === input.requestId,
    );
    if (prior) {
      if (prior.candidateIds[0] !== input.candidateId)
        throw new Error("candidate-draft-request-conflict");
      return prior;
    }
    const candidate = readCurrentQueueCandidates(repository, {
      includeSecondary: false,
    }).find((row) => row.id === input.candidateId);
    const bucket = candidate?.recipientBucket?.bucket;
    if (
      !candidate ||
      !bucket ||
      candidate.recipientBucket?.reviewState !== "accepted"
    )
      throw new Error("candidate-draft-review-required");
    const scope: BucketScope = { bucket };
    const reserve = bucketReserve(repository, scope, at, {
      requestId: input.requestId,
    });
    const eligible = reserve.eligible.find((row) => row.id === input.candidateId);
    if (!eligible) throw new Error("candidate-draft-unavailable");
    const review = renderQueueReview(
      eligible,
      reserve.active.length,
      at,
      initialResumeSelection(
        eligible.outreachTrack ?? "professional",
        repository,
      ),
    );
    if (!review) throw new Error("candidate-draft-planning-blocked");
    const date = localCampaignDate(at);
    const generation =
      Math.max(
        0,
        ...generations
          .filter((item) => item.campaignDate === date)
          .map((item) => item.generation),
      ) + 1;
    const result: DailyRefreshResult = {
      id: `${date}:${generation}`,
      campaignDate: date,
      generation,
      createdAt: at.toISOString(),
      scope,
      candidateIds: [review.candidateId],
      draftReviews: [review],
      addition: {
        requestId: input.requestId,
        scope,
        additionalDraftCount: 1,
        addedCount: 1,
        activeBefore: reserve.active.length,
        activeAfter: reserve.active.length + 1,
        eligibleReserveRemaining: Math.max(0, reserve.actionableCapacity - 1),
        blockCounts: reserve.blockCounts,
        shortfallCode: null,
      },
      professionalCount: review.outreachTrack === "professional" ? 1 : 0,
      recruiterCount: review.outreachTrack === "recruiter" ? 1 : 0,
      target: 1,
      shortfall: 0,
      reserveCount: reserve.totalReserve,
      providerUsed: false,
      enrichmentAttempts: 0,
      creditBefore: null,
      creditAfter: null,
      warning: null,
    };
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
    const current = readCurrentQueueCandidates(repository, options).find(
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

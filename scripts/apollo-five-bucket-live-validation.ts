import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { ImportedCandidateSnapshot } from "@/application/ingestion";
import { runCandidateRefresh } from "@/infrastructure/sqlite/candidate-refresh";
import { readPersistedApolloDailyAccounting } from "@/infrastructure/sqlite/apollo-accounting";
import { bucketCopyBlockReason, renderQueueReview } from "@/infrastructure/sqlite/draft-queue";
import { SqliteSimulationRepository } from "@/infrastructure/sqlite/database";
import {
  appliedMigrationVersions,
  FIVE_BUCKET_RUNTIME_SCHEMA,
} from "@/infrastructure/sqlite/schema-contract";
import { resolveDatastoreTopology } from "@/infrastructure/sqlite/datastore-topology";
import { SqliteScopedDiscoveryStore } from "@/infrastructure/sqlite/scoped-discovery";
import { ApolloAdapter } from "@/infrastructure/providers/apollo/adapter";
import { readApolloConfig } from "@/infrastructure/providers/apollo/config";
import { FetchApolloTransport } from "@/infrastructure/providers/apollo/http";
import { scopedApolloProviderConfigured } from "@/infrastructure/providers/apollo/scoped-runtime";
import type { ApolloCreditUsage } from "@/infrastructure/providers/apollo/types";
import type { BucketScope, RecipientBucket } from "@/domain/recipient-buckets";

const SESSION_ID = "five-bucket-live-2026-10-04-v1";
const STATE_KEY = `apolloFiveBucketLiveValidation:${SESSION_ID}`;
const PRODUCTION_OPERATIONAL = resolve(
  process.cwd(),
  "data/apollo-operational-scale-enrichment.sqlite",
);
const PRODUCTION_RECRUITER = resolve(
  process.cwd(),
  "data/apollo-recruiter-enrichment.sqlite",
);
const BUCKETS: readonly BucketScope[] = [
  { bucket: "recruiters" },
  { bucket: "peers" },
  { bucket: "managers" },
  { bucket: "executives" },
  { bucket: "ceos" },
];

type SafetyCounts = {
  gmailDraftOperations: number;
  manualOutreachRecords: number;
  outreachEvents: number;
};

type ValidationOutcome = {
  bucket: RecipientBucket;
  requestId: string;
  operationId: string;
  attempts: number;
  observedConsumption: number;
  accountConsumedAfter: number;
  searchedCandidates: number;
  rejectedCandidates: number;
  candidatesAdded: number;
  qualifiedCandidatesAdded: number;
  anomalyCount: number;
};

type ValidationState = {
  version: "five-bucket-live-validation-v1";
  sessionId: typeof SESSION_ID;
  baseline: ApolloCreditUsage;
  safetyCounts: SafetyCounts;
  outcomes: ValidationOutcome[];
  stopped: boolean;
  stopReason?: string;
};

function consumedCredits(usage: ApolloCreditUsage): number {
  if (
    usage.leadCreditsConsumed === null ||
    !Number.isInteger(usage.leadCreditsConsumed) ||
    usage.leadCreditsConsumed < 0
  )
    throw new Error("live-validation-account-usage-unavailable");
  return usage.leadCreditsConsumed;
}

const localDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

function requiredPath(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`live-validation-path-required:${name}`);
  const path = resolve(value);
  if (!existsSync(path)) throw new Error(`live-validation-path-missing:${name}`);
  return path;
}

function configureEnvironment(): { databasePath: string; recruiterPath: string } {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const databasePath = requiredPath("NETWORKPILOT_LIVE_VALIDATION_DATABASE_PATH");
  const recruiterPath = requiredPath(
    "NETWORKPILOT_LIVE_VALIDATION_RECRUITER_DATABASE_PATH",
  );
  if (databasePath === PRODUCTION_OPERATIONAL)
    throw new Error("live-validation-production-operational-path-rejected");
  if (recruiterPath === PRODUCTION_RECRUITER)
    throw new Error("live-validation-production-recruiter-path-rejected");

  process.env.NETWORKPILOT_DATABASE_PATH = databasePath;
  process.env.NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH = databasePath;
  process.env.NETWORKPILOT_RECRUITER_DATABASE_PATH = recruiterPath;
  process.env.NETWORKPILOT_FIVE_BUCKET_ENABLED = "true";
  process.env.NETWORKPILOT_APOLLO_ENABLED = "true";
  process.env.NETWORKPILOT_APOLLO_HARD_STOP = "true";
  process.env.NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_BATCH = "1";
  process.env.NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_DAY = "5";
  process.env.NETWORKPILOT_APOLLO_MAX_RETRIES = "0";
  process.env.NETWORKPILOT_GMAIL_ENABLED = "false";
  return { databasePath, recruiterPath };
}

function tableCount(repository: SqliteSimulationRepository, table: string): number {
  const exists = repository.native
    .prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?")
    .get(table);
  if (!exists) return 0;
  return (
    repository.native.prepare(`SELECT COUNT(*) count FROM ${table}`).get() as {
      count: number;
    }
  ).count;
}

function safetyCounts(repository: SqliteSimulationRepository): SafetyCounts {
  return {
    gmailDraftOperations: tableCount(repository, "gmail_draft_operations"),
    manualOutreachRecords: tableCount(repository, "manual_outreach_records"),
    outreachEvents: tableCount(repository, "outreach_events"),
  };
}

function readState(repository: SqliteSimulationRepository): ValidationState | null {
  const value = repository.getSetting(STATE_KEY);
  return value ? (JSON.parse(value) as ValidationState) : null;
}

function writeState(
  repository: SqliteSimulationRepository,
  state: ValidationState,
  at = new Date(),
): void {
  repository.setSetting(STATE_KEY, JSON.stringify(state), at);
}

function controlledConfig() {
  const config = readApolloConfig(process.env);
  if (
    !config.enabled ||
    !config.apiKey?.trim() ||
    !config.hardStop ||
    config.maxEnrichmentsPerBatch !== 1 ||
    config.maxEnrichmentsPerDay !== 5 ||
    config.maxRetries !== 0 ||
    process.env.NETWORKPILOT_GMAIL_ENABLED !== "false"
  )
    throw new Error("live-validation-controlled-configuration-invalid");
  if (!scopedApolloProviderConfigured(process.env))
    throw new Error("live-validation-scoped-provider-not-configured");
  return config;
}

function policy() {
  return {
    maximumPerBatch: 1,
    maximumPerDay: 5,
    maximumSearchCalls: 5,
    hardStop: true,
  } as const;
}

function assertLocalPreflight(
  repository: SqliteSimulationRepository,
  at: Date,
): Record<RecipientBucket, string> {
  repository.assertRuntimeSchema();
  controlledConfig();
  const store = new SqliteScopedDiscoveryStore(repository);
  const readiness = {} as Record<RecipientBucket, string>;
  for (const scope of BUCKETS) {
    const result = store.preflight({
      requestId: `${SESSION_ID}:${scope.bucket}`,
      scope,
      requested: 1,
      policy: policy(),
      at,
    });
    if (!result.ready)
      throw new Error(
        `live-validation-preflight-failed:${scope.bucket}:${result.reason}:${result.technicalDetail}`,
      );
    readiness[scope.bucket] = "ready";
  }
  return readiness;
}

function creditAdapter(repository: SqliteSimulationRepository): ApolloAdapter {
  return new ApolloAdapter(
    controlledConfig(),
    new FetchApolloTransport(),
    repository,
    {
      now: () => new Date(),
      sleep: async () => {},
      datasetClassification: "authorized-provider",
      localDate,
    },
  );
}

function currentSchemas(repository: SqliteSimulationRepository) {
  const topology = resolveDatastoreTopology();
  const operational = appliedMigrationVersions(repository.native).at(-1) ?? null;
  const recruiter = new SqliteSimulationRepository(topology.recruiterSource.path, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    return {
      operational,
      recruiter: appliedMigrationVersions(recruiter.native).at(-1) ?? null,
    };
  } finally {
    recruiter.close();
  }
}

function sanitizedCandidate(candidate: ImportedCandidateSnapshot | undefined) {
  if (!candidate) return null;
  const evidence = candidate.recipientBucket?.evidence ?? [];
  return {
    recipient: `${candidate.source.person.firstName.slice(0, 1)}*** ${candidate.source.person.lastName.slice(0, 1)}.`,
    title: candidate.source.currentTitle,
    employer: candidate.source.currentOrganization.name,
    employerDomain: candidate.source.currentOrganization.domain ?? null,
    exactProviderIdentity:
      Boolean(candidate.source.providerMetadata?.providerNativeRequestId) &&
      candidate.source.providerMetadata?.providerNativeRequestId ===
        candidate.source.providerMetadata?.providerNativeReturnedId,
    emailVerification: candidate.source.email.verificationStatus,
    emailDomain: candidate.source.email.address.split("@").at(-1) ?? null,
    lifecycle: candidate.state,
    reviewState: candidate.reviewState,
    gateFailures: candidate.gateFailures,
    recipientBucket: candidate.recipientBucket
      ? {
          bucket: candidate.recipientBucket.bucket,
          reviewState: candidate.recipientBucket.reviewState,
          explanationCodes: candidate.recipientBucket.explanationCodes,
          evidenceKinds: evidence.map((item) => ({
            kind: item.kind,
            value: item.value,
            verified: item.verified,
            sourceReference: item.sourceReference,
          })),
        }
      : null,
    companyTrust: candidate.employerTrust ?? null,
    recruiterClassification: candidate.recruiterClassification
      ? {
          accepted: candidate.recruiterClassification.accepted,
          recruiterType: candidate.recruiterClassification.recruiterType,
          explanationCodes:
            candidate.recruiterClassification.explanationCodes,
        }
      : null,
    function: candidate.recipientFunction,
    experience: candidate.experience,
  };
}

function localInspection(
  repository: SqliteSimulationRepository,
  operationId: string,
  expectedScope: BucketScope,
  expectedSafetyCounts: SafetyCounts,
) {
  const parent = repository.native
    .prepare(
      "SELECT state,candidate_count,estimated_max_exposure,observed_consumption,attempt_count,failure_reason,bucket_scope_json FROM provider_operations WHERE id=?",
    )
    .get(operationId) as
    | {
        state: string;
        candidate_count: number;
        estimated_max_exposure: number;
        observed_consumption: number | null;
        attempt_count: number;
        failure_reason: string | null;
        bucket_scope_json: string | null;
      }
    | undefined;
  const event = repository.native
    .prepare("SELECT result_json FROM candidate_refresh_events WHERE id=?")
    .get(operationId) as { result_json: string } | undefined;
  const childRows = repository.native
    .prepare(
      "SELECT state,attempt_count,observed_consumption,bucket_scope_json FROM provider_operations WHERE batch_id=? AND candidate_count=0 ORDER BY id",
    )
    .all(operationId) as Array<{
    state: string;
    attempt_count: number;
    observed_consumption: number | null;
    bucket_scope_json: string | null;
  }>;
  const candidates = repository
    .listImportedCandidates()
    .filter((candidate) => candidate.batchId === operationId)
    .map((candidate) => repository.projectCurrentCompanyTrust(candidate));
  const candidate = candidates[0];
  const draft = candidate ? renderQueueReview(candidate, 0, new Date()) : null;
  const schemas = currentSchemas(repository);
  const currentSafetyCounts = safetyCounts(repository);
  const anomalies: string[] = [];

  if (!parent) anomalies.push("parent-operation-missing");
  if (parent?.state !== "completed") anomalies.push("parent-operation-not-completed");
  if (parent?.candidate_count !== 1 || parent?.estimated_max_exposure !== 1)
    anomalies.push("parent-authorization-bound-invalid");
  if (parent?.bucket_scope_json !== JSON.stringify(expectedScope))
    anomalies.push("parent-scope-persistence-invalid");
  if (!event) anomalies.push("candidate-refresh-event-missing");
  if (candidates.length > 1) anomalies.push("multiple-candidates-imported");
  if (candidate?.recipientBucket?.bucket !== expectedScope.bucket)
    anomalies.push("recipient-bucket-scope-mismatch");
  if (candidate?.gateFailures.includes("discovery-scope-mismatch"))
    anomalies.push("discovery-scope-mismatch");
  if (
    candidate &&
    candidate.source.providerMetadata?.providerNativeRequestId !==
      candidate.source.providerMetadata?.providerNativeReturnedId
  )
    anomalies.push("provider-native-identity-mismatch");
  if (schemas.operational !== FIVE_BUCKET_RUNTIME_SCHEMA)
    anomalies.push("operational-schema-drift");
  if (schemas.recruiter !== "0011_outreach_tracks.sql")
    anomalies.push("recruiter-schema-drift");
  if (JSON.stringify(currentSafetyCounts) !== JSON.stringify(expectedSafetyCounts))
    anomalies.push("communication-state-mutated");

  return {
    parent,
    childRows: childRows.map((row) => ({
      state: row.state,
      attemptCount: row.attempt_count,
      observedConsumption: row.observed_consumption,
      lifecycle: row.bucket_scope_json
        ? (JSON.parse(row.bucket_scope_json) as { lifecycle?: string }).lifecycle ?? null
        : null,
    })),
    eventPersisted: Boolean(event),
    schemas,
    safetyCounts: currentSafetyCounts,
    candidate: sanitizedCandidate(candidate),
    draftPreview: draft
      ? {
          subject: draft.subject,
          body: draft.body,
          wordCount: draft.wordCount,
          resumeDecision: draft.resumeSelection ?? null,
        }
      : null,
    draftBlockReason: candidate
      ? bucketCopyBlockReason(candidate) ??
        (candidate.gateFailures.length
          ? candidate.gateFailures.join(",")
          : candidate.state !== "eligible"
            ? candidate.state
            : "not-renderable")
      : "no-enriched-candidate",
    anomalies,
  };
}

async function preflight(databasePath: string, recruiterPath: string) {
  const repository = new SqliteSimulationRepository(databasePath);
  try {
    const at = new Date();
    const readiness = assertLocalPreflight(repository, at);
    const accounting = readPersistedApolloDailyAccounting(
      repository.native,
      localDate(at),
    );
    if (accounting.effectiveExposure !== 0)
      throw new Error("live-validation-fresh-daily-ledger-required");
    console.log(
      JSON.stringify(
        {
          phase: "preflight",
          sessionId: SESSION_ID,
          databasePath,
          recruiterPath,
          schemas: currentSchemas(repository),
          readiness,
          accounting,
          safetyCounts: safetyCounts(repository),
          productionPathsRejected: true,
          gmailDisabled: process.env.NETWORKPILOT_GMAIL_ENABLED === "false",
          providerCalls: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    repository.close();
  }
}

async function baseline(databasePath: string) {
  const repository = new SqliteSimulationRepository(databasePath);
  try {
    const at = new Date();
    const readiness = assertLocalPreflight(repository, at);
    const existing = readState(repository);
    if (existing) {
      console.log(
        JSON.stringify(
          {
            phase: "baseline",
            sessionId: SESSION_ID,
            replayed: true,
            baseline: existing.baseline,
            readiness,
          },
          null,
          2,
        ),
      );
      return;
    }
    const accounting = readPersistedApolloDailyAccounting(
      repository.native,
      localDate(at),
    );
    if (accounting.effectiveExposure !== 0)
      throw new Error("live-validation-fresh-daily-ledger-required");
    const usage = await creditAdapter(repository).creditUsage();
    consumedCredits(usage);
    const state: ValidationState = {
      version: "five-bucket-live-validation-v1",
      sessionId: SESSION_ID,
      baseline: usage,
      safetyCounts: safetyCounts(repository),
      outcomes: [],
      stopped: false,
    };
    writeState(repository, state, at);
    console.log(
      JSON.stringify(
        {
          phase: "baseline",
          sessionId: SESSION_ID,
          replayed: false,
          baseline: usage,
          readiness,
          localAccounting: accounting,
          nextBucket: BUCKETS[0],
        },
        null,
        2,
      ),
    );
  } finally {
    repository.close();
  }
}

async function validateBucket(databasePath: string, scope: BucketScope) {
  let repository = new SqliteSimulationRepository(databasePath);
  let state = readState(repository);
  if (!state) {
    repository.close();
    throw new Error("live-validation-baseline-required");
  }
  if (state.stopped) {
    repository.close();
    throw new Error(`live-validation-stopped:${state.stopReason ?? "unknown"}`);
  }
  const expected = BUCKETS[state.outcomes.length];
  if (!expected || expected.bucket !== scope.bucket) {
    repository.close();
    throw new Error(
      `live-validation-bucket-order-invalid:expected-${expected?.bucket ?? "complete"}`,
    );
  }
  const priorConsumed =
    state.outcomes.at(-1)?.accountConsumedAfter ??
    consumedCredits(state.baseline);
  const usageBefore = await creditAdapter(repository).creditUsage();
  if (
    usageBefore.cycleStart !== state.baseline.cycleStart ||
    usageBefore.cycleEnd !== state.baseline.cycleEnd ||
    consumedCredits(usageBefore) !== priorConsumed
  ) {
    state = {
      ...state,
      stopped: true,
      stopReason: "apollo-account-usage-changed-outside-validation",
    };
    writeState(repository, state);
    repository.close();
    throw new Error(state.stopReason);
  }
  assertLocalPreflight(repository, new Date());
  repository.close();

  const requestId = `${SESSION_ID}:${scope.bucket}`;
  let result;
  try {
    result = await runCandidateRefresh({
      allowProvider: true,
      scope,
      requestId,
      requested: 1,
    });
  } catch (error) {
    repository = new SqliteSimulationRepository(databasePath);
    state = readState(repository)!;
    const usageAfterFailure = await creditAdapter(repository).creditUsage();
    state = {
      ...state,
      stopped: true,
      stopReason: error instanceof Error ? error.message : "live-validation-bucket-failed",
    };
    writeState(repository, state);
    console.error(
      JSON.stringify(
        {
          phase: "bucket",
          bucket: scope.bucket,
          stopped: true,
          reason: state.stopReason,
          usageBefore,
          usageAfterFailure,
        },
        null,
        2,
      ),
    );
    repository.close();
    process.exitCode = 1;
    return;
  }

  repository = new SqliteSimulationRepository(databasePath);
  state = readState(repository)!;
  const usageAfter = await creditAdapter(repository).creditUsage();
  const inspection = localInspection(
    repository,
    result.id,
    scope,
    state.safetyCounts,
  );
  const consumedBefore = consumedCredits(usageBefore);
  const consumedAfter = consumedCredits(usageAfter);
  const baselineConsumed = consumedCredits(state.baseline);
  const accountDelta = consumedAfter - consumedBefore;
  const observedConsumption = inspection.parent?.observed_consumption;
  const anomalies = [...inspection.anomalies];
  if (!Number.isInteger(result.enrichmentCreditsUsed) || result.enrichmentCreditsUsed > 1)
    anomalies.push("per-bucket-enrichment-cap-exceeded");
  if (inspection.parent?.attempt_count !== result.enrichmentCreditsUsed)
    anomalies.push("parent-attempt-accounting-mismatch");
  if (observedConsumption === null || observedConsumption === undefined)
    anomalies.push("provider-consumption-unknown");
  else if (accountDelta !== observedConsumption)
    anomalies.push("apollo-account-usage-disagreement");
  if (consumedAfter - baselineConsumed > 5)
    anomalies.push("session-account-usage-cap-exceeded");
  const totalAttempts =
    state.outcomes.reduce((sum, outcome) => sum + outcome.attempts, 0) +
    result.enrichmentCreditsUsed;
  if (totalAttempts > 5) anomalies.push("session-enrichment-attempt-cap-exceeded");

  const outcome: ValidationOutcome = {
    bucket: scope.bucket,
    requestId,
    operationId: result.id,
    attempts: result.enrichmentCreditsUsed,
    observedConsumption: observedConsumption ?? -1,
    accountConsumedAfter: consumedAfter,
    searchedCandidates: result.searchedCandidates ?? -1,
    rejectedCandidates: result.rejectedCandidates ?? -1,
    candidatesAdded: result.candidatesAdded,
    qualifiedCandidatesAdded: result.qualifiedCandidatesAdded,
    anomalyCount: anomalies.length,
  };
  state = {
    ...state,
    outcomes: [...state.outcomes, outcome],
    stopped: anomalies.length > 0,
    ...(anomalies.length > 0
      ? { stopReason: anomalies.join(",") }
      : { stopReason: undefined }),
  };
  writeState(repository, state);
  const dailyAccounting = readPersistedApolloDailyAccounting(
    repository.native,
    localDate(new Date()),
  );
  console.log(
    JSON.stringify(
      {
        phase: "bucket",
        sessionId: SESSION_ID,
        bucket: scope.bucket,
        usageBefore,
        usageAfter,
        accountDelta,
        result,
        inspection: { ...inspection, anomalies },
        dailyAccounting,
        sessionAttempts: totalAttempts,
        stopped: state.stopped,
        nextBucket: state.stopped ? null : BUCKETS[state.outcomes.length] ?? null,
      },
      null,
      2,
    ),
  );
  repository.close();
  if (state.stopped) process.exitCode = 1;
}

async function main() {
  const { databasePath, recruiterPath } = configureEnvironment();
  const phase = process.argv[2];
  if (phase === "preflight") return preflight(databasePath, recruiterPath);
  if (phase === "baseline") return baseline(databasePath);
  const scope = BUCKETS.find((item) => item.bucket === phase);
  if (!scope)
    throw new Error(
      "live-validation-phase-required:preflight|baseline|recruiters|peers|managers|executives|ceos",
    );
  return validateBucket(databasePath, scope);
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : "live-validation-failed",
    }),
  );
  process.exitCode = 1;
});

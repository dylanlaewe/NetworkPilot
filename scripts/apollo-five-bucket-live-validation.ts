import { createHash } from "node:crypto";
import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

import type { CandidateRefreshResult } from "@/application/candidate-refresh";
import {
  reservationAccountingMatches,
  stagedAccountUsageAnomalies,
} from "@/application/candidate-refresh/live-validation-accounting";
import type { ImportedCandidateSnapshot } from "@/application/ingestion";
import type { CompanyTrustResolution } from "@/domain/company-trust";
import type { BucketScope, RecipientBucket } from "@/domain/recipient-buckets";
import { ApolloAdapter } from "@/infrastructure/providers/apollo/adapter";
import { readApolloConfig } from "@/infrastructure/providers/apollo/config";
import { FetchApolloTransport } from "@/infrastructure/providers/apollo/http";
import { scopedApolloProviderConfigured } from "@/infrastructure/providers/apollo/scoped-runtime";
import type { ApolloCreditUsage } from "@/infrastructure/providers/apollo/types";
import { readPersistedApolloDailyAccounting } from "@/infrastructure/sqlite/apollo-accounting";
import { runCandidateRefresh } from "@/infrastructure/sqlite/candidate-refresh";
import { SqliteSimulationRepository } from "@/infrastructure/sqlite/database";
import {
  bucketCopyBlockReason,
  renderQueueReview,
} from "@/infrastructure/sqlite/draft-queue";
import {
  appliedMigrationVersions,
  FIVE_BUCKET_RUNTIME_SCHEMA,
} from "@/infrastructure/sqlite/schema-contract";
import { SqliteScopedDiscoveryStore } from "@/infrastructure/sqlite/scoped-discovery";
import { resolveDatastoreTopology } from "@/infrastructure/sqlite/datastore-topology";

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
const COMMUNICATION_TABLES = [
  "drafts",
  "draft_dispositions",
  "draft_disposition_audit",
  "gmail_connection_metadata",
  "gmail_connection_audit",
  "gmail_draft_operations",
  "gmail_send_audit",
  "gmail_send_reconciliations",
  "gmail_send_reconciliation_audit",
  "manual_outreach_records",
  "manual_outreach_audit",
  "outreach_events",
] as const;
const TRUST_OBJECTS = ["company_trust_audit", "company_trust_current"] as const;

type ObjectFingerprint = { exists: boolean; rowCount: number; sha256: string };
type DatastoreSnapshot = Record<string, ObjectFingerprint>;
type ValidationOutcome = {
  bucket: RecipientBucket;
  requestId: string;
  operationId: string;
  attempts: number;
  observedConsumption: number | null;
  accountConsumedAfter: number;
  searchedCandidates: number;
  rejectedCandidates: number;
  candidatesAdded: number;
  qualifiedCandidatesAdded: number;
  anomalyCount: number;
};
type ValidationState = {
  version: "five-bucket-live-validation-v2";
  sessionId: typeof SESSION_ID;
  baseline: ApolloCreditUsage;
  communicationSnapshot: DatastoreSnapshot;
  trustSnapshot: DatastoreSnapshot;
  outcomes: ValidationOutcome[];
  stopped: boolean;
  stopReason?: string;
};
type FileIdentity = { realpath: string; device: number; inode: number };

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

function fileIdentity(path: string): FileIdentity {
  const realpath = realpathSync(path);
  const stat = statSync(realpath);
  if (!stat.isFile()) throw new Error(`live-validation-not-a-file:${path}`);
  return { realpath, device: stat.dev, inode: stat.ino };
}

function sameFile(left: FileIdentity, right: FileIdentity): boolean {
  return (
    left.realpath === right.realpath ||
    (left.device === right.device && left.inode === right.inode)
  );
}

function requiredPath(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`live-validation-path-required:${name}`);
  const path = resolve(value);
  if (!existsSync(path))
    throw new Error(`live-validation-path-missing:${name}`);
  return fileIdentity(path).realpath;
}

function configureEnvironment(): {
  databasePath: string;
  recruiterPath: string;
} {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const databasePath = requiredPath(
    "NETWORKPILOT_LIVE_VALIDATION_DATABASE_PATH",
  );
  const recruiterPath = requiredPath(
    "NETWORKPILOT_LIVE_VALIDATION_RECRUITER_DATABASE_PATH",
  );
  const operationalIdentity = fileIdentity(databasePath);
  const recruiterIdentity = fileIdentity(recruiterPath);
  if (sameFile(operationalIdentity, fileIdentity(PRODUCTION_OPERATIONAL)))
    throw new Error("live-validation-production-operational-file-rejected");
  if (sameFile(recruiterIdentity, fileIdentity(PRODUCTION_RECRUITER)))
    throw new Error("live-validation-production-recruiter-file-rejected");
  if (sameFile(operationalIdentity, recruiterIdentity))
    throw new Error("live-validation-datastore-copies-must-be-distinct");

  process.env.NETWORKPILOT_DATABASE_PATH = databasePath;
  process.env.NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH = databasePath;
  process.env.NETWORKPILOT_RECRUITER_DATABASE_PATH = recruiterPath;
  process.env.NETWORKPILOT_FIVE_BUCKET_ENABLED = "true";
  process.env.NETWORKPILOT_APOLLO_ENABLED = "true";
  process.env.NETWORKPILOT_APOLLO_HARD_STOP = "true";
  process.env.NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_BATCH = "1";
  process.env.NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_DAY = "5";
  process.env.NETWORKPILOT_APOLLO_MAX_RETRIES = "0";
  process.env.NETWORKPILOT_APOLLO_STRICT_PROVIDER_SHAPE = "true";
  process.env.NETWORKPILOT_GMAIL_ENABLED = "false";
  return { databasePath, recruiterPath };
}

function fingerprintObject(
  repository: SqliteSimulationRepository,
  name: string,
): ObjectFingerprint {
  if (!/^[a-z_]+$/.test(name)) throw new Error("snapshot-object-name-invalid");
  const exists = Boolean(
    repository.native
      .prepare(
        "SELECT 1 FROM sqlite_schema WHERE name=? AND type IN ('table','view')",
      )
      .get(name),
  );
  if (!exists)
    return {
      exists: false,
      rowCount: 0,
      sha256: createHash("sha256").update("[]").digest("hex"),
    };
  const rows = repository.native.prepare(`SELECT * FROM "${name}"`).all();
  const serialized = rows.map((row) => JSON.stringify(row)).sort();
  return {
    exists: true,
    rowCount: rows.length,
    sha256: createHash("sha256")
      .update(JSON.stringify(serialized))
      .digest("hex"),
  };
}

function datastoreSnapshot(
  repository: SqliteSimulationRepository,
  names: readonly string[],
): DatastoreSnapshot {
  return Object.fromEntries(
    names.map((name) => [name, fingerprintObject(repository, name)]),
  );
}

function snapshotsEqual(
  left: DatastoreSnapshot,
  right: DatastoreSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readState(
  repository: SqliteSimulationRepository,
): ValidationState | null {
  const value = repository.getSetting(STATE_KEY);
  if (!value) return null;
  const parsed = JSON.parse(value) as ValidationState;
  return {
    ...parsed,
    outcomes: parsed.outcomes.map((outcome) => ({
      ...outcome,
      observedConsumption:
        outcome.observedConsumption === -1
          ? null
          : outcome.observedConsumption,
    })),
  };
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
    process.env.NETWORKPILOT_APOLLO_STRICT_PROVIDER_SHAPE !== "true" ||
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
  const operational =
    appliedMigrationVersions(repository.native).at(-1) ?? null;
  const recruiter = new SqliteSimulationRepository(
    topology.recruiterSource.path,
    { readonly: true, fileMustExist: true },
  );
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
          explanationCodes: candidate.recruiterClassification.explanationCodes,
        }
      : null,
    function: candidate.recipientFunction,
    experience: candidate.experience,
  };
}

function validateAuditedTrust(
  repository: SqliteSimulationRepository,
  trust: CompanyTrustResolution,
  anomalies: string[],
): void {
  if (
    !trust.companyId ||
    !trust.auditEventId ||
    trust.version < 1 ||
    !trust.identityVerified ||
    trust.sourceReference !== trust.auditEventId
  ) {
    anomalies.push("audited-company-trust-shape-invalid");
    return;
  }
  const audit = repository.native
    .prepare(
      "SELECT company_identity_key,resulting_trust_state,resulting_version FROM company_trust_audit WHERE id=?",
    )
    .get(trust.auditEventId) as
    | {
        company_identity_key: string;
        resulting_trust_state: string;
        resulting_version: number;
      }
    | undefined;
  const current = repository.native
    .prepare(
      "SELECT company_identity_key,trust_state,latest_audit_event_id,version FROM company_trust_current WHERE company_identity_key=?",
    )
    .get(trust.companyId) as
    | {
        company_identity_key: string;
        trust_state: string;
        latest_audit_event_id: string;
        version: number;
      }
    | undefined;
  if (
    !audit ||
    audit.company_identity_key !== trust.companyId ||
    audit.resulting_trust_state !== trust.state ||
    audit.resulting_version !== trust.version ||
    !current ||
    current.company_identity_key !== trust.companyId ||
    current.trust_state !== trust.state ||
    current.latest_audit_event_id !== trust.auditEventId ||
    current.version !== trust.version
  )
    anomalies.push("audited-company-trust-persistence-invalid");
}

function validateTrust(
  repository: SqliteSimulationRepository,
  candidate: ImportedCandidateSnapshot,
  anomalies: string[],
): void {
  const trust = candidate.employerTrust;
  if (!trust) {
    anomalies.push("company-trust-resolution-missing");
    return;
  }
  if (
    candidate.recruiterClassification?.accepted === true &&
    trust.state !== "trusted-operating"
  )
    anomalies.push("recruiter-accepted-without-trusted-company");
  if (
    trust.sourceKind === "provider-discovery-default" &&
    trust.state === "trusted-operating"
  )
    anomalies.push("provider-discovery-created-trust");
  if (trust.state === "trusted-operating") {
    if (trust.sourceKind === "authoritative-curated-registry") {
      if (
        trust.version !== 0 ||
        trust.auditEventId !== null ||
        !trust.identityVerified ||
        !trust.sourceReference?.startsWith("curated-company-domain:")
      )
        anomalies.push("curated-company-trust-shape-invalid");
    } else if (trust.sourceKind === "audited-human-review") {
      validateAuditedTrust(repository, trust, anomalies);
    } else anomalies.push("trusted-company-source-invalid");
  } else if (trust.state === "disallowed-recruiting-service") {
    if (trust.sourceKind !== "audited-human-review")
      anomalies.push("disallowed-company-source-invalid");
    else validateAuditedTrust(repository, trust, anomalies);
    if (!candidate.gateFailures.includes("company-trust-disallowed"))
      anomalies.push("disallowed-company-gate-missing");
  } else {
    if (
      !["provider-discovery-default", "identity-unverified"].includes(
        trust.sourceKind,
      ) ||
      trust.auditEventId !== null
    )
      anomalies.push("unverified-company-trust-shape-invalid");
    if (
      trust.sourceKind === "provider-discovery-default" &&
      !trust.identityVerified
    )
      anomalies.push("provider-company-identity-unverified");
    if (
      candidate.outreachTrack === "recruiter" &&
      (!candidate.gateFailures.includes("company-trust-unverified") ||
        candidate.recruiterClassification?.accepted === true)
    )
      anomalies.push("unverified-recruiter-not-failed-closed");
  }
}

function localInspection(
  repository: SqliteSimulationRepository,
  result: CandidateRefreshResult,
  expectedScope: BucketScope,
  expectedCommunication: DatastoreSnapshot,
  expectedTrust: DatastoreSnapshot,
) {
  const parent = repository.native
    .prepare(
      "SELECT state,candidate_count,estimated_max_exposure,observed_consumption,attempt_count,failure_reason,bucket_scope_json FROM provider_operations WHERE id=?",
    )
    .get(result.id) as
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
    .prepare(
      "SELECT created_at_utc,usable_before,target_reserve,provider_cap,search_calls,enrichment_credits_used,candidates_added,qualified_candidates_added,usable_after,professional_candidates_added,recruiter_candidates_added,companies_added,bucket_scope_json,result_json FROM candidate_refresh_events WHERE id=?",
    )
    .get(result.id) as Record<string, string | number | null> | undefined;
  const childRows = repository.native
    .prepare(
      "SELECT id,batch_id,state,attempt_count,observed_consumption,bucket_scope_json FROM provider_operations WHERE batch_id=? AND candidate_count=0 ORDER BY id",
    )
    .all(result.id) as Array<{
    id: string;
    batch_id: string;
    state: string;
    attempt_count: number;
    observed_consumption: number | null;
    bucket_scope_json: string | null;
  }>;
  const candidates = repository
    .listImportedCandidates()
    .filter((candidate) => candidate.batchId === result.id)
    .map((candidate) => repository.projectCurrentCompanyTrust(candidate));
  const candidate = candidates[0];
  const draft = candidate ? renderQueueReview(candidate, 0, new Date()) : null;
  const schemas = currentSchemas(repository);
  const communication = datastoreSnapshot(repository, COMMUNICATION_TABLES);
  const trust = datastoreSnapshot(repository, TRUST_OBJECTS);
  const anomalies: string[] = [];

  if (!parent) anomalies.push("parent-operation-missing");
  if (parent?.state !== "completed")
    anomalies.push("parent-operation-not-completed");
  if (parent?.candidate_count !== 1 || parent?.estimated_max_exposure !== 1)
    anomalies.push("parent-authorization-bound-invalid");
  if (parent?.bucket_scope_json !== JSON.stringify(expectedScope))
    anomalies.push("parent-scope-persistence-invalid");
  if (!event) anomalies.push("candidate-refresh-event-missing");
  if (event) {
    const persistedResult = JSON.parse(
      String(event.result_json),
    ) as CandidateRefreshResult;
    if (JSON.stringify(persistedResult) !== JSON.stringify(result))
      anomalies.push("candidate-refresh-result-persistence-mismatch");
    const scalarPairs: Array<[unknown, unknown]> = [
      [event.created_at_utc, result.createdAt],
      [event.usable_before, result.usableBefore],
      [event.target_reserve, result.target],
      [event.provider_cap, result.providerCap],
      [event.search_calls, result.searchCalls],
      [event.enrichment_credits_used, result.enrichmentCreditsUsed],
      [event.candidates_added, result.candidatesAdded],
      [event.qualified_candidates_added, result.qualifiedCandidatesAdded],
      [event.usable_after, result.usableAfter],
      [event.professional_candidates_added, result.professionalCandidatesAdded],
      [event.recruiter_candidates_added, result.recruiterCandidatesAdded],
      [event.companies_added, result.companiesAdded],
      [event.bucket_scope_json, JSON.stringify(expectedScope)],
    ];
    if (scalarPairs.some(([persisted, returned]) => persisted !== returned))
      anomalies.push("candidate-refresh-event-scalar-mismatch");
  }
  if (candidates.length !== result.candidatesAdded)
    anomalies.push("imported-candidate-count-mismatch");
  if (result.enrichedCandidates !== candidates.length)
    anomalies.push("enriched-candidate-count-mismatch");
  if (candidates.length > 1) anomalies.push("multiple-candidates-imported");
  if (candidate && candidate.recipientBucket?.bucket !== expectedScope.bucket)
    anomalies.push("recipient-bucket-scope-mismatch");
  if (
    candidate &&
    candidate.source.providerMetadata?.providerNativeRequestId !==
      candidate.source.providerMetadata?.providerNativeReturnedId
  )
    anomalies.push("provider-native-identity-mismatch");

  if (result.enrichmentCreditsUsed === 0) {
    if (childRows.length !== 0 || candidates.length !== 0)
      anomalies.push("zero-attempt-persistence-invalid");
  } else if (result.enrichmentCreditsUsed === 1) {
    if (childRows.length !== 1 || !candidate)
      anomalies.push("single-attempt-persistence-invalid");
    const child = childRows[0];
    if (child && candidate) {
      let metadata: Record<string, unknown> | null = null;
      try {
        metadata = child.bucket_scope_json
          ? (JSON.parse(child.bucket_scope_json) as Record<string, unknown>)
          : null;
      } catch {
        anomalies.push("person-reservation-metadata-malformed");
      }
      if (
        child.batch_id !== result.id ||
        child.state !== "completed" ||
        child.attempt_count !== 1 ||
        !reservationAccountingMatches({
          childObservedConsumption: child.observed_consumption,
          metadataObservedConsumption: metadata?.observedConsumption,
          parentObservedConsumption: parent?.observed_consumption,
        }) ||
        metadata?.version !== "apollo-person-reservation-v1" ||
        metadata?.ownerOperationId !== result.id ||
        metadata?.attemptedForOwner !== true ||
        metadata?.lifecycle !== "completed-imported" ||
        metadata?.importedCandidateId !== candidate.id ||
        metadata?.personId !== candidate.source.providerRecordId
      )
        anomalies.push("person-reservation-persistence-invalid");
    }
  } else anomalies.push("per-bucket-enrichment-cap-exceeded");

  if (candidate) validateTrust(repository, candidate, anomalies);
  if (schemas.operational !== FIVE_BUCKET_RUNTIME_SCHEMA)
    anomalies.push("operational-schema-drift");
  if (schemas.recruiter !== "0011_outreach_tracks.sql")
    anomalies.push("recruiter-schema-drift");
  if (!snapshotsEqual(communication, expectedCommunication))
    anomalies.push("communication-state-mutated");
  if (!snapshotsEqual(trust, expectedTrust))
    anomalies.push("company-trust-state-mutated");

  return {
    parent,
    childRows: childRows.map((row) => {
      let metadata: Record<string, unknown> | null = null;
      try {
        metadata = row.bucket_scope_json
          ? (JSON.parse(row.bucket_scope_json) as Record<string, unknown>)
          : null;
      } catch {
        metadata = null;
      }
      return {
        state: row.state,
        attemptCount: row.attempt_count,
        observedConsumption: row.observed_consumption,
        lifecycle: metadata?.lifecycle ?? null,
      };
    }),
    eventPersisted: Boolean(event),
    schemas,
    communicationSnapshot: communication,
    trustSnapshot: trust,
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
      ? (bucketCopyBlockReason(candidate) ??
        (candidate.gateFailures.length
          ? candidate.gateFailures.join(",")
          : candidate.state !== "eligible"
            ? candidate.state
            : "not-renderable"))
      : "no-appropriate-candidate",
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
          communicationSnapshot: datastoreSnapshot(
            repository,
            COMMUNICATION_TABLES,
          ),
          trustSnapshot: datastoreSnapshot(repository, TRUST_OBJECTS),
          productionFileIdentitiesRejected: true,
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
    if (existing?.outcomes.length)
      throw new Error("live-validation-baseline-already-used");
    const accounting = readPersistedApolloDailyAccounting(
      repository.native,
      localDate(at),
    );
    if (accounting.effectiveExposure !== 0)
      throw new Error("live-validation-fresh-daily-ledger-required");
    const usage = await creditAdapter(repository).creditUsage();
    consumedCredits(usage);
    const state: ValidationState = {
      version: "five-bucket-live-validation-v2",
      sessionId: SESSION_ID,
      baseline: usage,
      communicationSnapshot: datastoreSnapshot(
        repository,
        COMMUNICATION_TABLES,
      ),
      trustSnapshot: datastoreSnapshot(repository, TRUST_OBJECTS),
      outcomes: [],
      stopped: false,
    };
    writeState(repository, state, at);
    console.log(
      JSON.stringify(
        {
          phase: "baseline",
          sessionId: SESSION_ID,
          refreshed: Boolean(existing),
          baseline: usage,
          readiness,
          localAccounting: accounting,
          communicationSnapshot: state.communicationSnapshot,
          trustSnapshot: state.trustSnapshot,
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
  if (
    !snapshotsEqual(
      datastoreSnapshot(repository, COMMUNICATION_TABLES),
      state.communicationSnapshot,
    ) ||
    !snapshotsEqual(
      datastoreSnapshot(repository, TRUST_OBJECTS),
      state.trustSnapshot,
    )
  ) {
    repository.close();
    throw new Error("live-validation-protected-state-changed-before-bucket");
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
  let result: CandidateRefreshResult;
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
    const protectedStateChanged =
      !snapshotsEqual(
        datastoreSnapshot(repository, COMMUNICATION_TABLES),
        state.communicationSnapshot,
      ) ||
      !snapshotsEqual(
        datastoreSnapshot(repository, TRUST_OBJECTS),
        state.trustSnapshot,
      );
    state = {
      ...state,
      stopped: true,
      stopReason: `${error instanceof Error ? error.message : "live-validation-bucket-failed"}${protectedStateChanged ? ",protected-state-mutated" : ""}`,
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
    result,
    scope,
    state.communicationSnapshot,
    state.trustSnapshot,
  );
  const consumedBefore = consumedCredits(usageBefore);
  const consumedAfter = consumedCredits(usageAfter);
  const baselineConsumed = consumedCredits(state.baseline);
  const accountDelta = consumedAfter - consumedBefore;
  const observedConsumption = inspection.parent?.observed_consumption;
  const anomalies = [...inspection.anomalies];
  if (
    !Number.isInteger(result.enrichmentCreditsUsed) ||
    result.enrichmentCreditsUsed > 1
  )
    anomalies.push("per-bucket-enrichment-cap-exceeded");
  if (inspection.parent?.attempt_count !== result.enrichmentCreditsUsed)
    anomalies.push("parent-attempt-accounting-mismatch");
  anomalies.push(
    ...stagedAccountUsageAnomalies({
      authorizedAttempts: result.enrichmentCreditsUsed,
      observedConsumption,
      accountUsageDelta: accountDelta,
    }),
  );
  if (consumedAfter - baselineConsumed > 5)
    anomalies.push("session-account-usage-cap-exceeded");
  const totalAttempts =
    state.outcomes.reduce((sum, outcome) => sum + outcome.attempts, 0) +
    result.enrichmentCreditsUsed;
  if (totalAttempts > 5)
    anomalies.push("session-enrichment-attempt-cap-exceeded");

  const outcome: ValidationOutcome = {
    bucket: scope.bucket,
    requestId,
    operationId: result.id,
    attempts: result.enrichmentCreditsUsed,
    observedConsumption: observedConsumption ?? null,
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
        nextBucket: state.stopped
          ? null
          : (BUCKETS[state.outcomes.length] ?? null),
      },
      null,
      2,
    ),
  );
  repository.close();
  if (state.stopped) process.exitCode = 1;
}

async function reassessStoppedSession(databasePath: string) {
  const repository = new SqliteSimulationRepository(databasePath);
  try {
    const state = readState(repository);
    if (!state?.outcomes.length)
      throw new Error("live-validation-outcome-required-for-reassessment");
    const anomalies: string[] = [];
    if (
      !snapshotsEqual(
        datastoreSnapshot(repository, COMMUNICATION_TABLES),
        state.communicationSnapshot,
      ) ||
      !snapshotsEqual(
        datastoreSnapshot(repository, TRUST_OBJECTS),
        state.trustSnapshot,
      )
    )
      anomalies.push("protected-state-changed-before-reassessment");

    let previousAccountConsumption = consumedCredits(state.baseline);
    let sessionAttempts = 0;
    const outcomes = state.outcomes.map((outcome) => {
      const scope = BUCKETS.find((item) => item.bucket === outcome.bucket);
      const event = repository.native
        .prepare("SELECT result_json FROM candidate_refresh_events WHERE id=?")
        .get(outcome.operationId) as { result_json: string } | undefined;
      if (!scope || !event) {
        anomalies.push(`${outcome.bucket}:reassessment-evidence-missing`);
        previousAccountConsumption = outcome.accountConsumedAfter;
        sessionAttempts += outcome.attempts;
        return { ...outcome, anomalyCount: 1 };
      }
      const result = JSON.parse(event.result_json) as CandidateRefreshResult;
      const inspection = localInspection(
        repository,
        result,
        scope,
        state.communicationSnapshot,
        state.trustSnapshot,
      );
      const bucketAnomalies = [...inspection.anomalies];
      if (
        !Number.isInteger(result.enrichmentCreditsUsed) ||
        result.enrichmentCreditsUsed > 1
      )
        bucketAnomalies.push("per-bucket-enrichment-cap-exceeded");
      if (inspection.parent?.attempt_count !== result.enrichmentCreditsUsed)
        bucketAnomalies.push("parent-attempt-accounting-mismatch");
      bucketAnomalies.push(
        ...stagedAccountUsageAnomalies({
          authorizedAttempts: result.enrichmentCreditsUsed,
          observedConsumption: inspection.parent?.observed_consumption,
          accountUsageDelta:
            outcome.accountConsumedAfter - previousAccountConsumption,
        }),
      );
      previousAccountConsumption = outcome.accountConsumedAfter;
      sessionAttempts += result.enrichmentCreditsUsed;
      if (sessionAttempts > 5)
        bucketAnomalies.push("session-enrichment-attempt-cap-exceeded");
      anomalies.push(
        ...bucketAnomalies.map((anomaly) => `${outcome.bucket}:${anomaly}`),
      );
      return {
        ...outcome,
        attempts: result.enrichmentCreditsUsed,
        observedConsumption: inspection.parent?.observed_consumption ?? null,
        anomalyCount: bucketAnomalies.length,
      };
    });
    if (previousAccountConsumption - consumedCredits(state.baseline) > 5)
      anomalies.push("session-account-usage-cap-exceeded");
    const reassessed: ValidationState = {
      ...state,
      outcomes,
      stopped: anomalies.length > 0,
      ...(anomalies.length
        ? { stopReason: anomalies.join(",") }
        : { stopReason: undefined }),
    };
    writeState(repository, reassessed);
    console.log(
      JSON.stringify(
        {
          phase: "reassess",
          sessionId: SESSION_ID,
          providerCalls: 0,
          gmailCalls: 0,
          outcomes,
          anomalies,
          stopped: reassessed.stopped,
          nextBucket: reassessed.stopped
            ? null
            : (BUCKETS[reassessed.outcomes.length] ?? null),
        },
        null,
        2,
      ),
    );
    if (reassessed.stopped) process.exitCode = 1;
  } finally {
    repository.close();
  }
}

async function main() {
  const { databasePath, recruiterPath } = configureEnvironment();
  const phase = process.argv[2];
  if (phase === "preflight") return preflight(databasePath, recruiterPath);
  if (phase === "baseline") return baseline(databasePath);
  if (phase === "reassess") return reassessStoppedSession(databasePath);
  const scope = BUCKETS.find((item) => item.bucket === phase);
  if (!scope)
    throw new Error(
      "live-validation-phase-required:preflight|baseline|reassess|recruiters|peers|managers|executives|ceos",
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

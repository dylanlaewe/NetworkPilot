import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshScopedCandidateReserve, ScopedDiscoveryProviderFailure, type ScopedDiscoveryProvider } from "@/application/candidate-refresh/scoped";
import { bucketFixture, FIXTURE_AT, fixtureEvidence } from "@/domain/recipient-buckets/test-fixtures";
import type { BucketScope, RecipientBucket } from "@/domain/recipient-buckets";
import { SqliteSimulationRepository } from "./database";
import { migrateTestDatabase } from "./test-migrations";
import { SqliteScopedDiscoveryStore } from "./scoped-discovery";
import {
  resolveDatastoreTopology,
  type NetworkPilotDatastoreTopology,
} from "./datastore-topology";

const directories: string[] = [];

beforeEach(() => vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true"));
afterEach(() => {
  directories.splice(0).forEach((path) =>
    rmSync(path, { recursive: true, force: true }),
  );
  vi.unstubAllEnvs();
});

function migrationsThrough(directory: string, maximum: string): string {
  const target = join(directory, `migrations-${maximum.slice(0, 4)}`);
  mkdirSync(target);
  for (const name of readdirSync("migrations").filter(
    (name) => name.endsWith(".sql") && name <= maximum,
  ))
    copyFileSync(join("migrations", name), join(target, name));
  return target;
}

function setup(input: { canonicalVersion?: string; sourceVersion?: string } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "networkpilot-topology-"));
  directories.push(directory);
  const canonicalPath = join(directory, "canonical.sqlite"),
    sourcePath = join(directory, "recruiter-source.sqlite"),
    canonical = new SqliteSimulationRepository(canonicalPath),
    source = new SqliteSimulationRepository(sourcePath);
  migrateTestDatabase(
    canonical,
    input.canonicalVersion
      ? migrationsThrough(directory, input.canonicalVersion)
      : undefined,
  );
  migrateTestDatabase(
    source,
    migrationsThrough(
      directory,
      input.sourceVersion ?? "0011_outreach_tracks.sql",
    ),
  );
  source.close();
  const base = resolveDatastoreTopology({}, directory),
    topology: NetworkPilotDatastoreTopology = {
      ...base,
      canonical: { ...base.canonical, path: canonicalPath },
      recruiterSource: { ...base.recruiterSource, path: sourcePath },
    };
  return { canonical, canonicalPath, sourcePath, topology };
}

const policy = {
  maximumPerBatch: 5,
  maximumPerDay: 20,
  maximumSearchCalls: 5,
  hardStop: true,
};

function providerFor(
  records: ReturnType<typeof bucketFixture>["source"][],
){
  return {
    preflight: vi.fn(),
    discover: vi.fn(async () => ({
      records,
      searchedCandidates: records.length,
      rejectedCandidates: 0,
      enrichmentAttempts: records.length,
      searchCalls: 1,
      observedCredits: records.length,
    })),
  };
}

async function run(
  repository: SqliteSimulationRepository,
  topology: NetworkPilotDatastoreTopology,
  requestId: string,
  scope: BucketScope,
  provider: ScopedDiscoveryProvider,
  requested = 1,
) {
  return refreshScopedCandidateReserve({
    requestId,
    scope,
    requested,
    usableBefore: 0,
    policy,
    store: new SqliteScopedDiscoveryStore(repository, {
      companies: [],
      topology,
    }),
    provider,
    allowProvider: true,
    now: () => FIXTURE_AT,
  });
}

describe("role-aware five-bucket datastore preflight", () => {
  it("completes all five buckets with canonical 0022 and recruiter source 0011", async () => {
    const { canonical, sourcePath, topology } = setup();
    const buckets = [
      "recruiters",
      "peers",
      "managers",
      "executives",
      "ceos",
    ] as const;
    const companies = buckets.map((bucket, index) =>
      bucketFixture(bucket, index + 1, bucket === "peers"),
    );
    const store = new SqliteScopedDiscoveryStore(canonical, {
      companies: companies.map((item) => item.company),
      companyDomains: Object.fromEntries(
        companies.map((item) => [
          item.company.id,
          item.source.currentOrganization.domain!,
        ]),
      ),
      topology,
    });
    for (const [index, bucket] of buckets.entries()) {
      const provider = providerFor([companies[index].source]);
      const result = await refreshScopedCandidateReserve({
        requestId: `offline-five-bucket-${bucket}`,
        scope: { bucket },
        requested: 1,
        usableBefore: 0,
        policy,
        store,
        provider,
        allowProvider: true,
        now: () => FIXTURE_AT,
      });
      expect(result).toMatchObject({
        scope: { bucket },
        candidatesAdded: 1,
        qualifiedCandidatesAdded: bucket==="recruiters"?0:1,
        remainingActionableCapacity: bucket==="recruiters"?0:1,
      });
      expect(provider.preflight).toHaveBeenCalledOnce();
      expect(provider.discover).toHaveBeenCalledOnce();
    }
    expect(
      canonical.native
        .prepare("SELECT COUNT(*) count FROM candidate_refresh_events")
        .get(),
    ).toEqual({ count: 5 });
    expect(
      canonical.listImportedCandidates().map((item) => item.recipientBucket?.bucket),
    ).toEqual(buckets);
    const source = new SqliteSimulationRepository(sourcePath, {
      readonly: true,
      fileMustExist: true,
    });
    expect(
      source.native
        .prepare("SELECT MAX(version) version FROM schema_migrations")
        .get(),
    ).toEqual({ version: "0011_outreach_tracks.sql" });
    expect(
      source.native
        .prepare("PRAGMA table_info(imported_candidates)")
        .all()
        .some((column) =>
          (column as { name: string }).name === "recipient_bucket_json",
        ),
    ).toBe(false);
    source.close();
    canonical.close();
  });

  it("blocks pre-0021 canonical state before provider readiness or discovery", async () => {
    const { canonical, topology } = setup({
      canonicalVersion: "0020_resume_library.sql",
    });
    const provider = providerFor([bucketFixture("peers", 1).source]);
    await expect(
      run(canonical, topology, "blocked-canonical-schema", { bucket: "peers" }, provider),
    ).rejects.toThrow("canonical-schema-required");
    expect(provider.preflight).not.toHaveBeenCalled();
    expect(provider.discover).not.toHaveBeenCalled();
    expect(canonical.getApolloProviderStatus("2026-09-22").attempted).toBe(0);
    canonical.close();
  });

  it("accepts source schema 0011 but blocks an invalid recruiter source before calls", async () => {
    const ready = setup();
    const store = new SqliteScopedDiscoveryStore(ready.canonical, {
      companies: [bucketFixture("recruiters", 1).company],
      topology: ready.topology,
    });
    expect(
      store.preflight({
        requestId: "source-schema-ready",
        scope: { bucket: "recruiters" },
        requested: 1,
        policy,
        at: FIXTURE_AT,
      }),
    ).toMatchObject({ ready: true });
    ready.canonical.close();

    const blocked = setup({ sourceVersion: "0010_manual_hard_bounce.sql" }),
      blockedProvider = providerFor([bucketFixture("recruiters", 2).source]);
    await expect(
      run(blocked.canonical, blocked.topology, "blocked-source-schema", { bucket: "recruiters" }, blockedProvider),
    ).rejects.toThrow("recruiter-evidence-schema-invalid");
    expect(blockedProvider.preflight).not.toHaveBeenCalled();
    expect(blockedProvider.discover).not.toHaveBeenCalled();
    blocked.canonical.close();
  });

  it("rejects a source-role descriptor used as canonical before provider calls", async () => {
    const fixture = setup(), provider = providerFor([bucketFixture("peers", 1).source]);
    const invalidTopology = {
      ...fixture.topology,
      canonical: fixture.topology.recruiterSource,
    };
    await expect(
      run(fixture.canonical, invalidTopology, "wrong-canonical-role", { bucket: "peers" }, provider),
    ).rejects.toThrow("datastore-topology-invalid");
    expect(provider.discover).not.toHaveBeenCalled();
    fixture.canonical.close();
  });

  it("binds a canonical descriptor to the actual opened database path", async () => {
    const declared = setup(), opened = setup(), provider = providerFor([bucketFixture("peers", 1).source]);
    await expect(
      run(opened.canonical, declared.topology, "wrong-canonical-handle", { bucket: "peers" }, provider),
    ).rejects.toThrow("datastore-topology-invalid");
    expect(provider.preflight).not.toHaveBeenCalled();
    expect(provider.discover).not.toHaveBeenCalled();
    declared.canonical.close();
    opened.canonical.close();
  });

  it("persists truthful accounting for provider and local completion failures", async () => {
    const first = setup(), providerFailure: ScopedDiscoveryProvider = {
      preflight: vi.fn(),
      discover: vi.fn(async () => {
        throw new ScopedDiscoveryProviderFailure("provider-partial-failure", {
          attempts: 2,
          observedCredits: 2,
        });
      }),
    };
    await expect(
      run(first.canonical, first.topology, "provider-partial-failure", { bucket: "peers" }, providerFailure),
    ).rejects.toThrow("provider-partial-failure");
    expect(
      first.canonical.native
        .prepare("SELECT state,attempt_count,observed_consumption FROM provider_operations")
        .get(),
    ).toEqual({ state: "failed", attempt_count: 2, observed_consumption: 2 });
    expect(first.canonical.getApolloProviderStatus("2026-09-22")).toMatchObject({ observedConsumption: 2 });
    first.canonical.close();

    const second = setup(), peer = bucketFixture("peers", 5), manager = bucketFixture("managers", 6);
    manager.source.sourceProviderId = "different-fixture-provider";
    const localFailure = providerFor([peer.source, manager.source]);
    await expect(
      run(second.canonical, second.topology, "local-completion-failure", { bucket: "peers" }, localFailure, 2),
    ).rejects.toThrow("scoped-refresh-source-conflict");
    expect(
      second.canonical.native
        .prepare("SELECT state,attempt_count,observed_consumption FROM provider_operations")
        .get(),
    ).toEqual({ state: "failed", attempt_count: 2, observed_consumption: 2 });
    expect(second.canonical.listImportedCandidates()).toEqual([]);
    second.canonical.close();
  });

  it("claims against a fresh clock after preflight and attributes completion to that authorization day", async () => {
    const fixture = setup(), peer = bucketFixture("peers", 40), provider = providerFor([peer.source]), beforeMidnight = new Date("2026-09-22T23:59:59-04:00"), afterMidnight = new Date("2026-09-23T00:00:01-04:00"), times = [beforeMidnight, afterMidnight, afterMidnight, afterMidnight];
    await refreshScopedCandidateReserve({
      requestId: "cross-midnight-accounting",
      scope: { bucket: "peers" },
      requested: 1,
      usableBefore: 0,
      policy,
      store: new SqliteScopedDiscoveryStore(fixture.canonical, {
        companies: [peer.company],
        companyDomains: { [peer.company.id]: peer.source.currentOrganization.domain! },
        topology: fixture.topology,
      }),
      provider,
      allowProvider: true,
      now: () => times.shift() ?? afterMidnight,
    });
    expect(fixture.canonical.getApolloProviderStatus("2026-09-22").observedConsumption).toBeNull();
    expect(fixture.canonical.getApolloProviderStatus("2026-09-23").observedConsumption).toBe(1);
    fixture.canonical.close();
  });

  it("uses truthful provider overspend as the next authorization baseline", async () => {
    const fixture = setup(), peer = bucketFixture("peers", 41), provider: ScopedDiscoveryProvider = {
      preflight: vi.fn(),
      discover: vi.fn(async () => ({
        records: [peer.source],
        searchedCandidates: 6,
        rejectedCandidates: 5,
        enrichmentAttempts: 6,
        searchCalls: 1,
        observedCredits: 6,
      })),
    };
    fixture.canonical.authorizeApolloOperation({
      operationId: "unknown-consumption-hold",
      batchId: "unknown-consumption-hold",
      localDate: "2026-09-22",
      candidateCount: 10,
      estimatedMaxExposure: 10,
      maximumPerBatch: 20,
      maximumPerDay: 20,
      hardStop: true,
      at: FIXTURE_AT,
    });
    await expect(
      run(fixture.canonical, fixture.topology, "reported-provider-overspend", { bucket: "peers" }, provider, 2),
    ).rejects.toThrow("scoped-refresh-provider-cap-exceeded");
    expect(fixture.canonical.getApolloProviderStatus("2026-09-22")).toMatchObject({
      estimatedExposure: 16,
      observedConsumption: 6,
    });
    const failedOperation = fixture.canonical.native
      .prepare(
        "SELECT id FROM provider_operations WHERE bucket_scope_json IS NOT NULL",
      )
      .get() as { id: string };
    new SqliteScopedDiscoveryStore(fixture.canonical, {
      topology: fixture.topology,
    }).fail(failedOperation.id, "repeated-reconciliation", {
      attempts: 1,
      observedCredits: null,
      at: FIXTURE_AT,
    });
    expect(fixture.canonical.getApolloProviderStatus("2026-09-22")).toMatchObject({
      estimatedExposure: 16,
      observedConsumption: 6,
    });
    new SqliteScopedDiscoveryStore(fixture.canonical, {
      topology: fixture.topology,
    }).fail(failedOperation.id, "lower-reconciliation", {
      attempts: 2,
      observedCredits: 3,
      at: FIXTURE_AT,
    });
    expect(fixture.canonical.getApolloProviderStatus("2026-09-22")).toMatchObject({
      estimatedExposure: 16,
      observedConsumption: 6,
    });
    const next = providerFor([]);
    await refreshScopedCandidateReserve({
      requestId: "post-overspend-cap",
      scope: { bucket: "peers" },
      requested: 20,
      usableBefore: 0,
      policy: { ...policy, maximumPerBatch: 20 },
      store: new SqliteScopedDiscoveryStore(fixture.canonical, {
        topology: fixture.topology,
      }),
      provider: next,
      allowProvider: true,
      now: () => FIXTURE_AT,
    });
    expect(next.discover).toHaveBeenCalledWith(expect.objectContaining({ maximum: 4 }));
    fixture.canonical.close();
  });

  it("retains excess scoped attempts when exact provider consumption is unknown", async () => {
    const fixture = setup(), provider: ScopedDiscoveryProvider = {
      preflight: vi.fn(),
      discover: vi.fn(async () => {
        throw new ScopedDiscoveryProviderFailure("provider-usage-unavailable", {
          attempts: 6,
          observedCredits: null,
        });
      }),
    };
    await expect(
      run(fixture.canonical, fixture.topology, "unknown-provider-overage", { bucket: "peers" }, provider, 2),
    ).rejects.toThrow("provider-usage-unavailable");
    expect(fixture.canonical.getApolloProviderStatus("2026-09-22")).toMatchObject({
      estimatedExposure: 6,
      observedConsumption: null,
    });
    fixture.canonical.close();
  });

  it("rejects negative observed credits without persisting invalid consumption", async () => {
    const fixture = setup(), provider: ScopedDiscoveryProvider = {
      preflight: vi.fn(),
      discover: vi.fn(async () => ({
        records: [],
        searchedCandidates: 1,
        rejectedCandidates: 1,
        enrichmentAttempts: 1,
        searchCalls: 1,
        observedCredits: -1,
      })),
    };
    await expect(
      run(fixture.canonical, fixture.topology, "negative-provider-observation", { bucket: "peers" }, provider),
    ).rejects.toThrow("scoped-refresh-credit-model-exceeded");
    expect(
      fixture.canonical.native
        .prepare("SELECT state,observed_consumption FROM provider_operations")
        .get(),
    ).toEqual({ state: "failed", observed_consumption: null });
    expect(fixture.canonical.getApolloProviderStatus("2026-09-22")).toMatchObject({
      estimatedExposure: 1,
      observedConsumption: null,
    });
    fixture.canonical.close();
  });

  it("records a truthful zero-attempt provider completion", async () => {
    const fixture = setup(), provider = providerFor([]);
    await run(
      fixture.canonical,
      fixture.topology,
      "zero-attempt-provider-result",
      { bucket: "peers" },
      provider,
    );
    expect(
      fixture.canonical.native
        .prepare(
          "SELECT state,attempt_count,observed_consumption FROM provider_operations",
        )
        .get(),
    ).toEqual({ state: "completed", attempt_count: 0, observed_consumption: 0 });
    fixture.canonical.close();
  });

  it("enforces the externally consumed 20-credit validation hold", async () => {
    const fixture = setup(), provider = providerFor([bucketFixture("peers", 1).source]), incidentAt = new Date("2026-09-27T16:00:00-04:00");
    await expect(
      refreshScopedCandidateReserve({
        requestId: "external-spend-hold",
        scope: { bucket: "peers" },
        requested: 1,
        usableBefore: 0,
        policy,
        store: new SqliteScopedDiscoveryStore(fixture.canonical, { topology: fixture.topology }),
        provider,
        allowProvider: true,
        now: () => incidentAt,
      }),
    ).rejects.toThrow("provider-budget-unavailable");
    expect(provider.preflight).not.toHaveBeenCalled();
    expect(provider.discover).not.toHaveBeenCalled();
    fixture.canonical.close();
  });
});

describe("offline classification safety through scoped orchestration", () => {
  async function classify(
    bucket: RecipientBucket,
    ordinal: number,
    mutate?: (fixture: ReturnType<typeof bucketFixture>) => void,
    early = false,
  ) {
    const fixture = setup(), candidate = bucketFixture(bucket, ordinal, early);
    mutate?.(candidate);
    const store = new SqliteScopedDiscoveryStore(fixture.canonical, {
      companies: [candidate.company],
      companyDomains: { [candidate.company.id]: candidate.source.currentOrganization.domain! },
      topology: fixture.topology,
    });
    const result = await refreshScopedCandidateReserve({
      requestId: `classification-${bucket}-${ordinal}`,
      scope: { bucket, ...(early ? { earlyCareerOnly: true } : {}) },
      requested: 1,
      usableBefore: 0,
      policy,
      store,
      provider: providerFor([candidate.source]),
      allowProvider: true,
      now: () => FIXTURE_AT,
    });
    const saved = fixture.canonical.listImportedCandidates()[0];
    fixture.canonical.close();
    return { result, saved };
  }

  it("keeps leadership evidence fail-closed", async () => {
    expect((await classify("managers", 20)).saved.recipientBucket).toMatchObject({ bucket: "managers", reviewState: "accepted" });
    const titleOnly = await classify("managers", 21, (fixture) => {
      fixture.source.responsibilityEvidence = fixture.source.responsibilityEvidence?.filter((item) => item.kind !== "team-leadership");
    });
    expect(titleOnly.saved).toMatchObject({ state: "review-required", recipientBucket: { bucket: null, reviewState: "review-required" } });
    expect(titleOnly.result.qualifiedCandidatesAdded).toBe(0);
    const contradicted = await classify("managers", 22, (fixture) => {
      fixture.source.responsibilityEvidence = fixture.source.responsibilityEvidence?.filter((item) => item.kind !== "team-leadership").concat(fixtureEvidence("individual-contributor"));
    });
    expect(contradicted.saved.recipientBucket).toMatchObject({ bucket: "peers" });
    expect(contradicted.result.qualifiedCandidatesAdded).toBe(0);
  });

  it("keeps provider-only recruiters unverified and preserves early-career peer policy", async () => {
    const internal = await classify("recruiters", 30,(fixture)=>{fixture.source.currentTitle="Technical Recruiter";});
    expect(internal.saved).toMatchObject({ state: "review-required", employerTrust:{state:"unverified"},recipientBucket: { bucket: "recruiters", reviewState: "review-required" },gateFailures:expect.arrayContaining(["company-trust-unverified"]) });
    expect(internal.saved.recruiterClassification).toMatchObject({ internalStatus: "ambiguous", accepted: false });
    const agency = await classify("recruiters", 31, (fixture) => {
      fixture.source.responsibilityEvidence = fixture.source.responsibilityEvidence?.filter((item) => item.kind !== "internal-recruiting");
    });
    expect(agency.result.qualifiedCandidatesAdded).toBe(0);
    expect(["review-required", "rejected"]).toContain(agency.saved.state);
    const early = await classify("peers", 32, undefined, true), experienced = await classify("peers", 33);
    expect(early.saved).toMatchObject({ state: "eligible", recipientBucket: { earlyCareer: true } });
    expect(experienced.saved).toMatchObject({ state: "eligible", recipientBucket: { bucket: "peers" } });
    const unrelated = await classify("peers", 34, (fixture) => {
      fixture.source.currentTitle = "Warehouse Assistant";
      fixture.source.responsibilityEvidence = fixture.source.responsibilityEvidence?.filter((item) => item.kind !== "relevant-function");
    }, true);
    expect(unrelated.result.qualifiedCandidatesAdded).toBe(0);
    expect(unrelated.saved.gateFailures.some((reason) => reason.startsWith("recipient-function-"))).toBe(true);
  });
});

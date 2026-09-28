import {migrateTestDatabase} from "@/infrastructure/sqlite/test-migrations";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteSimulationRepository } from "./database";
import { SqliteScopedDiscoveryStore } from "./scoped-discovery";
import { refreshScopedCandidateReserve, type ScopedDiscoveryProvider } from "@/application/candidate-refresh/scoped";
import { bucketFixture, FIXTURE_AT } from "@/domain/recipient-buckets/test-fixtures";
import type { BucketScope } from "@/domain/recipient-buckets";
import { resolveDatastoreTopology } from "./datastore-topology";

const repos: SqliteSimulationRepository[] = [];
beforeEach(() => vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true"));
const directories: string[] = [];
afterEach(() => { repos.splice(0).forEach(r => r.close()); directories.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })); vi.unstubAllEnvs(); });
function sourceTopology() {
  const directory = mkdtempSync(join(tmpdir(), "networkpilot-source-role-")), migrations = join(directory, "migrations"), databasePath = join(directory, "recruiter-source.sqlite");
  directories.push(directory); mkdirSync(migrations);
  for (const name of readdirSync("migrations").filter(name => name.endsWith(".sql") && name <= "0011_outreach_tracks.sql")) copyFileSync(join("migrations", name), join(migrations, name));
  const source = new SqliteSimulationRepository(databasePath); migrateTestDatabase(source, migrations); source.close();
  const topology = resolveDatastoreTopology({}, directory);
  return { ...topology, canonical: { ...topology.canonical, path: ":memory:" }, recruiterSource: { ...topology.recruiterSource, path: databasePath } };
}
function setup() {
  const repository = new SqliteSimulationRepository(":memory:"); repos.push(repository); migrateTestDatabase(repository);
  const recruiter = bucketFixture("recruiters", 1), peer = bucketFixture("peers", 2, true);
  const store = new SqliteScopedDiscoveryStore(repository, { companies: [recruiter.company, peer.company], companyDomains: { [recruiter.company.id]: recruiter.source.currentOrganization.domain!, [peer.company.id]: peer.source.currentOrganization.domain! }, topology: sourceTopology() });
  const policy = { maximumPerBatch: 5, maximumPerDay: 7, maximumSearchCalls: 2, hardStop: true };
  const run = (requestId: string, scope: BucketScope, provider?: ScopedDiscoveryProvider) => refreshScopedCandidateReserve({ requestId, scope, provider, store, requested: 5, usableBefore: 0, policy, allowProvider: true, now: () => FIXTURE_AT });
  return { repository, recruiter, peer, store, policy, run };
}

describe("scoped discovery through existing persisted provider accounting", () => {
  it("preserves request scope, reports a partial result and cannot reset allowance by switching buckets", async () => {
    const { repository, recruiter, peer, run } = setup();
    const discover = vi.fn<ScopedDiscoveryProvider["discover"]>(async input => ({ records: [input.scope.bucket === "recruiters" ? recruiter.source : peer.source], searchedCandidates: 3, rejectedCandidates: 2, enrichmentAttempts: 1, searchCalls: 1, observedCredits: 1 }));
    const provider = { preflight: vi.fn(), discover };
    const first = await run("fictional-request-one", { bucket: "recruiters" }, provider);
    expect(first).toMatchObject({ requested: 5, searchedCandidates: 3, enrichedCandidates: 1, qualifiedCandidatesAdded: 1, added: 1, rejectedCandidates: 2, shortfallCode: "scoped-supply-shortfall", remainingActionableCapacity: 1 });
    expect(discover.mock.calls[0][0]).toMatchObject({ scope: { bucket: "recruiters" }, maximum: 5 });
    const second = await run("fictional-request-two", { bucket: "peers", earlyCareerOnly: true }, provider);
    expect(second.providerCap).toBe(2);
    expect(discover.mock.calls[1][0]).toMatchObject({ scope: { bucket: "peers", earlyCareerOnly: true }, maximum: 2 });
    expect(repository.getApolloProviderStatus("2026-09-22").estimatedExposure).toBe(7);
    await expect(run("fictional-request-three", { bucket: "ceos" }, provider)).rejects.toThrow("provider-budget-unavailable");
    expect(discover).toHaveBeenCalledTimes(2);
    expect(await run("fictional-request-one", { bucket: "recruiters" }, provider)).toEqual(first);
    expect(discover).toHaveBeenCalledTimes(2);
    await expect(run("fictional-request-one", { bucket: "peers" }, provider)).rejects.toThrow("scoped-refresh-request-conflict");
  });
  it("reserves once and refuses duplicate pending work", async () => {
    const { repository, recruiter, run } = setup();
    let finish!: (value: Awaited<ReturnType<ScopedDiscoveryProvider["discover"]>>) => void;
    const discover = vi.fn<ScopedDiscoveryProvider["discover"]>(() => new Promise(resolve => { finish = resolve; }));
    const provider = { preflight: vi.fn(), discover };
    const pending = run("fictional-pending-request", { bucket: "recruiters" }, provider);
    await vi.waitFor(() => expect(repository.getApolloProviderStatus("2026-09-22").estimatedExposure).toBe(5));
    await expect(run("fictional-pending-request", { bucket: "recruiters" }, provider)).rejects.toThrow("scoped-refresh-in-progress");
    expect(discover).toHaveBeenCalledTimes(1);
    finish({ records: [recruiter.source], searchedCandidates: 1, rejectedCandidates: 0, enrichmentAttempts: 1, searchCalls: 1, observedCredits: 1 });
    await pending;
  });
  it("fails closed without a validated scoped adapter and in disabled mode before accounting", async () => {
    const { repository, run } = setup();
    await expect(run("fictional-disabled-request", { bucket: "peers" })).rejects.toThrow("scoped-discovery-live-validation-required");
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "false");
    const discover = vi.fn<ScopedDiscoveryProvider["discover"]>();
    await expect(run("fictional-disabled-request", { bucket: "peers" }, { preflight: vi.fn(), discover })).rejects.toThrow("five-bucket-disabled");
    expect(discover).not.toHaveBeenCalled();
    expect(repository.getApolloProviderStatus("2026-09-22").estimatedExposure).toBe(0);
  });
  it("retains conservative reservation after a bounded provider violation and prevents retries", async () => {
    const { repository, run } = setup();
    const discover = vi.fn<ScopedDiscoveryProvider["discover"]>(async () => ({ records: [], searchedCandidates: 6, rejectedCandidates: 6, enrichmentAttempts: 6, searchCalls: 1, observedCredits: null }));
    const provider = { preflight: vi.fn(), discover };
    await expect(run("fictional-bad-provider", { bucket: "peers" }, provider)).rejects.toThrow("scoped-refresh-provider-cap-exceeded");
    expect(repository.getApolloProviderStatus("2026-09-22").estimatedExposure).toBe(6);
    await expect(run("fictional-bad-provider", { bucket: "peers" }, provider)).rejects.toThrow("scoped-refresh-reconciliation-required");
    expect(discover).toHaveBeenCalledTimes(1);
  });
});

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
import { refreshScopedCandidateReserve } from "@/application/candidate-refresh/scoped";
import type { RecipientBucket } from "@/domain/recipient-buckets";
import { SqliteSimulationRepository } from "@/infrastructure/sqlite/database";
import { loadScopedDiscoveryReadiness } from "@/infrastructure/sqlite/candidate-refresh";
import { resolveDatastoreTopology } from "@/infrastructure/sqlite/datastore-topology";
import { SqliteScopedDiscoveryStore } from "@/infrastructure/sqlite/scoped-discovery";
import { migrateTestDatabase } from "@/infrastructure/sqlite/test-migrations";
import { ScopedApolloProvider } from "./scoped-provider";
import type {
  ApolloConfig,
  ApolloHttpResponse,
  ApolloHttpTransport,
} from "./types";

const directories: string[] = [];
const at = new Date("2026-09-28T12:00:00.000-04:00");
const config: ApolloConfig = {
  enabled: true,
  apiKey: "offline-fixture-key",
  maxEnrichmentsPerBatch: 2,
  maxEnrichmentsPerDay: 10,
  hardStop: true,
  timeoutMs: 100,
  maxResponseBytes: 100_000,
  maxRetries: 0,
};
const policy = {
  maximumPerBatch: 2,
  maximumPerDay: 10,
  maximumSearchCalls: 5,
  hardStop: true,
};

beforeEach(() => vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true"));
afterEach(() => {
  vi.unstubAllEnvs();
  directories.splice(0).forEach((directory) =>
    rmSync(directory, { recursive: true, force: true }),
  );
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

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "networkpilot-scoped-apollo-"));
  directories.push(directory);
  const canonicalPath = join(directory, "canonical.sqlite");
  const recruiterPath = join(directory, "recruiter.sqlite");
  const canonical = new SqliteSimulationRepository(canonicalPath);
  migrateTestDatabase(canonical);
  const recruiter = new SqliteSimulationRepository(recruiterPath);
  migrateTestDatabase(
    recruiter,
    migrationsThrough(directory, "0011_outreach_tracks.sql"),
  );
  recruiter.close();
  const base = resolveDatastoreTopology({}, directory);
  const topology = {
    ...base,
    canonical: { ...base.canonical, path: canonicalPath },
    recruiterSource: { ...base.recruiterSource, path: recruiterPath },
  };
  return { canonical, canonicalPath, recruiterPath, topology };
}

function person(
  id: string,
  title: string,
  seniority: string,
  employer: string,
) {
  return {
    id,
    first_name: "Fixture",
    last_name: `Person ${id}`,
    title,
    seniority,
    city: "Boston",
    state: "Massachusetts",
    country: "United States",
    email: `fixture.${id}@${id}.example`,
    email_status: "verified",
    updated_at: at.toISOString(),
    organization: {
      id: `org-${id}`,
      name: employer,
      primary_domain: `${id}.example`,
      industry: "technology",
    },
    employment_history: [{ start_date: "2015-01-01", current: true }],
  };
}

function searchPerson(value: ReturnType<typeof person>) {
  const search = { ...value, last_name_obfuscated: "Pe***n" };
  delete (search as { email?: string }).email;
  return search;
}

class FixtureTransport implements ApolloHttpTransport {
  calls: Parameters<ApolloHttpTransport["request"]>[0][] = [];
  private searchCount = 0;
  constructor(private readonly candidate: ReturnType<typeof person>) {}
  async request(
    input: Parameters<ApolloHttpTransport["request"]>[0],
  ): Promise<ApolloHttpResponse> {
    this.calls.push(input);
    if (input.path.includes("api_search")) {
      const people = this.searchCount++ === 0 ? [searchPerson(this.candidate)] : [];
      return { status: 200, headers: {}, body: JSON.stringify({ people }) };
    }
    return {
      status: 200,
      headers: {},
      body: JSON.stringify({
        person: this.candidate,
        match_confidence: "high",
        credits_consumed: 1,
      }),
    };
  }
}

describe("offline scoped Apollo orchestration", () => {
  it("runs all buckets through canonical 0021 and recruiter source 0011", async () => {
    const { canonical, topology } = setup();
    const fixtures: Array<{
      bucket: RecipientBucket;
      person: ReturnType<typeof person>;
      qualified: number;
      state: "eligible" | "review-required";
    }> = [
      {
        bucket: "recruiters",
        person: person(
          "recruiter-101",
          "Senior Technical Recruiter",
          "senior",
          "Recruiter Technology Employer",
        ),
        qualified: 1,
        state: "eligible",
      },
      {
        bucket: "peers",
        person: person(
          "peer-101",
          "Senior Data Engineer",
          "senior",
          "Peer Technology Employer",
        ),
        qualified: 1,
        state: "eligible",
      },
      {
        bucket: "managers",
        person: person(
          "manager-101",
          "Analytics Manager",
          "manager",
          "Manager Technology Employer",
        ),
        qualified: 0,
        state: "review-required",
      },
      {
        bucket: "executives",
        person: person(
          "executive-101",
          "VP of Data",
          "vp",
          "Executive Technology Employer",
        ),
        qualified: 0,
        state: "review-required",
      },
      {
        bucket: "ceos",
        person: person(
          "ceo-101",
          "Chief Executive Officer",
          "c_suite",
          "CEO Technology Employer",
        ),
        qualified: 0,
        state: "review-required",
      },
    ];
    const results: Record<string, unknown> = {};
    for (const fixture of fixtures) {
      const transport = new FixtureTransport(fixture.person);
      const provider = new ScopedApolloProvider({
        config,
        transport,
        now: () => at,
        sleep: async () => undefined,
        datasetClassification: "authorized-provider",
        localDate: () => "2026-09-28",
        existingProviderIds: () =>
          new Set(
            canonical
              .listImportedCandidates()
              .map((candidate) => candidate.source.providerRecordId),
          ),
      });
      const result = await refreshScopedCandidateReserve({
        requestId: `concrete-apollo-${fixture.bucket}`,
        scope: { bucket: fixture.bucket },
        requested: 1,
        usableBefore: 0,
        policy,
        store: new SqliteScopedDiscoveryStore(canonical, { topology }),
        provider,
        allowProvider: true,
        now: () => at,
      });
      results[fixture.bucket] = result;
      expect(result).toMatchObject({
        searchedCandidates: 1,
        enrichedCandidates: 1,
        qualifiedCandidatesAdded: fixture.qualified,
        candidatesAdded: 1,
        remainingActionableCapacity: fixture.qualified,
        enrichmentCreditsUsed: 1,
      });
      const saved = canonical.findImportedCandidate(
        "apollo",
        fixture.person.id,
      );
      expect(saved).toMatchObject({ state: fixture.state });
      if (fixture.qualified === 0)
        expect(saved?.recipientBucket).toMatchObject({
          bucket: null,
          reviewState: "review-required",
          explanationCodes: ["responsibility-evidence-missing"],
        });
      expect(
        transport.calls.every((call) =>
          [
            "/api/v1/mixed_people/api_search",
            "/api/v1/people/match",
          ].includes(call.path),
        ),
      ).toBe(true);
    }
    expect(Object.keys(results)).toEqual([
      "recruiters",
      "peers",
      "managers",
      "executives",
      "ceos",
    ]);
    expect(canonical.listImportedCandidates()).toHaveLength(5);
    expect(canonical.getApolloProviderStatus("2026-09-28")).toMatchObject({
      attempted: 5,
      estimatedExposure: 5,
      observedConsumption: 5,
    });
    canonical.close();
  });

  it("recognizes configured runtime readiness without constructing a network request", () => {
    const { canonical, canonicalPath, recruiterPath } = setup();
    canonical.close();
    vi.stubEnv("NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH", canonicalPath);
    vi.stubEnv("NETWORKPILOT_RECRUITER_DATABASE_PATH", recruiterPath);
    vi.stubEnv("NETWORKPILOT_APOLLO_ENABLED", "true");
    vi.stubEnv("APOLLO_API_KEY", "offline-readiness-key");
    vi.stubEnv("NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_BATCH", "2");
    vi.stubEnv("NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_DAY", "10");
    expect(
      loadScopedDiscoveryReadiness({ bucket: "peers" }, at),
    ).toEqual({ ready: true, reason: null, technicalDetail: null });
    vi.stubEnv("APOLLO_API_KEY", "");
    expect(
      loadScopedDiscoveryReadiness({ bucket: "peers" }, at),
    ).toMatchObject({ ready: false, reason: "provider-not-configured" });
    vi.stubEnv("APOLLO_API_KEY", "offline-readiness-key");
    vi.stubEnv("NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_BATCH", "invalid");
    expect(
      loadScopedDiscoveryReadiness({ bucket: "peers" }, at),
    ).toMatchObject({ ready: false, reason: "provider-not-configured" });
  });

  it("reports unavailable canonical and recruiter-source stores before provider work", () => {
    const { canonical, canonicalPath } = setup();
    canonical.close();
    vi.stubEnv(
      "NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH",
      `${canonicalPath}.missing`,
    );
    expect(
      loadScopedDiscoveryReadiness({ bucket: "peers" }, at, true),
    ).toMatchObject({ ready: false, reason: "canonical-store-unavailable" });
    vi.stubEnv("NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH", canonicalPath);
    vi.stubEnv(
      "NETWORKPILOT_RECRUITER_DATABASE_PATH",
      `${canonicalPath}.recruiter-missing`,
    );
    expect(
      loadScopedDiscoveryReadiness({ bucket: "recruiters" }, at, true),
    ).toMatchObject({
      ready: false,
      reason: "recruiter-evidence-store-unavailable",
    });
  });
});

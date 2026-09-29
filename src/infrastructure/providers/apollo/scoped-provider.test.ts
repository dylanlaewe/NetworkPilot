import { describe, expect, it } from "vitest";
import { ScopedDiscoveryProviderFailure } from "@/application/candidate-refresh/scoped";
import {
  type ApolloPersonReservationStore,
  ScopedApolloProvider,
} from "./scoped-provider";
import type {
  ApolloConfig,
  ApolloHttpResponse,
  ApolloHttpTransport,
} from "./types";

const config: ApolloConfig = {
  enabled: true,
  apiKey: "offline-fixture-key",
  maxEnrichmentsPerBatch: 5,
  maxEnrichmentsPerDay: 20,
  hardStop: true,
  timeoutMs: 100,
  maxResponseBytes: 100_000,
  maxRetries: 2,
};

function person(
  id: string,
  title: string,
  seniority: string,
  organization: Record<string, unknown> = {},
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
    email: `fixture.${id}@business.example`,
    email_status: "verified",
    updated_at: "2026-09-28T12:00:00.000Z",
    organization: {
      id: `org-${id}`,
      name: `Employer ${id}`,
      primary_domain: "fixture-operating-company.example",
      industry: "technology",
      ...organization,
    },
    employment_history: [{ start_date: "2018-01-01", current: true }],
  };
}

function searchPerson(value: ReturnType<typeof person>) {
  const result = { ...value, last_name_obfuscated: "Pe***n" };
  delete (result as { email?: string }).email;
  return result;
}

const response = (status: number, body: unknown): ApolloHttpResponse => ({
  status,
  headers: {},
  body: typeof body === "string" ? body : JSON.stringify(body),
});

class Transport implements ApolloHttpTransport {
  calls: Parameters<ApolloHttpTransport["request"]>[0][] = [];
  constructor(
    private readonly searches: ApolloHttpResponse[],
    private readonly enrichments: ApolloHttpResponse[],
  ) {}
  async request(
    input: Parameters<ApolloHttpTransport["request"]>[0],
  ): Promise<ApolloHttpResponse> {
    this.calls.push(input);
    const queue = input.path.includes("api_search")
      ? this.searches
      : this.enrichments;
    const next = queue.shift();
    if (!next) throw new Error("offline-fixture-response-missing");
    return next;
  }
}

class Reservations implements ApolloPersonReservationStore {
  readonly states = new Map<
    string,
    { owner: string; attempted: boolean; outcome?: "usable" | "uncertain" }
  >();

  claim(input: { personId: string; operationId: string }): boolean {
    if (this.states.has(input.personId)) return false;
    this.states.set(input.personId, {
      owner: input.operationId,
      attempted: false,
    });
    return true;
  }

  markAttempted(input: { personId: string; operationId: string }): void {
    const state = this.states.get(input.personId);
    if (!state || state.owner !== input.operationId || state.attempted)
      throw new Error("fixture-reservation-attempt-unavailable");
    state.attempted = true;
  }

  retainAttempted(input: {
    personId: string;
    operationId: string;
    outcome: "usable" | "uncertain";
  }): void {
    const state = this.states.get(input.personId);
    if (!state || state.owner !== input.operationId || !state.attempted)
      throw new Error("fixture-reservation-completion-unavailable");
    state.outcome = input.outcome;
  }

  releaseUnattempted(input: {
    personId: string;
    operationId: string;
  }): void {
    const state = this.states.get(input.personId);
    if (!state || state.owner !== input.operationId || state.attempted)
      throw new Error("fixture-reservation-release-unavailable");
    this.states.delete(input.personId);
  }
}

function provider(
  transport: Transport,
  options: {
    config?: ApolloConfig;
    existing?: ReadonlySet<string>;
    reservations?: ApolloPersonReservationStore;
  } = {},
) {
  return new ScopedApolloProvider({
    config: options.config ?? config,
    transport,
    now: () => new Date("2026-09-28T12:00:00.000Z"),
    sleep: async () => undefined,
    datasetClassification: "provider-shaped-fixture",
    localDate: () => "2026-09-28",
    personReservations: options.reservations ?? new Reservations(),
    existingProviderIds: () => options.existing ?? new Set(),
  });
}

const discover = (
  subject: ScopedApolloProvider,
  bucket: "recruiters" | "peers" | "managers" | "executives" | "ceos",
  maximum = 5,
) =>
  subject.discover({
    scope: { bucket },
    maximum,
    operationId: `offline-${bucket}`,
    maximumSearchCalls: 5,
  });

describe("concrete scoped Apollo provider", () => {
  it("searches, enriches, and normalizes an internal recruiter", async () => {
    const recruiter = person(
      "recruiter-001",
      "Senior Technical Recruiter",
      "senior",
    );
    const transport = new Transport(
      [
        response(200, { people: [searchPerson(recruiter)] }),
        response(200, { people: [] }),
      ],
      [response(200, { person: recruiter, match_confidence: "high", credits_consumed: 1 })],
    );
    const result = await discover(provider(transport), "recruiters");
    expect(result).toMatchObject({
      searchedCandidates: 1,
      rejectedCandidates: 0,
      enrichmentAttempts: 1,
      searchCalls: 2,
      observedCredits: 1,
    });
    expect(result.records[0]!.responsibilityEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "recruiting-function", verified: true }),
        expect.objectContaining({
          kind: "internal-recruiting",
          value: "internal",
          verified: true,
        }),
        expect.objectContaining({
          kind: "recruiting-domain",
          value: "technical-data-ai",
        }),
      ]),
    );
    expect(
      transport.calls.find((call) => call.path.includes("people/match"))?.body,
    ).toEqual({
      id: "recruiter-001",
      reveal_personal_emails: false,
      reveal_phone_number: false,
      run_waterfall_email: false,
      run_waterfall_phone: false,
    });
  });

  it("rejects an agency recruiter before enrichment", async () => {
    const recruiter = person("agency-001", "Technical Recruiter", "senior", {
      name: "Example Staffing",
      industry: "staffing and recruiting",
    });
    const transport = new Transport(
      [
        response(200, { people: [searchPerson(recruiter)] }),
        response(200, { people: [] }),
      ],
      [],
    );
    await expect(discover(provider(transport), "recruiters")).resolves.toMatchObject(
      {
        searchedCandidates: 1,
        rejectedCandidates: 1,
        enrichmentAttempts: 0,
        records: [],
        observedCredits: 0,
      },
    );
    expect(transport.calls.every((call) => call.path.includes("api_search"))).toBe(
      true,
    );
  });

  it("enriches a plausible search-only employer but preserves missing identity", async () => {
    const recruiter = person(
      "ambiguous-employer-001",
      "Technical Recruiter",
      "senior",
      {
        id: undefined,
        name: "Ambiguous Technology Employer",
        primary_domain: undefined,
      },
    );
    const transport = new Transport(
      [
        response(200, { people: [searchPerson(recruiter)] }),
        response(200, { people: [] }),
      ],
      [
        response(200, {
          person: recruiter,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ],
    );
    const result = await discover(provider(transport), "recruiters");
    expect(result.enrichmentAttempts).toBe(1);
    expect(
      result.records[0]!.responsibilityEvidence?.some(
        (item) => item.kind === "company-identity",
      ),
    ).toBe(false);
    expect(result.records[0]!.responsibilityEvidence).toContainEqual(
      expect.objectContaining({
        kind: "internal-recruiting",
        value: "ambiguous",
        verified: false,
      }),
    );
  });

  it("supports an experienced IC while leaving title-only leadership unresolved", async () => {
    const peer = person("peer-001", "Senior Data Engineer", "senior");
    const manager = person("manager-001", "Analytics Manager", "manager");
    const peerTransport = new Transport(
      [
        response(200, { people: [searchPerson(peer)] }),
        response(200, { people: [] }),
      ],
      [response(200, { person: peer, match_confidence: "high", credits_consumed: 1 })],
    );
    const managerTransport = new Transport(
      [
        response(200, { people: [searchPerson(manager)] }),
        response(200, { people: [] }),
      ],
      [response(200, { person: manager, match_confidence: "high", credits_consumed: 1 })],
    );
    const peerResult = await discover(provider(peerTransport), "peers");
    expect(peerResult.records[0]!.responsibilityEvidence).toContainEqual(
      expect.objectContaining({
        kind: "individual-contributor",
        sourceReference: "apollo.person.seniority",
      }),
    );
    const managerResult = await discover(provider(managerTransport), "managers");
    expect(
      managerResult.records[0]!.responsibilityEvidence?.some((item) =>
        [
          "team-leadership",
          "functional-leadership",
          "division-leadership",
          "company-leadership",
        ].includes(item.kind),
      ),
    ).toBe(false);
  });

  it.each([
    ["executives", "VP of Data", "vp"],
    ["ceos", "Chief Executive Officer", "c_suite"],
    ["ceos", "President, East Region", "c_suite"],
  ] as const)(
    "keeps %s title-only scope review-required evidence-wise",
    async (bucket, title, seniority) => {
      const candidate = person(`${bucket}-${title}`, title, seniority);
      const transport = new Transport(
        [response(200, { people: [searchPerson(candidate)] }), ...(bucket === "executives" ? [response(200, { people: [] })] : [])],
        [response(200, { person: candidate, match_confidence: "high", credits_consumed: 1 })],
      );
      const result = await discover(provider(transport), bucket);
      expect(
        result.records[0]!.responsibilityEvidence?.some((item) =>
          ["functional-leadership", "division-leadership", "company-leadership"].includes(
            item.kind,
          ),
        ),
      ).toBe(false);
    },
  );

  it("does not spend on an already imported provider identity", async () => {
    const peer = person("duplicate-001", "Senior Data Engineer", "senior");
    const transport = new Transport(
      [
        response(200, { people: [searchPerson(peer)] }),
        response(200, { people: [] }),
      ],
      [],
    );
    const result = await discover(
      provider(transport, { existing: new Set(["duplicate-001"]) }),
      "peers",
    );
    expect(result).toMatchObject({
      searchedCandidates: 1,
      rejectedCandidates: 1,
      enrichmentAttempts: 0,
      observedCredits: 0,
    });
  });

  it("deduplicates the same Apollo ID repeated within one search response", async () => {
    const peer = person("duplicate-search-001", "Senior Data Engineer", "senior");
    const transport = new Transport(
      [
        response(200, {
          people: [searchPerson(peer), searchPerson(peer)],
        }),
        response(200, { people: [] }),
      ],
      [
        response(200, {
          person: peer,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ],
    );
    const result = await discover(provider(transport), "peers", 1);
    expect(result).toMatchObject({
      searchedCandidates: 2,
      rejectedCandidates: 1,
      enrichmentAttempts: 1,
      records: [expect.objectContaining({ providerRecordId: peer.id })],
    });
    expect(
      transport.calls.filter((call) => call.path.includes("people/match")),
    ).toHaveLength(1);
  });

  it("atomically enriches one shared Apollo ID across distinct bucket operations", async () => {
    const shared = person(
      "cross-bucket-001",
      "Senior Technical Recruiter",
      "senior",
    );
    const reservations = new Reservations();
    const recruiterTransport = new Transport(
      [
        response(200, { people: [searchPerson(shared)] }),
        response(200, { people: [] }),
      ],
      [
        response(200, {
          person: shared,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ],
    );
    const peerTransport = new Transport(
      [
        response(200, { people: [searchPerson(shared)] }),
        response(200, { people: [] }),
      ],
      [
        response(200, {
          person: shared,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ],
    );
    const results = await Promise.all([
      discover(
        provider(recruiterTransport, { reservations }),
        "recruiters",
        1,
      ),
      discover(provider(peerTransport, { reservations }), "peers", 1),
    ]);
    expect(results.map((result) => result.enrichmentAttempts).sort()).toEqual([
      0, 1,
    ]);
    expect(results.map((result) => result.records.length).sort()).toEqual([0, 1]);
    expect(
      [...recruiterTransport.calls, ...peerTransport.calls].filter((call) =>
        call.path.includes("people/match"),
      ),
    ).toHaveLength(1);
    expect(reservations.states.get(shared.id)).toMatchObject({
      attempted: true,
      outcome: "usable",
    });
  });

  it("continues to another eligible person when the first ID is already reserved", async () => {
    const duplicate = person("reserved-001", "Senior Data Engineer", "senior");
    const available = person("reserved-002", "Senior Data Engineer", "senior");
    const reservations = new Reservations();
    expect(
      reservations.claim({
        personId: duplicate.id,
        operationId: "other-operation",
      }),
    ).toBe(true);
    const transport = new Transport(
      [
        response(200, {
          people: [searchPerson(duplicate), searchPerson(available)],
        }),
        response(200, { people: [] }),
      ],
      [
        response(200, {
          person: available,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ],
    );
    const result = await discover(
      provider(transport, { reservations }),
      "peers",
      1,
    );
    expect(result).toMatchObject({
      rejectedCandidates: 1,
      enrichmentAttempts: 1,
      records: [expect.objectContaining({ providerRecordId: available.id })],
    });
  });

  it("fails search with zero enrichment accounting", async () => {
    const transport = new Transport(
      [response(500, {}), response(200, { people: [] })],
      [],
    );
    await expect(discover(provider(transport), "peers")).rejects.toMatchObject({
      name: "ScopedDiscoveryProviderFailure",
      accounting: { attempts: 0, observedCredits: 0 },
    });
    expect(transport.calls).toHaveLength(1);
  });

  it("reports truthful unknown consumption after partial enrichment failure", async () => {
    const first = person("partial-001", "Senior Data Engineer", "senior");
    const second = person("partial-002", "Senior Software Engineer", "senior");
    const transport = new Transport(
      [
        response(200, {
          people: [searchPerson(first), searchPerson(second)],
        }),
        response(200, { people: [] }),
      ],
      [
        response(200, {
          person: first,
          match_confidence: "high",
          credits_consumed: 1,
        }),
        response(500, {}),
      ],
    );
    const reservations = new Reservations();
    const error = await discover(
      provider(transport, { reservations }),
      "peers",
    ).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ScopedDiscoveryProviderFailure);
    expect(error).toMatchObject({
      accounting: { attempts: 2, observedCredits: null },
    });
    expect(reservations.states.get(second.id)).toMatchObject({
      attempted: true,
      outcome: "uncertain",
    });
  });

  it("preserves a concrete provider-reported credit overage", async () => {
    const candidate = person("overage-001", "Senior Data Engineer", "senior");
    const transport = new Transport(
      [
        response(200, { people: [searchPerson(candidate)] }),
        response(200, { people: [] }),
      ],
      [
        response(200, {
          person: candidate,
          match_confidence: "high",
          credits_consumed: 2,
        }),
      ],
    );
    await expect(discover(provider(transport), "peers")).rejects.toMatchObject({
      accounting: { attempts: 1, observedCredits: 2 },
    });
  });

  it("isolates malformed search records without enrichment", async () => {
    const transport = new Transport(
      [
        response(200, {
          people: [
            {
              id: "malformed-001",
              first_name: "Missing",
              title: "Data Analyst",
              organization: { name: "Employer" },
            },
          ],
        }),
        response(200, { people: [] }),
      ],
      [],
    );
    await expect(discover(provider(transport), "peers")).resolves.toMatchObject({
      searchedCandidates: 1,
      rejectedCandidates: 1,
      enrichmentAttempts: 0,
      records: [],
    });
  });

  it("preflights missing configuration without transport", () => {
    const transport = new Transport([], []);
    const subject = provider(transport, {
      config: { ...config, apiKey: undefined },
    });
    expect(() => subject.preflight()).toThrow("apollo-api-key-missing");
    expect(transport.calls).toHaveLength(0);
  });
});

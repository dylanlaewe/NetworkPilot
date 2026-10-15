import { describe, expect, it } from "vitest";
import { ScopedDiscoveryProviderFailure } from "@/application/candidate-refresh/scoped";
import {
  type ApolloSearchProgressStore,
  type ApolloPersonReservationStore,
  companyLeadershipTitleKind,
  scopedApolloQueryKey,
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
    {
      owner: string;
      attempted: boolean;
      outcome?: "usable" | "uncertain";
      observedConsumption?: number | null;
      providerViolation?: string;
      resultRetained?: boolean;
    }
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
    record?: unknown;
    observedConsumption: number | null;
    providerViolation?: "provider-credit-model-exceeded";
  }): void {
    const state = this.states.get(input.personId);
    if (!state || state.owner !== input.operationId || !state.attempted)
      throw new Error("fixture-reservation-completion-unavailable");
    state.outcome = input.outcome;
    state.observedConsumption = input.observedConsumption;
    state.providerViolation = input.providerViolation;
    state.resultRetained = Boolean(input.record);
  }

  releaseUnattempted(input: { personId: string; operationId: string }): void {
    const state = this.states.get(input.personId);
    if (!state || state.owner !== input.operationId || state.attempted)
      throw new Error("fixture-reservation-release-unavailable");
    this.states.delete(input.personId);
  }
}

class SearchProgress implements ApolloSearchProgressStore {
  readonly next = new Map<string, number>();
  claimNextPage(input: { queryKey: string }): number {
    const page = this.next.get(input.queryKey) ?? 1;
    this.next.set(input.queryKey, page + 1);
    return page;
  }
  observePage(): void {}
}

function provider(
  transport: Transport,
  options: {
    config?: ApolloConfig;
    existing?: ReadonlySet<string>;
    reservations?: ApolloPersonReservationStore;
    strictProviderShape?: boolean;
    searchProgress?: ApolloSearchProgressStore;
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
    strictProviderShape: options.strictProviderShape,
    searchProgress: options.searchProgress,
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
  it.each([
    ["CEO", "ceo"],
    ["Chief Executive Officer", "ceo"],
    ["C.E.O.", "ceo"],
    ["Co-CEO", "ceo"],
    ["President", "president"],
    ["Interim President", "president"],
    ["CEO & President", "combined"],
    ["President and Chief Executive Officer", "combined"],
    ["Vice President", null],
    ["Vice-President", null],
    ["V.P.", null],
    ["Regional President", null],
    ["President, Executive Search", null],
    ["Executive Recruiter", null],
    ["Founder", null],
  ] as const)("classifies company-leadership title %s", (title, expected) => {
    expect(companyLeadershipTitleKind(title)).toBe(expected);
  });

  it("keys progress by the full semantic query but not operation labels or page", () => {
    const base = {
      batchId: "operation-one",
      specificTitles: ["CEO"],
      emailStatuses: ["verified"],
      includeSimilarTitles: false,
      page: 1,
      perPage: 20,
    };
    const key = scopedApolloQueryKey({
      bucket: "ceos",
      purpose: "company-leadership",
      request: base,
    });
    expect(
      scopedApolloQueryKey({
        bucket: "ceos",
        purpose: "company-leadership",
        request: { ...base, batchId: "operation-two", page: 9 },
      }),
    ).toBe(key);
    expect(
      scopedApolloQueryKey({
        bucket: "ceos",
        purpose: "company-leadership",
        request: { ...base, emailStatuses: ["verified", "likely to engage"] },
      }),
    ).not.toBe(key);
  });

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
      [
        response(200, {
          person: recruiter,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ],
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
        expect.objectContaining({
          kind: "recruiting-function",
          verified: true,
        }),
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
    await expect(
      discover(provider(transport), "recruiters"),
    ).resolves.toMatchObject({
      searchedCandidates: 1,
      rejectedCandidates: 1,
      enrichmentAttempts: 0,
      records: [],
      observedCredits: 0,
    });
    expect(
      transport.calls.every((call) => call.path.includes("api_search")),
    ).toBe(true);
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
      [
        response(200, {
          person: peer,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ],
    );
    const managerTransport = new Transport(
      [
        response(200, { people: [searchPerson(manager)] }),
        response(200, { people: [] }),
      ],
      [
        response(200, {
          person: manager,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ],
    );
    const peerResult = await discover(provider(peerTransport), "peers");
    expect(peerResult.records[0]!.responsibilityEvidence).toContainEqual(
      expect.objectContaining({
        kind: "individual-contributor",
        sourceReference: "apollo.person.seniority",
      }),
    );
    const managerResult = await discover(
      provider(managerTransport),
      "managers",
    );
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

  it("interleaves mixed peer role families before committing enrichment spend", async () => {
    const juniorOne = person("a-junior-001", "Junior Data Analyst", "entry");
    const juniorTwo = person("b-junior-002", "Junior Data Analyst", "entry");
    const juniorThree = person("c-junior-003", "Junior Data Analyst", "entry");
    const product = person("z-product-001", "Product Operations Analyst", "senior");
    const engineering = person("y-engineering-001", "Software Engineer", "senior");
    const business = person("w-business-001", "Technical Business Analyst", "senior");
    const implementation = person("x-implementation-001", "Implementation Engineer", "senior");
    const expected = [juniorOne, product, engineering, business, juniorTwo];
    const transport = new Transport(
      [
        response(200, {
          people: [
            searchPerson(juniorOne),
            searchPerson(juniorTwo),
            searchPerson(juniorThree),
            searchPerson(product),
            searchPerson(engineering),
            searchPerson(business),
            searchPerson(implementation),
          ],
        }),
        response(200, { people: [] }),
      ],
      expected.map((candidate) =>
        response(200, {
          person: candidate,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ),
    );
    const result = await discover(provider(transport), "peers", 5);
    expect(result.records.map((record) => record.currentTitle)).toEqual([
      "Junior Data Analyst",
      "Product Operations Analyst",
      "Software Engineer",
      "Technical Business Analyst",
      "Junior Data Analyst",
    ]);
    expect(result.records.map((record) => record.providerRecordId)).toEqual(
      expected.map((candidate) => candidate.id),
    );
  });

  it("honors the explicit early-career peer filter even if a broad role leaks into provider results", async () => {
    const broad = person("a-product-001", "Product Analyst", "senior");
    const early = person("z-junior-001", "Junior Data Analyst", "entry");
    const transport = new Transport(
      [
        response(200, {
          people: [searchPerson(broad), searchPerson(early)],
        }),
      ],
      [
        response(200, {
          person: early,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ],
    );
    const result = await provider(transport).discover({
      scope: { bucket: "peers", earlyCareerOnly: true },
      maximum: 1,
      operationId: "offline-peers-early-career",
      maximumSearchCalls: 5,
    });
    expect(result).toMatchObject({
      enrichmentAttempts: 1,
      rejectedCandidates: 1,
      records: [expect.objectContaining({ providerRecordId: early.id })],
    });
  });

  it("interleaves CEO-only, President-only, and combined-title supply without relabeling it", async () => {
    const combinedOne = person("a-combined-001", "CEO & President", "c_suite");
    const combinedTwo = person("b-combined-002", "President and CEO", "c_suite");
    const president = person("y-president-001", "President", "c_suite");
    const ceo = person("z-ceo-001", "C.E.O.", "c_suite");
    const expected = [ceo, president, combinedOne];
    const transport = new Transport(
      [
        response(200, {
          people: [
            searchPerson(combinedOne),
            searchPerson(combinedTwo),
            searchPerson(president),
            searchPerson(ceo),
          ],
        }),
      ],
      expected.map((candidate) =>
        response(200, {
          person: candidate,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ),
    );
    const result = await discover(provider(transport), "ceos", 3);
    expect(result.records.map((record) => record.currentTitle)).toEqual([
      "C.E.O.",
      "President",
      "CEO & President",
    ]);
  });

  it.each([
    ["executives", "VP of Data", "vp"],
    ["ceos", "Chief Executive Officer", "c_suite"],
  ] as const)(
    "keeps %s title-only scope review-required evidence-wise",
    async (bucket, title, seniority) => {
      const candidate = person(`${bucket}-${title}`, title, seniority);
      const transport = new Transport(
        [
          response(200, { people: [searchPerson(candidate)] }),
          ...(bucket === "executives" ? [response(200, { people: [] })] : []),
        ],
        [
          response(200, {
            person: candidate,
            match_confidence: "high",
            credits_consumed: 1,
          }),
        ],
      );
      const result = await discover(provider(transport), bucket);
      expect(
        result.records[0]!.responsibilityEvidence?.some((item) =>
          [
            "functional-leadership",
            "division-leadership",
            "company-leadership",
          ].includes(item.kind),
        ),
      ).toBe(false);
    },
  );

  it("does not enrich a search result whose title falls outside the requested title scope", async () => {
    const regionalPresident = person(
      "regional-president-001",
      "President, East Region",
      "c_suite",
    );
    const transport = new Transport(
      [response(200, { people: [searchPerson(regionalPresident)] })],
      [],
    );
    await expect(
      discover(provider(transport), "ceos", 1),
    ).resolves.toMatchObject({
      searchedCandidates: 1,
      rejectedCandidates: 1,
      enrichmentAttempts: 0,
      records: [],
      observedCredits: 0,
    });
    expect(
      transport.calls.every((call) => call.path.includes("api_search")),
    ).toBe(true);
  });

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

  it("advances a stable CEO query across pages and never re-enriches prior identities", async () => {
    const regional = person("regional-001", "Regional President", "c_suite");
    const first = person("ceo-page-two-001", "President & CEO", "c_suite");
    const second = person("ceo-page-two-002", "Chief Executive Officer", "c_suite");
    const third = person("ceo-page-three-001", "CEO and President", "c_suite");
    const fourth = person("ceo-page-three-002", "President", "c_suite");
    const progress = new SearchProgress(), reservations = new Reservations();
    const transport = new Transport(
      [
        response(200, { people: [searchPerson(regional)], pagination: { total_entries: 80 } }),
        response(200, { people: [searchPerson(first), searchPerson(second)], pagination: { total_entries: 80 } }),
        response(200, { people: [searchPerson(third), searchPerson(fourth)], pagination: { total_entries: 80 } }),
      ],
      [second, first, fourth, third].map((candidate) => response(200, { person: candidate, match_confidence: "high" })),
    );
    const subject = provider(transport, { searchProgress: progress, reservations });
    const firstRun = await discover(subject, "ceos", 2);
    const secondRun = await discover(subject, "ceos", 2);
    expect(firstRun.records.map((record) => record.providerRecordId).sort()).toEqual([first.id, second.id].sort());
    expect(secondRun.records.map((record) => record.providerRecordId).sort()).toEqual([third.id, fourth.id].sort());
    expect(transport.calls.filter((call) => call.path.includes("api_search")).map((call) => (call.body as { page: number }).page)).toEqual([1, 2, 3]);
    expect(transport.calls.filter((call) => call.path.includes("people/match"))).toHaveLength(4);
    expect(firstRun.diagnostics?.searchPages).toEqual([
      expect.objectContaining({
        query: expect.stringMatching(/^[a-f0-9]{64}$/),
        page: 1,
        raw: 1,
        normalized: 1,
      }),
      expect.objectContaining({
        query: expect.stringMatching(/^[a-f0-9]{64}$/),
        page: 2,
        raw: 2,
        normalized: 2,
      }),
    ]);
    expect(JSON.stringify(firstRun.diagnostics)).not.toContain(first.id);
  });

  it.each([
    ["Founder & CEO", true],
    ["Co-CEO", true],
    ["Interim President", true],
    ["Founder", false],
    ["Regional President", false],
    ["President, Executive Search", false],
  ] as const)("applies company-leadership scope to %s", async (title, accepted) => {
    const candidate = person(`ceo-title-${title.replace(/[^a-z]/gi, "-")}`, title, "c_suite");
    const transport = new Transport(
      [response(200, { people: [searchPerson(candidate)] })],
      accepted
        ? [response(200, { person: candidate, match_confidence: "high" })]
        : [],
    );
    const result = await discover(provider(transport), "ceos", 1);
    expect(result.enrichmentAttempts).toBe(accepted ? 1 : 0);
    expect(result.records).toHaveLength(accepted ? 1 : 0);
  });

  it("deduplicates the same Apollo ID repeated within one search response", async () => {
    const peer = person(
      "duplicate-search-001",
      "Senior Data Engineer",
      "senior",
    );
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
      discover(provider(recruiterTransport, { reservations }), "recruiters", 1),
      discover(provider(peerTransport, { reservations }), "peers", 1),
    ]);
    expect(results.map((result) => result.enrichmentAttempts).sort()).toEqual([
      0, 1,
    ]);
    expect(results.map((result) => result.records.length).sort()).toEqual([
      0, 1,
    ]);
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
    ).catch((caught: unknown) => caught);
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
    const reservations = new Reservations();
    await expect(
      discover(provider(transport, { reservations }), "peers"),
    ).rejects.toMatchObject({
      accounting: { attempts: 1, observedCredits: 2 },
    });
    expect(reservations.states.get(candidate.id)).toMatchObject({
      attempted: true,
      outcome: "usable",
      observedConsumption: 2,
      providerViolation: "provider-credit-model-exceeded",
      resultRetained: true,
    });
    expect(
      reservations.claim({
        personId: candidate.id,
        operationId: "ordinary-retry-operation",
      }),
    ).toBe(false);
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
    await expect(discover(provider(transport), "peers")).resolves.toMatchObject(
      {
        searchedCandidates: 1,
        rejectedCandidates: 1,
        enrichmentAttempts: 0,
        records: [],
      },
    );
  });

  it("fails closed on a malformed search record in strict provider-shape mode", async () => {
    const valid = person("valid-sibling-001", "Data Analyst", "senior");
    const transport = new Transport(
      [
        response(200, {
          people: [
            {
              id: "malformed-strict-001",
              first_name: "Missing",
              title: "Data Analyst",
              organization: { name: "Employer" },
            },
            searchPerson(valid),
          ],
        }),
      ],
      [
        response(200, {
          person: valid,
          match_confidence: "high",
          credits_consumed: 1,
        }),
      ],
    );
    await expect(
      discover(provider(transport, { strictProviderShape: true }), "peers"),
    ).rejects.toMatchObject({
      message: "provider-search-record-shape-anomaly",
      accounting: { attempts: 0, observedCredits: 0 },
    });
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.path).toContain("api_search");
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

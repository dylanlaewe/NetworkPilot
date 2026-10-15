import { describe, expect, it } from "vitest";
import type { RecipientBucket } from "@/domain/recipient-buckets";
import { ApolloAdapter } from "./adapter";
import { planScopedApolloQueries } from "./scoped-query-plan";
import type {
  ApolloBudgetRepository,
  ApolloConfig,
  ApolloHttpResponse,
  ApolloHttpTransport,
} from "./types";

const config: ApolloConfig = {
  enabled: true,
  apiKey: "offline-fixture-key",
  maxEnrichmentsPerBatch: 5,
  maxEnrichmentsPerDay: 10,
  hardStop: true,
  timeoutMs: 100,
  maxResponseBytes: 100_000,
  maxRetries: 0,
};

class Transport implements ApolloHttpTransport {
  calls: Parameters<ApolloHttpTransport["request"]>[0][] = [];
  async request(
    input: Parameters<ApolloHttpTransport["request"]>[0],
  ): Promise<ApolloHttpResponse> {
    this.calls.push(input);
    return { status: 200, headers: {}, body: '{"people":[]}' };
  }
}

const budgets: ApolloBudgetRepository = {
  authorizeApolloOperation: () => ({
    operationId: "unused",
    estimatedMaxExposure: 0,
    remainingDaily: 0,
  }),
  recordApolloAttempt: () => undefined,
  completeApolloOperation: () => undefined,
  failApolloOperation: () => undefined,
};

describe("scoped Apollo query plans", () => {
  it.each([
    ["recruiters", "Technical Recruiter"],
    ["peers", "Data Analyst"],
    ["managers", "Data Analytics Manager"],
    ["executives", "Director of Data"],
    ["ceos", "Chief Executive Officer"],
  ] as const)(
    "produces the actual bounded Apollo request for %s",
    async (bucket, expectedTitle) => {
      const plan = planScopedApolloQueries({
        scope: { bucket },
        maximum: 3,
        maximumSearchCalls: 1,
      });
      const transport = new Transport();
      const adapter = new ApolloAdapter(config, transport, budgets, {
        now: () => new Date("2026-09-28T12:00:00.000Z"),
        sleep: async () => undefined,
        datasetClassification: "provider-shaped-fixture",
        localDate: () => "2026-09-28",
      });
      await adapter.search(plan[0]!.request);
      expect(transport.calls).toHaveLength(1);
      expect(transport.calls[0]!.body).toMatchObject({
        page: 1,
        per_page: 12,
        person_titles: expect.arrayContaining([expectedTitle]),
        include_similar_titles: false,
        person_locations: expect.arrayContaining(["United States"]),
        contact_email_status: ["verified"],
      });
      expect(transport.calls[0]!.body).not.toHaveProperty(
        "q_organization_domains_list",
      );
      expect(transport.calls[0]!.body).not.toHaveProperty("organization_ids");
      expect(transport.calls[0]!.body).not.toHaveProperty("person_seniorities");
      expect(transport.calls[0]!.body).not.toHaveProperty(
        "reveal_phone_number",
      );
    },
  );

  it("is deterministic, capped, and keeps early-career peers explicit", () => {
    const input = {
      scope: { bucket: "peers" as const, earlyCareerOnly: true as const },
      maximum: 5,
      maximumSearchCalls: 5,
    };
    expect(planScopedApolloQueries(input)).toEqual(
      planScopedApolloQueries(input),
    );
    expect(planScopedApolloQueries(input)).toHaveLength(1);
    expect(planScopedApolloQueries(input)[0]!.request.specificTitles).toEqual(
      expect.arrayContaining(["Associate Data Analyst", "Junior Data Engineer"]),
    );
    expect(
      planScopedApolloQueries({
        scope: { bucket: "executives" },
        maximum: 5,
        maximumSearchCalls: 1,
      }),
    ).toHaveLength(1);
  });

  it("keeps every approved peer lane in the default search while honoring the explicit early-career filter", () => {
    const broad = planScopedApolloQueries({
      scope: { bucket: "peers" },
      maximum: 5,
      maximumSearchCalls: 5,
    });
    expect(broad[0]!.request.specificTitles).toEqual(
      expect.arrayContaining([
        "Product Analyst",
        "Product Operations Analyst",
        "Data Analyst",
        "Business Intelligence Analyst",
        "Business Analyst",
        "Software Engineer",
        "Data Engineer",
        "Implementation Engineer",
        "Technical Business Analyst",
      ]),
    );
    const earlyCareer = planScopedApolloQueries({
      scope: { bucket: "peers", earlyCareerOnly: true },
      maximum: 5,
      maximumSearchCalls: 5,
    });
    expect(earlyCareer).toHaveLength(1);
    expect(earlyCareer[0]!.request.specificTitles).toContain(
      "Junior Data Analyst",
    );
    expect(earlyCareer[0]!.request.specificTitles).not.toContain(
      "Product Analyst",
    );
  });

  it("expresses CEO or President as distinct Apollo OR terms with local negative filters", () => {
    const request = planScopedApolloQueries({
      scope: { bucket: "ceos" },
      maximum: 5,
      maximumSearchCalls: 5,
    })[0]!.request;
    expect(request.specificTitles).toEqual(
      expect.arrayContaining(["CEO", "C.E.O.", "President"]),
    );
    expect(request.excludedTitles).toEqual(
      expect.arrayContaining([
        "Vice President",
        "Regional President",
        "Divisional President",
        "Executive Recruiter",
      ]),
    );
    expect(request.includeSimilarTitles).toBe(false);
  });

  it("rejects an unsupported bucket instead of falling back", () => {
    expect(() =>
      planScopedApolloQueries({
        scope: { bucket: "unsupported" as RecipientBucket },
        maximum: 1,
        maximumSearchCalls: 1,
      }),
    ).toThrow("scoped-apollo-bucket-unsupported");
  });
});

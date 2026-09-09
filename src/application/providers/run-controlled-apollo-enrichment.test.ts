import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { mapApolloPerson, type ApolloHttpTransport } from "@/infrastructure/providers/apollo";
import { APOLLO_PEOPLE } from "@/infrastructure/providers/apollo/fixtures";
import { SqliteSimulationRepository } from "@/infrastructure/sqlite/database";
import { CappedApolloEnrichmentTransport, runControlledApolloEnrichment } from "./run-controlled-apollo-enrichment";

describe("controlled Apollo enrichment", () => {
  it("imports only an explicitly bounded Apollo-ID result through normal gates", async () => {
    const repository = new SqliteSimulationRepository(":memory:"); repository.migrate();
    const source = { ...mapApolloPerson(APOLLO_PEOPLE.senior, { stage: "enrichment", retrievedAt: "2026-09-09T12:00:00Z", datasetClassification: "authorized-provider" }), providerMetadata: { ...mapApolloPerson(APOLLO_PEOPLE.senior, { stage: "enrichment", retrievedAt: "2026-09-09T12:00:00Z", datasetClassification: "authorized-provider" }).providerMetadata!, matchConfidence: "medium" as const } };
    const enrich = vi.fn(async () => [source]);
    const result = await runControlledApolloEnrichment({ adapter: { enrich }, repository, personIds: ["senior-001"] });
    expect(enrich).toHaveBeenCalledWith(expect.objectContaining({ personIds: ["senior-001"] }));
    expect(result[0]).toMatchObject({ source: { providerRecordId: "senior-001" }, gateFailures: expect.arrayContaining(["company-unreviewed", "provider-match-confidence-review"]), reviewState: "pending" });
    repository.close();
  });

  it("rejects empty, duplicate, excessive, malformed, and mismatched selections", async () => {
    const repository = new SqliteSimulationRepository(":memory:"); repository.migrate();
    const adapter = { enrich: vi.fn(async () => []) };
    await expect(runControlledApolloEnrichment({ adapter, repository, personIds: [] })).rejects.toThrow("selection-invalid");
    await expect(runControlledApolloEnrichment({ adapter, repository, personIds: ["1234567890abcdef", "1234567890abcdef"] })).rejects.toThrow("selection-invalid");
    await expect(runControlledApolloEnrichment({ adapter, repository, personIds: ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", "cccccccccccccccc", "dddddddddddddddd"] })).rejects.toThrow("selection-invalid");
    await expect(runControlledApolloEnrichment({ adapter, repository, personIds: ["!"] })).rejects.toThrow("person-id-invalid");
    await expect(runControlledApolloEnrichment({ adapter, repository, personIds: ["1234567890abcdef"] })).rejects.toThrow("result-invalid");
    repository.close();
  });

  it("enforces the exact endpoint and HTTP-attempt cap", async () => {
    const delegate: ApolloHttpTransport = { request: vi.fn(async () => ({ status: 200, headers: {}, body: "{}" })) };
    const capped = new CappedApolloEnrichmentTransport(delegate, 2);
    const request = { path: "/api/v1/people/match" as const, body: {}, apiKey: "fixture", timeoutMs: 10, maxResponseBytes: 100 };
    await capped.request(request); await capped.request(request);
    await expect(capped.request(request)).rejects.toThrow("http-cap-exceeded");
    await expect(capped.request({ ...request, path: "/api/v1/mixed_people/api_search" })).rejects.toThrow("endpoint-not-authorized");
    expect(delegate.request).toHaveBeenCalledTimes(2);
  });

  it("keeps controlled real-data artifacts excluded from Git", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toContain(".env.*");
    expect(ignore).toContain("data/*.sqlite");
    expect(ignore).toContain("data/*.sqlite-*");
  });
});

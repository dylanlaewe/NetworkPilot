import { describe, expect, it, vi } from "vitest";
import { mapApolloPerson } from "@/infrastructure/providers/apollo";
import { APOLLO_PEOPLE } from "@/infrastructure/providers/apollo/fixtures";
import { SqliteSimulationRepository } from "@/infrastructure/sqlite/database";
import { runControlledApolloSearch } from "./run-controlled-apollo-search";

describe("controlled Apollo live-search use case", () => {
  it("performs exactly one bounded search-only import and preserves the email gate", async () => {
    const repository = new SqliteSimulationRepository(":memory:");
    repository.migrate();
    const record = mapApolloPerson({ ...APOLLO_PEOPLE.senior, email: undefined }, { stage: "search", retrievedAt: "2026-09-09T01:00:00.000Z", datasetClassification: "authorized-provider" });
    const search = vi.fn(async () => ({ records: [record], totalAvailable: 1, requestVersion: "apollo-adapter-v1:test" }));
    const outcome = await runControlledApolloSearch({ adapter: { search }, repository, now: new Date("2026-09-09T01:00:00.000Z"), pass: 0 });
    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ page: 1, perPage: 10, includeSimilarTitles: false, seniorities: ["manager", "director", "senior"], emailStatuses: ["verified"] }));
    expect(outcome).toMatchObject({ requestCount: 1, returnedCount: 1, mappedCount: 1, malformedCount: 0, batch: { validationOutcomes: expect.arrayContaining(["authorized-provider"]) } });
    expect(outcome.candidates[0]).toMatchObject({ state: "rejected", gateFailures: expect.arrayContaining(["email-unverified"]), source: { email: { address: "", verificationStatus: "unknown" } } });
    repository.close();
  });

  it("fails closed before import if search unexpectedly returns an email", async () => {
    const repository = new SqliteSimulationRepository(":memory:");
    repository.migrate();
    const mapped = mapApolloPerson(APOLLO_PEOPLE.senior, { stage: "search", retrievedAt: "2026-09-09T01:00:00.000Z", datasetClassification: "authorized-provider" });
    const record = { ...mapped, email: { address: "unexpected@example.test", verificationStatus: "unknown" as const } };
    await expect(runControlledApolloSearch({ adapter: { search: async () => ({ records: [record], totalAvailable: 1, requestVersion: "test" }) }, repository })).rejects.toThrow("search-email-anomaly");
    expect(repository.listImportedCandidates()).toHaveLength(0);
    repository.close();
  });
});

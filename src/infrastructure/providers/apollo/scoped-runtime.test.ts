import { afterEach, describe, expect, it } from "vitest";
import { SqliteSimulationRepository } from "@/infrastructure/sqlite/database";
import { migrateTestDatabase } from "@/infrastructure/sqlite/test-migrations";
import { SqliteApolloSearchProgressStore } from "./scoped-runtime";

const repositories: SqliteSimulationRepository[] = [];

afterEach(() => {
  repositories.splice(0).forEach((repository) => repository.close());
});

describe("scoped Apollo search progress", () => {
  it("keeps an exhausted semantic query exhausted instead of wrapping to page one", () => {
    const repository = new SqliteSimulationRepository(":memory:");
    repositories.push(repository);
    migrateTestDatabase(repository);
    const store = new SqliteApolloSearchProgressStore(repository);
    const at = new Date("2026-10-15T12:00:00.000Z");

    expect(store.claimNextPage({ queryKey: "a".repeat(64), at })).toBe(1);
    store.observePage({
      queryKey: "a".repeat(64),
      page: 1,
      perPage: 20,
      totalAvailable: 20,
      returned: 20,
      at,
    });
    expect(store.claimNextPage({ queryKey: "a".repeat(64), at })).toBeNull();
    expect(store.claimNextPage({ queryKey: "b".repeat(64), at })).toBe(1);
  });
});

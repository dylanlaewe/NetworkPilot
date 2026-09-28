import type { SqliteSimulationRepository } from "./database";
import { applyPendingMigrations } from "./migration-runner";

/** Test-only schema setup. Never import this module from application or scripts. */
export function migrateTestDatabase(repository: SqliteSimulationRepository, migrationsDirectory?: string): string[] {
  if (!process.env.VITEST) throw new Error("test-migration-authority-unavailable");
  return applyPendingMigrations(repository, migrationsDirectory);
}

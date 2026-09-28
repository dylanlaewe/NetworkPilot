import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SqliteSimulationRepository } from "./database";

/** Sole schema-upgrade implementation. Runtime request code must never import this module. */
export function applyPendingMigrations(repository: SqliteSimulationRepository, migrationsDirectory = resolve(process.cwd(), "migrations")): string[] {
  repository.native.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at_utc TEXT NOT NULL)");
  const applied = repository.native.prepare("SELECT version FROM schema_migrations WHERE version = ?");
  const record = repository.native.prepare("INSERT INTO schema_migrations(version, applied_at_utc) VALUES (?, ?)");
  const newlyApplied: string[] = [];
  for (const file of readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql")).sort()) {
    if (applied.get(file)) continue;
    const sql = readFileSync(join(migrationsDirectory, file), "utf8");
    repository.native.transaction(() => {
      repository.native.exec(sql);
      record.run(file, new Date().toISOString());
    }).immediate();
    newlyApplied.push(file);
  }
  return newlyApplied;
}

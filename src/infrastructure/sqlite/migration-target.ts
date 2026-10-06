import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const MIGRATION_DATABASE_ENV = "NETWORKPILOT_DATABASE_PATH" as const;
export const CANONICAL_DATABASE_ENV =
  "NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH" as const;

export class MigrationTargetConfigurationError extends Error {
  readonly code = "migration-target-configuration-invalid";

  constructor(message: string) {
    super(message);
    this.name = "MigrationTargetConfigurationError";
  }
}

/**
 * Resolves the sole explicit migration target before SQLite is opened.
 * The migration command never falls back to the application/system database.
 */
export function resolveExplicitMigrationTarget(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  cwd = process.cwd(),
  targetExists: (path: string) => boolean = existsSync,
): string {
  const configured = environment[MIGRATION_DATABASE_ENV]?.trim();
  if (!configured) {
    throw new MigrationTargetConfigurationError(
      `${MIGRATION_DATABASE_ENV} is required; refusing the default application/system database fallback.`,
    );
  }

  const target = resolve(cwd, configured);
  const canonicalConfigured = environment[CANONICAL_DATABASE_ENV]?.trim();
  if (
    canonicalConfigured &&
    resolve(cwd, canonicalConfigured) !== target
  ) {
    throw new MigrationTargetConfigurationError(
      `${MIGRATION_DATABASE_ENV} conflicts with ${CANONICAL_DATABASE_ENV}; refusing an ambiguous migration target.`,
    );
  }

  if (!targetExists(target)) {
    throw new MigrationTargetConfigurationError(
      `Migration target does not exist: ${target}`,
    );
  }

  return target;
}

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { assertRuntimeSchema, appliedMigrationVersions } from "./schema-contract";
import {
  DEFAULT_MANUAL_OUTREACH_DATABASE,
  MANUAL_OUTREACH_DATABASE_ENV,
} from "./manual-outreach-operator";

export type DatastoreRole =
  | "canonical-operational"
  | "application-system"
  | "source-evidence"
  | "scratch-cache"
  | "test-only";

export type DatastoreCapability =
  | "application-state-read"
  | "application-state-write"
  | "bucket-state-read"
  | "bucket-state-write"
  | "provider-accounting"
  | "candidate-evidence-read"
  | "simulation-state";

export interface DatastoreDescriptor {
  readonly id: string;
  readonly path: string;
  readonly role: DatastoreRole;
  readonly capabilities: readonly DatastoreCapability[];
  readonly requiredSchema: string;
}

export interface NetworkPilotDatastoreTopology {
  readonly canonical: DatastoreDescriptor;
  readonly system: DatastoreDescriptor;
  readonly recruiterSource: DatastoreDescriptor;
  readonly professionalSearchCache: DatastoreDescriptor;
  readonly recruiterSearchCache: DatastoreDescriptor;
}

const CANONICAL_CAPABILITIES = [
  "application-state-read",
  "application-state-write",
  "bucket-state-read",
  "bucket-state-write",
  "provider-accounting",
  "candidate-evidence-read",
] as const satisfies readonly DatastoreCapability[];

const SOURCE_CAPABILITIES = [
  "candidate-evidence-read",
] as const satisfies readonly DatastoreCapability[];

export function resolveDatastoreTopology(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  cwd = process.cwd(),
): NetworkPilotDatastoreTopology {
  const path = (value: string) => resolve(cwd, value);
  return {
    canonical: {
      id: "operational",
      path: path(
        environment[MANUAL_OUTREACH_DATABASE_ENV] ??
          DEFAULT_MANUAL_OUTREACH_DATABASE,
      ),
      role: "canonical-operational",
      capabilities: CANONICAL_CAPABILITIES,
      requiredSchema: "0021_recipient_buckets.sql",
    },
    system: {
      id: "application-system",
      path: path(
        environment.NETWORKPILOT_DATABASE_PATH ?? "data/networkpilot.sqlite",
      ),
      role: "application-system",
      capabilities: ["application-state-read", "simulation-state"],
      requiredSchema: "0020_resume_library.sql",
    },
    recruiterSource: {
      id: "recruiter-source",
      path: path(
        environment.NETWORKPILOT_RECRUITER_DATABASE_PATH ??
          "data/apollo-recruiter-enrichment.sqlite",
      ),
      role: "source-evidence",
      capabilities: SOURCE_CAPABILITIES,
      requiredSchema: "0011_outreach_tracks.sql",
    },
    professionalSearchCache: {
      id: "professional-search-cache",
      path: path("data/apollo-operational-scale-search.sqlite"),
      role: "scratch-cache",
      capabilities: SOURCE_CAPABILITIES,
      requiredSchema: "0010_manual_hard_bounce.sql",
    },
    recruiterSearchCache: {
      id: "recruiter-search-cache",
      path: path("data/apollo-recruiter-search.sqlite"),
      role: "scratch-cache",
      capabilities: SOURCE_CAPABILITIES,
      requiredSchema: "0011_outreach_tracks.sql",
    },
  };
}

export class DatastoreCapabilityError extends Error {
  readonly code = "datastore-capability-unavailable";

  constructor(
    readonly datastoreId: string,
    readonly capability: DatastoreCapability,
  ) {
    super(`Datastore ${datastoreId} does not own capability ${capability}.`);
    this.name = "DatastoreCapabilityError";
  }
}

export function requireDatastoreCapability(
  descriptor: DatastoreDescriptor,
  capability: DatastoreCapability,
): void {
  if (!descriptor.capabilities.includes(capability))
    throw new DatastoreCapabilityError(descriptor.id, capability);
}

function tableExists(database: Database.Database, name: string): boolean {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(name),
  );
}

function columnExists(
  database: Database.Database,
  table: string,
  column: string,
): boolean {
  return (
    database.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>
  ).some((item) => item.name === column);
}

/** Role-aware readiness. A source store intentionally does not need app migrations. */
export function assertDatastoreSchema(
  descriptor: DatastoreDescriptor,
  database: Database.Database,
): void {
  const openedPath =
      database.name === ":memory:" ? database.name : resolve(database.name),
    declaredPath =
      descriptor.path === ":memory:"
        ? descriptor.path
        : resolve(descriptor.path);
  if (openedPath !== declaredPath)
    throw new Error(`${descriptor.id}-path-mismatch`);
  const versions = appliedMigrationVersions(database);
  if (!versions.includes(descriptor.requiredSchema))
    throw new Error(`${descriptor.id}-schema-unavailable`);
  if (descriptor.role === "canonical-operational") {
    requireDatastoreCapability(descriptor, "bucket-state-write");
    assertRuntimeSchema(database, {
      NETWORKPILOT_FIVE_BUCKET_ENABLED: "true",
    });
    return;
  }
  if (
    (descriptor.role === "source-evidence" ||
      descriptor.role === "scratch-cache") &&
    (!tableExists(database, "imported_candidates") ||
      !columnExists(
        database,
        "imported_candidates",
        "normalized_snapshot_json",
      ))
  )
    throw new Error(`${descriptor.id}-candidate-evidence-unavailable`);
}

export function inspectReadOnlyDatastore(
  descriptor: DatastoreDescriptor,
  requiredCapability: DatastoreCapability,
): void {
  requireDatastoreCapability(descriptor, requiredCapability);
  if (!existsSync(descriptor.path))
    throw new Error(`${descriptor.id}-unavailable`);
  const database = new Database(descriptor.path, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    database.pragma("query_only = ON");
    assertDatastoreSchema(descriptor, database);
  } finally {
    database.close();
  }
}

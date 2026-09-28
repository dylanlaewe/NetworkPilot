import type Database from "better-sqlite3";
import { relative, resolve } from "node:path";
import { fiveBucketEnabled } from "@/domain/recipient-buckets";

export const LEGACY_RUNTIME_SCHEMA = "0020_resume_library.sql";
export const FIVE_BUCKET_RUNTIME_SCHEMA = "0021_recipient_buckets.sql";

export class DatabaseMigrationRequiredError extends Error {
  readonly code = "database-migration-required";
  constructor(readonly requiredVersion: string, readonly databasePath: string) {
    super(`Database migration required for ${databasePath}: run the explicit migration command (missing ${requiredVersion}).`);
    this.name = "DatabaseMigrationRequiredError";
  }
}

export function displayDatabasePath(databasePath:string,cwd=process.cwd()):string{
  if(databasePath===":memory:")return databasePath;
  const absolute=resolve(databasePath),local=relative(cwd,absolute);
  return local&&!local.startsWith("..")&&!resolve(cwd,local).startsWith(`${resolve(cwd)}/..`)?local:absolute;
}

export function explicitMigrationCommand(databasePath:string,cwd=process.cwd()):string{
  const target=displayDatabasePath(databasePath,cwd).replaceAll("'",`'"'"'`);
  return `NETWORKPILOT_DATABASE_PATH='${target}' npm run db:migrate`;
}

export function appliedMigrationVersions(database: Database.Database): string[] {
  const ledger = database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
  if (!ledger) return [];
  return (database.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{version:string}>).map((row) => row.version);
}

export function requiredRuntimeSchema(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return fiveBucketEnabled(env) ? FIVE_BUCKET_RUNTIME_SCHEMA : LEGACY_RUNTIME_SCHEMA;
}

function tableExists(database:Database.Database,name:string):boolean{return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));}
function columnExists(database:Database.Database,table:string,column:string):boolean{return (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{name:string}>).some((item)=>item.name===column);}
function schemaShapeAvailable(database:Database.Database,required:string):boolean{
  if(!tableExists(database,"resume_library"))return false;
  if(required===LEGACY_RUNTIME_SCHEMA)return true;
  return tableExists(database,"recruiter_resume_preference")&&columnExists(database,"imported_candidates","recipient_bucket_json")&&columnExists(database,"candidate_review_audit","bucket_correction_json")&&columnExists(database,"daily_refresh_runs","bucket_scope_json")&&columnExists(database,"candidate_refresh_events","bucket_scope_json")&&columnExists(database,"candidate_refresh_events","result_json")&&columnExists(database,"provider_operations","bucket_scope_json");
}

/** Observes the ledger and required table/column shape. It never mutates schema. */
export function assertRuntimeSchema(database: Database.Database, env: Readonly<Record<string, string | undefined>> = process.env): void {
  const required = requiredRuntimeSchema(env);
  if (!appliedMigrationVersions(database).includes(required)||!schemaShapeAvailable(database,required)) throw new DatabaseMigrationRequiredError(required,displayDatabasePath(database.name));
}

export function isDatabaseMigrationRequired(error: unknown): error is DatabaseMigrationRequiredError {
  return error instanceof DatabaseMigrationRequiredError;
}

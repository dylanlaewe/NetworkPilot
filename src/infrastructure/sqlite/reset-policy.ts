import Database from "better-sqlite3";
import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export class ResetRefusedError extends Error {
  constructor(message: string) { super(`Reset refused: ${message}`); this.name = "ResetRefusedError"; }
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function nearestExistingParent(path: string): string {
  let candidate = path;
  while (!existsSync(candidate)) {
    const parent = dirname(candidate);
    if (parent === candidate) throw new ResetRefusedError("could not resolve an existing parent directory");
    candidate = parent;
  }
  return candidate;
}

export function assertResetEnvironment(environment: string | undefined): void {
  if (environment !== "development" && environment !== "test") throw new ResetRefusedError("NODE_ENV must be development or test");
}

export function resolveSafeResetTarget(configuredPath: string, projectRoot = process.cwd()): string {
  if (configuredPath === ":memory:") throw new ResetRefusedError("a persistent local database path is required");
  const lexicalRoot = resolve(projectRoot, "data");
  const target = resolve(projectRoot, configuredPath);
  if (!isWithin(lexicalRoot, target)) throw new ResetRefusedError(`target must be inside ${lexicalRoot}${sep}`);

  if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw new ResetRefusedError("target database must not be a symbolic link");
  const existingParent = nearestExistingParent(dirname(target));
  const realParent = realpathSync(existingParent);
  const realProject = realpathSync(projectRoot);
  const expectedRoot = existsSync(lexicalRoot) ? realpathSync(lexicalRoot) : resolve(realProject, "data");
  if (existsSync(lexicalRoot) && !isWithin(realProject, expectedRoot)) throw new ResetRefusedError("the data directory resolves outside the project");

  const remainingParent = relative(existingParent, dirname(target));
  const prospectiveRealTarget = resolve(realParent, remainingParent, target.slice(dirname(target).length + 1));
  if (!isWithin(expectedRoot, prospectiveRealTarget)) throw new ResetRefusedError("target resolves outside the project data directory");
  if (existsSync(target) && !isWithin(expectedRoot, realpathSync(target))) throw new ResetRefusedError("target resolves outside the project data directory");
  return target;
}

export function assertExistingDatabaseIsResettable(target: string): void {
  if (!existsSync(target) || statSync(target).size === 0) return;
  const database = new Database(target, { readonly: true, fileMustExist: true });
  try {
    const tables = (database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>).map((row) => row.name);
    if (tables.length === 0) return;
    const hasData = tables.some((table) => (database.prepare(`SELECT EXISTS(SELECT 1 FROM "${table.replaceAll('"', '""')}" LIMIT 1) present`).get() as { present: number }).present === 1);
    if (!hasData) return;
    if (!tables.includes("campaign_settings")) throw new ResetRefusedError("existing database contains data but has no fictional dataset marker");
    const marker = database.prepare("SELECT value FROM campaign_settings WHERE key='datasetType'").get() as { value: string } | undefined;
    if (!marker) throw new ResetRefusedError("existing database contains data but has no fictional dataset marker");
    if (marker.value !== "fictional") throw new ResetRefusedError("existing database datasetType is not exactly fictional");
  } finally { database.close(); }
}

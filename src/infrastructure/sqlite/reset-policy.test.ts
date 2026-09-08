import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteSimulationRepository } from "./database";
import { assertExistingDatabaseIsResettable, assertResetEnvironment, ResetRefusedError, resolveSafeResetTarget } from "./reset-policy";
import { seedFictionalData } from "./seed";

const directories: string[] = [];
function project(): string { const root = mkdtempSync(join(tmpdir(), "networkpilot-reset-")); directories.push(root); mkdirSync(join(root, "data")); return root; }
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

describe("reset protection", () => {
  it("preserves the development/test environment guard", () => {
    expect(() => assertResetEnvironment("production")).toThrow(ResetRefusedError);
    expect(() => assertResetEnvironment(undefined)).toThrow(ResetRefusedError);
    expect(() => assertResetEnvironment("development")).not.toThrow();
  });

  it("refuses an existing unmarked database containing data", () => {
    const root = project(); const target = join(root, "data", "unmarked.sqlite"); const repo = new SqliteSimulationRepository(target); repo.migrate(); repo.close();
    expect(() => assertExistingDatabaseIsResettable(resolveSafeResetTarget(target, root))).toThrow("no fictional dataset marker");
  });

  it("refuses an existing database with a non-fictional marker", () => {
    const root = project(); const target = join(root, "data", "other.sqlite"); const repo = new SqliteSimulationRepository(target); repo.migrate(); repo.setSetting("datasetType", "live", new Date()); repo.close();
    expect(() => assertExistingDatabaseIsResettable(resolveSafeResetTarget(target, root))).toThrow("not exactly fictional");
  });

  it("permits an approved fictional database", () => {
    const root = project(); const target = join(root, "data", "fictional.sqlite"); const repo = new SqliteSimulationRepository(target); repo.migrate(); seedFictionalData(repo); repo.close();
    expect(() => assertExistingDatabaseIsResettable(resolveSafeResetTarget(target, root))).not.toThrow();
  });

  it("permits a missing target and a demonstrably empty existing file", () => {
    const root = project();
    const missing = resolveSafeResetTarget("data/missing.sqlite", root);
    expect(() => assertExistingDatabaseIsResettable(missing)).not.toThrow();
    const empty = join(root, "data", "empty.sqlite"); writeFileSync(empty, "");
    expect(() => assertExistingDatabaseIsResettable(resolveSafeResetTarget(empty, root))).not.toThrow();
  });

  it("refuses paths outside the project data directory", () => {
    const root = project(); expect(() => resolveSafeResetTarget(join(root, "outside.sqlite"), root)).toThrow("must be inside");
  });

  it("refuses a target symlink and a data-directory symlink that escape", () => {
    const root = project(); const outside = mkdtempSync(join(tmpdir(), "networkpilot-outside-")); directories.push(outside);
    const outsideDb = join(outside, "outside.sqlite"); const repo = new SqliteSimulationRepository(outsideDb); repo.migrate(); repo.close();
    symlinkSync(outsideDb, join(root, "data", "linked.sqlite"));
    expect(() => resolveSafeResetTarget("data/linked.sqlite", root)).toThrow("symbolic link");
    const secondRoot = mkdtempSync(join(tmpdir(), "networkpilot-reset-")); directories.push(secondRoot); symlinkSync(outside, join(secondRoot, "data"));
    expect(() => resolveSafeResetTarget("data/escaped.sqlite", secondRoot)).toThrow("data directory resolves outside");
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDailySimulation } from "@/application/simulation/run-daily-simulation";
import { FICTIONAL_PROSPECT_COUNT, seedFictionalData } from "./seed";
import { SqliteSimulationRepository } from "./database";

const cleanup: string[] = [];
function repository(): SqliteSimulationRepository {
  const directory = mkdtempSync(join(tmpdir(), "networkpilot-test-"));
  cleanup.push(directory);
  const repo = new SqliteSimulationRepository(join(directory, "test.sqlite"));
  repo.migrate();
  return repo;
}
afterEach(() => { while (cleanup.length) rmSync(cleanup.pop()!, { recursive: true, force: true }); });
const instant = (day: string) => new Date(`${day}T15:00:00.000Z`);

describe("SQLite fictional simulation", () => {
  it("creates every migration table", () => {
    const repo = repository();
    const tables = (repo.native.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{name:string}>).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(["companies", "prospects", "simulation_runs", "qualification_decisions", "outreach_events", "suppression_entries", "campaign_settings", "schema_migrations"]));
    repo.close();
  });

  it("seeds the deterministic fictional dataset idempotently", () => {
    const repo = repository(); seedFictionalData(repo); seedFictionalData(repo);
    expect(repo.countProspects()).toBe(FICTIONAL_PROSPECT_COUNT);
    expect((repo.native.prepare("SELECT COUNT(DISTINCT industry) count FROM companies").get() as {count:number}).count).toBe(5);
    repo.close();
  });

  it("returns the existing completed same-day run", () => {
    const repo = repository(); seedFictionalData(repo);
    const first = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 });
    const second = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0.99 });
    expect(first.existing).toBe(false); expect(second.existing).toBe(true); expect(second.id).toBe(first.id); expect(second.target).toBe(15);
    expect(repo.recentRuns(10)).toHaveLength(1); repo.close();
  });

  it("enforces the unique campaign-date constraint", () => {
    const repo = repository();
    const base = { id: "a", campaignDate: "2026-09-07", campaignTimezone: "America/New_York", startedAtUtc: instant("2026-09-07").toISOString(), completedAtUtc: instant("2026-09-07").toISOString(), status: "completed" as const, target: 15, selectedCount: 0, shortfall: 15 };
    repo.createRun(base);
    expect(() => repo.createRun({ ...base, id: "b" })).toThrow(); repo.close();
  });

  it("rolls back an incomplete transaction", () => {
    const repo = repository(); seedFictionalData(repo);
    repo.native.exec("CREATE TRIGGER fail_simulated_send BEFORE INSERT ON outreach_events BEGIN SELECT RAISE(ABORT, 'injected event failure'); END");
    expect(() => runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 })).toThrow("injected event failure");
    expect(repo.findRunByDate("2026-09-07")).toBeNull();
    expect((repo.native.prepare("SELECT COUNT(*) count FROM qualification_decisions").get() as {count:number}).count).toBe(0);
    repo.close();
  });

  it("persists the chosen target and an insufficient-pool shortfall", () => {
    const repo = repository(); seedFictionalData(repo);
    repo.native.exec("DELETE FROM suppression_entries; DELETE FROM prospects WHERE id NOT IN ('fictional-person-003','fictional-person-004')");
    const run = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 });
    expect(run.target).toBe(15); expect(run.selectedCount).toBe(2); expect(run.shortfall).toBe(13); repo.close();
  });

  it("persists an auditable weekend no-send run", () => {
    const repo = repository(); seedFictionalData(repo);
    const run = runDailySimulation(repo, { instant: instant("2026-09-06"), random: () => 0.5 });
    expect(run).toMatchObject({ status: "weekend-no-send", target: 0, selectedCount: 0, shortfall: 0 });
    expect((repo.native.prepare("SELECT COUNT(*) count FROM outreach_events").get() as {count:number}).count).toBe(0); repo.close();
  });

  it("preserves historical decision snapshots after prospect changes", () => {
    const repo = repository(); seedFictionalData(repo);
    const run = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 });
    const selected = run.selected[0]!;
    repo.native.prepare("UPDATE companies SET name='Changed Later' WHERE id=(SELECT company_id FROM prospects WHERE id=?)").run(selected.prospectId);
    repo.native.prepare("UPDATE prospects SET first_name='Changed' WHERE id=?").run(selected.prospectId);
    const stored = repo.findRunByDate("2026-09-07")!.selected[0]!;
    expect(stored.prospectName).toBe(selected.prospectName); expect(stored.companyName).toBe(selected.companyName); repo.close();
  });

  it("persists suppression and records it as a qualification reason", () => {
    const repo = repository(); seedFictionalData(repo);
    expect(repo.countSuppressions()).toBeGreaterThan(0);
    const run = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 });
    expect(run.decisions.some((d) => d.reasonCode === "suppressed")).toBe(true); repo.close();
  });

  it("uses simulated-send events for company cooldown", () => {
    const repo = repository(); seedFictionalData(repo);
    const first = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 });
    const selected = first.selected[0]!;
    const companyId = (repo.native.prepare("SELECT company_id FROM prospects WHERE id=?").get(selected.prospectId) as {company_id:string}).company_id;
    repo.native.prepare("INSERT INTO prospects VALUES(?,?,?,?,?,?,?,?,?,1)").run("fictional-alternate", "Fictional", "Alternate", companyId, "fictional.alternate@example.com", 1, 12, 0, 999);
    const second = runDailySimulation(repo, { instant: instant("2026-09-08"), random: () => 0 });
    expect(second.decisions.find((d) => d.prospectId === "fictional-alternate")?.reasonCode).toBe("company-in-cooldown"); repo.close();
  });

  it("selects at most one fictional prospect per company", () => {
    const repo = repository(); seedFictionalData(repo);
    repo.native.prepare("INSERT INTO prospects VALUES(?,?,?,?,?,?,?,?,?,1)").run("fictional-duplicate", "Fictional", "Duplicate", "fictional-company-003", "fictional.duplicate@example.com", 1, 10, 0, 1000);
    const run = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 });
    const companies = run.selected.map((d) => d.companyName);
    expect(new Set(companies).size).toBe(companies.length); repo.close();
  });

  it("simulates five weekdays without selecting a person or company twice", () => {
    const repo = repository(); seedFictionalData(repo);
    const people = new Set<string>(); const companies = new Set<string>();
    for (const day of ["2026-09-07","2026-09-08","2026-09-09","2026-09-10","2026-09-11"]) {
      const run = runDailySimulation(repo, { instant: instant(day), random: () => 0.999 });
      expect(run.selectedCount).toBe(20);
      for (const selected of run.selected) { expect(people.has(selected.prospectId)).toBe(false); expect(companies.has(selected.companyName)).toBe(false); people.add(selected.prospectId); companies.add(selected.companyName); }
    }
    expect(people.size).toBe(100); repo.close();
  });
});

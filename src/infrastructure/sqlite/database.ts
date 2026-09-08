import Database from "better-sqlite3";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { DecisionReasonCode, Industry, OutreachEvent, OutreachEventType, Prospect, QualificationDecision } from "@/domain/outreach";
import type { PersistedDecision, RunSummary, SimulationRepository, SimulationRunView } from "@/application/simulation/types";

export const DEFAULT_DATABASE_PATH = "data/networkpilot.sqlite";

type RunRow = { id: string; campaign_date: string; campaign_timezone: string; started_at_utc: string; completed_at_utc: string; status: RunSummary["status"]; target: number; selected_count: number; shortfall: number };
type DecisionRow = { prospect_id: string; reason_code: DecisionReasonCode; accepted: number; prospect_name_snapshot: string; company_name_snapshot: string; industry_snapshot: Industry; email_snapshot: string; years_experience_snapshot: number; relevance_score_snapshot: number };

export class SqliteSimulationRepository implements SimulationRepository {
  readonly native: Database.Database;
  constructor(databasePath = process.env.NETWORKPILOT_DATABASE_PATH ?? DEFAULT_DATABASE_PATH) {
    if (databasePath !== ":memory:") mkdirSync(dirname(resolve(databasePath)), { recursive: true });
    this.native = new Database(databasePath);
    this.native.pragma("foreign_keys = ON");
    this.native.pragma("journal_mode = WAL");
  }
  close(): void { this.native.close(); }
  migrate(migrationsDirectory = resolve(process.cwd(), "migrations")): void {
    this.native.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at_utc TEXT NOT NULL)");
    const applied = this.native.prepare("SELECT version FROM schema_migrations WHERE version = ?");
    const record = this.native.prepare("INSERT INTO schema_migrations(version, applied_at_utc) VALUES (?, ?)");
    for (const file of readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql")).sort()) {
      if (applied.get(file)) continue;
      const sql = readFileSync(join(migrationsDirectory, file), "utf8");
      this.native.transaction(() => { this.native.exec(sql); record.run(file, new Date().toISOString()); }).immediate();
    }
  }
  transaction<T>(work: () => T): T { return this.native.transaction(work).immediate(); }
  getSetting(key: string): string | undefined { return (this.native.prepare("SELECT value FROM campaign_settings WHERE key = ?").get(key) as { value: string } | undefined)?.value; }
  getDatasetStatus(): { datasetType?: string; prospectCount: number } { return { datasetType: this.getSetting("datasetType"), prospectCount: this.countProspects() }; }
  setSetting(key: string, value: string, at: Date): void { this.native.prepare("INSERT INTO campaign_settings(key,value,updated_at_utc) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at_utc=excluded.updated_at_utc").run(key, value, at.toISOString()); }
  listProspects(): Prospect[] {
    const rows = this.native.prepare(`SELECT p.*, c.name company_name, c.industry, EXISTS(SELECT 1 FROM suppression_entries s WHERE s.prospect_id=p.id) suppressed FROM prospects p JOIN companies c ON c.id=p.company_id ORDER BY p.id`).all() as Array<Record<string, string | number>>;
    return rows.map((r) => ({ id: String(r.id), firstName: String(r.first_name), lastName: String(r.last_name), companyId: String(r.company_id), companyName: String(r.company_name), industry: r.industry as Industry, email: String(r.email), emailVerified: Boolean(r.email_verified), yearsExperience: Number(r.years_experience), suppressed: Boolean(r.suppressed), optedOut: Boolean(r.opted_out), relevanceScore: Number(r.relevance_score) }));
  }
  listOutreachEvents(): OutreachEvent[] {
    const rows = this.native.prepare("SELECT prospect_id, company_id, event_type, occurred_at_utc FROM outreach_events").all() as Array<{ prospect_id: string; company_id: string; event_type: OutreachEventType; occurred_at_utc: string }>;
    return rows.map((r) => ({ prospectId: r.prospect_id, companyId: r.company_id, type: r.event_type, occurredAt: new Date(r.occurred_at_utc) }));
  }
  createRun(run: Omit<RunSummary, "existing">): void {
    this.native.prepare("INSERT INTO simulation_runs(id,campaign_date,campaign_timezone,started_at_utc,completed_at_utc,status,target,selected_count,shortfall) VALUES(?,?,?,?,?,?,?,?,?)").run(run.id, run.campaignDate, run.campaignTimezone, run.startedAtUtc, run.completedAtUtc, run.status, run.target, run.selectedCount, run.shortfall);
  }
  createDecisions(runId: string, decisions: QualificationDecision[]): void {
    const insert = this.native.prepare("INSERT INTO qualification_decisions(run_id,prospect_id,reason_code,accepted,prospect_name_snapshot,company_name_snapshot,industry_snapshot,email_snapshot,years_experience_snapshot,relevance_score_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?)");
    for (const d of decisions) insert.run(runId, d.prospect.id, d.reasonCode, Number(d.accepted), `${d.prospect.firstName} ${d.prospect.lastName}`, d.prospect.companyName, d.prospect.industry, d.prospect.email, d.prospect.yearsExperience, d.prospect.relevanceScore);
  }
  createSimulatedSendEvents(runId: string, prospects: Prospect[], at: Date): void {
    const insert = this.native.prepare("INSERT INTO outreach_events(run_id,prospect_id,company_id,event_type,occurred_at_utc) VALUES(?,?,?,'simulated-sent',?)");
    for (const prospect of prospects) insert.run(runId, prospect.id, prospect.companyId, at.toISOString());
  }
  private summary(row: RunRow, existing = false): RunSummary { return { id: row.id, campaignDate: row.campaign_date, campaignTimezone: row.campaign_timezone, startedAtUtc: row.started_at_utc, completedAtUtc: row.completed_at_utc, status: row.status, target: row.target, selectedCount: row.selected_count, shortfall: row.shortfall, existing }; }
  findRunByDate(date: string): SimulationRunView | null {
    const row = this.native.prepare("SELECT * FROM simulation_runs WHERE campaign_date = ?").get(date) as RunRow | undefined;
    if (!row) return null;
    const decisions = (this.native.prepare("SELECT * FROM qualification_decisions WHERE run_id = ? ORDER BY relevance_score_snapshot DESC, prospect_id").all(row.id) as DecisionRow[]).map((d): PersistedDecision => ({ prospectId: d.prospect_id, reasonCode: d.reason_code, accepted: Boolean(d.accepted), prospectName: d.prospect_name_snapshot, companyName: d.company_name_snapshot, industry: d.industry_snapshot, email: d.email_snapshot, yearsExperience: d.years_experience_snapshot, relevanceScore: d.relevance_score_snapshot }));
    return { ...this.summary(row), decisions, selected: decisions.filter((d) => d.reasonCode === "selected") };
  }
  recentRuns(limit: number): RunSummary[] { return (this.native.prepare("SELECT * FROM simulation_runs ORDER BY campaign_date DESC LIMIT ?").all(limit) as RunRow[]).map((row) => this.summary(row)); }
  countSuppressions(): number { return (this.native.prepare("SELECT COUNT(*) count FROM suppression_entries").get() as { count: number }).count; }
  countProspects(): number { return (this.native.prepare("SELECT COUNT(*) count FROM prospects").get() as { count: number }).count; }
}

import Database from "better-sqlite3";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { DecisionReasonCode, Industry, OutreachEvent, OutreachEventType, Prospect, QualificationDecision } from "@/domain/outreach";
import type { PersistedDecision, RunSummary, SimulationRepository, SimulationRunView } from "@/application/simulation/types";
import type { DraftRecord, DraftStatus, DraftStudioRepository, SelectedDraftRecipient } from "@/application/drafts/types";
import type { PersonalizationEvidence } from "@/domain/drafting";
import type { ScoreComponent, TargetCompany } from "@/domain/targeting";

export const DEFAULT_DATABASE_PATH = "data/networkpilot.sqlite";

type RunRow = { id: string; campaign_date: string; campaign_timezone: string; started_at_utc: string; completed_at_utc: string; status: RunSummary["status"]; target: number; selected_count: number; shortfall: number };
type DecisionRow = { prospect_id: string; reason_code: DecisionReasonCode; accepted: number; prospect_name_snapshot: string; company_name_snapshot: string; industry_snapshot: Industry; email_snapshot: string; years_experience_snapshot: number; relevance_score_snapshot: number };

type DraftRow={id:string;prospect_id:string;run_id:string|null;template_id:string;template_version:string;subject:string;body:string;fact_ids_json:string;evidence_ids_json:string;targeting_score_version:string;targeting_score:number;score_components_json:string;status:DraftStatus;created_at_utc:string;updated_at_utc:string;industry:string;role_family_id:string;company_name:string;prospect_name:string};
export class SqliteSimulationRepository implements SimulationRepository, DraftStudioRepository {
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
  listCompletedRuns():RunSummary[] { return (this.native.prepare("SELECT * FROM simulation_runs WHERE status='completed' ORDER BY campaign_date DESC").all() as RunRow[]).map((row)=>this.summary(row)); }
  listSelectedRecipients(runId:string):SelectedDraftRecipient[] {
    const rows=this.native.prepare(`SELECT p.id,p.first_name,p.last_name,c.name company_name,c.industry,p.years_experience,p.relevance_score FROM qualification_decisions q JOIN prospects p ON p.id=q.prospect_id JOIN companies c ON c.id=p.company_id WHERE q.run_id=? AND q.reason_code='selected' AND p.fictional=1 ORDER BY q.relevance_score_snapshot DESC,p.id`).all(runId) as Array<{id:string;first_name:string;last_name:string;company_name:string;industry:string;years_experience:number;relevance_score:number}>;
    return rows.map((r)=>({id:r.id,firstName:r.first_name,prospectName:`${r.first_name} ${r.last_name}`,companyName:r.company_name,industry:r.industry,industryId:"",roleFamilyId:"",personaId:"",yearsExperience:r.years_experience,relevanceScore:r.relevance_score}));
  }
  listEvidence(prospectId:string):PersonalizationEvidence[] { return (this.native.prepare("SELECT * FROM personalization_evidence WHERE prospect_id=? ORDER BY id").all(prospectId) as Array<{id:string;source_type:"fictional-simulation";source_reference:string;reviewed_at_utc:string;factual_claim:string;verification_status:"verified"|"unverified"}>).map((r)=>({id:r.id,sourceType:r.source_type,sourceReference:r.source_reference,reviewedAt:r.reviewed_at_utc,claim:r.factual_claim,verificationStatus:r.verification_status})); }
  saveDraft(input:Parameters<DraftStudioRepository["saveDraft"]>[0]):DraftRecord {
    this.native.prepare("INSERT OR IGNORE INTO drafts(id,prospect_id,run_id,context_key,template_id,template_version,subject,body,fact_ids_json,evidence_ids_json,targeting_score_version,targeting_score,score_components_json,status,created_at_utc,updated_at_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(input.id,input.recipient.id,input.runId,input.runId,input.rendered.templateId,input.rendered.templateVersion,input.rendered.subject,input.rendered.body,JSON.stringify(input.rendered.referencedFactIds),JSON.stringify(input.rendered.evidenceIds),input.score.version,input.score.total,JSON.stringify(input.score.components),input.status,input.rendered.generatedAt,input.rendered.generatedAt);
    const saved=this.listDrafts().find((draft)=>draft.id===input.id); if(!saved) throw new Error("Draft persistence failed"); return saved;
  }
  listDrafts(filters:Parameters<DraftStudioRepository["listDrafts"]>[0]={}):DraftRecord[] {
    const clauses:string[]=[];const values:string[]=[];
    if(filters?.runId){clauses.push("d.run_id=?");values.push(filters.runId);}if(filters?.industry){clauses.push("c.industry=?");values.push(filters.industry);}if(filters?.templateId){clauses.push("d.template_id=?");values.push(filters.templateId);}if(filters?.status){clauses.push("d.status=?");values.push(filters.status);}
    const rows=this.native.prepare(`SELECT d.*,c.industry,c.name company_name,p.first_name||' '||p.last_name prospect_name,CASE c.industry WHEN 'Technology' THEN 'data-analytics' WHEN 'Defense' THEN 'technical-product' ELSE 'industry-professional' END role_family_id FROM drafts d JOIN prospects p ON p.id=d.prospect_id JOIN companies c ON c.id=p.company_id ${clauses.length?`WHERE ${clauses.join(" AND ")}`:""} ORDER BY d.created_at_utc DESC,d.id`).all(...values) as DraftRow[];
    return rows.filter((r)=>!filters?.roleFamilyId||r.role_family_id===filters.roleFamilyId).map((r)=>{const evidenceIds=JSON.parse(r.evidence_ids_json) as string[];return{id:r.id,prospectId:r.prospect_id,runId:r.run_id,templateId:r.template_id,templateVersion:r.template_version,subject:r.subject,body:r.body,factIds:JSON.parse(r.fact_ids_json) as string[],evidenceIds,evidence:this.listEvidence(r.prospect_id).filter((item)=>evidenceIds.includes(item.id)),scoreVersion:r.targeting_score_version,score:r.targeting_score,scoreComponents:JSON.parse(r.score_components_json) as ScoreComponent[],status:r.status,createdAt:r.created_at_utc,updatedAt:r.updated_at_utc,industry:r.industry,roleFamilyId:r.role_family_id,companyName:r.company_name,prospectName:r.prospect_name};});
  }
  updateDraftStatus(id:string,status:"approved-for-simulation"|"rejected",at:Date):void { const result=this.native.prepare("UPDATE drafts SET status=?,updated_at_utc=? WHERE id=? AND (status IN ('generated','needs-review') OR status=?)").run(status,at.toISOString(),id,status);if(result.changes!==1)throw new Error(`Draft cannot transition to ${status}: ${id}`); }
  listTargetCompanies():TargetCompany[] { return (this.native.prepare("SELECT * FROM target_companies ORDER BY company_tier,canonical_name").all() as Array<{id:string;canonical_name:string;industry_id:string;company_tier:TargetCompany["tier"];enabled:number;recognition_score:number;career_upside_score:number;technical_interest_score:number;geographic_relevance_json:string;rationale:string;provenance:string;last_reviewed_date:string;operator_notes:string}>).map((r)=>({id:r.id,canonicalName:r.canonical_name,industryId:r.industry_id,tier:r.company_tier,enabled:Boolean(r.enabled),recognitionScore:r.recognition_score,careerUpsideScore:r.career_upside_score,technicalInterestScore:r.technical_interest_score,geographicRelevance:JSON.parse(r.geographic_relevance_json) as string[],rationale:r.rationale,provenance:r.provenance,lastReviewedDate:r.last_reviewed_date,operatorNotes:r.operator_notes})); }
}

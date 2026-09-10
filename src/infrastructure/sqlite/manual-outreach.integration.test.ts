import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDraftsForRun } from "@/application/drafts";
import { approveForGmailDraft, type ApprovedEmailDraftSnapshot } from "@/application/email-drafts";
import { confirmManualSendByOperatorId, confirmOperatorManualSend, manualSendOperatorId, reportManualOutreachOutcome } from "@/application/manual-outreach";
import { runDailySimulation } from "@/application/simulation/run-daily-simulation";
import { selectDailyProspects } from "@/domain/outreach";
import { seedFictionalData } from "./seed";
import { SqliteSimulationRepository } from "./database";
import { DEFAULT_MANUAL_OUTREACH_DATABASE, listManualDraftOperatorEntries, resolveManualOutreachDatabaseSelection } from "./manual-outreach-operator";

const directories: string[] = [];
const SENT_AT = new Date("2026-09-09T14:00:00.000Z");
const CONFIRMED_AT = new Date("2026-09-09T14:05:00.000Z");

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "networkpilot-manual-outreach-"));
  directories.push(directory);
  const databasePath=join(directory,"test.sqlite"),repository = new SqliteSimulationRepository(databasePath);
  repository.migrate();
  seedFictionalData(repository);
  const run = runDailySimulation(repository, { instant: new Date("2026-09-07T15:00:00.000Z"), random: () => 0 });
  const draft = generateDraftsForRun(repository, run.id, () => new Date("2026-09-07T16:00:00.000Z"))[0]!;
  const prospect = repository.listProspects().find((item) => item.id === draft.prospectId)!;
  const snapshot: ApprovedEmailDraftSnapshot = {
    snapshotId: draft.id,
    recipientProfessionalEmail: prospect.email,
    recipientDisplayName: draft.prospectName,
    subject: draft.subject,
    body: draft.body,
    planningSnapshotId: run.id,
    templateCatalogVersion: draft.templateCatalogVersion,
    evidenceIds: draft.evidenceIds,
    approvedAt: "2026-09-07T17:00:00.000Z",
  };
  const operation = approveForGmailDraft(repository, snapshot, "fixture-adapter-v1");
  repository.native.prepare("DELETE FROM outreach_events").run();
  repository.native.prepare("DELETE FROM campaign_plan_decisions").run();
  return { repository, databasePath, draft, prospect, operation, snapshot };
}

function markGmailDraftCreated(repository: SqliteSimulationRepository, operationId: string) {
  repository.beginGmailDraftAttempt(operationId, new Date("2026-09-07T17:01:00.000Z"));
  repository.completeGmailDraftOperation(operationId, "fictional-gmail-draft-id", "fictional-gmail-message-id", new Date("2026-09-07T17:02:00.000Z"));
}

afterEach(() => {
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

describe("operator-confirmed manual outreach production path", () => {
  it("selects the explicit operational datastore without searching neighboring databases",()=>{
    const directory=mkdtempSync(join(tmpdir(),"networkpilot-manual-config-"));directories.push(directory);
    const defaultPath=join(directory,DEFAULT_MANUAL_OUTREACH_DATABASE),configuredPath=join(directory,"configured.sqlite");
    const defaultRepository=new SqliteSimulationRepository(defaultPath);defaultRepository.close();const configuredRepository=new SqliteSimulationRepository(configuredPath);configuredRepository.close();
    expect(resolveManualOutreachDatabaseSelection({},directory)).toMatchObject({path:defaultPath,displayPath:DEFAULT_MANUAL_OUTREACH_DATABASE,source:"default-operational"});
    expect(resolveManualOutreachDatabaseSelection({NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH:configuredPath},directory)).toMatchObject({path:configuredPath,source:"environment"});
    expect(resolveManualOutreachDatabaseSelection({NETWORKPILOT_DATABASE_PATH:configuredPath},directory).path).toBe(defaultPath);
  });

  it("upgrades an existing migration-0008 database without changing historical Gmail operations", () => {
    const directory=mkdtempSync(join(tmpdir(),"networkpilot-manual-upgrade-"));directories.push(directory);
    const repository=new SqliteSimulationRepository(join(directory,"upgrade.sqlite"));
    repository.native.exec("CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at_utc TEXT NOT NULL)");
    for(const file of readdirSync(resolve(process.cwd(),"migrations")).filter((name)=>name.endsWith(".sql")&&name<"0009_").sort()){
      repository.native.exec(readFileSync(resolve(process.cwd(),"migrations",file),"utf8"));
      repository.native.prepare("INSERT OR IGNORE INTO schema_migrations(version,applied_at_utc) VALUES(?,?)").run(file,"2026-09-10T00:00:00.000Z");
    }
    const fixture={operationId:"gmail-draft:historical",snapshot:{snapshotId:"historical-snapshot",recipientProfessionalEmail:"fictional@example.invalid",recipientDisplayName:"Fictional Person",subject:"Historical subject",body:"Historical body",planningSnapshotId:"historical-plan",templateCatalogVersion:"catalog-v3",evidenceIds:[],approvedAt:"2026-09-10T00:00:00.000Z"},provider:"gmail" as const,state:"approved-for-gmail-draft" as const,gmailDraftId:null,gmailMessageId:null,attemptStartedAt:null,completedAt:null,errorCategory:null,adapterVersion:"fixture-v1"};
    repository.approveGmailDraftOperation(fixture);repository.migrate();
    expect(repository.findGmailDraftOperation("historical-snapshot")).toEqual(fixture);
    expect(repository.findManualOutreach("historical-snapshot")).toBeNull();
    expect(repository.native.prepare("SELECT version FROM schema_migrations WHERE version='0009_manual_outreach_tracking.sql'").get()).toEqual({version:"0009_manual_outreach_tracking.sql"});
    repository.close();
  });

  it("does not infer a send from Gmail draft creation and preserves historical unconfirmed drafts", () => {
    const { repository, operation } = setup();
    markGmailDraftCreated(repository, operation.operationId);
    expect(repository.findManualOutreach(operation.snapshot.snapshotId)).toBeNull();
    expect(repository.getManualOutreachMetrics().manuallySent).toBe(0);
    expect(repository.listOutreachEvents()).toEqual([]);
    repository.close();
  });

  it("requires a confirmed Gmail draft and resolvable immutable draft identity", () => {
    const { repository, operation } = setup();
    expect(() => confirmOperatorManualSend({ snapshotId: operation.snapshot.snapshotId, effectiveSentAt: SENT_AT, now: () => CONFIRMED_AT, repository })).toThrow("manual-send-gmail-draft-not-confirmed");
    expect(() => confirmOperatorManualSend({ snapshotId: "missing", effectiveSentAt: SENT_AT, now: () => CONFIRMED_AT, repository })).toThrow("manual-send-draft-or-identity-unavailable");
    expect(repository.getManualOutreachMetrics().manuallySent).toBe(0);
    repository.close();
  });

  it("records deliberate confirmation exactly once without any provider dependency", () => {
    const { repository, operation } = setup();
    markGmailDraftCreated(repository, operation.operationId);
    const now = vi.fn(() => CONFIRMED_AT);
    const first = confirmOperatorManualSend({ snapshotId: operation.snapshot.snapshotId, effectiveSentAt: SENT_AT, now, repository });
    const second = confirmOperatorManualSend({ snapshotId: operation.snapshot.snapshotId, effectiveSentAt: new Date("2026-09-09T15:00:00.000Z"), now, repository });
    expect(second).toEqual(first);
    expect(first).toMatchObject({ confirmationSource: "operator", effectiveSentAt: SENT_AT.toISOString(), outcome: "awaiting-response" });
    expect(repository.native.prepare("SELECT COUNT(*) count FROM manual_outreach_audit WHERE event_type='operator-confirmed-manual-send'").get()).toEqual({ count: 1 });
    expect(now).toHaveBeenCalledTimes(1);
    repository.close();
  });

  it("lists stable operation-derived IDs and confirms through exactly one matching ID",()=>{
    const {repository,databasePath,operation}=setup();markGmailDraftCreated(repository,operation.operationId);
    const entries=listManualDraftOperatorEntries(databasePath),entry=entries.find((item)=>item.snapshotId===operation.snapshot.snapshotId)!;
    expect(entry).toMatchObject({operatorId:manualSendOperatorId(operation.operationId),gmailDraftCreated:true,manualSendConfirmed:false});
    expect(entry.operatorId).toMatch(/^npms-[a-f0-9]{16}$/);expect(JSON.stringify(entry)).not.toContain("@example");
    const first=confirmManualSendByOperatorId({entries,operatorId:entry.operatorId,effectiveSentAt:SENT_AT,now:()=>CONFIRMED_AT,repository});
    const second=confirmManualSendByOperatorId({entries,operatorId:entry.operatorId,effectiveSentAt:SENT_AT,now:()=>CONFIRMED_AT,repository});
    expect(second).toEqual(first);expect(repository.native.prepare("SELECT COUNT(*) count FROM manual_outreach_records").get()).toEqual({count:1});expect(repository.native.prepare("SELECT COUNT(*) count FROM manual_outreach_audit").get()).toEqual({count:1});repository.close();
  });

  it("rejects report hashes, nonexistent IDs, and ambiguous IDs before persistence",()=>{
    const {repository,databasePath,operation}=setup();markGmailDraftCreated(repository,operation.operationId);const entry=listManualDraftOperatorEntries(databasePath).find((item)=>item.snapshotId===operation.snapshot.snapshotId)!;
    for(const operatorId of ["dd0c271aac21","npms-0000000000000000"]){expect(()=>confirmManualSendByOperatorId({entries:[entry],operatorId,effectiveSentAt:SENT_AT,now:()=>CONFIRMED_AT,repository})).toThrow();}
    expect(()=>confirmManualSendByOperatorId({entries:[entry,{...entry}],operatorId:entry.operatorId,effectiveSentAt:SENT_AT,now:()=>CONFIRMED_AT,repository})).toThrow("manual-send-operator-id-ambiguous");
    expect(repository.native.prepare("SELECT COUNT(*) count FROM manual_outreach_records").get()).toEqual({count:0});expect(repository.native.prepare("SELECT COUNT(*) count FROM manual_outreach_audit").get()).toEqual({count:0});repository.close();
  });

  it("uses effective manual-send time for repeat-person prevention and company cooldown", () => {
    const { repository, operation, prospect } = setup();
    markGmailDraftCreated(repository, operation.operationId);
    confirmOperatorManualSend({ snapshotId: operation.snapshot.snapshotId, effectiveSentAt: SENT_AT, now: () => CONFIRMED_AT, repository });
    const sameCompany = { ...prospect, id: "fictional-same-company", email: "same-company@example.invalid" };
    const otherCompany = repository.listProspects().find((item) => item.companyId !== prospect.companyId)!;
    const result = selectDailyProspects([prospect, sameCompany, otherCompany], repository.listOutreachEvents(), {
      now: () => new Date("2026-09-10T14:00:00.000Z"),
      random: () => 0,
      config: { minimumDailyTarget: 3, maximumDailyTarget: 3 },
    });
    expect(result.decisions.find((item) => item.prospect.id === prospect.id)?.reasonCode).toBe("previously-contacted");
    expect(result.decisions.find((item) => item.prospect.id === sameCompany.id)?.reasonCode).toBe("company-in-cooldown");
    expect(result.selected.map((item) => item.id)).toEqual([otherCompany.id]);
    expect(repository.listOutreachEvents()[0]?.occurredAt.toISOString()).toBe(SENT_AT.toISOString());
    repository.close();
  });

  it("audits human-reported outcomes, suppresses opt-outs, and leaves the draft snapshot immutable", () => {
    const { repository, operation, snapshot, prospect } = setup();
    markGmailDraftCreated(repository, operation.operationId);
    confirmOperatorManualSend({ snapshotId: snapshot.snapshotId, effectiveSentAt: SENT_AT, now: () => CONFIRMED_AT, repository });
    const immutableBefore = repository.findGmailDraftOperation(snapshot.snapshotId)?.snapshot;
    reportManualOutreachOutcome({ snapshotId: snapshot.snapshotId, outcome: "replied", now: () => new Date("2026-09-10T12:00:00.000Z"), repository });
    const optOut = reportManualOutreachOutcome({ snapshotId: snapshot.snapshotId, outcome: "opt-out", now: () => new Date("2026-09-10T13:00:00.000Z"), repository });
    expect(optOut.outcome).toBe("opt-out");
    expect(repository.listProspects().find((item) => item.id === prospect.id)?.suppressed).toBe(true);
    expect(repository.findGmailDraftOperation(snapshot.snapshotId)?.snapshot).toEqual(immutableBefore);
    expect(repository.getManualOutreachMetrics()).toMatchObject({ manuallySent: 1, outcomes: { "opt-out": 1 }, denominator: "operator-confirmed-manual-send" });
    expect(repository.native.prepare("SELECT COUNT(*) count FROM manual_outreach_audit").get()).toEqual({ count: 3 });
    repository.close();
  });

  it("resolves provider-ready candidates and feeds their opt-outs into imported-candidate suppression", () => {
    const {repository}=setup(),candidate=repository.findImportedCandidate("fictional-flat","flat-001")!;
    const snapshot:ApprovedEmailDraftSnapshot={snapshotId:"operational-fixture-snapshot",recipientProfessionalEmail:"flat.one@example.test",recipientDisplayName:"Fictional F.",subject:"Fictional subject",body:"Fictional body",planningSnapshotId:"operational-scale:authorized:flat-001",templateCatalogVersion:"catalog-v3",evidenceIds:[],approvedAt:"2026-09-09T12:00:00.000Z"};
    const operation=approveForGmailDraft(repository,snapshot,"fixture-adapter-v1");markGmailDraftCreated(repository,operation.operationId);
    const confirmed=confirmOperatorManualSend({snapshotId:snapshot.snapshotId,effectiveSentAt:SENT_AT,now:()=>CONFIRMED_AT,repository});
    expect(confirmed).toMatchObject({candidateId:candidate.id,companyId:"microsoft",identitySource:"imported-candidate"});
    reportManualOutreachOutcome({snapshotId:snapshot.snapshotId,outcome:"opt-out",now:()=>new Date("2026-09-10T13:00:00.000Z"),repository});
    expect(repository.listImportedCandidates().find((item)=>item.id===candidate.id)).toMatchObject({state:"suppressed",source:{consent:{suppressed:true}}});
    expect(repository.native.prepare("SELECT COUNT(*) count FROM candidate_suppression_entries WHERE candidate_id=?").get(candidate.id)).toEqual({count:1});
    repository.close();
  });
});

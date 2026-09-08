import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDailySimulation } from "@/application/simulation/run-daily-simulation";
import { getDashboardData } from "@/application/simulation/dashboard";
import { FICTIONAL_DATASET_UNAVAILABLE, FictionalDatasetUnavailableError } from "@/application/simulation/dataset-readiness";
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
  it("rejects an unseeded database without mutations or randomness", () => {
    const repo = repository(); let randomCalls = 0;
    repo.setSetting("datasetType", "fictional", instant("2026-09-07"));
    expect(() => runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => { randomCalls += 1; return 0; } })).toThrow(FictionalDatasetUnavailableError);
    expect(randomCalls).toBe(0);
    expect(repo.recentRuns(10)).toEqual([]);
    expect((repo.native.prepare("SELECT COUNT(*) count FROM qualification_decisions").get() as {count:number}).count).toBe(0);
    expect((repo.native.prepare("SELECT COUNT(*) count FROM outreach_events").get() as {count:number}).count).toBe(0);
    repo.close();
  });

  it.each([["missing", undefined], ["non-fictional", "production"]] as const)("rejects a %s dataset marker", (_label, marker) => {
    const repo = repository(); seedFictionalData(repo);
    if (marker) repo.setSetting("datasetType", marker, instant("2026-09-07"));
    else repo.native.prepare("DELETE FROM campaign_settings WHERE key='datasetType'").run();
    let randomCalls = 0;
    try { runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => { randomCalls += 1; return 0; } }); throw new Error("expected rejection"); }
    catch (error) { expect(error).toBeInstanceOf(FictionalDatasetUnavailableError); expect((error as FictionalDatasetUnavailableError).code).toBe(FICTIONAL_DATASET_UNAVAILABLE); }
    expect(randomCalls).toBe(0); expect(repo.recentRuns(10)).toEqual([]); repo.close();
  });

  it("allows simulation after an initially unseeded database is seeded", () => {
    const repo = repository();
    expect(() => runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 })).toThrow(FictionalDatasetUnavailableError);
    seedFictionalData(repo);
    expect(runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 })).toMatchObject({ status: "completed", selectedCount: 15 });
    repo.close();
  });

  it("reports dashboard simulation readiness from the application boundary", () => {
    const repo = repository();
    expect(getDashboardData(repo, instant("2026-09-07"))).toMatchObject({ simulationReady: false, prospectCount: 0 });
    seedFictionalData(repo);
    expect(getDashboardData(repo, instant("2026-09-07"))).toMatchObject({ simulationReady: true, prospectCount: FICTIONAL_PROSPECT_COUNT });
    repo.close();
  });

  it("creates every migration table", () => {
    const repo = repository();
    const tables = (repo.native.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{name:string}>).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(["companies", "prospects", "simulation_runs", "campaign_plans", "campaign_plan_decisions", "campaign_plan_lifecycle", "outreach_events", "suppression_entries", "campaign_settings", "schema_migrations"]));
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

  it("keeps the persisted targeting plan idempotent and versioned",()=>{
    const repo=repository();seedFictionalData(repo);const first=runDailySimulation(repo,{instant:instant("2026-09-07"),random:()=>0});const snapshot=structuredClone(repo.findCampaignPlan(first.id));
    repo.native.prepare("UPDATE fictional_targeting_profiles SET role_alignment=1").run();const second=runDailySimulation(repo,{instant:instant("2026-09-07"),random:()=>0.99});
    expect(second.existing).toBe(true);expect(repo.findCampaignPlan(first.id)).toEqual(snapshot);expect(snapshot).toMatchObject({planVersion:"campaign-plan-v1",targetingVersion:"targeting-v1",status:"planned"});repo.close();
  });

  it("keeps an existing same-day run readable if dataset readiness is later lost", () => {
    const repo = repository(); seedFictionalData(repo);
    const first = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 });
    repo.native.prepare("DELETE FROM campaign_settings WHERE key='datasetType'").run();
    const existing = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => { throw new Error("randomness must not run"); } });
    expect(existing).toMatchObject({ id: first.id, existing: true, selectedCount: 15 }); repo.close();
  });

  it("enforces the unique campaign-date constraint", () => {
    const repo = repository();
    const base = { id: "a", campaignDate: "2026-09-07", campaignTimezone: "America/New_York", startedAtUtc: instant("2026-09-07").toISOString(), completedAtUtc: instant("2026-09-07").toISOString(), status: "completed" as const, target: 15, selectedCount: 0, shortfall: 15 };
    repo.createRun(base);
    expect(() => repo.createRun({ ...base, id: "b" })).toThrow(); repo.close();
  });

  it("rolls back an incomplete targeting-plan transaction", () => {
    const repo = repository(); seedFictionalData(repo);
    repo.native.exec("CREATE TRIGGER fail_plan_decision BEFORE INSERT ON campaign_plan_decisions BEGIN SELECT RAISE(ABORT, 'injected plan failure'); END");
    expect(() => runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 })).toThrow("injected plan failure");
    expect(repo.findRunByDate("2026-09-07")).toBeNull();
    expect((repo.native.prepare("SELECT COUNT(*) count FROM campaign_plans").get() as {count:number}).count).toBe(0);
    repo.close();
  });

  it("persists the chosen target and an insufficient-pool shortfall", () => {
    const repo = repository(); seedFictionalData(repo);
    repo.native.exec("DELETE FROM suppression_entries; DELETE FROM personalization_evidence; DELETE FROM prospects WHERE id NOT IN ('fictional-person-003','fictional-person-004')");
    const run = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 });
    expect(run.target).toBe(15); expect(run.selectedCount).toBe(2); expect(run.shortfall).toBe(13); repo.close();
  });

  it("persists an auditable weekend no-send run", () => {
    const repo = repository(); seedFictionalData(repo);
    const run = runDailySimulation(repo, { instant: instant("2026-09-06"), random: () => 0.5 });
    expect(run).toMatchObject({ status: "weekend-no-send", target: 0, selectedCount: 0, shortfall: 0 });
    expect((repo.native.prepare("SELECT COUNT(*) count FROM outreach_events").get() as {count:number}).count).toBe(0); repo.close();
  });

  it("creates no delivery or contact-impacting event while planning",()=>{const repo=repository();seedFictionalData(repo);runDailySimulation(repo,{instant:instant("2026-09-07"),random:()=>0});expect((repo.native.prepare("SELECT COUNT(*) count FROM outreach_events").get() as {count:number}).count).toBe(0);expect(repo.findCampaignPlan("run-2026-09-07")?.selected).toHaveLength(15);repo.close();});

  it("persists complete immutable ranking and company-match provenance",()=>{const repo=repository();seedFictionalData(repo);const run=runDailySimulation(repo,{instant:instant("2026-09-07"),random:()=>0});const plan=repo.findCampaignPlan(run.id)!;const selected=plan.selected[0];expect(selected).toMatchObject({planVersion:"campaign-plan-v1",targetingVersion:"targeting-v1",selected:true,selectionReason:"selected-by-targeting-rank",sourceType:"fictional-fixture"});expect(selected.rankBeforeDiversification).toBeTypeOf("number");expect(selected.components).toHaveLength(8);expect(selected.companyMatch).toMatchObject({method:"simulation-alias",fictionalScenario:true});expect(selected.professionalTitle).toBeTruthy();expect(selected.desiredRoleFamily).toBeTruthy();expect(selected.recipientPersona).toBeTruthy();repo.native.prepare("UPDATE fictional_targeting_profiles SET professional_title='Changed Later',role_alignment=1 WHERE prospect_id=?").run(selected.prospectId);expect(repo.findCampaignPlan(run.id)?.selected[0]).toEqual(selected);repo.close();});

  it("routes SQLite fixtures through normalization with authoritative registry values",()=>{const repo=repository();seedFictionalData(repo);expect("listPlanningCandidates" in repo).toBe(false);const source=repo.listCandidateSourceRecords()[0];const registryId=source.input.publicCompanyRegistryMatch!.companyId;repo.native.prepare("UPDATE target_companies SET company_tier='tier-2',recognition_score=44,career_upside_score=45,technical_interest_score=46 WHERE id=?").run(registryId);repo.native.prepare("UPDATE fictional_company_profiles SET scenario_tier='tier-1',recognition_score=99,career_upside_score=99,technical_interest_score=99 WHERE company_id=?").run(source.fictionalEmployer.id);const run=runDailySimulation(repo,{instant:instant("2026-09-07"),random:()=>0});const decision=repo.findCampaignPlan(run.id)!.decisions.find((item)=>item.prospectId===source.input.internalId)!;expect(decision).toMatchObject({classificationVersion:"classification-v1",normalizedTitle:"senior data engineer",companyTier:"tier-2",companyRecognition:44,companyCareerUpside:45,companyTechnicalInterest:46,matchMethod:"simulation-alias",fictionalEmployer:{name:source.fictionalEmployer.name},strategyCompanyMatch:{registryCompanyId:registryId}});expect(decision.classificationExplanationCodes).toContain("data-quality-derived");repo.close();});

  it("fails conflicting persisted classifications and unreviewed aliases closed",()=>{const repo=repository();seedFictionalData(repo);repo.native.prepare("UPDATE fictional_targeting_profiles SET role_family_id='technical-product',desired_role_id='technical-1' WHERE prospect_id='fictional-person-001'").run();repo.native.prepare("UPDATE fictional_company_profiles SET registry_alias_reviewed=0 WHERE company_id='fictional-company-002'").run();const run=runDailySimulation(repo,{instant:instant("2026-09-07"),random:()=>0});const decisions=repo.findCampaignPlan(run.id)!.decisions;expect(decisions.find((item)=>item.prospectId==="fictional-person-001")?.hardGateRejectionCode).toBe("classification-conflict");expect(decisions.find((item)=>item.prospectId==="fictional-person-002")?.hardGateRejectionCode).toBe("company-alias-unreviewed");repo.close();});

  it("rejects invalid planning inputs before randomness or writes",()=>{const repo=repository();seedFictionalData(repo);repo.setSetting("minimumTargetingScore","NaN",instant("2026-09-07"));let calls=0;expect(()=>runDailySimulation(repo,{instant:instant("2026-09-07"),random:()=>{calls+=1;return 0;}})).toThrow("Invalid campaign planning configuration");expect(calls).toBe(0);expect(repo.recentRuns(1)).toEqual([]);expect(()=>runDailySimulation(repo,{instant:new Date("invalid"),random:()=>{calls+=1;return 0;}})).toThrow("valid Date");expect(calls).toBe(0);repo.close();});

  it("rejects out-of-policy target bounds before randomness or writes",()=>{const repo=repository();seedFictionalData(repo);repo.setSetting("minimumDailyTarget","14",instant("2026-09-07"));let calls=0;expect(()=>runDailySimulation(repo,{instant:instant("2026-09-07"),random:()=>{calls+=1;return 0;}})).toThrow("15–20");expect(calls).toBe(0);expect(repo.recentRuns(1)).toEqual([]);repo.close();});

  it("labels strategy aliases as non-employment exercises in the dashboard source",()=>{const source=readFileSync(join(process.cwd(),"src/app/page.tsx"),"utf8");expect(source).toContain("not an employment claim");expect(source).toContain("fictionalEmployer.name");expect(source).toContain("strategyCompanyMatch");expect(source).not.toMatch(/works (for|at)\s*\{?d\.strategyCompanyMatch/);});

  it("supports cancellation without contact-impacting history",()=>{const repo=repository();seedFictionalData(repo);const run=runDailySimulation(repo,{instant:instant("2026-09-07"),random:()=>0});repo.updateCampaignPlanStatus(run.id,"cancelled",instant("2026-09-07"));expect(repo.findCampaignPlan(run.id)?.status).toBe("cancelled");expect(repo.listOutreachEvents()).toHaveLength(0);expect(()=>repo.updateCampaignPlanStatus(run.id,"planned",new Date())).toThrow("Invalid campaign plan transition");repo.close();});

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

  it("persists a fail-closed decision when a normalized profile is missing",()=>{const repo=repository();seedFictionalData(repo);repo.native.prepare("DELETE FROM fictional_targeting_profiles WHERE prospect_id='fictional-person-001'").run();const run=runDailySimulation(repo,{instant:instant("2026-09-07"),random:()=>0});const decision=repo.findCampaignPlan(run.id)?.decisions.find((item)=>item.prospectId==="fictional-person-001");expect(decision).toMatchObject({selected:false,hardGateRejectionCode:"candidate-input-invalid",selectionReason:"candidate-input-invalid"});repo.close();});

  it("uses non-contacting plan reservations for company cooldown", () => {
    const repo = repository(); seedFictionalData(repo);
    const first = runDailySimulation(repo, { instant: instant("2026-09-07"), random: () => 0 });
    const selected = first.selected[0]!;
    const companyId = (repo.native.prepare("SELECT company_id FROM prospects WHERE id=?").get(selected.prospectId) as {company_id:string}).company_id;
    repo.native.prepare("INSERT INTO prospects VALUES(?,?,?,?,?,?,?,?,?,1)").run("fictional-alternate", "Fictional", "Alternate", companyId, "fictional.alternate@example.com", 1, 12, 0, 999);
    repo.native.prepare("INSERT INTO fictional_targeting_profiles SELECT 'fictional-alternate',professional_title,role_family_id,desired_role_id,persona_id,geography_id,industry_id,role_alignment,functional_relevance,shared_signal,data_quality,role_specific_upside,profile_version FROM fictional_targeting_profiles WHERE prospect_id=?").run(selected.prospectId);
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

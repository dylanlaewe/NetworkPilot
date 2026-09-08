import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FICTIONAL_TARGETING_PROFILE_INVALID, generateDraftsForRun } from "@/application/drafts";
import { runDailySimulation } from "@/application/simulation/run-daily-simulation";
import { TARGET_COMPANIES } from "@/domain/targeting";
import { SqliteSimulationRepository } from "./database";
import { seedFictionalData } from "./seed";

const directories: string[] = [];
function setup() {
  const directory = mkdtempSync(join(tmpdir(), "networkpilot-drafts-")); directories.push(directory);
  const repository = new SqliteSimulationRepository(join(directory, "test.sqlite")); repository.migrate(); seedFictionalData(repository);
  const run = runDailySimulation(repository, { instant: new Date("2026-09-07T15:00:00Z"), random: () => 0 });
  return { repository, run };
}
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

describe("draft persistence and fictional targeting profiles", () => {
  it("creates profile, draft, evidence, and separate registry schema", () => {
    const { repository } = setup();
    const tables = (repository.native.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{name:string}>).map((row) => row.name);
    expect(tables).toEqual(expect.arrayContaining(["drafts", "personalization_evidence", "target_companies", "fictional_targeting_profiles", "fictional_company_profiles"]));
    expect(repository.listTargetCompanies()).toHaveLength(TARGET_COMPANIES.length);
    const columns = (repository.native.prepare("PRAGMA table_info(target_companies)").all() as Array<{name:string}>).map((row) => row.name);
    expect(columns.some((name) => /person|email|contact/i.test(name))).toBe(false); repository.close();
  });

  it("seeds varied, understandable fictional targeting scenarios", () => {
    const { repository } = setup();
    const profiles = repository.native.prepare("SELECT professional_title,role_family_id,persona_id,geography_id,role_alignment,functional_relevance,shared_signal,data_quality FROM fictional_targeting_profiles").all() as Array<Record<string,string|number>>;
    for (const title of ["Senior Data Engineer", "Analytics Manager", "Technical Program Leader", "Commodities Analyst", "Unrelated Corporate Executive", "Junior Data Peer", "Principal Analytics Engineer"]) expect(profiles.some((profile) => profile.professional_title === title)).toBe(true);
    expect(new Set(profiles.map((profile) => profile.role_family_id)).size).toBe(4);
    expect(new Set(profiles.map((profile) => profile.persona_id)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(profiles.map((profile) => profile.geography_id)).size).toBe(5);
    expect(new Set(profiles.map((profile) => `${profile.role_alignment}/${profile.functional_relevance}/${profile.shared_signal}/${profile.data_quality}`)).size).toBeGreaterThan(100);
    const technologyProgramLeader = repository.native.prepare("SELECT t.role_family_id FROM fictional_targeting_profiles t JOIN prospects p ON p.id=t.prospect_id JOIN companies c ON c.id=p.company_id WHERE t.professional_title='Technical Program Leader' AND c.industry='Technology'").get() as {role_family_id:string};
    expect(technologyProgramLeader.role_family_id).toBe("business-delivery");
    const scenarios = repository.native.prepare("SELECT t.professional_title,c.industry,p.years_experience,t.geography_id,t.role_alignment,t.functional_relevance,t.shared_signal,t.data_quality FROM fictional_targeting_profiles t JOIN prospects p ON p.id=t.prospect_id JOIN companies c ON c.id=p.company_id WHERE p.id IN ('fictional-person-001','fictional-person-002','fictional-person-004','fictional-person-005','fictional-person-006','fictional-person-007','fictional-person-008','fictional-person-009','fictional-person-010')").all() as Array<Record<string,string|number>>;
    const scenario = (title:string) => scenarios.find((item) => item.professional_title === title)!;
    expect(scenario("Senior Data Engineer").industry).toBe("Defense"); expect(scenario("Analytics Manager").industry).toBe("Finance"); expect(scenario("Commodities Analyst").industry).toBe("Commodities");
    expect(scenario("Unrelated Corporate Executive")).toMatchObject({role_alignment:10,functional_relevance:5}); expect(scenario("Junior Data Peer").years_experience).toBe(1);
    expect(scenario("Principal Analytics Engineer")).toMatchObject({geography_id:"broader-us",role_alignment:98}); expect(scenario("Business Intelligence Analyst").geography_id).toBe("nyc");
    expect(scenario("Senior Automation Engineer").shared_signal).toBe(95); expect(scenario("Market Data Analyst").data_quality).toBe(45); repository.close();
  });

  it("generates idempotent rotated drafts with explicit version snapshots", () => {
    const { repository, run } = setup();
    const first = generateDraftsForRun(repository, run.id, () => new Date("2026-09-07T16:00:00Z"));
    const second = generateDraftsForRun(repository, run.id, () => new Date("2026-09-08T16:00:00Z"));
    expect(first).toHaveLength(15); expect(second.map((draft) => draft.id)).toEqual(first.map((draft) => draft.id)); expect(repository.listDrafts()).toHaveLength(15);
    expect(second[0]).toMatchObject({ templateVersion: "2.0.0", templateCatalogVersion: "catalog-v2", scoreVersion: "targeting-v1", score: first[0].score, createdAt: "2026-09-07T16:00:00.000Z" });
    expect(new Set(first.map((draft) => draft.templateId)).size).toBeGreaterThan(3); repository.close();
  });

  it("fails closed and atomically when a selected recipient profile is missing or inconsistent", () => {
    const { repository, run } = setup(); const selected = repository.listSelectedRecipients(run.id)[0];
    repository.native.prepare("DELETE FROM fictional_targeting_profiles WHERE prospect_id=?").run(selected.id);
    try { generateDraftsForRun(repository, run.id, () => new Date()); throw new Error("expected invalid profile"); }
    catch (error) { expect((error as {code?:string}).code).toBe(FICTIONAL_TARGETING_PROFILE_INVALID); }
    expect(repository.listDrafts()).toEqual([]); repository.close();
  });

  it("preserves complete historical display and score context after source mutation", () => {
    const { repository, run } = setup(); const original = generateDraftsForRun(repository, run.id, () => new Date())[0]; const snapshot = structuredClone(original.recipientSnapshot);
    repository.native.prepare("UPDATE prospects SET first_name='Changed',years_experience=99 WHERE id=?").run(original.prospectId);
    repository.native.prepare("UPDATE companies SET name='Changed Fictional Employer' WHERE id=?").run(snapshot.companyId);
    repository.native.prepare("UPDATE fictional_targeting_profiles SET professional_title='Changed Title',role_alignment=1 WHERE prospect_id=?").run(original.prospectId);
    repository.native.prepare("UPDATE fictional_company_profiles SET recognition_score=1 WHERE company_id=?").run(snapshot.companyId);
    const historical = repository.listDrafts().find((draft) => draft.id === original.id)!;
    expect(historical.recipientSnapshot).toEqual(snapshot); expect(historical.score).toBe(original.score); expect(historical.scoreComponents).toEqual(original.scoreComponents); expect(historical.templateId).toBe(original.templateId); repository.close();
  });

  it("keeps public companies and fictional employers structurally and referentially separate", () => {
    const { repository, run } = setup(); generateDraftsForRun(repository, run.id, () => new Date());
    const employerNames = new Set(repository.listProspects().map((prospect) => prospect.companyName));
    expect(repository.listTargetCompanies().some((company) => employerNames.has(company.canonicalName))).toBe(false);
    const publicIds = new Set(repository.listTargetCompanies().map((company) => company.id));
    const fictionalIds = (repository.native.prepare("SELECT company_id FROM fictional_company_profiles").all() as Array<{company_id:string}>).map((row) => row.company_id);
    expect(fictionalIds.some((id) => publicIds.has(id))).toBe(false);
    const source = readFileSync(join(process.cwd(), "src/infrastructure/sqlite/database.ts"), "utf8"); expect(source).toContain("AND p.fictional=1"); repository.close();
  });

  it("traces only verified fictional evidence", () => {
    const { repository, run } = setup(); const drafts = generateDraftsForRun(repository, run.id, () => new Date());
    for (const draft of drafts) { const verified = repository.listEvidence(draft.prospectId).filter((item) => item.verificationStatus === "verified"); expect(draft.evidenceIds).toEqual(verified.slice(0, 1).map((item) => item.id)); }
    repository.close();
  });

  it("makes approval/rejection explicit and incapable of affecting outreach or runs", () => {
    const { repository, run } = setup(); const drafts = generateDraftsForRun(repository, run.id, () => new Date());
    const eventCount = repository.listOutreachEvents().length; const runBefore = repository.findRunByDate(run.campaignDate);
    repository.updateDraftStatus(drafts[0].id, "approved-for-simulation", new Date()); repository.updateDraftStatus(drafts[1].id, "rejected", new Date());
    expect(repository.listOutreachEvents()).toHaveLength(eventCount); expect(repository.findRunByDate(run.campaignDate)).toEqual(runBefore);
    expect(() => repository.updateDraftStatus("missing-draft", "rejected", new Date())).toThrow("cannot transition");
    expect(() => repository.updateDraftStatus(drafts[1].id, "approved-for-simulation", new Date())).toThrow("cannot transition");
    expect(() => repository.native.prepare("UPDATE drafts SET status='sent' WHERE id=?").run(drafts[0].id)).toThrow(); repository.close();
  });

  it("rejects missing or non-completed run contexts without drafts", () => {
    const { repository } = setup(); expect(() => generateDraftsForRun(repository, "missing-run", () => new Date())).toThrow("Completed fictional simulation run not found"); expect(repository.listDrafts()).toEqual([]); repository.close();
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateDraftsForRun } from "@/application/drafts";
import { runDailySimulation } from "@/application/simulation/run-daily-simulation";
import { SqliteSimulationRepository } from "./database";
import { seedFictionalData } from "./seed";

const directories:string[]=[];
const instant=new Date("2026-09-07T15:00:00.000Z");
function repository(){const directory=mkdtempSync(join(tmpdir(),"networkpilot-function-plan-"));directories.push(directory);const repo=new SqliteSimulationRepository(join(directory,"test.sqlite"));repo.migrate();seedFictionalData(repo);return repo;}
afterEach(()=>{for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});

function isolateCandidate(repo:SqliteSimulationRepository,title:string,desiredRoleId="",roleFamilyId="",personaId="team-manager"){
  const id="fictional-person-001";
  repo.native.prepare("DELETE FROM suppression_entries WHERE prospect_id=?").run(id);
  repo.native.prepare("INSERT OR IGNORE INTO suppression_entries(prospect_id,reason,created_at_utc) SELECT id,'Function planning test isolation',? FROM prospects WHERE id<>?").run(instant.toISOString(),id);
  repo.native.prepare("UPDATE prospects SET email_verified=1,years_experience=12,opted_out=0 WHERE id=?").run(id);
  repo.native.prepare("UPDATE fictional_targeting_profiles SET professional_title=?,role_family_id=?,desired_role_id=?,persona_id=?,geography_id='boston-ma',role_alignment=90,functional_relevance=90,shared_signal=70,data_quality=100,role_specific_upside=90 WHERE prospect_id=?").run(title,roleFamilyId,desiredRoleId,personaId,id);
  return id;
}

describe("recipient-function production planning",()=>{
  it("selects an Analytics Program Manager and drafts solely from its immutable targeting-v2 plan",()=>{
    const repo=repository(),id=isolateCandidate(repo,"Analytics Program Manager","project-manager","business-delivery");
    const normalized=repo.listCandidateSourceRecords().find((record)=>record.input.internalId===id)!;
    expect(normalized.input.professionalTitle).toBe("Analytics Program Manager");

    const run=runDailySimulation(repo,{instant,random:()=>0});
    const plan=repo.findCampaignPlan(run.id)!;
    const decision=plan.decisions.find((item)=>item.prospectId===id)!;
    expect(run.selectedCount).toBe(1);
    expect(decision).toMatchObject({
      selected:true,
      hardGateRejectionCode:null,
      classificationVersion:"classification-v1",
      normalizedTitle:"analytics program manager",
      desiredRoleFamily:"business-delivery",
      desiredRoleId:"project-manager",
      targetingVersion:"targeting-v2",
      recipientFunctionVersion:"recipient-function-v2",
      recipientRelevanceVersion:"recipient-relevance-v2",
      primaryRecipientFunction:"project-program",
      secondaryRecipientFunctions:expect.arrayContaining(["data-analytics"]),
      recipientFunctionConfidence:"high",
      preciseTargetRoleId:null,
      recipientPersona:"team-manager",
    });
    expect(decision.recipientRelevanceScore).toBeGreaterThan(0);
    expect(decision.totalScore).toBeGreaterThanOrEqual(55);
    expect(decision.rankBeforeDiversification).toBe(1);
    expect(decision.classificationExplanationCodes).not.toContain("role-title-unknown");
    expect(decision.components.find((component)=>component.id==="recipient-functional-relevance")?.raw).toBe(decision.recipientRelevanceScore);

    const immutable=structuredClone(decision);
    repo.native.prepare("UPDATE fictional_targeting_profiles SET professional_title='Changed Source Title',desired_role_id='data-engineer',role_family_id='data-analytics',functional_relevance=1 WHERE prospect_id=?").run(id);
    expect(repo.findCampaignPlan(run.id)?.decisions.find((item)=>item.prospectId===id)).toEqual(immutable);
    const draft=generateDraftsForRun(repo,run.id,()=>new Date("2026-09-07T16:00:00.000Z"))[0]!;
    expect(draft).toMatchObject({scoreVersion:"targeting-v2",score:immutable.totalScore,scoreComponents:immutable.components,recipientSnapshot:{professionalTitle:"analytics program manager",recipientFunctionVersion:"recipient-function-v2",recipientRelevanceVersion:"recipient-relevance-v2",primaryRecipientFunction:"project-program",preciseTargetRoleId:null}});
    repo.close();
  });

  it.each([
    ["unknown","General Manager","team-manager","recipient-function-unknown"],
    ["unrelated","Account Executive","senior-ic","recipient-function-unrelated"],
    ["unrelated recruiting","Talent Acquisition Director","functional-director","recipient-function-unrelated"],
    ["ambiguous digital transformation","Director Digital Transformation","functional-director","recipient-function-unknown"],
    ["prohibited seniority","Chief Executive Officer","team-manager","c-suite-rejected"],
  ] as const)("fails %s recipients closed in the production planner",(_label,title,personaId,rejectionCode)=>{
    const repo=repository(),id=isolateCandidate(repo,title,"","",personaId);
    const run=runDailySimulation(repo,{instant,random:()=>0});
    const decision=repo.findCampaignPlan(run.id)!.decisions.find((item)=>item.prospectId===id)!;
    expect(run.selectedCount).toBe(0);
    expect(decision).toMatchObject({selected:false,hardGateRejectionCode:rejectionCode,selectionReason:rejectionCode});
    repo.close();
  });

  it("selects a technical-security recipient on function grounds without an exact target role",()=>{const repo=repository(),id=isolateCandidate(repo,"Security Analyst II","software-engineer","technical-product","senior-ic");const run=runDailySimulation(repo,{instant,random:()=>0});const decision=repo.findCampaignPlan(run.id)!.decisions.find((item)=>item.prospectId===id)!;expect(decision).toMatchObject({selected:true,preciseTargetRoleId:null,primaryRecipientFunction:"technical-infrastructure",recipientFunctionVersion:"recipient-function-v2",recipientRelevanceVersion:"recipient-relevance-v2",hardGateRejectionCode:null});repo.close();});

  it.each([
    ["verified email",(repo:SqliteSimulationRepository,id:string)=>repo.native.prepare("UPDATE prospects SET email_verified=0 WHERE id=?").run(id),"email-unverified"],
    ["five years of experience",(repo:SqliteSimulationRepository,id:string)=>repo.native.prepare("UPDATE prospects SET years_experience=4 WHERE id=?").run(id),"insufficient-experience"],
    ["reviewed company",(repo:SqliteSimulationRepository,id:string)=>repo.native.prepare("UPDATE fictional_company_profiles SET registry_alias_reviewed=0 WHERE company_id=(SELECT company_id FROM prospects WHERE id=?)").run(id),"company-alias-unreviewed"],
  ] as const)("does not let technical-security relevance bypass required %s",(_label,mutate,rejectionCode)=>{const repo=repository(),id=isolateCandidate(repo,"Security Analyst II","software-engineer","technical-product","senior-ic");mutate(repo,id);runDailySimulation(repo,{instant,random:()=>0});expect(repo.findCampaignPlan("run-2026-09-07")!.decisions.find((item)=>item.prospectId===id)).toMatchObject({selected:false,hardGateRejectionCode:rejectionCode});repo.close();});

  it("keeps an explicitly persisted legacy targeting-v1 plan readable",()=>{
    const repo=repository();
    const run=runDailySimulation(repo,{instant,random:()=>0});
    const current=repo.findCampaignPlan(run.id)!.decisions[0]!;
    const legacy={...current,targetingVersion:"targeting-v1" as const};
    delete legacy.recipientFunctionVersion;delete legacy.recipientRelevanceVersion;delete legacy.recipientRelevanceScore;delete legacy.primaryRecipientFunction;delete legacy.secondaryRecipientFunctions;delete legacy.recipientFunctionEvidence;delete legacy.recipientFunctionConfidence;delete legacy.preciseTargetRoleId;delete legacy.targetRoleAffinities;
    repo.createRun({id:"legacy-plan",campaignDate:"2026-09-08",campaignTimezone:"America/New_York",startedAtUtc:instant.toISOString(),completedAtUtc:instant.toISOString(),status:"completed",target:1,selectedCount:Number(legacy.selected),shortfall:Number(!legacy.selected)});
    repo.createCampaignPlan({id:"legacy-plan",planVersion:"campaign-plan-v1",targetingVersion:"targeting-v1",status:"planned",diversificationConfig:{},quotaRelaxations:[],at:instant});
    repo.createPlanDecisions("legacy-plan",[legacy]);
    expect(repo.findCampaignPlan("legacy-plan")).toMatchObject({targetingVersion:"targeting-v1",decisions:[{targetingVersion:"targeting-v1"}]});
    repo.close();
  });

  it("keeps persisted recipient-function-v1 relevance snapshots immutable and draftable",()=>{const repo=repository(),id=isolateCandidate(repo,"Analytics Program Manager","project-manager","business-delivery");const run=runDailySimulation(repo,{instant,random:()=>0}),current=repo.findCampaignPlan(run.id)!.decisions.find((item)=>item.prospectId===id)!;const legacy={...current,recipientFunctionVersion:"recipient-function-v1",recipientRelevanceVersion:"recipient-relevance-v1",targetRoleAffinities:current.targetRoleAffinities?.map((item)=>({...item,mappingVersion:"function-role-relevance-v1"}))};repo.createRun({id:"legacy-function-plan",campaignDate:"2026-09-08",campaignTimezone:"America/New_York",startedAtUtc:instant.toISOString(),completedAtUtc:instant.toISOString(),status:"completed",target:1,selectedCount:1,shortfall:0});repo.createCampaignPlan({id:"legacy-function-plan",planVersion:"campaign-plan-v1",targetingVersion:"targeting-v2",status:"planned",diversificationConfig:{},quotaRelaxations:[],at:instant});repo.createPlanDecisions("legacy-function-plan",[legacy]);repo.native.prepare("UPDATE fictional_targeting_profiles SET professional_title='Changed Later' WHERE prospect_id=?").run(id);const stored=repo.findCampaignPlan("legacy-function-plan")!.selected[0]!;expect(stored).toMatchObject({recipientFunctionVersion:"recipient-function-v1",recipientRelevanceVersion:"recipient-relevance-v1"});expect(stored.targetRoleAffinities?.every((item)=>item.mappingVersion==="function-role-relevance-v1")).toBe(true);const draft=generateDraftsForRun(repo,"legacy-function-plan",()=>new Date("2026-09-08T16:00:00Z"))[0]!;expect(draft.recipientSnapshot).toMatchObject({recipientFunctionVersion:"recipient-function-v1",recipientRelevanceVersion:"recipient-relevance-v1",professionalTitle:"analytics program manager"});repo.close();});
});

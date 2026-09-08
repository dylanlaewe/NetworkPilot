import { campaignCalendar, DEFAULT_SELECTION_CONFIG } from "@/domain/outreach";
import { CAMPAIGN_PLAN_VERSION, DEFAULT_DIVERSIFICATION_CONFIG, planDailyCampaign, validatePlanningConfiguration } from "@/domain/planning";
import { TARGETING_SCORE_VERSION } from "@/domain/targeting";
import { CLASSIFICATION_VERSION } from "@/domain/candidates";
import { DEFAULT_CANDIDATE_PIPELINE_CONFIG, normalizeCandidateSources } from "@/application/planning";
import type { CreateRunInput, SimulationRepository, SimulationRunView } from "./types";
import { requireFictionalDataset } from "./dataset-readiness";

export function runDailySimulation(repository: SimulationRepository, input: CreateRunInput): SimulationRunView {
  const timezone = repository.getSetting("campaignTimezone") ?? DEFAULT_SELECTION_CONFIG.campaignTimezone;
  const calendar = campaignCalendar(input.instant, timezone);
  const existing = repository.findRunByDate(calendar.date);
  if (existing) return { ...existing, existing: true };

  requireFictionalDataset(repository);

  return repository.transaction(() => {
    const concurrentExisting = repository.findRunByDate(calendar.date);
    if (concurrentExisting) return { ...concurrentExisting, existing: true };
    requireFictionalDataset(repository);
    const minimum=Number(repository.getSetting("minimumDailyTarget")??DEFAULT_SELECTION_CONFIG.minimumDailyTarget),maximum=Number(repository.getSetting("maximumDailyTarget")??DEFAULT_SELECTION_CONFIG.maximumDailyTarget);
    if(!Number.isInteger(minimum)||!Number.isInteger(maximum)||minimum<15||maximum>20||minimum>maximum)throw new RangeError("Daily target configuration must remain within 15–20");
    const cooldown=Number(repository.getSetting("companyCooldownDays")??DEFAULT_SELECTION_CONFIG.companyCooldownDays);
    const diversification={industrySoftCap:Number(repository.getSetting("industrySoftCap")??DEFAULT_DIVERSIFICATION_CONFIG.industrySoftCap),roleFamilySoftCap:Number(repository.getSetting("roleFamilySoftCap")??DEFAULT_DIVERSIFICATION_CONFIG.roleFamilySoftCap),minimumScore:Number(repository.getSetting("minimumTargetingScore")??DEFAULT_DIVERSIFICATION_CONFIG.minimumScore)};
    validatePlanningConfiguration(input.instant,cooldown,diversification);
    const classificationVersion=repository.getSetting("classificationVersion")??CLASSIFICATION_VERSION;
    const candidates=normalizeCandidateSources(repository.listCandidateSourceRecords(),repository.listTargetCompanies(),{...DEFAULT_CANDIDATE_PIPELINE_CONFIG,classificationVersion,minimumScore:diversification.minimumScore});
    const sample=calendar.isWeekday?input.random():0;if(calendar.isWeekday&&(!Number.isFinite(sample)||sample<0||sample>=1))throw new RangeError("random must return a number from 0 (inclusive) to 1 (exclusive)");
    const target=calendar.isWeekday?minimum+Math.floor(sample*(maximum-minimum+1)):0;
    const result=calendar.isWeekday?planDailyCampaign(candidates,repository.listOutreachEvents(),target,input.instant,cooldown,diversification,DEFAULT_CANDIDATE_PIPELINE_CONFIG.weights): {target:0,decisions:[],selected:[],quotaRelaxations:[],qualifiedPopulation:0};
    const id = `run-${calendar.date}`;
    const timestamp = input.instant.toISOString();
    repository.createRun({ id, campaignDate: calendar.date, campaignTimezone: timezone, startedAtUtc: timestamp, completedAtUtc: timestamp, status: calendar.isWeekday ? "completed" : "weekend-no-send", target: result.target, selectedCount: result.selected.length, shortfall: result.target-result.selected.length });
    repository.createCampaignPlan({id,planVersion:CAMPAIGN_PLAN_VERSION,targetingVersion:TARGETING_SCORE_VERSION,status:"planned",diversificationConfig:diversification,quotaRelaxations:result.quotaRelaxations,at:input.instant});
    repository.createPlanDecisions(id,result.decisions);
    const created = repository.findRunByDate(calendar.date);
    if (!created) throw new Error("Simulation transaction did not produce a run");
    return { ...created, existing: false };
  });
}

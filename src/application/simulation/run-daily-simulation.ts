import { campaignCalendar, DEFAULT_SELECTION_CONFIG, selectDailyProspects } from "@/domain/outreach";
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
    const result = selectDailyProspects(repository.listProspects(), repository.listOutreachEvents(), {
      now: () => input.instant,
      random: input.random,
      config: {
        campaignTimezone: timezone,
        companyCooldownDays: Number(repository.getSetting("companyCooldownDays") ?? DEFAULT_SELECTION_CONFIG.companyCooldownDays),
        minimumYearsExperience: Number(repository.getSetting("minimumYearsExperience") ?? DEFAULT_SELECTION_CONFIG.minimumYearsExperience),
        minimumDailyTarget: Number(repository.getSetting("minimumDailyTarget") ?? DEFAULT_SELECTION_CONFIG.minimumDailyTarget),
        maximumDailyTarget: Number(repository.getSetting("maximumDailyTarget") ?? DEFAULT_SELECTION_CONFIG.maximumDailyTarget),
      },
    });
    const id = `run-${calendar.date}`;
    const timestamp = input.instant.toISOString();
    repository.createRun({ id, campaignDate: calendar.date, campaignTimezone: timezone, startedAtUtc: timestamp, completedAtUtc: timestamp, status: result.isWeekday ? "completed" : "weekend-no-send", target: result.target, selectedCount: result.selected.length, shortfall: result.shortfall });
    repository.createDecisions(id, result.decisions);
    repository.createSimulatedSendEvents(id, result.selected, input.instant);
    const created = repository.findRunByDate(calendar.date);
    if (!created) throw new Error("Simulation transaction did not produce a run");
    return { ...created, existing: false };
  });
}

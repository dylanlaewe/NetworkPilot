import { campaignCalendar, DEFAULT_SELECTION_CONFIG } from "@/domain/outreach";
import type { DashboardData, SimulationRepository } from "./types";
import { getFictionalDatasetReadiness } from "./dataset-readiness";

export function getDashboardData(repository: SimulationRepository, instant: Date): DashboardData {
  const timezone = repository.getSetting("campaignTimezone") ?? DEFAULT_SELECTION_CONFIG.campaignTimezone;
  const calendar = campaignCalendar(instant, timezone);
  const readiness = getFictionalDatasetReadiness(repository);
  return { today: calendar.date, isWeekday: calendar.isWeekday, timezone, latestRun: repository.findRunByDate(calendar.date), recentRuns: repository.recentRuns(7), suppressionCount: repository.countSuppressions(), prospectCount: readiness.prospectCount, simulationReady: readiness.ready };
}

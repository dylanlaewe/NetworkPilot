import { campaignCalendar, DEFAULT_SELECTION_CONFIG } from "@/domain/outreach";
import type { DashboardData, SimulationRepository } from "./types";

export function getDashboardData(repository: SimulationRepository, instant: Date): DashboardData {
  const timezone = repository.getSetting("campaignTimezone") ?? DEFAULT_SELECTION_CONFIG.campaignTimezone;
  const calendar = campaignCalendar(instant, timezone);
  return { today: calendar.date, isWeekday: calendar.isWeekday, timezone, latestRun: repository.findRunByDate(calendar.date), recentRuns: repository.recentRuns(7), suppressionCount: repository.countSuppressions(), prospectCount: repository.countProspects() };
}

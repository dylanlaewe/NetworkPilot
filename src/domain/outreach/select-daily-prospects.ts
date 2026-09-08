import type { DailySelectionResult, OutreachEvent, Prospect, QualificationDecision, SelectionConfig, SelectionOptions } from "./types";
import { CONTACT_IMPACTING_EVENT_TYPES } from "./types";

export const DEFAULT_SELECTION_CONFIG: Readonly<SelectionConfig> = { minimumDailyTarget: 15, maximumDailyTarget: 20, companyCooldownDays: 7, minimumYearsExperience: 5, campaignTimezone: "America/New_York" };
const DAY_IN_MS = 86_400_000;

export function campaignCalendar(instant: Date, timeZone: string): { date: string; weekday: string; isWeekday: boolean } {
  if (Number.isNaN(instant.getTime())) throw new RangeError("now must return a valid Date");
  let parts: Intl.DateTimeFormatPart[];
  try { parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(instant); }
  catch { throw new RangeError(`Invalid campaign timezone: ${timeZone}`); }
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = value("weekday");
  return { date: `${value("year")}-${value("month")}-${value("day")}`, weekday, isWeekday: weekday !== "Sat" && weekday !== "Sun" };
}

function validateConfig(config: SelectionConfig): void {
  for (const [name, value] of [["minimumDailyTarget", config.minimumDailyTarget], ["maximumDailyTarget", config.maximumDailyTarget], ["companyCooldownDays", config.companyCooldownDays]] as const) {
    if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer`);
  }
  if (config.minimumDailyTarget > config.maximumDailyTarget) throw new RangeError("minimumDailyTarget cannot exceed maximumDailyTarget");
  if (!Number.isFinite(config.minimumYearsExperience) || config.minimumYearsExperience < 0) throw new RangeError("minimumYearsExperience must be a non-negative number");
  campaignCalendar(new Date(0), config.campaignTimezone);
}

function chooseTarget(config: SelectionConfig, random: () => number): number {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new RangeError("random must return a number from 0 (inclusive) to 1 (exclusive)");
  return config.minimumDailyTarget + Math.floor(sample * (config.maximumDailyTarget - config.minimumDailyTarget + 1));
}

export function selectDailyProspects(prospects: readonly Prospect[], history: readonly OutreachEvent[], options: SelectionOptions): DailySelectionResult {
  const config = { ...DEFAULT_SELECTION_CONFIG, ...options.config };
  validateConfig(config);
  const now = options.now();
  const calendar = campaignCalendar(now, config.campaignTimezone);
  if (!calendar.isWeekday) return { date: calendar.date, target: 0, selected: [], decisions: [], isWeekday: false, shortfall: 0 };
  const target = chooseTarget(config, options.random);
  const impacting = history.filter((event) => CONTACT_IMPACTING_EVENT_TYPES.has(event.type));
  const contacted = new Set(impacting.map((event) => event.prospectId));
  const cooldownStart = now.getTime() - config.companyCooldownDays * DAY_IN_MS;
  const coolingCompanies = new Set(impacting.filter((event) => event.occurredAt.getTime() > cooldownStart && event.occurredAt.getTime() <= now.getTime()).map((event) => event.companyId));
  const decisions = new Map<string, QualificationDecision>();
  const eligible: Prospect[] = [];
  for (const prospect of prospects) {
    let reason: QualificationDecision["reasonCode"] | undefined;
    if (prospect.suppressed) reason = "suppressed";
    else if (prospect.optedOut) reason = "opted-out";
    else if (!prospect.emailVerified) reason = "email-unverified";
    else if (prospect.yearsExperience < config.minimumYearsExperience) reason = "insufficient-experience";
    else if (contacted.has(prospect.id)) reason = "previously-contacted";
    else if (coolingCompanies.has(prospect.companyId)) reason = "company-in-cooldown";
    if (reason) decisions.set(prospect.id, { prospect, reasonCode: reason, accepted: false }); else eligible.push(prospect);
  }
  eligible.sort((a, b) => b.relevanceScore - a.relevanceScore || a.id.localeCompare(b.id));
  const selected: Prospect[] = [];
  const runCompanies = new Set<string>();
  for (const prospect of eligible) {
    if (runCompanies.has(prospect.companyId)) decisions.set(prospect.id, { prospect, reasonCode: "duplicate-company-in-run", accepted: false });
    else if (selected.length < target) { selected.push(prospect); runCompanies.add(prospect.companyId); decisions.set(prospect.id, { prospect, reasonCode: "selected", accepted: true }); }
    else decisions.set(prospect.id, { prospect, reasonCode: "eligible-below-cutoff", accepted: true });
  }
  return { date: calendar.date, target, selected, decisions: prospects.map((p) => decisions.get(p.id)).filter((d): d is QualificationDecision => Boolean(d)), isWeekday: true, shortfall: target - selected.length };
}

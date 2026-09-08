import type {
  DailySelectionResult,
  OutreachEvent,
  Prospect,
  SelectionConfig,
  SelectionOptions,
} from "./types";

export const DEFAULT_SELECTION_CONFIG: Readonly<SelectionConfig> = {
  minimumDailyTarget: 15,
  maximumDailyTarget: 20,
  companyCooldownDays: 7,
  minimumYearsExperience: 5,
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function validateConfig(config: SelectionConfig): void {
  const integerFields: Array<[string, number]> = [
    ["minimumDailyTarget", config.minimumDailyTarget],
    ["maximumDailyTarget", config.maximumDailyTarget],
    ["companyCooldownDays", config.companyCooldownDays],
  ];

  for (const [name, value] of integerFields) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative integer`);
    }
  }

  if (config.minimumDailyTarget > config.maximumDailyTarget) {
    throw new RangeError("minimumDailyTarget cannot exceed maximumDailyTarget");
  }

  if (!Number.isFinite(config.minimumYearsExperience) || config.minimumYearsExperience < 0) {
    throw new RangeError("minimumYearsExperience must be a non-negative number");
  }
}

function targetFor(config: SelectionConfig, random: () => number): number {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError("random must return a number from 0 (inclusive) to 1 (exclusive)");
  }

  const range = config.maximumDailyTarget - config.minimumDailyTarget + 1;
  return config.minimumDailyTarget + Math.floor(sample * range);
}

export function selectDailyProspects(
  prospects: readonly Prospect[],
  history: readonly OutreachEvent[],
  options: SelectionOptions,
): DailySelectionResult {
  const config: SelectionConfig = { ...DEFAULT_SELECTION_CONFIG, ...options.config };
  validateConfig(config);

  const now = options.now();
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("now must return a valid Date");
  }

  const date = now.toISOString().slice(0, 10);
  const day = now.getUTCDay();
  const isWeekday = day >= 1 && day <= 5;
  if (!isWeekday) {
    return { date, target: 0, selected: [], isWeekday: false, shortfall: 0 };
  }

  const target = targetFor(config, options.random);
  const previouslyContacted = new Set(history.map((event) => event.prospectId));
  const cooldownStart = now.getTime() - config.companyCooldownDays * DAY_IN_MS;
  const companiesInCooldown = new Set(
    history
      .filter((event) => {
        const occurredAt = event.occurredAt.getTime();
        return occurredAt > cooldownStart && occurredAt <= now.getTime();
      })
      .map((event) => event.companyId),
  );

  const eligible = prospects
    .filter(
      (prospect) =>
        !prospect.suppressed &&
        !prospect.optedOut &&
        prospect.emailVerified &&
        prospect.yearsExperience >= config.minimumYearsExperience &&
        !previouslyContacted.has(prospect.id) &&
        !companiesInCooldown.has(prospect.companyId),
    )
    .sort(
      (left, right) =>
        right.relevanceScore - left.relevanceScore || left.id.localeCompare(right.id),
    );

  const selected: Prospect[] = [];
  const selectedCompanies = new Set<string>();
  for (const prospect of eligible) {
    if (selected.length === target) break;
    if (selectedCompanies.has(prospect.companyId)) continue;
    selected.push(prospect);
    selectedCompanies.add(prospect.companyId);
  }

  return {
    date,
    target,
    selected,
    isWeekday: true,
    shortfall: target - selected.length,
  };
}

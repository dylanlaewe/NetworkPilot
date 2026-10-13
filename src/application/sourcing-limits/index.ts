import type { ApolloConfig } from "@/infrastructure/providers/apollo/types";

export const SOURCING_DAILY_ALLOWANCE_KEY =
  "sourcingDailyNetworkPilotCreditAllowance";
export const SOURCING_MAXIMUM_PER_RUN_KEY =
  "sourcingMaximumCreditsPerFindPeopleRun";

export interface SourcingLimits {
  dailyAllowance: number;
  maximumPerRun: number;
}

export interface SourcingLimitSettingsReader {
  getSetting(key: string): string | undefined;
}

export interface SourcingLimitSettingsWriter extends SourcingLimitSettingsReader {
  setSetting(key: string, value: string, at: Date): void;
}

function configuredDefault(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function defaultSourcingLimits(config: ApolloConfig): SourcingLimits {
  return {
    dailyAllowance: configuredDefault(config.maxEnrichmentsPerDay, 10),
    maximumPerRun: configuredDefault(config.maxEnrichmentsPerBatch, 5),
  };
}

function persistedPositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum
    ? parsed
    : fallback;
}

export function readSourcingLimits(
  settings: SourcingLimitSettingsReader,
  config: ApolloConfig,
): SourcingLimits {
  const defaults = defaultSourcingLimits(config);
  return {
    dailyAllowance: persistedPositiveInteger(
      settings.getSetting(SOURCING_DAILY_ALLOWANCE_KEY),
      defaults.dailyAllowance,
      1_000,
    ),
    maximumPerRun: persistedPositiveInteger(
      settings.getSetting(SOURCING_MAXIMUM_PER_RUN_KEY),
      defaults.maximumPerRun,
      20,
    ),
  };
}

export function validateSourcingLimits(input: {
  dailyAllowance: number;
  maximumPerRun: number;
}): SourcingLimits {
  if (
    !Number.isSafeInteger(input.dailyAllowance) ||
    input.dailyAllowance < 1 ||
    input.dailyAllowance > 1_000
  )
    throw new Error("sourcing-daily-allowance-invalid");
  if (
    !Number.isSafeInteger(input.maximumPerRun) ||
    input.maximumPerRun < 1 ||
    input.maximumPerRun > 20
  )
    throw new Error("sourcing-maximum-per-run-invalid");
  if (input.maximumPerRun > input.dailyAllowance)
    throw new Error("sourcing-maximum-exceeds-daily-allowance");
  return input;
}

export function saveSourcingLimits(
  settings: SourcingLimitSettingsWriter,
  input: SourcingLimits,
  at: Date,
): SourcingLimits {
  const limits = validateSourcingLimits(input);
  settings.setSetting(
    SOURCING_DAILY_ALLOWANCE_KEY,
    String(limits.dailyAllowance),
    at,
  );
  settings.setSetting(
    SOURCING_MAXIMUM_PER_RUN_KEY,
    String(limits.maximumPerRun),
    at,
  );
  return limits;
}

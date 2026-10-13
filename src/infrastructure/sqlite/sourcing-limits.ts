import type { ApolloConfig } from "@/infrastructure/providers/apollo/types";
import {
  readSourcingLimits,
  saveSourcingLimits,
  type SourcingLimits,
} from "@/application/sourcing-limits";
import type { SqliteSimulationRepository } from "./database";

export interface SourcingUsage extends SourcingLimits {
  timezone: string;
  localDate: string;
  accountedOrHeldExposure: number;
  confirmedConsumption: number;
  hasUnknownConsumption: boolean;
  remainingAllowance: number;
  nextResetLabel: string;
}

export function sourcingLocalDate(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function nextSourcingResetLabel(at: Date, timezone: string): string {
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(local.find((item) => item.type === type)?.value);
  const tomorrow = new Date(
    Date.UTC(part("year"), part("month") - 1, part("day") + 1),
  );
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(tomorrow);
  return `${date} at 12:00 AM (${timezone})`;
}

export function loadSourcingUsage(
  repository: SqliteSimulationRepository,
  config: ApolloConfig,
  at = new Date(),
): SourcingUsage {
  const limits = readSourcingLimits(repository, config);
  const timezone = repository.getSetting("campaignTimezone") ?? "America/New_York";
  const localDate = sourcingLocalDate(at, timezone);
  const accounting = repository.getApolloProviderStatus(localDate);
  return {
    ...limits,
    timezone,
    localDate,
    accountedOrHeldExposure: accounting.estimatedExposure,
    confirmedConsumption: accounting.knownObservedConsumption,
    hasUnknownConsumption: accounting.hasUnknownConsumption,
    remainingAllowance: Math.max(
      0,
      limits.dailyAllowance - accounting.estimatedExposure,
    ),
    nextResetLabel: nextSourcingResetLabel(at, timezone),
  };
}

export function persistSourcingLimits(
  repository: SqliteSimulationRepository,
  input: SourcingLimits,
  at = new Date(),
): SourcingLimits {
  return repository.transaction(() =>
    saveSourcingLimits(repository, input, at),
  );
}

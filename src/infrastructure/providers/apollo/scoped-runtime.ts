import { readApolloConfig } from "./config";
import { FetchApolloTransport } from "./http";
import {
  isScopedApolloProviderConfigured,
  ScopedApolloProvider,
} from "./scoped-provider";
import { SqliteApolloPersonReservationStore } from "@/infrastructure/sqlite/apollo-person-reservations";
import type { SqliteSimulationRepository } from "@/infrastructure/sqlite/database";

const localDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export function scopedApolloProviderConfigured(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  try {
    return isScopedApolloProviderConfigured(readApolloConfig(environment));
  } catch {
    return false;
  }
}

export function createServerScopedApolloProvider(
  repository: SqliteSimulationRepository,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now: () => Date = () => new Date(),
): ScopedApolloProvider {
  return new ScopedApolloProvider({
    config: readApolloConfig(environment),
    transport: new FetchApolloTransport(),
    now,
    sleep: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    datasetClassification: "authorized-provider",
    localDate,
    personReservations: new SqliteApolloPersonReservationStore(repository),
    existingProviderIds: () =>
      new Set(
        repository
          .listImportedCandidates()
          .filter((candidate) => candidate.source.sourceProviderId === "apollo")
          .map((candidate) => candidate.source.providerRecordId),
      ),
  });
}

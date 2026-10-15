import { readApolloConfig } from "./config";
import { FetchApolloTransport } from "./http";
import {
  isScopedApolloProviderConfigured,
  ScopedApolloProvider,
  type ApolloSearchProgressStore,
} from "./scoped-provider";
import { SqliteApolloPersonReservationStore } from "@/infrastructure/sqlite/apollo-person-reservations";
import type { SqliteSimulationRepository } from "@/infrastructure/sqlite/database";
import type { ApolloConfig } from "./types";

const localDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

interface SearchProgressState {
  nextPage: number;
  totalPages: number | null;
  lastPage: number | null;
  lastReturned: number | null;
}

const progressSettingKey = (queryKey: string) =>
  `apollo.scoped-search-progress.${queryKey}`;

function readSearchProgress(
  repository: SqliteSimulationRepository,
  queryKey: string,
): SearchProgressState {
  try {
    const parsed = JSON.parse(
      repository.getSetting(progressSettingKey(queryKey)) ?? "{}",
    ) as Partial<SearchProgressState>;
    return {
      nextPage:
        Number.isInteger(parsed.nextPage) && (parsed.nextPage ?? 0) > 0
          ? parsed.nextPage!
          : 1,
      totalPages:
        Number.isInteger(parsed.totalPages) && (parsed.totalPages ?? 0) > 0
          ? parsed.totalPages!
          : null,
      lastPage:
        Number.isInteger(parsed.lastPage) && (parsed.lastPage ?? 0) > 0
          ? parsed.lastPage!
          : null,
      lastReturned:
        Number.isInteger(parsed.lastReturned) &&
        (parsed.lastReturned ?? -1) >= 0
          ? parsed.lastReturned!
          : null,
    };
  } catch {
    return { nextPage: 1, totalPages: null, lastPage: null, lastReturned: null };
  }
}

/** Uses the existing settings ledger to serialize a cursor per stable query. */
export class SqliteApolloSearchProgressStore
  implements ApolloSearchProgressStore
{
  constructor(private readonly repository: SqliteSimulationRepository) {}

  claimNextPage(input: { queryKey: string; at: Date }): number | null {
    return this.repository.transaction(() => {
      const current = readSearchProgress(this.repository, input.queryKey);
      if (
        (current.totalPages !== null && current.nextPage > current.totalPages) ||
        current.nextPage > 500
      )
        return null;
      const page = current.nextPage;
      this.repository.setSetting(
        progressSettingKey(input.queryKey),
        JSON.stringify({ ...current, nextPage: page + 1 }),
        input.at,
      );
      return page;
    });
  }

  observePage(input: {
    queryKey: string;
    page: number;
    perPage: number;
    totalAvailable: number | null;
    returned: number;
    at: Date;
  }): void {
    this.repository.transaction(() => {
      const current = readSearchProgress(this.repository, input.queryKey);
      const totalPages =
        input.totalAvailable === null
          ? current.totalPages
          : Math.max(1, Math.ceil(input.totalAvailable / input.perPage));
      this.repository.setSetting(
        progressSettingKey(input.queryKey),
        JSON.stringify({
          ...current,
          totalPages,
          lastPage: input.page,
          lastReturned: input.returned,
        }),
        input.at,
      );
    });
  }
}

function unavailableCompanyDomains(
  repository: SqliteSimulationRepository,
): ReadonlySet<string> {
  const candidateIds = new Set(
    (
      repository.native
        .prepare("SELECT candidate_id FROM manual_outreach_records")
        .all() as Array<{ candidate_id: string }>
    ).map((row) => row.candidate_id),
  );
  const operations = repository.native
    .prepare(
      "SELECT approved_snapshot_json FROM gmail_draft_operations WHERE send_state IN ('not-sent','sending','sent','send-status-uncertain')",
    )
    .all() as Array<{ approved_snapshot_json: string }>;
  for (const row of operations) {
    try {
      const snapshot = JSON.parse(row.approved_snapshot_json) as {
        candidateId?: string;
      };
      if (snapshot.candidateId) candidateIds.add(snapshot.candidateId);
    } catch {
      // Malformed approved snapshots fail closed elsewhere and contribute no
      // speculative search exclusion here.
    }
  }
  return new Set(
    repository
      .listImportedCandidates()
      .filter((candidate) => candidateIds.has(candidate.id))
      .flatMap((candidate) =>
        candidate.source.currentOrganization.domain
          ? [candidate.source.currentOrganization.domain.toLowerCase()]
          : [],
      ),
  );
}

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
  configOverride?: ApolloConfig,
): ScopedApolloProvider {
  return new ScopedApolloProvider({
    config: configOverride ?? readApolloConfig(environment),
    transport: new FetchApolloTransport(),
    now,
    sleep: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    datasetClassification: "authorized-provider",
    localDate,
    personReservations: new SqliteApolloPersonReservationStore(repository),
    searchProgress: new SqliteApolloSearchProgressStore(repository),
    excludedCompanyDomains: () => unavailableCompanyDomains(repository),
    strictProviderShape:
      environment.NETWORKPILOT_APOLLO_STRICT_PROVIDER_SHAPE === "true",
    existingProviderIds: () =>
      new Set(
        repository
          .listImportedCandidates()
          .filter((candidate) => candidate.source.sourceProviderId === "apollo")
          .map((candidate) => candidate.source.providerRecordId),
      ),
  });
}

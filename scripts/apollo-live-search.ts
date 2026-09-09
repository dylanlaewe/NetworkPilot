import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { runControlledApolloSearch, CONTROLLED_APOLLO_COMPANY_DOMAINS, CONTROLLED_APOLLO_SEARCHES } from "../src/application/providers/run-controlled-apollo-search";
import { TARGET_COMPANIES } from "../src/domain/targeting";
import { ApolloAdapter } from "../src/infrastructure/providers/apollo/adapter";
import { readApolloConfig } from "../src/infrastructure/providers/apollo/config";
import { FetchApolloTransport } from "../src/infrastructure/providers/apollo/http";
import type { ApolloHttpTransport } from "../src/infrastructure/providers/apollo/types";
import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";

class OneRequestSearchTransport implements ApolloHttpTransport {
  requestCount = 0;
  constructor(private readonly delegate: ApolloHttpTransport) {}
  request(input: Parameters<ApolloHttpTransport["request"]>[0]) {
    if (input.path !== "/api/v1/mixed_people/api_search") throw new Error("controlled-apollo-endpoint-not-authorized");
    if (this.requestCount >= 1) throw new Error("controlled-apollo-http-request-cap-exceeded");
    this.requestCount += 1;
    return this.delegate.request(input);
  }
}

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  if (process.env.NETWORKPILOT_APOLLO_ENABLED !== "true") throw new Error("controlled-apollo-feature-disabled");
  if (!process.env.APOLLO_API_KEY?.trim()) throw new Error("controlled-apollo-api-key-missing");
  const databasePath = resolve(process.cwd(), "data", "apollo-live-validation.sqlite");
  const repository = new SqliteSimulationRepository(databasePath);
  const transport = new OneRequestSearchTransport(new FetchApolloTransport());
  const controlledEnvironment = { ...process.env, NETWORKPILOT_APOLLO_MAX_RETRIES: "0" };
  try {
    repository.migrate();
    const importedRequests = (repository.native.prepare("SELECT COUNT(*) count FROM import_batches WHERE adapter_id = 'apollo' AND id LIKE 'apollo-live-search-%'").get() as { count: number }).count;
    const recordedRequests = Number(repository.getSetting("apolloLiveSearch61aRequestCount") ?? 0);
    const priorRequests = Math.max(importedRequests, Number.isSafeInteger(recordedRequests) ? recordedRequests : 0);
    if (priorRequests >= CONTROLLED_APOLLO_SEARCHES.length) throw new Error("controlled-apollo-milestone-request-cap-exceeded");
    const search = CONTROLLED_APOLLO_SEARCHES[priorRequests];
    repository.setSetting("apolloLiveSearch61aRequestCount", String(priorRequests + 1), new Date());
    const adapter = new ApolloAdapter(readApolloConfig(controlledEnvironment), transport, repository, { now: () => new Date(), sleep: async () => {}, datasetClassification: "authorized-provider", localDate: (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) });
    const outcome = await runControlledApolloSearch({ adapter, repository, pass: priorRequests as 0 | 1 | 2 });
    const summaries = outcome.candidates.map((candidate) => {
    const remainingGates = candidate.gateFailures.filter((failure) => failure !== "email-unverified");
    return {
      name: `${candidate.source.person.firstName} ${candidate.source.person.lastName}`,
      currentTitle: candidate.source.currentTitle,
      organization: candidate.source.currentOrganization.name,
      location: candidate.source.location,
      apolloId: candidate.source.providerRecordId,
      normalizedTitle: candidate.classification.normalizedTitle,
      proposedRole: candidate.classification.specificRoleId,
      roleFamily: candidate.classification.roleFamilyId,
      recipientPersona: candidate.personaId,
      experience: candidate.experience.kind,
      minimumExperience: candidate.experience.minimumSupportedYears,
      maximumExperience: candidate.experience.maximumSupportedYears,
      companyMatch: candidate.strategyCompanyMatch,
      companyTier: candidate.strategyCompanyMatch ? TARGET_COMPANIES.find((company) => company.id === candidate.strategyCompanyMatch?.companyId)?.tier ?? null : null,
      dataQuality: candidate.dataQualityScore,
      lifecycleState: candidate.state,
      reviewState: candidate.reviewState,
      gateFailures: candidate.gateFailures,
      eligibleBeforeEmailVerification: remainingGates.length === 0,
      progression: remainingGates.length === 0 ? "Blocked only by search-only email verification boundary." : `Blocked or held for review by: ${remainingGates.join(", ")}.`,
    };
    });
    console.log(JSON.stringify({
    operation: "NetworkPilot Milestone 6.1A controlled live search",
    logicalSearchCount: outcome.requestCount,
    httpRequestCount: transport.requestCount,
    milestoneHttpRequestNumber: priorRequests + transport.requestCount,
    endpoint: "https://api.apollo.io/api/v1/mixed_people/api_search",
    companies: Object.keys(CONTROLLED_APOLLO_COMPANY_DOMAINS),
    filters: search,
    returnedCount: outcome.returnedCount,
    mappedCount: outcome.mappedCount,
    malformedCount: outcome.malformedCount,
    totalAvailable: outcome.totalAvailable,
    importBatch: { id: outcome.batch.id, state: outcome.batch.state, accepted: outcome.batch.acceptedCount, reviewRequired: outcome.batch.reviewRequiredCount, rejected: outcome.batch.rejectedCount },
    summaries,
    }, null, 2));
  } finally {
    repository.close();
  }
}

void main();

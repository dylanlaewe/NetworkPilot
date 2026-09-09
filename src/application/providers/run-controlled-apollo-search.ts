import { createHash } from "node:crypto";
import { importCandidateBatch, type ImportBatch, type ImportedCandidateSnapshot, type IngestionRepository } from "@/application/ingestion";
import type { CandidateSourceRecord } from "@/domain/candidates";
import { TARGET_COMPANIES, type TargetCompany } from "@/domain/targeting";
import type { ApolloSearchOptions, ApolloSearchResult } from "@/infrastructure/providers/apollo";

export const CONTROLLED_APOLLO_COMPANY_DOMAINS = {
  microsoft: "microsoft.com",
  "goldman-sachs": "goldmansachs.com",
  rtx: "rtx.com",
} as const;

const BASE_CONTROLLED_APOLLO_SEARCH: Readonly<Omit<ApolloSearchOptions, "specificTitles">> = {
  batchId: "apollo-live-search-6.1a",
  companyDomains: Object.values(CONTROLLED_APOLLO_COMPANY_DOMAINS),
  seniorities: ["manager", "director", "senior"],
  personLocations: ["Boston, Massachusetts", "New York, New York", "New Jersey, United States"],
  includeSimilarTitles: false,
  page: 1,
  perPage: 10,
};
export const CONTROLLED_APOLLO_SEARCHES: readonly Readonly<ApolloSearchOptions>[] = [
  { ...BASE_CONTROLLED_APOLLO_SEARCH, specificTitles: ["Data Engineer", "Data Analyst", "Analytics Manager", "Software Engineer", "Program Manager"], emailStatuses: ["verified"] },
  { ...BASE_CONTROLLED_APOLLO_SEARCH, specificTitles: ["Senior Data Engineer", "Data Engineering Manager", "Director of Data Engineering", "Senior Software Engineer", "Software Engineering Manager"], emailStatuses: ["verified"] },
  { ...BASE_CONTROLLED_APOLLO_SEARCH, specificTitles: ["Senior Data Analyst", "Senior Data Engineer", "Senior Software Engineer", "Analytics Manager", "Technical Program Leader"] },
] as const;

interface SearchOnlyApolloAdapter {
  search(options: ApolloSearchOptions): Promise<ApolloSearchResult>;
}

export interface ControlledApolloSearchOutcome {
  requestCount: 1;
  returnedCount: number;
  mappedCount: number;
  malformedCount: 0;
  totalAvailable: number | null;
  batch: ImportBatch;
  candidates: ImportedCandidateSnapshot[];
}

function selectedCompanies(registry: readonly TargetCompany[]): TargetCompany[] {
  const ids = Object.keys(CONTROLLED_APOLLO_COMPANY_DOMAINS);
  const selected = ids.map((id) => registry.find((company) => company.id === id && company.enabled && (company.tier === "tier-1" || company.tier === "tier-2")));
  if (selected.some((company) => !company)) throw new Error("controlled-apollo-registry-company-unavailable");
  return selected as TargetCompany[];
}

function batchFingerprint(records: readonly CandidateSourceRecord[], search: Readonly<ApolloSearchOptions>): string {
  return `apollo-live-search:${createHash("sha256").update(JSON.stringify(search)).update(records.map((record) => record.sourceFingerprint).sort().join("|")).digest("hex")}`;
}

export async function runControlledApolloSearch(input: {
  adapter: SearchOnlyApolloAdapter;
  repository: IngestionRepository;
  registry?: readonly TargetCompany[];
  now?: Date;
  pass?: 0 | 1 | 2;
}): Promise<ControlledApolloSearchOutcome> {
  const registry = input.registry ?? TARGET_COMPANIES;
  selectedCompanies(registry);
  const search = CONTROLLED_APOLLO_SEARCHES[input.pass ?? 0];
  const result = await input.adapter.search({ ...search });
  if (result.records.length > 10) throw new Error("controlled-apollo-result-cap-exceeded");
  if (result.records.some((record) => record.email.address.trim())) throw new Error("controlled-apollo-search-email-anomaly");
  if (result.records.some((record) => record.email.verificationStatus !== "unknown")) throw new Error("controlled-apollo-search-verification-anomaly");
  const batchId = `apollo-live-search-${(input.now ?? new Date()).toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
  const batch = importCandidateBatch(input.repository, registry, {
    batchId,
    adapterId: "apollo",
    adapterVersion: result.requestVersion,
    datasetClassification: "authorized-provider",
    sourceFingerprint: batchFingerprint(result.records, search),
    records: result.records,
    authorizedProviderAccess: { enabled: true, providerId: "apollo" },
    strategyCompanyDomains: CONTROLLED_APOLLO_COMPANY_DOMAINS,
  }, input.now);
  const candidates = input.repository.listImportedCandidates().filter((candidate) => candidate.batchId === batch.id);
  return { requestCount: 1, returnedCount: result.records.length, mappedCount: result.records.length, malformedCount: 0, totalAvailable: result.totalAvailable, batch, candidates };
}

import { createHash } from "node:crypto";
import { importCandidateBatch, type ImportedCandidateSnapshot, type IngestionRepository } from "@/application/ingestion";
import type { CandidateSourceRecord } from "@/domain/candidates";
import { TARGET_COMPANIES } from "@/domain/targeting";
import type { ApolloHttpResponse, ApolloHttpTransport } from "@/infrastructure/providers/apollo";

export const CONTROLLED_ENRICHMENT_MAX_CANDIDATES = 3;
export const CONTROLLED_ENRICHMENT_MAX_HTTP_ATTEMPTS = 6;
export const CONTROLLED_ENRICHMENT_MAX_CREDIT_EXPOSURE = 27;

interface EnrichmentAdapter {
  enrich(input: { batchId: string; personIds: string[]; persistedSearchPersonIds: string[] }): Promise<CandidateSourceRecord[]>;
}

export class CappedApolloEnrichmentTransport implements ApolloHttpTransport {
  requestCount = 0;
  constructor(private readonly delegate: ApolloHttpTransport, private readonly maximum = CONTROLLED_ENRICHMENT_MAX_HTTP_ATTEMPTS) {}
  async request(input: Parameters<ApolloHttpTransport["request"]>[0]): Promise<ApolloHttpResponse> {
    if (input.path !== "/api/v1/people/match") throw new Error("controlled-apollo-enrichment-endpoint-not-authorized");
    if (this.requestCount >= this.maximum) throw new Error("controlled-apollo-enrichment-http-cap-exceeded");
    this.requestCount += 1;
    return this.delegate.request(input);
  }
}

const fingerprint = (record: CandidateSourceRecord) => `apollo-enrichment-v1:${createHash("sha256").update(record.sourceFingerprint).digest("hex")}`;

export async function runControlledApolloEnrichment(input: {
  adapter: EnrichmentAdapter;
  repository: IngestionRepository;
  personIds: readonly string[];
  now?: () => Date;
}): Promise<ImportedCandidateSnapshot[]> {
  if (input.personIds.length < 1 || input.personIds.length > CONTROLLED_ENRICHMENT_MAX_CANDIDATES || new Set(input.personIds).size !== input.personIds.length) throw new Error("controlled-apollo-enrichment-selection-invalid");
  const imported: ImportedCandidateSnapshot[] = [];
  for (const [index, personId] of input.personIds.entries()) {
    if (!/^[a-z0-9][a-z0-9._:-]{2,127}$/i.test(personId)) throw new Error("controlled-apollo-enrichment-person-id-invalid");
    const at = input.now?.() ?? new Date();
    const batchId = `apollo-live-enrichment-${index + 1}-${at.toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
    const records = await input.adapter.enrich({ batchId, personIds: [personId], persistedSearchPersonIds: [personId] });
    if (records.length !== 1 || records[0].providerRecordId !== personId) throw new Error("controlled-apollo-enrichment-result-invalid");
    importCandidateBatch(input.repository, TARGET_COMPANIES, {
      batchId,
      adapterId: "apollo",
      adapterVersion: records[0].providerMetadata?.adapterVersion ?? "apollo-adapter-v1",
      datasetClassification: "authorized-provider",
      sourceFingerprint: fingerprint(records[0]),
      records,
      authorizedProviderAccess: { enabled: true, providerId: "apollo" },
      strategyCompanyDomains: { microsoft: "microsoft.com" },
    }, at);
    const candidate = input.repository.findImportedCandidate("apollo", personId);
    if (!candidate) throw new Error("controlled-apollo-enrichment-import-missing");
    imported.push(candidate);
  }
  return imported;
}

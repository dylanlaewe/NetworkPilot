import { importCandidateBatch, type ImportedCandidateSnapshot } from "@/application/ingestion";
import type { CandidateSourceRecord } from "@/domain/candidates";
import { matchesBucketScope, type BucketScope } from "@/domain/recipient-buckets";
import type { TargetCompany } from "@/domain/targeting";
import type { SqliteSimulationRepository } from "./database";

export interface ScopedCandidateCompletionResult {
  added: ImportedCandidateSnapshot[];
  imported: ImportedCandidateSnapshot[];
}

/**
 * The single local completion gate for both ordinary scoped discovery and
 * retained-result recovery. It re-runs current canonical classification,
 * company, consent/suppression, dedupe, and original BucketScope policy.
 */
export function completeScopedCandidateRecords(input: {
  repository: SqliteSimulationRepository;
  operationId: string;
  scope: BucketScope;
  records: CandidateSourceRecord[];
  adapterVersion: string;
  sourceFingerprint: string;
  at: Date;
  companies?: readonly TargetCompany[];
  companyDomains?: Readonly<Record<string, string>>;
}): ScopedCandidateCompletionResult {
  const beforeIds = new Set(
    input.repository.listImportedCandidates().map((candidate) => candidate.id),
  );
  if (input.records.length) {
    const provider = input.records[0]!.sourceProviderId;
    const dataset = input.records[0]!.datasetClassification;
    if (
      input.records.some(
        (record) =>
          record.sourceProviderId !== provider ||
          record.datasetClassification !== dataset,
      )
    )
      throw new Error("scoped-refresh-source-conflict");
    importCandidateBatch(
      input.repository,
      input.companies ?? input.repository.listTargetCompanies(),
      {
        batchId: input.operationId,
        adapterId: provider,
        adapterVersion: input.adapterVersion,
        datasetClassification: dataset,
        sourceFingerprint: input.sourceFingerprint,
        records: input.records,
        strategyCompanyDomains: input.companyDomains,
        ...(dataset === "authorized-provider"
          ? {
              authorizedProviderAccess: {
                enabled: true as const,
                providerId: provider,
              },
            }
          : {}),
      },
      input.at,
    );
  }

  // listImportedCandidates projects current canonical suppression state. Only
  // candidates created by this completion are persisted with that projection;
  // an existing duplicate remains owned by its original lifecycle.
  const added = input.repository
    .listImportedCandidates()
    .filter((candidate) => !beforeIds.has(candidate.id));
  for (const candidate of added) {
    if (!matchesBucketScope(candidate.recipientBucket, input.scope)) {
      candidate.gateFailures = [
        ...new Set([...candidate.gateFailures, "discovery-scope-mismatch"]),
      ];
      if (candidate.state === "eligible") candidate.state = "review-required";
    }
    input.repository.native
      .prepare(
        "UPDATE imported_candidates SET normalized_snapshot_json=?,lifecycle_state=? WHERE id=?",
      )
      .run(JSON.stringify(candidate), candidate.state, candidate.id);
  }

  const imported = input.records.map((record) => {
    const candidate = input.repository.findImportedCandidate(
      record.sourceProviderId,
      record.providerRecordId,
    );
    if (!candidate) throw new Error("scoped-refresh-imported-candidate-missing");
    return candidate;
  });
  return { added, imported };
}

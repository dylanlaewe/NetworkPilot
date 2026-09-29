import type { ScopedDiscoveryProvider } from "@/application/candidate-refresh/scoped";
import { ScopedDiscoveryProviderFailure } from "@/application/candidate-refresh/scoped";
import type { CandidateSourceRecord } from "@/domain/candidates";
import { ApolloAdapter, ApolloProviderError } from "./adapter";
import { assertApolloEnabled } from "./config";
import { planScopedApolloQueries } from "./scoped-query-plan";
import type {
  ApolloBudgetAuthorization,
  ApolloBudgetRepository,
  ApolloConfig,
  ApolloHttpTransport,
} from "./types";

class ScopedOperationBudget implements ApolloBudgetRepository {
  private authorizations = 0;
  private completions = 0;
  private observed = 0;
  private observedKnown = true;
  private readonly completedOperations = new Set<string>();
  private pendingAttempt: (() => void) | null = null;
  private lastCompletionConsumption: number | null | undefined;

  constructor(private readonly maximum: number) {}

  authorizeApolloOperation(
    input: Parameters<ApolloBudgetRepository["authorizeApolloOperation"]>[0],
  ): ApolloBudgetAuthorization {
    if (
      !input.hardStop ||
      input.candidateCount !== 1 ||
      input.estimatedMaxExposure !== 1 ||
      this.authorizations >= this.maximum
    )
      throw new Error("scoped-apollo-accounting-boundary-invalid");
    this.authorizations += 1;
    return {
      operationId: input.operationId,
      estimatedMaxExposure: 1,
      remainingDaily: this.maximum - this.authorizations,
    };
  }

  beginPersonAttempt(onAttempt: () => void): void {
    if (this.pendingAttempt)
      throw new Error("scoped-apollo-attempt-marker-already-active");
    this.pendingAttempt = onAttempt;
  }

  clearPersonAttempt(): void {
    this.pendingAttempt = null;
  }

  recordApolloAttempt(): void {
    if (!this.pendingAttempt)
      throw new Error("scoped-apollo-attempt-marker-unavailable");
    const mark = this.pendingAttempt;
    this.pendingAttempt = null;
    mark();
  }

  completeApolloOperation(
    operationId: string,
    observedConsumption: number | null,
  ): void {
    this.completions += 1;
    this.completedOperations.add(operationId);
    this.lastCompletionConsumption = observedConsumption;
    if (observedConsumption === null) this.observedKnown = false;
    else this.observed += observedConsumption;
  }

  takeLastCompletionConsumption(): number | null {
    if (this.lastCompletionConsumption === undefined)
      throw new Error("scoped-apollo-completion-consumption-unavailable");
    const observed = this.lastCompletionConsumption;
    this.lastCompletionConsumption = undefined;
    return observed;
  }

  failApolloOperation(operationId: string): void {
    if (!this.completedOperations.has(operationId)) this.observedKnown = false;
  }

  observedCredits(attempts: number): number | null {
    if (attempts === 0) return 0;
    return this.observedKnown && this.completions === attempts
      ? this.observed
      : null;
  }
}

const employerKey = (record: CandidateSourceRecord): string =>
  record.currentOrganization.providerId ??
  record.currentOrganization.domain ??
  record.currentOrganization.name.trim().toLowerCase();

function plausibleEmployer(record: CandidateSourceRecord): boolean {
  const name = record.currentOrganization.name.trim();
  return (
    name.length >= 3 &&
    !/^(unknown|confidential|stealth|self[- ]employed|n\/a)$/i.test(name)
  );
}

function recruiterSearchEligible(record: CandidateSourceRecord): boolean {
  const internal = record.responsibilityEvidence?.find(
    (item) => item.kind === "internal-recruiting",
  );
  // Search payloads can omit provider employer ID/domain even when People
  // Match supplies them. Known agency evidence is enough to reject early;
  // ambiguous identity is allowed to enrichment and still fails closed later
  // if the enriched record cannot establish internal employment.
  return internal?.value !== "agency";
}

function diversifiedCandidates(
  candidates: readonly CandidateSourceRecord[],
  maximum: number,
): CandidateSourceRecord[] {
  if (maximum === 0) return [];
  const ranked = [...candidates].sort((left, right) =>
    left.providerRecordId.localeCompare(right.providerRecordId),
  );
  const selected: CandidateSourceRecord[] = [];
  const selectedIds = new Set<string>();
  const perEmployer = new Map<string, number>();
  for (const candidate of ranked) {
    const employer = employerKey(candidate);
    if ((perEmployer.get(employer) ?? 0) >= 2) continue;
    selected.push(candidate);
    selectedIds.add(candidate.providerRecordId);
    perEmployer.set(employer, (perEmployer.get(employer) ?? 0) + 1);
    if (selected.length === maximum) return selected;
  }
  for (const candidate of ranked) {
    if (selectedIds.has(candidate.providerRecordId)) continue;
    selected.push(candidate);
    if (selected.length === maximum) break;
  }
  return selected;
}

export interface ApolloPersonReservationStore {
  claim(input: { personId: string; operationId: string; at: Date }): boolean;
  markAttempted(input: {
    personId: string;
    operationId: string;
    at: Date;
  }): void;
  retainAttempted(input: {
    personId: string;
    operationId: string;
    at: Date;
    outcome: "usable" | "uncertain";
    record?: CandidateSourceRecord;
    observedConsumption: number | null;
    providerViolation?: "provider-credit-model-exceeded";
  }): void;
  releaseUnattempted(input: {
    personId: string;
    operationId: string;
    at: Date;
  }): void;
}

export interface ScopedApolloProviderDependencies {
  config: ApolloConfig;
  transport: ApolloHttpTransport;
  now: () => Date;
  sleep: (milliseconds: number) => Promise<void>;
  datasetClassification: "provider-shaped-fixture" | "authorized-provider";
  localDate: (date: Date) => string;
  personReservations: ApolloPersonReservationStore;
  existingProviderIds?: () => ReadonlySet<string>;
}

/**
 * Dedicated scoped provider. The application store owns the single persisted
 * authorization; this adapter applies a non-persisting per-call guard while
 * reusing Apollo's existing endpoint, identity, mapping, and safety behavior.
 */
export class ScopedApolloProvider implements ScopedDiscoveryProvider {
  constructor(private readonly dependencies: ScopedApolloProviderDependencies) {}

  preflight(): void {
    assertApolloEnabled(this.dependencies.config);
    if (
      !this.dependencies.config.hardStop ||
      this.dependencies.config.maxEnrichmentsPerBatch < 1 ||
      this.dependencies.config.maxEnrichmentsPerDay < 1
    )
      throw new Error("scoped-apollo-configuration-invalid");
  }

  async discover(
    input: Parameters<ScopedDiscoveryProvider["discover"]>[0],
  ): ReturnType<ScopedDiscoveryProvider["discover"]> {
    this.preflight();
    if (
      input.maximum > this.dependencies.config.maxEnrichmentsPerBatch ||
      input.maximum > this.dependencies.config.maxEnrichmentsPerDay
    )
      throw new Error("scoped-apollo-maximum-exceeds-configuration");

    const budget = new ScopedOperationBudget(input.maximum);
    const adapter = new ApolloAdapter(
      // A scoped operation claims one credit per logical enrichment. Retrying
      // a request whose outcome is uncertain could exceed that deterministic
      // ceiling, so scoped traffic deliberately disables transport retries.
      { ...this.dependencies.config, maxRetries: 0 },
      this.dependencies.transport,
      budget,
      {
        now: this.dependencies.now,
        sleep: this.dependencies.sleep,
        datasetClassification: this.dependencies.datasetClassification,
        localDate: this.dependencies.localDate,
      },
    );
    const plans = planScopedApolloQueries({
      scope: input.scope,
      maximum: input.maximum,
      maximumSearchCalls: input.maximumSearchCalls,
    });
    const existing = this.dependencies.existingProviderIds?.() ?? new Set();
    const seen = new Set(existing);
    const candidates: CandidateSourceRecord[] = [];
    let searchedCandidates = 0;
    let rejectedCandidates = 0;
    let searchCalls = 0;

    try {
      for (const plan of plans) {
        const result = await adapter.search({
          ...plan.request,
          batchId: `${input.operationId}:${plan.request.batchId}`,
        });
        searchCalls += 1;
        const recordRejections = result.recordRejections ?? [];
        searchedCandidates += result.records.length + recordRejections.length;
        rejectedCandidates += recordRejections.length;
        for (const record of result.records) {
          if (
            seen.has(record.providerRecordId) ||
            !plausibleEmployer(record) ||
            (input.scope.bucket === "recruiters" &&
              !recruiterSearchEligible(record))
          ) {
            rejectedCandidates += 1;
            continue;
          }
          seen.add(record.providerRecordId);
          candidates.push(record);
        }
      }
    } catch (error) {
      throw new ScopedDiscoveryProviderFailure(
        error instanceof Error ? error.message : "scoped-apollo-search-failed",
        { attempts: 0, observedCredits: 0 },
      );
    }

    const orderedCandidates = diversifiedCandidates(
      candidates,
      candidates.length,
    );
    const records: CandidateSourceRecord[] = [];
    let enrichmentAttempts = 0;
    try {
      for (const [index, candidate] of orderedCandidates.entries()) {
        if (enrichmentAttempts >= input.maximum) {
          rejectedCandidates += 1;
          continue;
        }
        const reservation = {
          personId: candidate.providerRecordId,
          operationId: input.operationId,
        };
        if (
          !this.dependencies.personReservations.claim({
            ...reservation,
            at: this.dependencies.now(),
          })
        ) {
          rejectedCandidates += 1;
          continue;
        }
        let attempted = false;
        budget.beginPersonAttempt(() => {
          this.dependencies.personReservations.markAttempted({
            ...reservation,
            at: this.dependencies.now(),
          });
          attempted = true;
          enrichmentAttempts += 1;
        });
        try {
          const enriched = await adapter.enrich({
            batchId: `${input.operationId}:enrichment:${index + 1}`,
            personIds: [candidate.providerRecordId],
            persistedSearchPersonIds: [candidate.providerRecordId],
            creditCostPolicy: "disabled-phone-v1",
          });
          if (
            enriched.length !== 1 ||
            enriched[0]?.providerRecordId !== candidate.providerRecordId
          )
            throw new Error("scoped-apollo-enrichment-identity-invalid");
          this.dependencies.personReservations.retainAttempted({
            ...reservation,
            at: this.dependencies.now(),
            outcome: "usable",
            record: enriched[0],
            observedConsumption: budget.takeLastCompletionConsumption(),
          });
          records.push(enriched[0]);
        } catch (error) {
          if (attempted) {
            try {
              const modelViolation =
                error instanceof ApolloProviderError &&
                error.category === "provider-credit-model-exceeded";
              const retainedRecord = modelViolation
                ? error.details?.retainedRecord
                : undefined;
              this.dependencies.personReservations.retainAttempted({
                ...reservation,
                at: this.dependencies.now(),
                outcome: retainedRecord ? "usable" : "uncertain",
                ...(retainedRecord ? { record: retainedRecord } : {}),
                observedConsumption:
                  error instanceof ApolloProviderError
                    ? (error.details?.observedConsumption ?? null)
                    : null,
                ...(modelViolation
                  ? { providerViolation: error.category }
                  : {}),
              });
            } catch {
              // attempt_count=1 remains a permanent conservative lock even
              // if final reservation annotation cannot be persisted.
            }
          } else {
            this.dependencies.personReservations.releaseUnattempted({
              ...reservation,
              at: this.dependencies.now(),
            });
          }
          throw error;
        } finally {
          budget.clearPersonAttempt();
        }
      }
    } catch (error) {
      throw new ScopedDiscoveryProviderFailure(
        error instanceof Error
          ? error.message
          : "scoped-apollo-enrichment-failed",
        {
          attempts: enrichmentAttempts,
          observedCredits: budget.observedCredits(enrichmentAttempts),
        },
      );
    }

    return {
      records,
      searchedCandidates,
      rejectedCandidates,
      enrichmentAttempts,
      searchCalls,
      observedCredits: budget.observedCredits(enrichmentAttempts),
    };
  }
}

export function isScopedApolloProviderConfigured(
  config: ApolloConfig,
): boolean {
  return Boolean(
    config.enabled &&
      config.apiKey?.trim() &&
      config.hardStop &&
      config.maxEnrichmentsPerBatch > 0 &&
      config.maxEnrichmentsPerDay > 0,
  );
}

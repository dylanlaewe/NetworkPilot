import type { ScopedDiscoveryProvider } from "@/application/candidate-refresh/scoped";
import { ScopedDiscoveryProviderFailure } from "@/application/candidate-refresh/scoped";
import { emptyRefreshDiagnostics } from "@/application/candidate-refresh/diagnostics";
import type { CandidateSourceRecord } from "@/domain/candidates";
import type { RecipientBucket } from "@/domain/recipient-buckets";
import { createHash } from "node:crypto";
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

const SEARCH_TITLE_MODIFIERS = new Set([
  "associate",
  "junior",
  "jr",
  "principal",
  "senior",
  "sr",
  "staff",
]);

function normalizedTitleTokens(value: string): string[] {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (tokens[0] && SEARCH_TITLE_MODIFIERS.has(tokens[0])) tokens.shift();
  return tokens;
}

type CompanyLeadershipTitleKind = "ceo" | "president" | "combined";

const CEO_TITLE = /\b(?:ceo|c[.\s]*e[.\s]*o|chief\s+executive\s+officer)\b/i;
const PRESIDENT_TITLE = /\bpresident\b/i;
const VICE_PRESIDENT_TITLE = /\b(?:vice[\s-]*president|v[.\s]*p)\b/i;

/**
 * Apollo title filters are OR terms, but the retained current title is still
 * the authority for local scope. This keeps standalone CEO and President
 * records distinct and rejects substring/scope collisions before enrichment.
 */
export function companyLeadershipTitleKind(
  title: string,
): CompanyLeadershipTitleKind | null {
  if (
    /\b(regional|region|division|divisional|area|market|business unit|recruiter|recruiting|talent acquisition|executive search|staffing)\b/i.test(
      title,
    )
  )
    return null;
  const ceo = CEO_TITLE.test(title);
  const president = PRESIDENT_TITLE.test(title);
  if (!ceo && !president) return null;
  if (!ceo && VICE_PRESIDENT_TITLE.test(title)) return null;
  if (ceo && president) return "combined";
  return ceo ? "ceo" : "president";
}

function searchTitleEligible(
  record: CandidateSourceRecord,
  requestedTitles: readonly string[],
  bucket: RecipientBucket,
): boolean {
  const actual = normalizedTitleTokens(record.currentTitle);
  if (actual.length === 0) return false;
  if (bucket === "ceos") {
    return companyLeadershipTitleKind(record.currentTitle) !== null;
  }
  return requestedTitles.some((requestedTitle) => {
    const requested = normalizedTitleTokens(requestedTitle);
    if (actual.join(" ") === requested.join(" ")) return true;
    // Apollo can omit a functional qualifier (for example, "Data" from
    // "Data Analytics Manager") or return a harmless seniority prefix. Keep
    // those narrow variants, but never accept extra scope such as a regional
    // president or a wholly different role before a paid enrichment.
    return (
      actual.length >= 2 &&
      requested.length >= 2 &&
      actual.every((token) => requested.includes(token))
    );
  });
}

type PeerSelectionFamily =
  | "data-analysis"
  | "product"
  | "engineering"
  | "implementation-business"
  | "other";

const PEER_FAMILY_ORDER: readonly PeerSelectionFamily[] = [
  "data-analysis",
  "product",
  "engineering",
  "implementation-business",
  "other",
];

function peerSelectionFamily(title: string): PeerSelectionFamily {
  const normalized = ` ${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")} `;
  if (normalized.includes(" product ")) return "product";
  if (
    /\b(?:implementation|solutions?|technical business|operations?|program|project)\b/.test(
      normalized,
    )
  )
    return "implementation-business";
  if (
    /\b(?:engineer|engineering|software|developer|machine learning)\b/.test(
      normalized,
    )
  )
    return "engineering";
  if (
    /\b(?:data|analytics?|analyst|business intelligence|bi|scientist)\b/.test(
      normalized,
    )
  )
    return "data-analysis";
  return "other";
}

function candidateSelectionFamily(
  candidate: CandidateSourceRecord,
  bucket: RecipientBucket,
): string {
  if (bucket === "peers") return peerSelectionFamily(candidate.currentTitle);
  if (bucket === "ceos")
    return companyLeadershipTitleKind(candidate.currentTitle) ?? "other";
  return "all";
}

function selectionFamilyOrder(bucket: RecipientBucket): readonly string[] {
  if (bucket === "peers") return PEER_FAMILY_ORDER;
  if (bucket === "ceos") return ["ceo", "president", "combined", "other"];
  return ["all"];
}

export function scopedApolloQueryKey(input: {
  bucket: RecipientBucket;
  purpose: string;
  request: import("./types").ApolloSearchOptions;
}): string {
  const request = Object.fromEntries(
    Object.entries(input.request).filter(
      ([key]) => key !== "batchId" && key !== "page",
    ),
  );
  return createHash("sha256")
    .update(
      JSON.stringify({
        bucket: input.bucket,
        purpose: input.purpose,
        request,
      }),
    )
    .digest("hex");
}

function diversifiedCandidates(
  candidates: readonly CandidateSourceRecord[],
  maximum: number,
  bucket: RecipientBucket,
): CandidateSourceRecord[] {
  if (maximum === 0) return [];
  const ranked = [...candidates].sort((left, right) =>
    left.providerRecordId.localeCompare(right.providerRecordId),
  );
  const families = selectionFamilyOrder(bucket);
  const queues = new Map(
    families.map((family) => [
      family,
      ranked.filter(
        (candidate) => candidateSelectionFamily(candidate, bucket) === family,
      ),
    ]),
  );
  const selected: CandidateSourceRecord[] = [];
  const selectedIds = new Set<string>();
  const perEmployer = new Map<string, number>();
  const appendInterleaved = (respectEmployerCap: boolean) => {
    let advanced = true;
    while (selected.length < maximum && advanced) {
      advanced = false;
      for (const family of families) {
        const queue = queues.get(family)!;
        const index = queue.findIndex((candidate) => {
          if (selectedIds.has(candidate.providerRecordId)) return false;
          return (
            !respectEmployerCap ||
            (perEmployer.get(employerKey(candidate)) ?? 0) < 2
          );
        });
        if (index < 0) continue;
        const [candidate] = queue.splice(index, 1);
        if (!candidate) continue;
        const employer = employerKey(candidate);
        selected.push(candidate);
        selectedIds.add(candidate.providerRecordId);
        perEmployer.set(employer, (perEmployer.get(employer) ?? 0) + 1);
        advanced = true;
        if (selected.length === maximum) break;
      }
    }
  };
  // This is ordering, not a family quota: empty families are skipped and any
  // suitable remaining supply fills the run after each deterministic round.
  appendInterleaved(true);
  appendInterleaved(false);
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

export interface ApolloSearchProgressStore {
  claimNextPage(input: { queryKey: string; at: Date }): number | null;
  observePage(input: {
    queryKey: string;
    page: number;
    perPage: number;
    totalAvailable: number | null;
    returned: number;
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
  excludedCompanyDomains?: () => ReadonlySet<string>;
  searchProgress?: ApolloSearchProgressStore;
  strictProviderShape?: boolean;
}

/**
 * Dedicated scoped provider. The application store owns the single persisted
 * authorization; this adapter applies a non-persisting per-call guard while
 * reusing Apollo's existing endpoint, identity, mapping, and safety behavior.
 */
export class ScopedApolloProvider implements ScopedDiscoveryProvider {
  constructor(
    private readonly dependencies: ScopedApolloProviderDependencies,
  ) {}

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
    const requestedTitles = plans.flatMap(
      (plan) => plan.request.specificTitles ?? [],
    );
    const existing = this.dependencies.existingProviderIds?.() ?? new Set();
    const seen = new Set(existing);
    const excludedCompanyDomains = [...(this.dependencies.excludedCompanyDomains?.() ?? new Set())].sort();
    const candidates: CandidateSourceRecord[] = [];
    const rawEmployers = new Set<string>();
    let rawUnknownEmployerRecords = 0;
    let searchedCandidates = 0;
    let rejectedCandidates = 0;
    let searchCalls = 0;
    const rejectionReasons: Record<string, number> = {};
    const diagnostics = emptyRefreshDiagnostics();
    const reject = (reason: string, count = 1) => {
      if (count < 1) return;
      rejectedCandidates += count;
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + count;
    };

    try {
      const exhaustedQueries = new Set<string>();
      const searchedQueries = new Set<string>();
      const searchCallCap = this.dependencies.searchProgress
        ? input.maximumSearchCalls
        : Math.min(input.maximumSearchCalls, plans.length);
      while (searchCalls < searchCallCap) {
        const plan = plans.find((candidate, index) => {
          const round = Math.floor(searchCalls / plans.length);
          return index >= searchCalls % plans.length && !exhaustedQueries.has(candidate.purpose) && (round > 0 || !searchedQueries.has(candidate.purpose));
        }) ?? plans.find((candidate) => !exhaustedQueries.has(candidate.purpose));
        if (!plan) break;
        const semanticRequest = {
          ...plan.request,
          ...(excludedCompanyDomains.length ? { excludedCompanyDomains } : {}),
        };
        // The cursor identity covers every semantic filter. Operation-specific
        // labels and the cursor page itself are intentionally excluded.
        const queryKey = scopedApolloQueryKey({
          bucket: plan.bucket,
          purpose: plan.purpose,
          request: semanticRequest,
        });
        const fallbackPage = 1 + Math.floor(searchCalls / plans.length);
        const claimedPage = this.dependencies.searchProgress?.claimNextPage({
          queryKey,
          at: this.dependencies.now(),
        });
        if (claimedPage === null) {
          exhaustedQueries.add(plan.purpose);
          continue;
        }
        const page = claimedPage ?? fallbackPage;
        const result = await adapter.search({
          ...plan.request,
          batchId: `${input.operationId}:${plan.request.batchId}`,
          ...(excludedCompanyDomains.length ? { excludedCompanyDomains } : {}),
          page,
        });
        searchCalls += 1;
        diagnostics.searchCalls = searchCalls;
        searchedQueries.add(plan.purpose);
        const perPage = plan.request.perPage ?? 25;
        this.dependencies.searchProgress?.observePage({ queryKey, page, perPage, totalAvailable: result.totalAvailable, returned: result.records.length + (result.recordRejections?.length ?? 0), at: this.dependencies.now() });
        if (result.totalAvailable !== null && page * perPage >= result.totalAvailable) exhaustedQueries.add(plan.purpose);
        const recordRejections = result.recordRejections ?? [];
        if (this.dependencies.strictProviderShape && recordRejections.length)
          throw new ApolloProviderError("provider-search-record-shape-anomaly");
        searchedCandidates += result.records.length + recordRejections.length;
        diagnostics.searchPages.push({
          query: queryKey,
          page,
          raw: result.records.length + recordRejections.length,
          normalized: result.records.length,
        });
        reject("provider-record-invalid", recordRejections.length);
        for (const record of result.records) {
          if (plausibleEmployer(record)) rawEmployers.add(employerKey(record));
          else rawUnknownEmployerRecords += 1;
          if (seen.has(record.providerRecordId)) { reject("duplicate-or-already-known"); continue; }
          if (!plausibleEmployer(record)) { reject("employer-evidence-insufficient"); continue; }
          if (!searchTitleEligible(record, requestedTitles, input.scope.bucket)) { reject("title-outside-requested-scope"); continue; }
          if (input.scope.bucket === "recruiters" && !recruiterSearchEligible(record)) { reject("recruiting-service-evidence"); continue; }
          seen.add(record.providerRecordId);
          candidates.push(record);
        }
        const uniqueEmployers = new Set(candidates.map(employerKey)).size;
        if (searchedQueries.size === plans.length && uniqueEmployers >= input.maximum) break;
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
      input.scope.bucket,
    );
    diagnostics.rawCandidates = searchedCandidates;
    diagnostics.normalizedCandidates = searchedCandidates - (rejectionReasons["provider-record-invalid"] ?? 0);
    diagnostics.uniqueCandidates = candidates.length;
    diagnostics.rawUniqueEmployers = rawEmployers.size;
    diagnostics.rawDiscoveredEmployers = rawEmployers.size;
    diagnostics.rawUnknownEmployerRecords = rawUnknownEmployerRecords;
    diagnostics.shortlistSize = orderedCandidates.length;
    const records: CandidateSourceRecord[] = [];
    let enrichmentAttempts = 0;
    try {
      for (const [index, candidate] of orderedCandidates.entries()) {
        if (enrichmentAttempts >= input.maximum) {
          reject("run-credit-limit-reached");
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
          reject("duplicate-or-concurrent-reservation");
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
      rejectionReasons,
      enrichmentAttempts,
      searchCalls,
      observedCredits: budget.observedCredits(enrichmentAttempts),
      diagnostics: {
        ...diagnostics,
        enrichmentAttempts,
        observedCreditsUsed: budget.observedCredits(enrichmentAttempts),
        estimatedCreditsUsed: enrichmentAttempts,
        rejectionReasons: { ...rejectionReasons },
      },
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

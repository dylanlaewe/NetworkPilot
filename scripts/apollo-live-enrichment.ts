import { loadEnvFile } from "node:process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { CappedApolloEnrichmentTransport, runControlledApolloEnrichment } from "../src/application/providers/run-controlled-apollo-enrichment";
import { ApolloAdapter, FetchApolloTransport, readApolloConfig } from "../src/infrastructure/providers/apollo";
import { SqliteSimulationRepository } from "../src/infrastructure/sqlite/database";

const SEARCH_DATABASE = resolve(process.cwd(), "data/apollo-live-validation.sqlite");
const ENRICHMENT_DATABASE = resolve(process.cwd(), "data/apollo-live-enrichment.sqlite");
const unique = <T>(items: T[], label: string): T => { if (items.length !== 1) throw new Error(`controlled-apollo-candidate-not-unique:${label}`); return items[0]; };
const attemptKey = (id: string) => `apolloLiveEnrichmentCorrectionAttempted:${createHash("sha256").update(id).digest("hex")}`;
const expectedFailClosed = new Set(["provider-match-confidence-none", "provider-match-confidence-malformed", "provider-native-identity-mismatch"]);

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  const search = new SqliteSimulationRepository(SEARCH_DATABASE);
  const repository = new SqliteSimulationRepository(ENRICHMENT_DATABASE);
  const transport = new CappedApolloEnrichmentTransport(new FetchApolloTransport(), 4);
  try {
    search.migrate(); repository.migrate();
    if (repository.getSetting("apolloLiveEnrichmentCorrectionCompleted") === "true") throw new Error("controlled-apollo-enrichment-correction-already-completed");
    const selectedId = search.getSetting("apolloLiveEnrichmentCandidate1Id");
    if (!selectedId) throw new Error("controlled-apollo-enrichment-candidate-one-not-authorized");
    const all = search.listImportedCandidates();
    const candidateOne = unique(all.filter((item) => item.source.providerRecordId === selectedId && item.source.currentTitle === "Senior Software Engineer"), "candidate-one");
    const searchFour = all.filter((item) => item.batchId.startsWith("apollo-live-search-61b-3-"));
    const candidateTwo = unique(searchFour.filter((item) => item.source.currentTitle === "Analytics Program Manager"), "candidate-two");
    const thirdPreferred = searchFour.filter((item) => item.source.currentTitle === "Senior Cloud Solution Architect, AI and Apps");
    const thirdFallback = searchFour.filter((item) => item.source.currentTitle === "Director of AI");
    const candidateThree = thirdPreferred.length === 1 ? thirdPreferred[0] : thirdFallback.length === 1 ? thirdFallback[0] : undefined;
    const ids = [candidateOne.source.providerRecordId, candidateTwo.source.providerRecordId, candidateThree?.source.providerRecordId].filter((id): id is string => Boolean(id));
    const environment = { ...process.env, NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_BATCH: "2", NETWORKPILOT_APOLLO_MAX_ENRICHMENTS_PER_DAY: "4", NETWORKPILOT_APOLLO_MAX_RETRIES: "1" };
    const adapter = new ApolloAdapter(readApolloConfig(environment), transport, repository, { now: () => new Date(), sleep: (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)), datasetClassification: "authorized-provider", localDate: (date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) });
    const candidates = [];
    const failures: Array<{ apolloId: string; condition: string }> = [];
    for (const id of ids) {
      if (repository.getSetting(attemptKey(id)) === "true") continue;
      repository.setSetting(attemptKey(id), "true", new Date());
      try { candidates.push(...await runControlledApolloEnrichment({ adapter, repository, personIds: [id] })); }
      catch (error) { const condition = error instanceof Error ? error.message : "controlled-apollo-enrichment-failed"; if (!expectedFailClosed.has(condition)) throw error; failures.push({ apolloId: id, condition }); }
    }
    repository.setSetting("apolloLiveEnrichmentCorrectionCompleted", "true", new Date());
    console.log(JSON.stringify({ operation: "NetworkPilot controlled live enrichment correction", logicalEnrichmentsThisInvocation: candidates.length + failures.length, httpAttemptsThisInvocation: transport.requestCount, endpoint: "https://api.apollo.io/api/v1/people/match", maximumNewCreditExposure: Math.min(18, ids.length * 9), failures, candidates: candidates.map((candidate) => ({ apolloId: candidate.source.providerRecordId, identityEvidenceBasis: candidate.source.providerMetadata?.identityEvidenceBasis, requestedIdMatchesReturnedId: candidate.source.providerMetadata?.providerNativeRequestId === candidate.source.providerMetadata?.providerNativeReturnedId, matchConfidencePresent: candidate.source.providerMetadata?.matchConfidence !== undefined, matchConfidence: candidate.source.providerMetadata?.matchConfidence ?? "absent", responseStructure: candidate.source.providerMetadata?.responseStructure, fullNameMapped: Boolean(candidate.source.person.firstName && candidate.source.person.lastName), title: candidate.source.currentTitle, organization: candidate.source.currentOrganization.name, organizationDomain: candidate.source.currentOrganization.domain ?? "unknown", location: candidate.source.location, experience:{kind:candidate.experience.kind,minimumSupportedYears:candidate.experience.minimumSupportedYears,maximumSupportedYears:candidate.experience.maximumSupportedYears,evidenceEntries:candidate.experience.evidence.length,employmentPeriods:candidate.experience.evidence.reduce((count,item)=>count+(item.kind==="employment-history"?item.periods.length:0),0),confidence:candidate.experience.confidence,reviewState:candidate.experience.reviewState,explanationCodes:candidate.experience.explanationCodes}, role: candidate.classification, persona: candidate.personaId, emailReturned: Boolean(candidate.source.email.address), emailDomain: candidate.source.email.address.split("@")[1] ?? "unknown", apolloEmailStatus: candidate.source.email.verificationStatus, networkPilotVerification: candidate.source.email.verificationStatus, companyMatch: candidate.strategyCompanyMatch, dataQuality: candidate.dataQualityScore, hardGateFailures: candidate.gateFailures, reviewState: candidate.reviewState, lifecycleState: candidate.state, targetingEligible: candidate.state === "eligible", planningEligible: false })) }, null, 2));
  } finally { search.close(); repository.close(); }
}

main().catch((error) => { console.error(JSON.stringify({ error: error instanceof Error ? error.message : "controlled-apollo-enrichment-failed" })); process.exitCode = 1; });

/** Relationship classification is independent of target role, outreach track and lifecycle. */
export const RECIPIENT_BUCKETS = ["recruiters", "peers", "managers", "executives", "ceos"] as const;
export type RecipientBucket = typeof RECIPIENT_BUCKETS[number];
export const RECIPIENT_BUCKET_VERSION = "recipient-bucket-v1" as const;
export const BUCKET_LABELS: Record<RecipientBucket, string> = { recruiters: "Recruiters", peers: "Peers & practitioners", managers: "Managers & team leaders", executives: "Executives", ceos: "CEOs & presidents" };
export type BucketEvidenceKind = "professional-identity" | "current-employment" | "company-identity" | "relevant-function" | "recruiting-function" | "internal-recruiting" | "recruiting-domain" | "individual-contributor" | "early-career" | "team-leadership" | "functional-leadership" | "division-leadership" | "company-leadership" | "outreach-topic" | "contact-reason";
export interface RecipientBucketEvidence { id: string; kind: BucketEvidenceKind; value: string; sourceReference: string; sourceReferences?: string[]; observedAt: string; verified: boolean; reviewedBy?: string; }
export interface RecipientBucketClassification {
  bucket: RecipientBucket | null;
  classifierVersion: typeof RECIPIENT_BUCKET_VERSION;
  confidence: "high" | "low";
  reviewState: "accepted" | "review-required";
  explanationCodes: string[];
  evidence: RecipientBucketEvidence[];
  evidenceReferences: string[];
  earlyCareer: boolean;
  review?: { reviewedBy: string; reviewedAt: string; reason: string };
}
export interface BucketScope { bucket: RecipientBucket; earlyCareerOnly?: boolean; }
export interface BucketCorrection { bucket: RecipientBucket; evidence: RecipientBucketEvidence[]; reviewedBy: string; }
export function fiveBucketEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean { return env.NETWORKPILOT_FIVE_BUCKET_ENABLED === "true"; }
export function assertFiveBucketEnabled(): void { if (!fiveBucketEnabled()) throw new Error("five-bucket-disabled"); }
export const bucketLabel = (classification?: RecipientBucketClassification | null) => classification?.bucket ? BUCKET_LABELS[classification.bucket] : "Legacy / unclassified";
export function parseBucketScope(input: { bucket?: unknown; earlyCareerOnly?: unknown }): BucketScope | undefined {
  if (input.bucket == null || input.bucket === "" || input.bucket === "all") return undefined;
  if (!RECIPIENT_BUCKETS.includes(input.bucket as RecipientBucket)) throw new Error("recipient-bucket-invalid");
  const earlyCareerOnly = input.earlyCareerOnly === true || input.earlyCareerOnly === "true";
  if (earlyCareerOnly && input.bucket !== "peers") throw new Error("early-career-scope-invalid");
  return { bucket: input.bucket as RecipientBucket, ...(earlyCareerOnly ? { earlyCareerOnly: true } : {}) };
}
export function matchesBucketScope(classification: RecipientBucketClassification | null | undefined, scope?: BucketScope): boolean {
  if (!scope) return true;
  return classification?.reviewState === "accepted" && classification.bucket === scope.bucket && (!scope.earlyCareerOnly || classification.earlyCareer);
}
export function verifiedBucketEvidence(evidence: readonly RecipientBucketEvidence[], kind: BucketEvidenceKind): RecipientBucketEvidence | undefined {
  return evidence.find(e => e.kind === kind && e.verified && e.id.trim() && e.value.trim() && e.sourceReference.trim() && (!e.sourceReferences || e.sourceReferences.length > 0 && e.sourceReferences.every(reference => reference.trim())) && Number.isFinite(Date.parse(e.observedAt)));
}
export function classifyRecipientBucket(input: { title: string; outreachTrack: "professional" | "recruiter"; recruiterAccepted?: boolean; evidence?: readonly RecipientBucketEvidence[] }): RecipientBucketClassification {
  const evidence = (input.evidence ?? []).map(e => ({ ...e })), has = (kind: BucketEvidenceKind) => Boolean(verifiedBucketEvidence(evidence, kind));
  const result = (bucket: RecipientBucket | null, accepted: boolean, code: string): RecipientBucketClassification => ({ bucket, classifierVersion: RECIPIENT_BUCKET_VERSION, confidence: accepted ? "high" : "low", reviewState: accepted ? "accepted" : "review-required", explanationCodes: [code], evidence, evidenceReferences: [...new Set(evidence.flatMap(e => e.sourceReferences ?? [e.sourceReference]))], earlyCareer: Boolean(verifiedBucketEvidence(evidence, "early-career")?.reviewedBy?.trim()) });
  const base = has("professional-identity") && has("current-employment") && has("company-identity") && has("relevant-function");
  if (input.outreachTrack === "recruiter" || has("recruiting-function")) return result("recruiters", base && input.outreachTrack === "recruiter" && Boolean(input.recruiterAccepted) && has("recruiting-function") && has("internal-recruiting") && has("recruiting-domain"), "recruiter-function-and-domain-evidence-required");
  const scopes = (["individual-contributor", "team-leadership", "functional-leadership", "division-leadership", "company-leadership"] as const).filter(has);
  if (scopes.length !== 1) return result(null, false, scopes.length ? "responsibility-evidence-conflicting" : "responsibility-evidence-missing");
  const scope = scopes[0];
  const bucket: RecipientBucket = scope === "company-leadership" ? "ceos" : scope === "functional-leadership" || scope === "division-leadership" ? "executives" : scope === "team-leadership" ? "managers" : "peers";
  if (bucket === "ceos" && !/\b(ceo|chief executive officer|president)\b/i.test(input.title)) return result(null, false, "company-chief-role-unverified");
  if (bucket === "ceos" && /\b(division|divisional|business unit|region|regional)\b/i.test(input.title)) return result(null, false, "company-and-division-scope-conflicting");
  if (bucket === "ceos" && /\b(recruiter|recruiting|talent acquisition|executive search|staffing)\b/i.test(input.title)) return result(null, false, "company-chief-recruiting-role-conflicting");
  return result(bucket, base, base ? `supported-${scope}` : "professional-context-evidence-missing");
}

const TITLE_SUPPORTED_SCOPE: Record<Exclude<RecipientBucket, "recruiters" | "peers">, RegExp> = {
  managers: /\b(manager|supervisor|team lead)\b/i,
  executives: /\b(director|head of|vice president|vp|chief (?:data|technology|information|analytics|product|engineering) officer)\b/i,
  ceos: /\b(ceo|chief executive officer|president)\b/i,
};

/**
 * A scoped provider query can support a personal-networking relationship from
 * an exact current title without claiming unobserved people, function or
 * company-wide responsibility. This projection is intentionally limited to a
 * requested leadership bucket and does not manufacture responsibility evidence.
 */
export function projectTitleSupportedPersonalNetworking(input: {
  classification: RecipientBucketClassification;
  requestedScope: BucketScope;
  title: string;
}): RecipientBucketClassification {
  const { classification, requestedScope, title } = input;
  const titleSupportedPeer = requestedScope.bucket === "peers" && !requestedScope.earlyCareerOnly &&
    !/\b(recruiter|talent acquisition|manager|supervisor|team lead|director|head of|vice president|vp|chief|ceo|president|founder|owner)\b/i.test(title);
  const leadershipBucket = requestedScope.bucket === "managers" || requestedScope.bucket === "executives" || requestedScope.bucket === "ceos";
  if (
    (!titleSupportedPeer && (requestedScope.earlyCareerOnly || !leadershipBucket)) ||
    classification.bucket !== null ||
    classification.reviewState !== "review-required" ||
    classification.explanationCodes.length !== 1 ||
    classification.explanationCodes[0] !== "responsibility-evidence-missing"
  ) return classification;

  const requiredContext = ["professional-identity", "current-employment", "company-identity"] as const;
  if (requiredContext.some((kind) => !verifiedBucketEvidence(classification.evidence, kind))) return classification;
  if (requestedScope.bucket !== "ceos" && !verifiedBucketEvidence(classification.evidence, "relevant-function")) return classification;
  if (requestedScope.bucket === "peers" && !titleSupportedPeer) return classification;
  if (leadershipBucket && !TITLE_SUPPORTED_SCOPE[requestedScope.bucket as keyof typeof TITLE_SUPPORTED_SCOPE].test(title)) return classification;
  if (requestedScope.bucket !== "ceos" && /\b(ceo|chief executive officer|president)\b/i.test(title)) return classification;
  if (requestedScope.bucket === "managers" && /\b(director|head of|vice president|vp|chief\b)/i.test(title)) return classification;
  if (requestedScope.bucket === "ceos" && /\b(division|divisional|business unit|region|regional)\b/i.test(title)) return classification;
  if (requestedScope.bucket === "ceos" && /\b(recruiter|recruiting|talent acquisition|executive search|staffing)\b/i.test(title)) return classification;

  return {
    ...classification,
    bucket: requestedScope.bucket,
    confidence: "low",
    reviewState: "accepted",
    explanationCodes: ["title-supported-personal-networking"],
  };
}
/** Only reviewed bucket policy exceptions are removed. All other gates remain authoritative. */
export function bucketAwareGateFailures(input: { classification: RecipientBucketClassification; gateFailures: readonly string[]; minimumYears: number | null; providerSeniority?: string }): string[] {
  const c = input.classification, failures = input.gateFailures.filter(code => !code.startsWith("recipient-bucket:"));
  if (c.reviewState !== "accepted" || !c.bucket) return [...failures, ...c.explanationCodes.map(code => `recipient-bucket:${code}`)];
  const personalRelationship = c.bucket !== "recruiters";
  const relationshipPeer = c.bucket === "peers";
  const leadership = ["managers", "executives", "ceos"].includes(c.bucket);
  const titleSupportedLeadership=c.explanationCodes.includes("title-supported-personal-networking");
  // A deliberate relationship path can supersede the legacy target-role
  // function inference only with human-reviewed, verified field relevance.
  // It does not assign a target role or remove any other safety gate.
  const relationshipRelevance=leadership&&(titleSupportedLeadership||Boolean(verifiedBucketEvidence(c.evidence,"relevant-function")?.reviewedBy?.trim()));
  const providerSenioritySupportsBucket=input.providerSeniority===undefined||(c.bucket==="executives"&&["director","vp","head","partner","c_suite"].includes(input.providerSeniority))||(c.bucket==="ceos"&&input.providerSeniority==="c_suite");
  const reviewedLeadershipSeniority=providerSenioritySupportsBucket&&((c.bucket==="executives"&&Boolean((verifiedBucketEvidence(c.evidence,"functional-leadership")??verifiedBucketEvidence(c.evidence,"division-leadership"))?.reviewedBy?.trim()))||(c.bucket==="ceos"&&Boolean(verifiedBucketEvidence(c.evidence,"company-leadership")?.reviewedBy?.trim())));
  const titleSupportedSeniority=titleSupportedLeadership&&providerSenioritySupportsBucket;
  return failures.filter(code => !(personalRelationship && code === "company-trust-unverified") && !(relationshipPeer && (code === "insufficient-or-unknown-experience" || code === "prohibited-seniority" || code === "prohibited-target-seniority" || code.startsWith("experience-") || code.startsWith("employment-history-"))) && !((reviewedLeadershipSeniority || titleSupportedSeniority) && code === "prohibited-seniority") && !(relationshipRelevance && ["recipient-function-unknown","recipient-function-unrelated"].includes(code)));
}
export function bucketProjection(classification?: RecipientBucketClassification | null) {
  return { recipientBucket: classification ?? null, bucketLabel: bucketLabel(classification), bucketReviewState: classification?.reviewState ?? "legacy-unclassified", bucketReviewReason: classification?.explanationCodes.join(", ") ?? null, bucketEvidenceReferences: classification?.evidenceReferences ?? [], bucketClassifierVersion: classification?.classifierVersion ?? null };
}

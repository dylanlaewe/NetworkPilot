/** Relationship classification is independent of target role, outreach track and lifecycle. */
export const RECIPIENT_BUCKETS = ["recruiters", "peers", "managers", "executives", "ceos"] as const;
export type RecipientBucket = typeof RECIPIENT_BUCKETS[number];
export const RECIPIENT_BUCKET_VERSION = "recipient-bucket-v1" as const;
export const BUCKET_LABELS: Record<RecipientBucket, string> = { recruiters: "Recruiters", peers: "Peers & practitioners", managers: "Managers & team leaders", executives: "Executives", ceos: "CEOs & presidents" };
export type BucketEvidenceKind = "professional-identity" | "current-employment" | "company-identity" | "relevant-function" | "recruiting-function" | "internal-recruiting" | "recruiting-domain" | "individual-contributor" | "early-career" | "team-leadership" | "functional-leadership" | "division-leadership" | "company-leadership" | "outreach-topic" | "contact-reason";
export interface RecipientBucketEvidence { id: string; kind: BucketEvidenceKind; value: string; sourceReference: string; observedAt: string; verified: boolean; reviewedBy?: string; }
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
  return evidence.find(e => e.kind === kind && e.verified && e.id.trim() && e.value.trim() && e.sourceReference.trim() && Number.isFinite(Date.parse(e.observedAt)));
}
export function classifyRecipientBucket(input: { title: string; outreachTrack: "professional" | "recruiter"; recruiterAccepted?: boolean; evidence?: readonly RecipientBucketEvidence[] }): RecipientBucketClassification {
  const evidence = (input.evidence ?? []).map(e => ({ ...e })), has = (kind: BucketEvidenceKind) => Boolean(verifiedBucketEvidence(evidence, kind));
  const result = (bucket: RecipientBucket | null, accepted: boolean, code: string): RecipientBucketClassification => ({ bucket, classifierVersion: RECIPIENT_BUCKET_VERSION, confidence: accepted ? "high" : "low", reviewState: accepted ? "accepted" : "review-required", explanationCodes: [code], evidence, evidenceReferences: evidence.map(e => e.sourceReference), earlyCareer: Boolean(verifiedBucketEvidence(evidence, "early-career")?.reviewedBy?.trim()) });
  const base = has("professional-identity") && has("current-employment") && has("company-identity") && has("relevant-function");
  if (input.outreachTrack === "recruiter" || has("recruiting-function")) return result("recruiters", base && input.outreachTrack === "recruiter" && Boolean(input.recruiterAccepted) && has("recruiting-function") && has("internal-recruiting") && has("recruiting-domain"), "recruiter-function-and-domain-evidence-required");
  const scopes = (["individual-contributor", "team-leadership", "functional-leadership", "division-leadership", "company-leadership"] as const).filter(has);
  if (scopes.length !== 1) return result(null, false, scopes.length ? "responsibility-evidence-conflicting" : "responsibility-evidence-missing");
  const scope = scopes[0];
  const bucket: RecipientBucket = scope === "company-leadership" ? "ceos" : scope === "functional-leadership" || scope === "division-leadership" ? "executives" : scope === "team-leadership" ? "managers" : "peers";
  if (bucket === "ceos" && !/\b(ceo|chief executive officer|president)\b/i.test(input.title)) return result(null, false, "company-chief-role-unverified");
  if (bucket === "ceos" && /\b(division|business unit|regional)\b/i.test(input.title)) return result(null, false, "company-and-division-scope-conflicting");
  return result(bucket, base, base ? `supported-${scope}` : "professional-context-evidence-missing");
}
/** Only reviewed bucket policy exceptions are removed. All other gates remain authoritative. */
export function bucketAwareGateFailures(input: { classification: RecipientBucketClassification; gateFailures: readonly string[]; minimumYears: number | null; providerSeniority?: string }): string[] {
  const c = input.classification, failures = input.gateFailures.filter(code => !code.startsWith("recipient-bucket:"));
  if (c.reviewState !== "accepted" || !c.bucket) return [...failures, ...c.explanationCodes.map(code => `recipient-bucket:${code}`)];
  const earlyPeer = c.bucket === "peers" && c.earlyCareer && input.minimumYears !== null;
  const leadership = ["managers", "executives", "ceos"].includes(c.bucket);
  // A deliberate relationship path can supersede the legacy target-role
  // function inference only with human-reviewed, verified field relevance.
  // It does not assign a target role or remove any other safety gate.
  const relationshipRelevance=leadership&&Boolean(verifiedBucketEvidence(c.evidence,"relevant-function")?.reviewedBy?.trim());
  const providerSenioritySupportsBucket=input.providerSeniority===undefined||(c.bucket==="executives"&&["vp","head","partner","c_suite"].includes(input.providerSeniority))||(c.bucket==="ceos"&&input.providerSeniority==="c_suite");
  const reviewedLeadershipSeniority=providerSenioritySupportsBucket&&((c.bucket==="executives"&&Boolean((verifiedBucketEvidence(c.evidence,"functional-leadership")??verifiedBucketEvidence(c.evidence,"division-leadership"))?.reviewedBy?.trim()))||(c.bucket==="ceos"&&Boolean(verifiedBucketEvidence(c.evidence,"company-leadership")?.reviewedBy?.trim())));
  return failures.filter(code => !(earlyPeer && code === "insufficient-or-unknown-experience") && !((reviewedLeadershipSeniority || earlyPeer && input.providerSeniority === "entry") && code === "prohibited-seniority") && !(relationshipRelevance && ["recipient-function-unknown","recipient-function-unrelated"].includes(code)));
}
export function bucketProjection(classification?: RecipientBucketClassification | null) {
  return { recipientBucket: classification ?? null, bucketLabel: bucketLabel(classification), bucketReviewState: classification?.reviewState ?? "legacy-unclassified", bucketReviewReason: classification?.explanationCodes.join(", ") ?? null, bucketEvidenceReferences: classification?.evidenceReferences ?? [], bucketClassifierVersion: classification?.classifierVersion ?? null };
}

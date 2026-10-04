import { bucketAwareGateFailures, classifyRecipientBucket, verifiedBucketEvidence, type BucketScope } from "@/domain/recipient-buckets";
import { classifyRecruiter, classifyRecruiterEmployerDomain, type RecruiterClassification, type RecruitingDomain } from "@/domain/recruiters";
import type { CompanyTrustResolution } from "@/domain/company-trust";
import type { ImportedCandidateSnapshot } from "./types";

const dynamicRecruiterGate = (code: string) => code.startsWith("recruiter-") || code.startsWith("company-trust-") || code === "company-unreviewed" || code.startsWith("recipient-bucket:recruiter-") || code.startsWith("recipient-bucket:company-trust-");

export function qualifyRecruiterWithCompanyTrust(input: {
  title: string; employerName: string; employerDomain?: string; minimumExperience: number | null; maximumExperience: number | null;
  trust: CompanyTrustResolution; evidence?: ImportedCandidateSnapshot["source"]["responsibilityEvidence"]; companyOpportunity?: number;
}): { classification: RecruiterClassification; hardGates: string[]; reviewGates: string[]; domainEvidence: ReturnType<typeof classifyRecruiterEmployerDomain> } {
  const reviewedInternalRecruiting = Boolean(verifiedBucketEvidence(input.evidence ?? [], "internal-recruiting") && verifiedBucketEvidence(input.evidence ?? [], "recruiting-function"));
  const reviewedRecruitingDomain = verifiedBucketEvidence(input.evidence ?? [], "recruiting-domain")?.value as RecruitingDomain | undefined;
  const providerEmployerStatus = input.evidence?.find((item) => item.kind === "internal-recruiting")?.value;
  const analyzedDomain = classifyRecruiterEmployerDomain(input.employerDomain);
  const domainEvidence = providerEmployerStatus === "agency" ? "agency-contradiction" : providerEmployerStatus === "ambiguous" ? "ambiguous" : analyzedDomain;
  const domainAllowsInternal = domainEvidence === "neutral" || domainEvidence === "no-domain-evidence";
  const trusted = input.trust.state === "trusted-operating" && input.trust.identityVerified;
  const base = classifyRecruiter({title: input.title, employerName: input.employerName, internalCompanyMatch: trusted && domainAllowsInternal, minimumExperience: input.minimumExperience, maximumExperience: input.maximumExperience, reviewedInternalRecruiting, reviewedRecruitingDomain});
  const hardGates: string[] = [], reviewGates: string[] = [];
  if (base.track === "recruiter") {
    if (domainEvidence === "agency-contradiction" || base.internalStatus === "agency") hardGates.push("recruiter-agency-employer");
    else if (domainEvidence === "ambiguous") reviewGates.push("recruiter-company-domain-ambiguous","recruiter-employer-ambiguous");
    else if (input.trust.state === "disallowed-recruiting-service") hardGates.push("company-trust-disallowed");
    else if (!trusted) reviewGates.push("company-trust-unverified");
    for (const code of base.explanationCodes) if (!["recruiter-qualified", "recruiter-employer-ambiguous"].includes(code) && !hardGates.includes(code)) hardGates.push(code);
  }
  const opportunity = input.companyOpportunity ?? 0;
  const trustCodes = [...hardGates, ...reviewGates].filter((code) => code.startsWith("company-trust-"));
  const classification: RecruiterClassification = {
    ...base,
    accepted: base.accepted && hardGates.length === 0 && reviewGates.length === 0,
    internalStatus: input.trust.state === "disallowed-recruiting-service" || base.internalStatus === "agency" ? "agency" : trusted && domainAllowsInternal ? "internal" : "ambiguous",
    score: Math.min(100, base.score + opportunity),
    explanationCodes: [...base.explanationCodes.filter((code) => !["recruiter-qualified", "recruiter-employer-ambiguous"].includes(code)), ...trustCodes, ...(base.accepted && !hardGates.length && !reviewGates.length ? ["recruiter-qualified"] : []), ...(opportunity ? [`target-company-opportunity:${opportunity}`] : [])],
  };
  return {classification, hardGates: [...new Set(hardGates)], reviewGates: [...new Set(reviewGates)], domainEvidence};
}

/** Projects current company trust onto mutable candidate supply; sent snapshots are not touched. */
export function applyCurrentCompanyTrust(candidate: ImportedCandidateSnapshot, trust: CompanyTrustResolution, expectedScope?: BucketScope): ImportedCandidateSnapshot {
  const next = structuredClone(candidate); next.employerTrust = trust;
  if ((next.outreachTrack ?? next.recruiterClassification?.track) !== "recruiter") return next;
  const opportunity = Number(next.recruiterClassification?.explanationCodes.find((code) => code.startsWith("target-company-opportunity:"))?.split(":")[1] ?? 0);
  const result = qualifyRecruiterWithCompanyTrust({title: next.source.currentTitle, employerName: next.source.currentOrganization.name, employerDomain: next.source.currentOrganization.domain, minimumExperience: next.experience.minimumSupportedYears, maximumExperience: next.experience.maximumSupportedYears, trust, evidence: next.recipientBucket?.evidence ?? next.source.responsibilityEvidence, companyOpportunity: Number.isFinite(opportunity) ? opportunity : 0});
  next.recruiterClassification = result.classification;
  const staleSameBucketMismatch =
    expectedScope &&
    next.recipientBucket?.bucket === expectedScope.bucket &&
    (!expectedScope.earlyCareerOnly || next.recipientBucket.earlyCareer);
  const retained = next.gateFailures.filter(
    (code) =>
      !dynamicRecruiterGate(code) &&
      !(code === "discovery-scope-mismatch" && staleSameBucketMismatch),
  );
  const retainedReview=retained.filter((code)=>code==="discovery-scope-mismatch"||code==="geography-ambiguous"||code==="provider-match-confidence-review"||code.startsWith("recipient-bucket:"));
  const hard = [...retained.filter((code)=>!retainedReview.includes(code)), ...result.hardGates], review = [...retainedReview,...result.reviewGates];
  if (next.recipientBucket) {
    const bucket = classifyRecipientBucket({title: next.source.currentTitle, outreachTrack: "recruiter", recruiterAccepted: result.classification.accepted, evidence: next.recipientBucket.evidence});
    if (trust.state !== "trusted-operating") bucket.explanationCodes = [trust.state === "disallowed-recruiting-service" ? "company-trust-disallowed" : "company-trust-unverified"];
    next.recipientBucket = bucket;
    const bucketGates = bucketAwareGateFailures({classification: bucket, gateFailures: [...hard, ...review], minimumYears: next.experience.minimumSupportedYears, providerSeniority: next.source.providerMetadata?.providerSeniority});
    const knownReview=new Set(review);
    hard.splice(0, hard.length, ...bucketGates.filter((code) => !code.startsWith("recipient-bucket:")&&!knownReview.has(code)));
    review.splice(0, review.length, ...bucketGates.filter((code) => code.startsWith("recipient-bucket:")||knownReview.has(code)));
  }
  next.gateFailures = [...new Set([...hard, ...review])];
  if (next.source.consent.suppressed) next.state = "suppressed";
  else if (hard.length) next.state = "rejected";
  else if (review.length || !result.classification.accepted) next.state = "review-required";
  else next.state = "eligible";
  return next;
}

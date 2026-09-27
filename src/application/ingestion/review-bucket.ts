import { createHash } from "node:crypto";
import {
  assertFiveBucketEnabled,
  bucketAwareGateFailures,
  classifyRecipientBucket,
  type BucketCorrection,
  type BucketEvidenceKind,
  type RecipientBucket,
  type RecipientBucketEvidence,
} from "@/domain/recipient-buckets";
import type { ImportedCandidateSnapshot } from "./types";

const scopeKind: Record<RecipientBucket, BucketEvidenceKind> = {
  recruiters: "recruiting-function",
  peers: "individual-contributor",
  managers: "team-leadership",
  executives: "functional-leadership",
  ceos: "company-leadership",
};
const replaceableKinds = new Set<BucketEvidenceKind>([
  "relevant-function",
  "recruiting-function",
  "internal-recruiting",
  "recruiting-domain",
  "individual-contributor",
  "team-leadership",
  "functional-leadership",
  "division-leadership",
  "company-leadership",
  "outreach-topic",
  "contact-reason",
]);

function reviewedEvidence(
  candidateId: string,
  kind: BucketEvidenceKind,
  value: string,
  sourceReference: string,
  at: Date,
): RecipientBucketEvidence {
  return {
    id: `operator:${createHash("sha256").update(JSON.stringify({ candidateId, kind, value, sourceReference })).digest("hex").slice(0, 24)}`,
    kind,
    value: value.trim(),
    sourceReference: sourceReference.trim(),
    observedAt: at.toISOString(),
    verified: true,
    reviewedBy: "local-operator",
  };
}

export function buildReviewedBucketCorrection(
  candidate: ImportedCandidateSnapshot,
  input: {
    bucket: RecipientBucket;
    field: string;
    responsibility: string;
    context?: string;
    sourceReference: string;
    at: Date;
  },
): BucketCorrection {
  const sourceReference = input.sourceReference.trim();
  if (!input.field.trim() || !input.responsibility.trim() || !sourceReference)
    throw new Error("bucket-review-evidence-required");
  const evidence = (
    candidate.recipientBucket?.evidence ??
    candidate.source.responsibilityEvidence ??
    []
  ).filter((item) => !replaceableKinds.has(item.kind));
  const identity =
    `${candidate.source.person.firstName} ${candidate.source.person.lastName}`.trim();
  const employer = candidate.source.currentOrganization;
  evidence.push(
    reviewedEvidence(
      candidate.id,
      "professional-identity",
      identity,
      sourceReference,
      input.at,
    ),
    reviewedEvidence(
      candidate.id,
      "current-employment",
      `${candidate.source.currentTitle} at ${employer.name}`,
      sourceReference,
      input.at,
    ),
  );
  if (
    candidate.strategyCompanyMatch ||
    employer.providerId?.trim() ||
    employer.domain?.trim()
  ) {
    evidence.push(
      reviewedEvidence(
        candidate.id,
        "company-identity",
        candidate.strategyCompanyMatch?.canonicalName ?? employer.name,
        sourceReference,
        input.at,
      ),
    );
  }
  evidence.push(
    reviewedEvidence(
      candidate.id,
      "relevant-function",
      input.field,
      sourceReference,
      input.at,
    ),
    reviewedEvidence(
      candidate.id,
      scopeKind[input.bucket],
      input.responsibility,
      sourceReference,
      input.at,
    ),
  );
  if (input.bucket === "recruiters")
    evidence.push(
      reviewedEvidence(
        candidate.id,
        "internal-recruiting",
        "internal employer recruiting responsibility",
        sourceReference,
        input.at,
      ),
      reviewedEvidence(
        candidate.id,
        "recruiting-domain",
        input.context?.trim() || "general",
        sourceReference,
        input.at,
      ),
    );
  if (input.bucket === "managers")
    evidence.push(
      reviewedEvidence(
        candidate.id,
        "outreach-topic",
        input.context?.trim() || input.responsibility,
        sourceReference,
        input.at,
      ),
    );
  if (input.bucket === "ceos")
    evidence.push(
      reviewedEvidence(
        candidate.id,
        "contact-reason",
        input.context?.trim() || input.responsibility,
        sourceReference,
        input.at,
      ),
    );
  return { bucket: input.bucket, evidence, reviewedBy: "local-operator" };
}

export function reviewedBucketCorrection(
  candidate: ImportedCandidateSnapshot,
  correction: BucketCorrection,
  reason: string,
  at: Date,
): ImportedCandidateSnapshot {
  assertFiveBucketEnabled();
  if (!correction.reviewedBy.trim() || !reason.trim())
    throw new Error("bucket-review-provenance-required");
  const outreachTrack = candidate.outreachTrack ?? "professional";
  const classification = classifyRecipientBucket({
    title: candidate.source.currentTitle,
    outreachTrack,
    recruiterAccepted:
      outreachTrack === "recruiter" && correction.bucket === "recruiters"
        ? true
        : candidate.recruiterClassification?.accepted,
    evidence: correction.evidence,
  });
  if (
    classification.reviewState !== "accepted" ||
    classification.bucket !== correction.bucket
  )
    throw new Error("bucket-correction-evidence-insufficient");
  classification.review = {
    reviewedBy: correction.reviewedBy.trim(),
    reviewedAt: at.toISOString(),
    reason: reason.trim(),
  };
  const gateFailures = bucketAwareGateFailures({
    classification,
    gateFailures: candidate.gateFailures,
    minimumYears: candidate.experience.minimumSupportedYears,
    providerSeniority: candidate.source.providerMetadata?.providerSeniority,
  });
  // A classification review cannot undo a prior operator rejection or suppression.
  const blockedState =
    candidate.source.consent.suppressed || candidate.state === "suppressed"
      ? "suppressed"
      : candidate.reviewState === "rejected" ||
          candidate.reviewState === "suppressed"
        ? candidate.state
        : null;
  return {
    ...structuredClone(candidate),
    recipientBucket: classification,
    gateFailures,
    reviewState: blockedState ? candidate.reviewState : "corrected",
    state:
      blockedState ?? (gateFailures.length ? "review-required" : "eligible"),
  };
}

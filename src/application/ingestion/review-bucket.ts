import { assertFiveBucketEnabled, bucketAwareGateFailures, classifyRecipientBucket, type BucketCorrection } from "@/domain/recipient-buckets";
import type { ImportedCandidateSnapshot } from "./types";

export function reviewedBucketCorrection(candidate: ImportedCandidateSnapshot, correction: BucketCorrection, reason: string, at: Date): ImportedCandidateSnapshot {
  assertFiveBucketEnabled();
  if (!correction.reviewedBy.trim() || !reason.trim()) throw new Error("bucket-review-provenance-required");
  const classification = classifyRecipientBucket({ title: candidate.source.currentTitle, outreachTrack: candidate.outreachTrack ?? "professional", recruiterAccepted: candidate.recruiterClassification?.accepted, evidence: correction.evidence });
  if (classification.reviewState !== "accepted" || classification.bucket !== correction.bucket) throw new Error("bucket-correction-evidence-insufficient");
  classification.review = { reviewedBy: correction.reviewedBy.trim(), reviewedAt: at.toISOString(), reason: reason.trim() };
  const gateFailures = bucketAwareGateFailures({ classification, gateFailures: candidate.gateFailures, minimumYears: candidate.experience.minimumSupportedYears, providerSeniority: candidate.source.providerMetadata?.providerSeniority });
  // A classification review cannot undo a prior operator rejection or suppression.
  const blockedState = candidate.source.consent.suppressed || candidate.state === "suppressed" ? "suppressed" : candidate.reviewState === "rejected" || candidate.reviewState === "suppressed" ? candidate.state : null;
  return { ...structuredClone(candidate), recipientBucket: classification, gateFailures, reviewState: blockedState ? candidate.reviewState : "corrected", state: blockedState ?? (gateFailures.length ? "review-required" : "eligible") };
}

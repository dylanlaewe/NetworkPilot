import { CANONICAL, personalize, TEMPLATE_VERSION, TITLE_SUPPORTED } from "@/domain/drafting/bucket-templates";
import { verifiedBucketEvidence } from "@/domain/recipient-buckets";
import type { ImportedCandidateSnapshot } from "@/application/ingestion";
import { assertDylanVoice } from "@/domain/drafting/voice";

export function renderBucketCopy(candidate: ImportedCandidateSnapshot) {
  const classification = candidate.recipientBucket;
  if (!classification?.bucket || classification.reviewState !== "accepted") throw new Error("recipient-bucket-review-required");
  const bucket = classification.bucket, evidence = classification.evidence;
  const required = (kind: Parameters<typeof verifiedBucketEvidence>[1]) => {
    const item = verifiedBucketEvidence(evidence, kind);
    if (!item) throw new Error(`bucket-copy-evidence-required:${kind}`);
    return item.value;
  };
  const field = bucket === "ceos" ? verifiedBucketEvidence(evidence, "relevant-function")?.value ?? "technology" : required("relevant-function");
  const slots: Record<string, string> = { "First name": candidate.source.person.firstName, Company: candidate.source.currentOrganization.name, field, role: candidate.source.currentTitle };
  const managerTopic = verifiedBucketEvidence(evidence, "outreach-topic")?.value;
  const executiveFunction = verifiedBucketEvidence(evidence, "functional-leadership")?.value ?? verifiedBucketEvidence(evidence, "division-leadership")?.value;
  const ceoReason = verifiedBucketEvidence(evidence, "contact-reason")?.value;
  if (managerTopic) slots["specific topic"] = managerTopic;
  if (executiveFunction) slots["verified function"] = executiveFunction;
  if (ceoReason) slots["specific reason for contacting this person"] = ceoReason;
  const titleSupported = bucket === "recruiters" && candidate.employerTrust?.state !== "trusted-operating" || bucket === "managers" && !managerTopic || bucket === "executives" && !executiveFunction || bucket === "ceos" && !ceoReason;
  const template = bucket === "peers" ? CANONICAL.peers : titleSupported ? TITLE_SUPPORTED[bucket] : CANONICAL[bucket];
  const subject = personalize(template.subject, slots);
  let body = personalize(template.body, slots);
  if (bucket === "peers" && !classification.earlyCareer) body = body.replace(`I'd be curious how you approached your job search and what helped you get started in ${field}.`, `I'd be curious what you've learned from your experience in ${field}.`);
  assertDylanVoice(subject, body, { semanticAsks: true });
  return { subject, body, catalogVersion: TEMPLATE_VERSION, variant: `${titleSupported ? "title-supported" : "canonical"}-${bucket}`, factIds: classification.evidenceReferences };
}

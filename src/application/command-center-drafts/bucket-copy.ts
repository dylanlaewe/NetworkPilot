import { CANONICAL, personalize, TEMPLATE_VERSION } from "@/domain/drafting/bucket-templates";
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
  const field = required("relevant-function");
  const slots: Record<string, string> = { "First name": candidate.source.person.firstName, Company: candidate.source.currentOrganization.name, field, role: candidate.source.currentTitle };
  if (bucket === "managers") slots["specific topic"] = required("outreach-topic");
  if (bucket === "executives") slots["verified function"] = verifiedBucketEvidence(evidence, "functional-leadership")?.value ?? required("division-leadership");
  if (bucket === "ceos") slots["specific reason for contacting this person"] = required("contact-reason");
  const subject = personalize(CANONICAL[bucket].subject, slots);
  let body = personalize(CANONICAL[bucket].body, slots);
  if (bucket === "peers" && !classification.earlyCareer) body = body.replace(`I'd be curious how you approached your job search and what helped you get started in ${field}.`, `I'd be curious what you've learned from your experience in ${field}.`);
  assertDylanVoice(subject, body, { semanticAsks: true });
  return { subject, body, catalogVersion: TEMPLATE_VERSION, variant: `canonical-${bucket}`, factIds: classification.evidenceReferences };
}

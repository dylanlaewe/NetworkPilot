import { CANONICAL, personalize, TEMPLATE_VERSION, TITLE_SUPPORTED } from "@/domain/drafting/bucket-templates";
import { verifiedBucketEvidence } from "@/domain/recipient-buckets";
import type { ImportedCandidateSnapshot } from "@/application/ingestion";
import { assertDylanVoice } from "@/domain/drafting/voice";
import type { RecipientFunctionId } from "@/domain/candidates/recipient-function";

const OUTBOUND_FUNCTION_LABELS: Record<RecipientFunctionId, string> = {
  "data-analytics": "data analytics",
  "software-engineering": "software engineering",
  "ai-ml": "AI and machine learning",
  "technical-infrastructure": "technical infrastructure",
  product: "product",
  "project-program": "project and program management",
  operations: "operations",
  consulting: "consulting",
  finance: "finance",
  investing: "investing",
  "commodities-energy": "commodities and energy",
  "defense-aerospace": "defense and aerospace",
  "business-strategy": "business strategy",
  "other-approved-relevant-function": "your field",
  unrelated: "your field",
  unknown: "your field",
};

function outboundFunctionLabel(value: string): string {
  const reviewed = value.trim();
  const known = OUTBOUND_FUNCTION_LABELS[reviewed as RecipientFunctionId];
  if (known) return known;
  if (/^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(reviewed))
    return reviewed.replace(/[-_]+/g, " ");
  return reviewed || "your field";
}

export function renderBucketCopy(candidate: ImportedCandidateSnapshot) {
  const classification = candidate.recipientBucket;
  if (!classification?.bucket || classification.reviewState !== "accepted") throw new Error("recipient-bucket-review-required");
  const bucket = classification.bucket, evidence = classification.evidence;
  const required = (kind: Parameters<typeof verifiedBucketEvidence>[1]) => {
    const item = verifiedBucketEvidence(evidence, kind);
    if (!item) throw new Error(`bucket-copy-evidence-required:${kind}`);
    return item.value;
  };
  const field = outboundFunctionLabel(bucket === "ceos" ? verifiedBucketEvidence(evidence, "relevant-function")?.value ?? "technology" : required("relevant-function"));
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

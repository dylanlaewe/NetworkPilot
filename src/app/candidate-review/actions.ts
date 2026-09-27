"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSimulationRepository } from "@/infrastructure/sqlite/runtime";
import { SqliteSimulationRepository } from "@/infrastructure/sqlite/database";
import { resolveManualOutreachDatabaseSelection } from "@/infrastructure/sqlite/manual-outreach-operator";
import {
  fiveBucketEnabled,
  parseBucketScope,
  type BucketEvidenceKind,
  type RecipientBucketEvidence,
} from "@/domain/recipient-buckets";

function repository() {
  if (!fiveBucketEnabled())
    return { value: getSimulationRepository(), close: false };
  const value = new SqliteSimulationRepository(
    resolveManualOutreachDatabaseSelection().path,
  );
  value.migrate();
  return { value, close: true };
}
const scopeKind = {
  recruiters: "recruiting-function",
  peers: "individual-contributor",
  managers: "team-leadership",
  executives: "functional-leadership",
  ceos: "company-leadership",
} as const;
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

export async function reviewCandidateAction(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? ""),
    action = String(formData.get("action") ?? "") as
      "confirm" | "correct" | "reject" | "suppress" | "pending",
    reason = String(formData.get("reason") ?? ""),
    specificRoleId = String(formData.get("specificRoleId") ?? "") || undefined;
  if (!["confirm", "correct", "reject", "suppress", "pending"].includes(action))
    throw new Error("review-action-invalid");
  const selected = repository();
  try {
    selected.value.reviewCandidate(
      candidateId,
      action,
      reason,
      specificRoleId,
      new Date(),
    );
  } finally {
    if (selected.close) selected.value.close();
  }
  revalidatePath("/candidate-review");
  revalidatePath("/candidates");
  revalidatePath("/drafts");
}

export async function correctRecipientBucketAction(formData: FormData) {
  if (!fiveBucketEnabled()) throw new Error("five-bucket-disabled");
  const candidateId = String(formData.get("candidateId") ?? ""),
    scope = parseBucketScope({ bucket: formData.get("bucket") }),
    reason = String(formData.get("reason") ?? "").trim(),
    field = String(formData.get("fieldEvidence") ?? "").trim(),
    responsibility = String(
      formData.get("responsibilityEvidence") ?? "",
    ).trim(),
    context = String(formData.get("messageContext") ?? "").trim(),
    sourceReference = String(formData.get("sourceReference") ?? "").trim();
  if (!scope || !reason || !field || !responsibility || !sourceReference)
    throw new Error("bucket-review-evidence-required");
  const selected = repository();
  try {
    const candidate = selected.value
      .listImportedCandidates()
      .find((item) => item.id === candidateId);
    if (!candidate) throw new Error("candidate-not-found");
    const at = new Date(),
      prior = (
        candidate.recipientBucket?.evidence ??
        candidate.source.responsibilityEvidence ??
        []
      ).filter((item) => !replaceableKinds.has(item.kind)),
      next = [
        ...prior,
        reviewedEvidence(
          candidateId,
          "relevant-function",
          field,
          sourceReference,
          at,
        ),
        reviewedEvidence(
          candidateId,
          scopeKind[scope.bucket],
          responsibility,
          sourceReference,
          at,
        ),
      ];
    if (scope.bucket === "recruiters")
      next.push(
        reviewedEvidence(
          candidateId,
          "internal-recruiting",
          "internal employer recruiting responsibility",
          sourceReference,
          at,
        ),
        reviewedEvidence(
          candidateId,
          "recruiting-domain",
          context || "general",
          sourceReference,
          at,
        ),
      );
    if (scope.bucket === "managers")
      next.push(
        reviewedEvidence(
          candidateId,
          "outreach-topic",
          context || responsibility,
          sourceReference,
          at,
        ),
      );
    if (scope.bucket === "ceos")
      next.push(
        reviewedEvidence(
          candidateId,
          "contact-reason",
          context || responsibility,
          sourceReference,
          at,
        ),
      );
    selected.value.reviewCandidate(
      candidateId,
      "correct",
      reason,
      undefined,
      at,
      { bucket: scope.bucket, evidence: next, reviewedBy: "local-operator" },
    );
  } finally {
    if (selected.close) selected.value.close();
  }
  revalidatePath("/candidate-review");
  revalidatePath("/candidates");
  revalidatePath("/drafts");
}

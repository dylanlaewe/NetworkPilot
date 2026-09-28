"use server";
import { revalidatePath } from "next/cache";
import { getSimulationRepository } from "@/infrastructure/sqlite/runtime";
import { resolveManualOutreachDatabaseSelection } from "@/infrastructure/sqlite/manual-outreach-operator";
import {
  fiveBucketEnabled,
  parseBucketScope,
} from "@/domain/recipient-buckets";
import { buildReviewedBucketCorrection } from "@/application/ingestion/review-bucket";
import {openRuntimeRepository} from "@/infrastructure/sqlite/runtime";

function repository() {
  if (!fiveBucketEnabled())
    return { value: getSimulationRepository(), close: false };
  const value = openRuntimeRepository(resolveManualOutreachDatabaseSelection().path);
  return { value, close: true };
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
      correction = buildReviewedBucketCorrection(candidate, {
        bucket: scope.bucket,
        field,
        responsibility,
        context,
        sourceReference,
        at,
      });
    selected.value.reviewCandidate(
      candidateId,
      "correct",
      reason,
      undefined,
      at,
      correction,
    );
  } finally {
    if (selected.close) selected.value.close();
  }
  revalidatePath("/candidate-review");
  revalidatePath("/candidates");
  revalidatePath("/drafts");
}

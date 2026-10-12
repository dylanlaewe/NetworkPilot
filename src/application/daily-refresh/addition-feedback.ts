import type { DraftAdditionMetrics } from ".";

export interface DraftAdditionFeedback {
  status: "success" | "partial" | "zero";
  message: string;
  reasons: string[];
  recovery: { label: string; href: string } | null;
}

export function draftAdditionDestination(result: DraftAdditionMetrics): string {
  return `/drafts?${new URLSearchParams({ added: String(result.addedCount), requested: String(result.additionalDraftCount), reserveRemaining: String(result.eligibleReserveRemaining) })}`;
}

const item = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

export function draftAdditionFeedback(result: DraftAdditionMetrics): DraftAdditionFeedback {
  const { addedCount: added, additionalDraftCount: requested, blockCounts } = result;
  const reasons: string[] = [];
  if (blockCounts?.reviewRequired) reasons.push(`${item(blockCounts.reviewRequired, "person", "people")} need employer or eligibility review`);
  if (blockCounts?.unresolvedEvidence) reasons.push(`${item(blockCounts.unresolvedEvidence, "person", "people")} lack required evidence`);
  if (blockCounts?.alreadyDraftedOrContacted) reasons.push(`${item(blockCounts.alreadyDraftedOrContacted, "person", "people")} already have a draft or contact history`);
  if (blockCounts?.companyCooldown) reasons.push(`${item(blockCounts.companyCooldown, "company", "companies")} are in cooldown`);
  if (blockCounts?.suppressed) reasons.push(`${item(blockCounts.suppressed, "person", "people")} are suppressed or opted out`);
  if (blockCounts?.noQualifiedReserve) reasons.push("No qualified people are currently in this recipient group");
  if (!reasons.length && added < requested) reasons.push("The actionable reserve is exhausted for this recipient group");

  const recovery = blockCounts?.reviewRequired || blockCounts?.unresolvedEvidence
    ? { label: "Review candidates", href: result.scope ? `/candidates?bucket=${encodeURIComponent(result.scope.bucket)}` : "/candidates" }
    : added < requested
      ? { label: "Find more people", href: result.scope ? `/candidates?bucket=${encodeURIComponent(result.scope.bucket)}&findMore=true` : "/candidates" }
      : null;
  return {
    status: added === 0 ? "zero" : added < requested ? "partial" : "success",
    message: added === 0 ? "No drafts could be added" : added < requested ? `${added} of ${requested} drafts added` : `${added} ${added === 1 ? "draft" : "drafts"} added`,
    reasons,
    recovery,
  };
}

/** Compatibility copy for redirected legacy actions. */
export function draftAdditionMessage(added: number, requested: number, remaining: number): string {
  if (added === 0) return "No drafts could be added. No eligible candidates are available right now.";
  if (added < requested) return `${added} of ${requested} drafts added. ${remaining === 0 ? "The actionable reserve is exhausted." : "Some candidates remain blocked."}`;
  return `${added} ${added === 1 ? "draft" : "drafts"} added.`;
}

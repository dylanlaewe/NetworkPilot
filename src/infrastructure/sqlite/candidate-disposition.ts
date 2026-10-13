import { localCampaignDate } from "@/application/daily-refresh";
import type { SqliteSimulationRepository } from "./database";
import { readDraftGenerations, readQueueOperations } from "./draft-queue";

export type CandidateBrowseDisposition = "skip" | "do-not-show-again";

/**
 * Records a browsing/planning disposition before a candidate has entered a
 * draft campaign. Skip is local to the current campaign day; permanent
 * exclusion reuses the canonical durable candidate suppression ledger.
 */
export function recordCandidateDispositionInRepository(
  repository: SqliteSimulationRepository,
  input: { candidateId: string; disposition: CandidateBrowseDisposition; at: Date },
): { changed: boolean; disposition: "skipped" | "permanently-excluded"; campaignDate: string } {
  return repository.transaction(() => {
    const candidate = repository.native
      .prepare("SELECT 1 present FROM imported_candidates WHERE id=?")
      .get(input.candidateId) as { present: number } | undefined;
    if (!candidate) throw new Error("candidate-disposition-candidate-unavailable");

    const alreadyPlanned = readDraftGenerations(repository.native).some(
      (generation) =>
        generation.candidateIds.includes(input.candidateId) ||
        generation.carriedDraftReviews?.some((review) => review.candidateId === input.candidateId),
    );
    const hasOperation = readQueueOperations(repository).some(
      (operation) => operation.snapshot.candidateId === input.candidateId,
    );
    if (alreadyPlanned || hasOperation) throw new Error("candidate-disposition-draft-exists");

    const campaignDate = localCampaignDate(input.at);
    const suppressed = repository.native
      .prepare("SELECT reason FROM candidate_suppression_entries WHERE candidate_id=?")
      .get(input.candidateId) as { reason: string } | undefined;
    if (suppressed) return { changed: false, disposition: "permanently-excluded", campaignDate };

    const prior = repository.native
      .prepare("SELECT disposition FROM draft_dispositions WHERE candidate_id=? AND campaign_date=?")
      .get(input.candidateId, campaignDate) as { disposition: "skipped" | "permanently-excluded" } | undefined;
    const disposition = input.disposition === "do-not-show-again" ? "permanently-excluded" : "skipped";
    if (prior?.disposition === "permanently-excluded" || prior?.disposition === disposition)
      return { changed: false, disposition: prior.disposition, campaignDate };

    repository.native
      .prepare("INSERT INTO draft_dispositions(candidate_id,campaign_date,disposition,created_at_utc) VALUES(?,?,?,?) ON CONFLICT(candidate_id,campaign_date) DO UPDATE SET disposition=excluded.disposition")
      .run(input.candidateId, campaignDate, disposition, input.at.toISOString());
    repository.native
      .prepare("INSERT INTO draft_disposition_audit(candidate_id,campaign_date,event_type,occurred_at_utc) VALUES(?,?,?,?)")
      .run(input.candidateId, campaignDate, disposition === "permanently-excluded" ? "candidate-permanently-excluded" : "draft-skipped", input.at.toISOString());
    if (disposition === "permanently-excluded")
      repository.native
        .prepare("INSERT OR IGNORE INTO candidate_suppression_entries(candidate_id,reason,created_at_utc) VALUES(?,'operator-do-not-show-again',?)")
        .run(input.candidateId, input.at.toISOString());
    return { changed: true, disposition, campaignDate };
  });
}

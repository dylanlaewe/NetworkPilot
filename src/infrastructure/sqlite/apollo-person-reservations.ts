import { createHash } from "node:crypto";
import type { ApolloPersonReservationStore } from "@/infrastructure/providers/apollo/scoped-provider";
import type { SqliteSimulationRepository } from "./database";

const DEFAULT_STALE_AFTER_MS = 15 * 60 * 1000;

export const apolloPersonReservationId = (personId: string): string =>
  `apollo-person:${createHash("sha256").update(personId).digest("hex")}`;

/**
 * A zero-exposure provider operation is a coordination record, not a second
 * budget. Its deterministic ID makes the Apollo-native person ID globally
 * exclusive in the canonical database before People Match can be attempted.
 */
export class SqliteApolloPersonReservationStore
  implements ApolloPersonReservationStore
{
  constructor(
    private readonly repository: SqliteSimulationRepository,
    private readonly staleAfterMs = DEFAULT_STALE_AFTER_MS,
  ) {
    if (!Number.isFinite(staleAfterMs) || staleAfterMs < 1)
      throw new Error("apollo-person-reservation-stale-window-invalid");
  }

  claim(input: {
    personId: string;
    operationId: string;
    at: Date;
  }): boolean {
    const reservationId = apolloPersonReservationId(input.personId);
    return this.repository.transaction(() => {
      const inserted = this.repository.native
        .prepare(
          "INSERT OR IGNORE INTO provider_operations(id,provider_id,batch_id,operation,state,candidate_count,estimated_max_exposure,observed_consumption,attempt_count,failure_reason,occurred_at_utc) VALUES(?,'apollo',?,'enrichment','authorized',0,0,NULL,0,'scoped-person-reservation:claimed',?)",
        )
        .run(reservationId, input.operationId, input.at.toISOString());
      if (inserted.changes === 1) return true;

      const staleBefore = new Date(
        input.at.getTime() - this.staleAfterMs,
      ).toISOString();
      const reclaimed = this.repository.native
        .prepare(
          "UPDATE provider_operations SET batch_id=?,failure_reason='scoped-person-reservation:reclaimed',occurred_at_utc=? WHERE id=? AND provider_id='apollo' AND operation='enrichment' AND state='authorized' AND candidate_count=0 AND estimated_max_exposure=0 AND attempt_count=0 AND occurred_at_utc<=?",
        )
        .run(
          input.operationId,
          input.at.toISOString(),
          reservationId,
          staleBefore,
        );
      return reclaimed.changes === 1;
    });
  }

  markAttempted(input: {
    personId: string;
    operationId: string;
    at: Date;
  }): void {
    const result = this.repository.native
      .prepare(
        "UPDATE provider_operations SET attempt_count=1,failure_reason='scoped-person-reservation:attempted',occurred_at_utc=? WHERE id=? AND batch_id=? AND state='authorized' AND candidate_count=0 AND estimated_max_exposure=0 AND attempt_count=0",
      )
      .run(
        input.at.toISOString(),
        apolloPersonReservationId(input.personId),
        input.operationId,
      );
    if (result.changes !== 1)
      throw new Error("apollo-person-reservation-attempt-unavailable");
  }

  retainAttempted(input: {
    personId: string;
    operationId: string;
    at: Date;
    outcome: "completed" | "uncertain";
  }): void {
    const result = this.repository.native
      .prepare(
        "UPDATE provider_operations SET state='completed',failure_reason=?,occurred_at_utc=? WHERE id=? AND batch_id=? AND state='authorized' AND candidate_count=0 AND estimated_max_exposure=0 AND attempt_count=1",
      )
      .run(
        `scoped-person-reservation:${input.outcome}`,
        input.at.toISOString(),
        apolloPersonReservationId(input.personId),
        input.operationId,
      );
    if (result.changes !== 1)
      throw new Error("apollo-person-reservation-completion-unavailable");
  }

  releaseUnattempted(input: {
    personId: string;
    operationId: string;
  }): void {
    const result = this.repository.native
      .prepare(
        "DELETE FROM provider_operations WHERE id=? AND batch_id=? AND state='authorized' AND candidate_count=0 AND estimated_max_exposure=0 AND attempt_count=0",
      )
      .run(
        apolloPersonReservationId(input.personId),
        input.operationId,
      );
    if (result.changes !== 1)
      throw new Error("apollo-person-reservation-release-unavailable");
  }
}

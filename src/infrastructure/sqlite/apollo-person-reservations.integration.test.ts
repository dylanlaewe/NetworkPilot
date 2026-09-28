import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteSimulationRepository } from "./database";
import { migrateTestDatabase } from "./test-migrations";
import {
  apolloPersonReservationId,
  SqliteApolloPersonReservationStore,
} from "./apollo-person-reservations";

const directories: string[] = [];
const at = new Date("2026-09-28T12:00:00.000Z");

afterEach(() => {
  directories.splice(0).forEach((directory) =>
    rmSync(directory, { recursive: true, force: true }),
  );
});

function repositories() {
  const directory = mkdtempSync(join(tmpdir(), "networkpilot-person-claim-"));
  directories.push(directory);
  const path = join(directory, "canonical.sqlite");
  const first = new SqliteSimulationRepository(path);
  migrateTestDatabase(first);
  const second = new SqliteSimulationRepository(path);
  return { first, second };
}

describe("canonical Apollo person reservations", () => {
  it("atomically grants exactly one concurrent owner without changing budget exposure", async () => {
    const { first, second } = repositories();
    const stores = [
      new SqliteApolloPersonReservationStore(first),
      new SqliteApolloPersonReservationStore(second),
    ];
    try {
      const claims = await Promise.all([
        Promise.resolve().then(() =>
          stores[0]!.claim({ personId: "same-person", operationId: "op-a", at }),
        ),
        Promise.resolve().then(() =>
          stores[1]!.claim({ personId: "same-person", operationId: "op-b", at }),
        ),
      ]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      expect(first.getApolloProviderStatus("2026-09-28")).toMatchObject({
        attempted: 0,
        estimatedExposure: 0,
        observedConsumption: null,
      });
      expect(
        first.native
          .prepare(
            "SELECT COUNT(*) count FROM provider_operations WHERE id=? AND candidate_count=0 AND estimated_max_exposure=0",
          )
          .get(apolloPersonReservationId("same-person")),
      ).toEqual({ count: 1 });
    } finally {
      first.close();
      second.close();
    }
  });

  it.each(["completed", "uncertain"] as const)(
    "retains an attempted %s reservation against later duplicate spend",
    (outcome) => {
      const { first, second } = repositories();
      const owner = new SqliteApolloPersonReservationStore(first, 1);
      const later = new SqliteApolloPersonReservationStore(second, 1);
      try {
        expect(
          owner.claim({ personId: "attempted-person", operationId: "op-a", at }),
        ).toBe(true);
        owner.markAttempted({
          personId: "attempted-person",
          operationId: "op-a",
          at,
        });
        owner.retainAttempted({
          personId: "attempted-person",
          operationId: "op-a",
          at,
          outcome,
        });
        expect(
          later.claim({
            personId: "attempted-person",
            operationId: "op-b",
            at: new Date(at.getTime() + 60_000),
          }),
        ).toBe(false);
      } finally {
        first.close();
        second.close();
      }
    },
  );

  it("reclaims only a stale never-attempted owner and prevents the old owner from attempting", () => {
    const { first, second } = repositories();
    const staleOwner = new SqliteApolloPersonReservationStore(first, 1_000);
    const recovery = new SqliteApolloPersonReservationStore(second, 1_000);
    try {
      expect(
        staleOwner.claim({ personId: "stale-person", operationId: "op-old", at }),
      ).toBe(true);
      const recoveredAt = new Date(at.getTime() + 1_001);
      expect(
        recovery.claim({
          personId: "stale-person",
          operationId: "op-new",
          at: recoveredAt,
        }),
      ).toBe(true);
      expect(() =>
        staleOwner.markAttempted({
          personId: "stale-person",
          operationId: "op-old",
          at: recoveredAt,
        }),
      ).toThrow("apollo-person-reservation-attempt-unavailable");
      recovery.markAttempted({
        personId: "stale-person",
        operationId: "op-new",
        at: recoveredAt,
      });
    } finally {
      first.close();
      second.close();
    }
  });

  it("releases a never-attempted claim for immediate safe reuse", () => {
    const { first, second } = repositories();
    const owner = new SqliteApolloPersonReservationStore(first);
    const next = new SqliteApolloPersonReservationStore(second);
    try {
      expect(
        owner.claim({ personId: "released-person", operationId: "op-a", at }),
      ).toBe(true);
      owner.releaseUnattempted({
        personId: "released-person",
        operationId: "op-a",
      });
      expect(
        next.claim({ personId: "released-person", operationId: "op-b", at }),
      ).toBe(true);
    } finally {
      first.close();
      second.close();
    }
  });
});

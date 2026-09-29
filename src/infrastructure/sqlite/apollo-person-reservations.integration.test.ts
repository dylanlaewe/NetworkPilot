import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectApolloPersonReservation,
  reconcileApolloPersonReservation,
  type ApolloPersonReconciliationCommand,
} from "@/application/candidate-refresh";
import type { CandidateSourceRecord } from "@/domain/candidates";
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

function authorize(
  repository: SqliteSimulationRepository,
  operationId: string,
): void {
  repository.authorizeApolloOperation({
    operationId,
    batchId: operationId,
    localDate: "2026-09-28",
    candidateCount: 1,
    estimatedMaxExposure: 1,
    maximumPerBatch: 20,
    maximumPerDay: 20,
    hardStop: true,
    at,
  });
}

function candidate(personId: string): CandidateSourceRecord {
  return {
    sourceProviderId: "apollo",
    providerRecordId: personId,
    datasetClassification: "authorized-provider",
    person: { firstName: "Fixture", lastName: "Candidate" },
    currentTitle: "Senior Data Engineer",
    currentOrganization: {
      name: "Fixture Software",
      domain: "fixture-software.example",
      providerId: "org-fixture",
    },
    location: "Boston, Massachusetts, United States",
    industrySignals: ["Software"],
    experienceEvidence: [
      { kind: "exact", years: 8, sourceField: "fixture.experience" },
    ],
    email: {
      address: `${personId}@fixture-software.example`,
      verificationStatus: "verified",
    },
    sourceTimestamps: { retrievedAt: at.toISOString() },
    fieldProvenance: {},
    consent: { suppressed: false, optedOut: false },
    sourceFingerprint: `fixture-source-${personId}`,
    providerMetadata: {
      adapterVersion: "fixture",
      responseMappingVersion: "fixture",
      requestContractVersion: "fixture",
      importArchitectureVersion: "fixture",
      matchConfidence: "high",
    },
  };
}

function command(
  overrides: Partial<ApolloPersonReconciliationCommand> &
    Pick<ApolloPersonReconciliationCommand, "outcome">,
): ApolloPersonReconciliationCommand {
  return {
    commandId: "reconcile-command-001",
    personId: "reconcile-person-001",
    operationId: "reconcile-operation-001",
    actor: "fixture-operator",
    mechanism: "provider-billing-evidence",
    evidence: "Fixture provider ledger inspected",
    reason: "Resolve the uncertain provider attempt",
    at: new Date("2026-09-28T12:05:00.000Z"),
    ...overrides,
  } as ApolloPersonReconciliationCommand;
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

  it("retains a usable normalized result and blocks every ordinary retry", () => {
    const { first, second } = repositories();
    authorize(first, "usable-operation-001");
    const owner = new SqliteApolloPersonReservationStore(first, 1);
    const later = new SqliteApolloPersonReservationStore(second, 1);
    try {
      expect(
        owner.claim({
          personId: "usable-person-001",
          operationId: "usable-operation-001",
          at,
        }),
      ).toBe(true);
      owner.markAttempted({
        personId: "usable-person-001",
        operationId: "usable-operation-001",
        at,
      });
      owner.retainAttempted({
        personId: "usable-person-001",
        operationId: "usable-operation-001",
        at,
        outcome: "usable",
        record: candidate("usable-person-001"),
      });
      expect(
        later.claim({
          personId: "usable-person-001",
          operationId: "later-operation-001",
          at: new Date(at.getTime() + 60_000),
        }),
      ).toBe(false);
      expect(
        owner.inspectApolloPersonReservation({
          personId: "usable-person-001",
          operationId: "usable-operation-001",
        }),
      ).toMatchObject({
        lifecycle: "attempted-result-usable",
        resultRetained: true,
        requiresReconciliation: true,
      });
    } finally {
      first.close();
      second.close();
    }
  });

  it("keeps uncertain attempts locked regardless of stale time", () => {
    const { first, second } = repositories();
    authorize(first, "uncertain-operation-001");
    const owner = new SqliteApolloPersonReservationStore(first, 1);
    const later = new SqliteApolloPersonReservationStore(second, 1);
    try {
      owner.claim({
        personId: "uncertain-person-001",
        operationId: "uncertain-operation-001",
        at,
      });
      owner.markAttempted({
        personId: "uncertain-person-001",
        operationId: "uncertain-operation-001",
        at,
      });
      owner.retainAttempted({
        personId: "uncertain-person-001",
        operationId: "uncertain-operation-001",
        at,
        outcome: "uncertain",
      });
      expect(
        later.claim({
          personId: "uncertain-person-001",
          operationId: "later-operation-001",
          at: new Date(at.getTime() + 86_400_000),
        }),
      ).toBe(false);
      expect(
        owner.inspectApolloPersonReservation({
          personId: "uncertain-person-001",
          operationId: "uncertain-operation-001",
        }),
      ).toMatchObject({
        lifecycle: "reconciliation-required",
        attemptCount: 1,
        reusable: false,
      });
    } finally {
      first.close();
      second.close();
    }
  });

  it("reclaims only a stale never-attempted owner and rejects the old owner", () => {
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
      ).toThrow("apollo-person-reservation-operation-mismatch");
    } finally {
      first.close();
      second.close();
    }
  });

  it("releases a local never-attempted failure without deleting its audit", () => {
    const { first, second } = repositories();
    const owner = new SqliteApolloPersonReservationStore(first);
    const next = new SqliteApolloPersonReservationStore(second);
    try {
      owner.claim({ personId: "released-person", operationId: "op-a", at });
      owner.releaseUnattempted({
        personId: "released-person",
        operationId: "op-a",
        at,
      });
      expect(
        next.claim({ personId: "released-person", operationId: "op-b", at }),
      ).toBe(true);
      expect(
        next.inspectApolloPersonReservation({
          personId: "released-person",
          operationId: "op-b",
        })?.audit,
      ).toHaveLength(3);
    } finally {
      first.close();
      second.close();
    }
  });

  it("explicitly reconciles no consumption, preserves history, and permits one safe reuse", () => {
    const { first, second } = repositories();
    authorize(first, "reconcile-operation-001");
    const store = new SqliteApolloPersonReservationStore(first);
    const other = new SqliteApolloPersonReservationStore(second);
    try {
      store.claim({
        personId: "reconcile-person-001",
        operationId: "reconcile-operation-001",
        at,
      });
      store.markAttempted({
        personId: "reconcile-person-001",
        operationId: "reconcile-operation-001",
        at,
      });
      const resolved = reconcileApolloPersonReservation({
        repository: store,
        command: command({ outcome: "no-consumption-safe-release" }),
      });
      expect(resolved).toMatchObject({
        status: "applied",
        before: { lifecycle: "reconciliation-required" },
        after: {
          lifecycle: "released-no-consumption",
          attemptCount: 1,
          reusable: true,
          observedConsumption: 0,
        },
      });
      expect(
        reconcileApolloPersonReservation({
          repository: store,
          command: command({ outcome: "no-consumption-safe-release" }),
        }).status,
      ).toBe("existing");
      expect(
        other.claim({
          personId: "reconcile-person-001",
          operationId: "reused-operation-001",
          at: new Date("2026-09-29T12:00:00.000Z"),
        }),
      ).toBe(true);
      expect(() =>
        store.markAttempted({
          personId: "reconcile-person-001",
          operationId: "reconcile-operation-001",
          at,
        }),
      ).toThrow("apollo-person-reservation-operation-mismatch");
    } finally {
      first.close();
      second.close();
    }
  });

  it("records consumed-without-import and never makes ordinary retry eligible", () => {
    const { first, second } = repositories();
    authorize(first, "reconcile-operation-001");
    const store = new SqliteApolloPersonReservationStore(first);
    const other = new SqliteApolloPersonReservationStore(second);
    try {
      store.claim({
        personId: "reconcile-person-001",
        operationId: "reconcile-operation-001",
        at,
      });
      store.markAttempted({
        personId: "reconcile-person-001",
        operationId: "reconcile-operation-001",
        at,
      });
      const consumedCommand = command({
        outcome: "consumed-no-import",
        observedConsumption: 1,
      });
      expect(
        reconcileApolloPersonReservation({
          repository: store,
          command: consumedCommand,
        }),
      ).toMatchObject({
        status: "applied",
        after: {
          lifecycle: "consumed-no-import",
          observedConsumption: 1,
          reusable: false,
          importedCandidateId: null,
        },
      });
      expect(
        reconcileApolloPersonReservation({
          repository: store,
          command: consumedCommand,
        }).status,
      ).toBe("existing");
      expect(
        other.claim({
          personId: "reconcile-person-001",
          operationId: "retry-operation-001",
          at: new Date("2026-09-29T12:00:00.000Z"),
        }),
      ).toBe(false);
      expect(
        first.findImportedCandidate("apollo", "reconcile-person-001"),
      ).toBeNull();
    } finally {
      first.close();
      second.close();
    }
  });

  it("resumes a retained result into canonical import without provider work", () => {
    const { first, second } = repositories();
    authorize(first, "reconcile-operation-001");
    const store = new SqliteApolloPersonReservationStore(first);
    try {
      store.claim({
        personId: "reconcile-person-001",
        operationId: "reconcile-operation-001",
        at,
      });
      store.markAttempted({
        personId: "reconcile-person-001",
        operationId: "reconcile-operation-001",
        at,
      });
      store.retainAttempted({
        personId: "reconcile-person-001",
        operationId: "reconcile-operation-001",
        at,
        outcome: "usable",
        record: candidate("reconcile-person-001"),
      });
      expect(
        reconcileApolloPersonReservation({
          repository: store,
          command: command({ outcome: "resume-retained-result" }),
        }),
      ).toMatchObject({
        status: "applied",
        after: {
          lifecycle: "completed-imported",
          resultRetained: false,
          importedCandidateId: expect.any(String),
        },
      });
      expect(
        first.findImportedCandidate("apollo", "reconcile-person-001"),
      ).not.toBeNull();
      expect(
        inspectApolloPersonReservation({
          repository: store,
          personId: "reconcile-person-001",
          operationId: "reconcile-operation-001",
        }),
      ).toMatchObject({ lifecycle: "completed-imported" });
      expect(
        second.native
          .prepare("SELECT COUNT(*) count FROM imported_candidates")
          .get(),
      ).toEqual({ count: 1 });
    } finally {
      first.close();
      second.close();
    }
  });

  it("serializes concurrent reconciliation and replays one command idempotently", async () => {
    const { first, second } = repositories();
    authorize(first, "reconcile-operation-001");
    const owner = new SqliteApolloPersonReservationStore(first);
    const contender = new SqliteApolloPersonReservationStore(second);
    try {
      owner.claim({
        personId: "reconcile-person-001",
        operationId: "reconcile-operation-001",
        at,
      });
      owner.markAttempted({
        personId: "reconcile-person-001",
        operationId: "reconcile-operation-001",
        at,
      });
      const input = command({ outcome: "no-consumption-safe-release" });
      const results = await Promise.all([
        Promise.resolve().then(() =>
          reconcileApolloPersonReservation({ repository: owner, command: input }),
        ),
        Promise.resolve().then(() =>
          reconcileApolloPersonReservation({
            repository: contender,
            command: input,
          }),
        ),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([
        "applied",
        "existing",
      ]);
      expect(
        results[0]!.after.audit.filter(
          (event) => event.commandId === input.commandId,
        ),
      ).toHaveLength(1);
      expect(() =>
        reconcileApolloPersonReservation({
          repository: owner,
          command: {
            ...input,
            evidence: "Conflicting evidence under a replayed command ID",
          },
        }),
      ).toThrow("apollo-person-reconciliation-command-conflict");
    } finally {
      first.close();
      second.close();
    }
  });
});

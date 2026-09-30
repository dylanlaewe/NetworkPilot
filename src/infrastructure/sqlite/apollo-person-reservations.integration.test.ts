import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inspectApolloPersonReservation,
  reconcileApolloPersonReservation,
  type ApolloPersonReconciliationCommand,
} from "@/application/candidate-refresh";
import type { CandidateSourceRecord } from "@/domain/candidates";
import {
  bucketFixture,
  fixtureEvidence,
} from "@/domain/recipient-buckets/test-fixtures";
import type { BucketScope, RecipientBucket } from "@/domain/recipient-buckets";
import { SqliteSimulationRepository } from "./database";
import { migrateTestDatabase } from "./test-migrations";
import {
  apolloPersonReservationId,
  SqliteApolloPersonReservationStore,
} from "./apollo-person-reservations";
import { completeScopedCandidateRecords } from "./scoped-candidate-completion";

const directories: string[] = [];
const at = new Date("2026-09-28T12:00:00.000Z");

afterEach(() => {
  vi.unstubAllEnvs();
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
  candidateCount = 1,
  scope: BucketScope = { bucket: "peers" },
): void {
  repository.authorizeApolloOperation({
    operationId,
    batchId: operationId,
    localDate: "2026-09-28",
    candidateCount,
    estimatedMaxExposure: candidateCount,
    maximumPerBatch: 20,
    maximumPerDay: 20,
    hardStop: true,
    at,
  });
  repository.native
    .prepare("UPDATE provider_operations SET bucket_scope_json=? WHERE id=?")
    .run(JSON.stringify(scope), operationId);
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

function bucketCandidate(personId: string, bucket: RecipientBucket) {
  const fixture = bucketFixture(bucket, 70 + personId.length);
  return {
    company: fixture.company,
    record: {
      ...fixture.source,
      sourceProviderId: "apollo",
      providerRecordId: personId,
      datasetClassification: "authorized-provider" as const,
      sourceFingerprint: `scoped-${personId}`,
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
        observedConsumption: 1,
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
        observedConsumption: null,
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
        observedConsumption: 1,
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
      expect(
        contender.claim({
          personId: input.personId,
          operationId: "replacement-operation-001",
          at: new Date("2026-09-28T12:06:00.000Z"),
        }),
      ).toBe(true);
      expect(
        reconcileApolloPersonReservation({ repository: owner, command: input })
          .status,
      ).toBe("existing");
    } finally {
      first.close();
      second.close();
    }
  });

  it.each([
    ["recruiters", "recruiters", "rejected", true],
    ["recruiters", "peers", "review-required", true],
    ["peers", "managers", "review-required", true],
    ["executives", "ceos", "review-required", true],
  ] as const)(
    "replays a retained candidate through original %s scope with %s classification",
    (scopeBucket, candidateBucket, expectedState, mismatch) => {
      vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true");
      const { first, second } = repositories();
      const operationId = `scope-${scopeBucket}-${candidateBucket}`;
      const personId = `scope-person-${scopeBucket}-${candidateBucket}`;
      const fixture = bucketCandidate(personId, candidateBucket);
      authorize(first, operationId, 1, { bucket: scopeBucket });
      const store = new SqliteApolloPersonReservationStore(first, undefined, {
        companies: [fixture.company],
        companyDomains: {
          [fixture.company.id]: fixture.record.currentOrganization.domain!,
        },
      });
      try {
        store.claim({ personId, operationId, at });
        store.markAttempted({ personId, operationId, at });
        store.retainAttempted({
          personId,
          operationId,
          at,
          outcome: "usable",
          record: fixture.record,
          observedConsumption: 1,
        });
        reconcileApolloPersonReservation({
          repository: store,
          command: command({
            commandId: `resume-${scopeBucket}-${candidateBucket}`,
            personId,
            operationId,
            outcome: "resume-retained-result",
          }),
        });
        const imported = first.findImportedCandidate("apollo", personId)!;
        expect(imported.state).toBe(expectedState);
        expect(imported.gateFailures.includes("discovery-scope-mismatch")).toBe(
          mismatch,
        );
      } finally {
        first.close();
        second.close();
      }
    },
  );

  it("replays through current review, suppression, duplicate, and company gates", () => {
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true");
    const scenarios = ["review", "suppressed", "duplicate", "company"] as const;
    for (const scenario of scenarios) {
      const { first, second } = repositories();
      const operationId = `current-gate-${scenario}`;
      const personId = `current-person-${scenario}`;
      const fixture = bucketCandidate(personId, "peers");
      if (scenario === "review")
        fixture.record.responsibilityEvidence = [
          fixtureEvidence("professional-identity"),
          fixtureEvidence("current-employment"),
          fixtureEvidence("company-identity"),
          fixtureEvidence("relevant-function"),
        ];
      const companies = [
        scenario === "company"
          ? { ...fixture.company, enabled: false }
          : fixture.company,
      ];
      authorize(first, operationId, 1, { bucket: "peers" });
      const store = new SqliteApolloPersonReservationStore(first, undefined, {
        companies,
        companyDomains: {
          [fixture.company.id]: fixture.record.currentOrganization.domain!,
        },
      });
      try {
        store.claim({ personId, operationId, at });
        store.markAttempted({ personId, operationId, at });
        store.retainAttempted({
          personId,
          operationId,
          at,
          outcome: "usable",
          record: fixture.record,
          observedConsumption: 1,
        });
        if (scenario === "suppressed")
          first.native
            .prepare(
              "INSERT INTO candidate_suppression_entries(candidate_id,reason,created_at_utc) VALUES(?,?,?)",
            )
            .run(
              `zz-import:apollo:${personId}`,
              "fixture-current-suppression",
              at.toISOString(),
            );
        if (scenario === "duplicate")
          completeScopedCandidateRecords({
            repository: first,
            operationId: `prior-import-${scenario}`,
            scope: { bucket: "peers" },
            records: [fixture.record],
            adapterVersion: "fixture-prior-import",
            sourceFingerprint: `prior-import-fingerprint-${scenario}`,
            at,
            companies,
            companyDomains: {
              [fixture.company.id]: fixture.record.currentOrganization.domain!,
            },
          });
        reconcileApolloPersonReservation({
          repository: store,
          command: command({
            commandId: `resume-current-${scenario}`,
            personId,
            operationId,
            outcome: "resume-retained-result",
          }),
        });
        const imported = first.listImportedCandidates().find(
          (item) => item.source.providerRecordId === personId,
        )!;
        if (scenario === "review") expect(imported.state).toBe("review-required");
        if (scenario === "suppressed") expect(imported.state).toBe("suppressed");
        if (scenario === "company") {
          expect(imported.state).toBe("rejected");
          expect(imported.gateFailures).toContain("company-unreviewed");
        }
        if (scenario === "duplicate")
          expect(
            first.native
              .prepare(
                "SELECT COUNT(*) count FROM imported_candidates WHERE source_provider_id='apollo' AND provider_record_id=?",
              )
              .get(personId),
          ).toEqual({ count: 1 });
      } finally {
        first.close();
        second.close();
      }
    }
  });

  it("reapplies the original early-career filter during retained replay", () => {
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true");
    const { first, second } = repositories();
    const operationId = "early-career-filter-operation";
    const personId = "early-career-filter-person";
    const fixture = bucketCandidate(personId, "peers");
    authorize(first, operationId, 1, {
      bucket: "peers",
      earlyCareerOnly: true,
    });
    const store = new SqliteApolloPersonReservationStore(first, undefined, {
      companies: [fixture.company],
      companyDomains: {
        [fixture.company.id]: fixture.record.currentOrganization.domain!,
      },
    });
    try {
      store.claim({ personId, operationId, at });
      store.markAttempted({ personId, operationId, at });
      store.retainAttempted({
        personId,
        operationId,
        at,
        outcome: "usable",
        record: fixture.record,
        observedConsumption: 1,
      });
      reconcileApolloPersonReservation({
        repository: store,
        command: command({
          commandId: "resume-early-career-filter",
          personId,
          operationId,
          outcome: "resume-retained-result",
        }),
      });
      expect(first.findImportedCandidate("apollo", personId)).toMatchObject({
        state: "review-required",
        gateFailures: expect.arrayContaining(["discovery-scope-mismatch"]),
      });
    } finally {
      first.close();
      second.close();
    }
  });

  it("never downgrades known provider overage to a no-consumption release", () => {
    const { first, second } = repositories();
    const operationId = "known-overage-release-conflict";
    const personId = "known-overage-person";
    authorize(first, operationId);
    const store = new SqliteApolloPersonReservationStore(first);
    try {
      store.claim({ personId, operationId, at });
      store.markAttempted({ personId, operationId, at });
      store.retainAttempted({
        personId,
        operationId,
        at,
        outcome: "uncertain",
        observedConsumption: 2,
        providerViolation: "provider-credit-model-exceeded",
      });
      expect(() =>
        reconcileApolloPersonReservation({
          repository: store,
          command: command({
            commandId: "invalid-zero-overage-release",
            personId,
            operationId,
            outcome: "no-consumption-safe-release",
          }),
        }),
      ).toThrow("apollo-person-reconciliation-consumption-conflict");
      expect(
        store.inspectApolloPersonReservation({ personId, operationId }),
      ).toMatchObject({
        lifecycle: "reconciliation-required",
        personObservedConsumption: 2,
        providerViolation: "provider-credit-model-exceeded",
        reusable: false,
      });
    } finally {
      first.close();
      second.close();
    }
  });

  it.each([
    ["two-consumed", 1, 1, 2, 2, false, false],
    ["consumed-zero", 1, 0, 1, 1, false, false],
    ["two-zero", 0, 0, 0, 0, false, false],
    ["consumed-unknown", 1, null, null, 1, true, false],
    ["overage-plus-one", 2, 1, 3, 3, false, true],
    ["overage-plus-zero", 2, 0, 2, 2, false, true],
    ["overage-plus-unknown", 2, null, null, 2, true, true],
  ] as const)(
    "derives parent accounting for %s child outcomes",
    (
      _case,
      firstConsumption,
      secondConsumption,
      expectedObserved,
      expectedKnown,
      unknown,
      violation,
    ) => {
      const repositoriesForCase = repositories();
      const { first, second } = repositoriesForCase;
      const operationId = `accounting-${_case}`;
      authorize(first, operationId, 2);
      const store = new SqliteApolloPersonReservationStore(first);
      try {
        for (const personId of [`${_case}-person-a`, `${_case}-person-b`]) {
          store.claim({ personId, operationId, at });
          store.markAttempted({ personId, operationId, at });
        }
        const reconcile = (personId: string, value: number) =>
          reconcileApolloPersonReservation({
            repository: store,
            command: command({
              commandId: `resolve-${personId}`,
              personId,
              operationId,
              outcome:
                value === 0
                  ? "no-consumption-safe-release"
                  : "consumed-no-import",
              ...(value > 0 ? { observedConsumption: value } : {}),
            }),
          });
        reconcile(`${_case}-person-a`, firstConsumption);
        if (secondConsumption !== null)
          reconcile(`${_case}-person-b`, secondConsumption);
        const parent = first.native
          .prepare(
            "SELECT state,attempt_count,estimated_max_exposure,observed_consumption,failure_reason FROM provider_operations WHERE id=?",
          )
          .get(operationId);
        expect(parent).toEqual({
          state: violation ? "failed" : "authorized",
          attempt_count: 2,
          estimated_max_exposure: 2,
          observed_consumption: expectedObserved,
          failure_reason: violation
            ? "provider-credit-model-exceeded"
            : null,
        });
        expect(first.getApolloProviderStatus("2026-09-28")).toMatchObject({
          observedConsumption: expectedObserved,
          knownObservedConsumption: expectedKnown,
          hasUnknownConsumption: unknown,
        });
        expect(
          store.inspectApolloPersonReservation({
            personId: `${_case}-person-a`,
            operationId,
          }),
        ).toMatchObject({
          personObservedConsumption: firstConsumption,
          consumptionKnown: true,
          providerViolation: violation
            ? "provider-credit-model-exceeded"
            : null,
        });
        expect(
          store.inspectApolloPersonReservation({
            personId: `${_case}-person-b`,
            operationId,
          }),
        ).toMatchObject({
          personObservedConsumption: secondConsumption,
          consumptionKnown: secondConsumption !== null,
        });
      } finally {
        first.close();
        second.close();
      }
    },
  );

  it("atomically reconciles different people under one parent", async () => {
    const { first, second } = repositories();
    const operationId = "concurrent-parent-operation";
    authorize(first, operationId, 2);
    const owner = new SqliteApolloPersonReservationStore(first);
    const contender = new SqliteApolloPersonReservationStore(second);
    try {
      for (const personId of ["concurrent-parent-a", "concurrent-parent-b"]) {
        owner.claim({ personId, operationId, at });
        owner.markAttempted({ personId, operationId, at });
      }
      const results = await Promise.all([
        Promise.resolve().then(() =>
          reconcileApolloPersonReservation({
            repository: owner,
            command: command({
              commandId: "concurrent-parent-command-a",
              personId: "concurrent-parent-a",
              operationId,
              outcome: "consumed-no-import",
              observedConsumption: 1,
            }),
          }),
        ),
        Promise.resolve().then(() =>
          reconcileApolloPersonReservation({
            repository: contender,
            command: command({
              commandId: "concurrent-parent-command-b",
              personId: "concurrent-parent-b",
              operationId,
              outcome: "no-consumption-safe-release",
            }),
          }),
        ),
      ]);
      expect(results.every((result) => result.status === "applied")).toBe(true);
      expect(
        first.native
          .prepare(
            "SELECT attempt_count,estimated_max_exposure,observed_consumption FROM provider_operations WHERE id=?",
          )
          .get(operationId),
      ).toEqual({
        attempt_count: 2,
        estimated_max_exposure: 2,
        observed_consumption: 1,
      });
    } finally {
      first.close();
      second.close();
    }
  });

  it("allows only one of two conflicting operators to resolve the same person", async () => {
    const { first, second } = repositories();
    const operationId = "same-person-conflicting-resolution";
    const personId = "same-person-conflict-001";
    authorize(first, operationId);
    const owner = new SqliteApolloPersonReservationStore(first);
    const contender = new SqliteApolloPersonReservationStore(second);
    try {
      owner.claim({ personId, operationId, at });
      owner.markAttempted({ personId, operationId, at });
      const results = await Promise.allSettled([
        Promise.resolve().then(() =>
          reconcileApolloPersonReservation({
            repository: owner,
            command: command({
              commandId: "same-person-consumed-command",
              personId,
              operationId,
              outcome: "consumed-no-import",
              observedConsumption: 1,
            }),
          }),
        ),
        Promise.resolve().then(() =>
          reconcileApolloPersonReservation({
            repository: contender,
            command: command({
              commandId: "same-person-zero-command",
              personId,
              operationId,
              outcome: "no-consumption-safe-release",
            }),
          }),
        ),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
        1,
      );
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(
        1,
      );
      expect(
        owner.inspectApolloPersonReservation({ personId, operationId })
          ?.lifecycle,
      ).toMatch(/^(consumed-no-import|released-no-consumption)$/);
    } finally {
      first.close();
      second.close();
    }
  });

  it("serializes retained replay with normal local completion and duplicate replay", async () => {
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true");
    const { first, second } = repositories();
    const operationId = "resume-completion-race-operation";
    const personId = "resume-completion-race-person";
    const fixture = bucketCandidate(personId, "peers");
    authorize(first, operationId, 1, { bucket: "peers" });
    const owner = new SqliteApolloPersonReservationStore(first, undefined, {
      companies: [fixture.company],
      companyDomains: {
        [fixture.company.id]: fixture.record.currentOrganization.domain!,
      },
    });
    const contender = new SqliteApolloPersonReservationStore(second, undefined, {
      companies: [fixture.company],
      companyDomains: {
        [fixture.company.id]: fixture.record.currentOrganization.domain!,
      },
    });
    owner.claim({ personId, operationId, at });
    owner.markAttempted({ personId, operationId, at });
    owner.retainAttempted({
      personId,
      operationId,
      at,
      outcome: "usable",
      record: fixture.record,
      observedConsumption: 1,
    });
    const resumeCommand = command({
      commandId: "resume-race-command-001",
      personId,
      operationId,
      outcome: "resume-retained-result",
    });
    try {
      const replayResults = await Promise.all([
        Promise.resolve().then(() =>
          reconcileApolloPersonReservation({
            repository: owner,
            command: resumeCommand,
          }),
        ),
        Promise.resolve().then(() =>
          reconcileApolloPersonReservation({
            repository: contender,
            command: resumeCommand,
          }),
        ),
      ]);
      expect(replayResults.map((result) => result.status).sort()).toEqual([
        "applied",
        "existing",
      ]);
      expect(
        first.native
          .prepare(
            "SELECT COUNT(*) count FROM imported_candidates WHERE source_provider_id='apollo' AND provider_record_id=?",
          )
          .get(personId),
      ).toEqual({ count: 1 });

      first.transaction(() => {
        completeScopedCandidateRecords({
          repository: first,
          operationId,
          scope: { bucket: "peers" },
          records: [fixture.record],
          adapterVersion: "normal-completion-race-fixture",
          sourceFingerprint: operationId,
          at,
          companies: [fixture.company],
          companyDomains: {
            [fixture.company.id]: fixture.record.currentOrganization.domain!,
          },
        });
        owner.markImported({
          personId,
          operationId,
          importedCandidateId: `zz-import:apollo:${personId}`,
          at,
        });
      });
      expect(
        first.native
          .prepare(
            "SELECT COUNT(*) count FROM imported_candidates WHERE source_provider_id='apollo' AND provider_record_id=?",
          )
          .get(personId),
      ).toEqual({ count: 1 });
    } finally {
      first.close();
      second.close();
    }
  });

  it("serializes retained reconciliation racing normal scoped completion", async () => {
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true");
    const { first, second } = repositories();
    const operationId = "normal-reconciliation-race-operation";
    const personId = "normal-reconciliation-race-person";
    const fixture = bucketCandidate(personId, "peers");
    authorize(first, operationId, 1, { bucket: "peers" });
    const options = {
      companies: [fixture.company],
      companyDomains: {
        [fixture.company.id]: fixture.record.currentOrganization.domain!,
      },
    };
    const owner = new SqliteApolloPersonReservationStore(
      first,
      undefined,
      options,
    );
    const contender = new SqliteApolloPersonReservationStore(
      second,
      undefined,
      options,
    );
    owner.claim({ personId, operationId, at });
    owner.markAttempted({ personId, operationId, at });
    owner.retainAttempted({
      personId,
      operationId,
      at,
      outcome: "usable",
      record: fixture.record,
      observedConsumption: 1,
    });
    try {
      const results = await Promise.allSettled([
        Promise.resolve().then(() =>
          reconcileApolloPersonReservation({
            repository: owner,
            command: command({
              commandId: "normal-reconciliation-race-command",
              personId,
              operationId,
              outcome: "resume-retained-result",
            }),
          }),
        ),
        Promise.resolve().then(() =>
          second.transaction(() => {
            const completed = completeScopedCandidateRecords({
              repository: second,
              operationId,
              scope: { bucket: "peers" },
              records: [fixture.record],
              adapterVersion: "normal-race-fixture",
              sourceFingerprint: operationId,
              at,
              ...options,
            });
            contender.markImported({
              personId,
              operationId,
              importedCandidateId: completed.imported[0]!.id,
              at,
            });
          }),
        ),
      ]);
      expect(results.some((result) => result.status === "fulfilled")).toBe(true);
      expect(
        first.native
          .prepare(
            "SELECT COUNT(*) count FROM imported_candidates WHERE source_provider_id='apollo' AND provider_record_id=?",
          )
          .get(personId),
      ).toEqual({ count: 1 });
      expect(
        owner.inspectApolloPersonReservation({ personId, operationId }),
      ).toMatchObject({
        lifecycle: "completed-imported",
        importedCandidateId: `zz-import:apollo:${personId}`,
      });
    } finally {
      first.close();
      second.close();
    }
  });
});

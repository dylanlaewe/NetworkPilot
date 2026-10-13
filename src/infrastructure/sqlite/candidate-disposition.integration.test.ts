import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importCandidateBatch } from "@/application/ingestion";
import { bucketFixture, FIXTURE_AT } from "@/domain/recipient-buckets/test-fixtures";
import { bucketReserve } from "./bucket-reserve";
import { recordCandidateDispositionInRepository } from "./candidate-disposition";
import { SqliteSimulationRepository } from "./database";
import { draftIsDismissed } from "./draft-queue";
import { migrateTestDatabase } from "./test-migrations";

const repositories: SqliteSimulationRepository[] = [];
beforeEach(() => vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true"));
afterEach(() => { repositories.splice(0).forEach((repository) => repository.close()); vi.unstubAllEnvs(); });

function setup() {
  const repository = new SqliteSimulationRepository(":memory:");
  repositories.push(repository);
  migrateTestDatabase(repository);
  const fixture = bucketFixture("managers");
  importCandidateBatch(repository, [fixture.company], {
    batchId: "candidate-disposition-fixture",
    adapterId: "bucket-fixture",
    adapterVersion: "fixture-v1",
    datasetClassification: "provider-shaped-fixture",
    sourceFingerprint: "candidate-disposition-fingerprint",
    records: [fixture.source],
    requestedBucketScope: { bucket: "managers" },
    strategyCompanyDomains: { [fixture.company.id]: fixture.source.currentOrganization.domain! },
  }, FIXTURE_AT);
  return { repository, candidateId: repository.listImportedCandidates()[0]!.id };
}

describe("pre-draft candidate disposition", () => {
  it("skips current browsing/planning without contact, cooldown, or suppression", () => {
    const { repository, candidateId } = setup();
    expect(bucketReserve(repository, { bucket: "managers" }, FIXTURE_AT).actionableCapacity).toBe(1);
    expect(recordCandidateDispositionInRepository(repository, { candidateId, disposition: "skip", at: FIXTURE_AT })).toMatchObject({ changed: true, disposition: "skipped" });
    expect(draftIsDismissed(repository.native, candidateId, "2026-09-22")).toBe(true);
    expect(bucketReserve(repository, { bucket: "managers" }, FIXTURE_AT).actionableCapacity).toBe(0);
    expect(repository.native.prepare("SELECT COUNT(*) count FROM candidate_suppression_entries").get()).toEqual({ count: 0 });
    expect(repository.native.prepare("SELECT COUNT(*) count FROM outreach_events").get()).toEqual({ count: 0 });
    expect(repository.native.prepare("SELECT COUNT(*) count FROM manual_outreach_records").get()).toEqual({ count: 0 });
    expect(recordCandidateDispositionInRepository(repository, { candidateId, disposition: "skip", at: FIXTURE_AT }).changed).toBe(false);
    expect(repository.native.prepare("SELECT COUNT(*) count FROM draft_disposition_audit").get()).toEqual({ count: 1 });
  });

  it("upgrades to durable suppression and cannot be downgraded", () => {
    const { repository, candidateId } = setup();
    recordCandidateDispositionInRepository(repository, { candidateId, disposition: "skip", at: FIXTURE_AT });
    expect(recordCandidateDispositionInRepository(repository, { candidateId, disposition: "do-not-show-again", at: FIXTURE_AT })).toMatchObject({ changed: true, disposition: "permanently-excluded" });
    expect(repository.native.prepare("SELECT candidate_id,reason FROM candidate_suppression_entries").all()).toEqual([{ candidate_id: candidateId, reason: "operator-do-not-show-again" }]);
    expect(recordCandidateDispositionInRepository(repository, { candidateId, disposition: "skip", at: FIXTURE_AT })).toMatchObject({ changed: false, disposition: "permanently-excluded" });
    expect(repository.listImportedCandidates()[0]).toMatchObject({ state: "suppressed", source: { consent: { suppressed: true } } });
    expect(repository.native.prepare("SELECT COUNT(*) count FROM draft_disposition_audit").get()).toEqual({ count: 2 });
  });

  it("fails closed for an unknown candidate", () => {
    const { repository } = setup();
    expect(() => recordCandidateDispositionInRepository(repository, { candidateId: "missing", disposition: "skip", at: FIXTURE_AT })).toThrow("candidate-disposition-candidate-unavailable");
    expect(repository.native.prepare("SELECT COUNT(*) count FROM draft_dispositions").get()).toEqual({ count: 0 });
  });
});

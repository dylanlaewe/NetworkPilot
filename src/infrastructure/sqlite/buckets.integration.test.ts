import {migrateTestDatabase} from "@/infrastructure/sqlite/test-migrations";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteSimulationRepository } from "./database";
import {
  bucketFixture,
  fixtureEvidence,
  FIXTURE_AT,
} from "@/domain/recipient-buckets/test-fixtures";
import { importCandidateBatch } from "@/application/ingestion";
import { buildReviewedBucketCorrection } from "@/application/ingestion/review-bucket";
import {
  addBucketDraftsFromRepository,
  bucketReserve,
  resolveBucketDraftCorrectionInRepository,
} from "./bucket-reserve";
import { loadQueueReviews, readDraftGenerations } from "./draft-queue";
import { approveForGmailDraft } from "@/application/email-drafts";
import { approvedSnapshot } from "@/application/command-center-drafts";
import type { RecipientBucket } from "@/domain/recipient-buckets";
import {reviewCompanyTrust} from "@/application/company-trust";
import {discoveredCompanyIdentity} from "@/domain/company-trust";

const repos: SqliteSimulationRepository[] = [],
  folders: string[] = [];
const repo = () => {
  const r = new SqliteSimulationRepository(":memory:");
  migrateTestDatabase(r);
  repos.push(r);
  return r;
};
function add(
  r: SqliteSimulationRepository,
  bucket: RecipientBucket,
  ordinal: number,
  early = false,
) {
  const fixture = bucketFixture(bucket, ordinal, early);
  if(bucket==="recruiters")fixture.company.id=discoveredCompanyIdentity({employerDomain:fixture.source.currentOrganization.domain})!;
  r.native.prepare("INSERT OR IGNORE INTO target_companies(id,canonical_name,industry_id,company_tier,enabled,recognition_score,career_upside_score,technical_interest_score,geographic_relevance_json,rationale,provenance,last_reviewed_date,operator_notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(fixture.company.id,fixture.company.canonicalName,fixture.company.industryId,fixture.company.tier,Number(fixture.company.enabled),fixture.company.recognitionScore,fixture.company.careerUpsideScore,fixture.company.technicalInterestScore,JSON.stringify(fixture.company.geographicRelevance),fixture.company.rationale,fixture.company.provenance,fixture.company.lastReviewedDate,fixture.company.operatorNotes);
  importCandidateBatch(
    r,
    [fixture.company],
    {
      batchId: `fixture-batch-${ordinal}`,
      adapterId: "bucket-fixture",
      adapterVersion: "fixture-v1",
      datasetClassification: "provider-shaped-fixture",
      sourceFingerprint: `fixture-batch-fingerprint-${ordinal}`,
      records: [fixture.source],
      strategyCompanyDomains: {
        [fixture.company.id]: fixture.source.currentOrganization.domain!,
      },
    },
    FIXTURE_AT,
  );
  return r.findImportedCandidate("bucket-fixture", `person-${ordinal}`)!;
}
function trustCandidateCompany(r:SqliteSimulationRepository,candidate:ReturnType<typeof add>,commandId:string){
  return reviewCompanyTrust(r,{commandId,companyId:candidate.strategyCompanyMatch!.companyId,expectedVersion:r.findCompanyTrustRecord(candidate.strategyCompanyMatch!.companyId)?.version??0,resultingTrustState:"trusted-operating",reason:"Fixture operating-employer review",reviewerActor:"local-operator",sourceReference:"fixture://company-review",at:FIXTURE_AT});
}
beforeEach(() => vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true"));
afterEach(() => {
  repos.splice(0).forEach((r) => r.close());
  folders.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true }));
  vi.unstubAllEnvs();
});

describe("bucket persistence and reserve integration", () => {
  it("preserves disabled legacy imports and writes no classification or default preference", () => {
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "false");
    const r = repo(),
      c = add(r, "peers", 1, true);
    expect(c.recipientBucket).toBeUndefined();
    expect(c.gateFailures).toContain("insufficient-or-unknown-experience");
    expect(
      r.native
        .prepare("SELECT recipient_bucket_json FROM imported_candidates")
        .get(),
    ).toEqual({ recipient_bucket_json: null });
    expect(() => r.clearRecruiterDefaultResumeId()).toThrow(
      "five-bucket-disabled",
    );
    expect(() =>
      addBucketDraftsFromRepository(r, 5, { bucket: "peers" }, FIXTURE_AT, {
        includeSecondary: false,
      }),
    ).toThrow("five-bucket-disabled");
    expect(readDraftGenerations(r.native)).toEqual([]);
  });
  it.each(["recruiters", "peers", "managers", "executives", "ceos"] as const)(
    "roundtrips qualified evidence for %s",
    (bucket) => {
      const r = repo();
      let c = add(r, bucket, 1, bucket === "peers");
      if(bucket==="recruiters"){trustCandidateCompany(r,c,"bucket-trust-roundtrip");c=r.findImportedCandidate("bucket-fixture","person-1")!;}
      expect(c).toMatchObject({
        state: "eligible",
        gateFailures: [],
        recipientBucket: { bucket, reviewState: "accepted" },
      });
      const storedBucket=JSON.parse((r.native.prepare("SELECT recipient_bucket_json FROM imported_candidates").get() as {recipient_bucket_json:string}).recipient_bucket_json);
      if(bucket==="recruiters")expect(storedBucket).toMatchObject({reviewState:"review-required",explanationCodes:["company-trust-unverified"]});else expect(storedBucket).toEqual(c.recipientBucket);
      if (bucket === "ceos" || bucket === "executives")
        expect(c.classification.specificRoleId).toBeNull();
    },
  );
  it("keeps a CEO review-only when verified field relevance lacks human review provenance", () => {
    const r = repo(),
      fixture = bucketFixture("ceos", 1);
    fixture.source.responsibilityEvidence =
      fixture.source.responsibilityEvidence?.map((item) =>
        item.kind === "relevant-function"
          ? { ...item, reviewedBy: undefined }
          : item,
      );
    importCandidateBatch(
      r,
      [fixture.company],
      {
        batchId: "fixture-unreviewed-ceo",
        adapterId: "bucket-fixture",
        adapterVersion: "fixture-v1",
        datasetClassification: "provider-shaped-fixture",
        sourceFingerprint: "fixture-unreviewed-ceo-fingerprint",
        records: [fixture.source],
        strategyCompanyDomains: {
          [fixture.company.id]: fixture.source.currentOrganization.domain!,
        },
      },
      FIXTURE_AT,
    );
    expect(r.listImportedCandidates()[0]).toMatchObject({
      state: "review-required",
      gateFailures: ["recipient-function-unrelated"],
      recipientBucket: { bucket: "ceos", reviewState: "accepted" },
    });
  });
  it.each([
    { title: "Data Engineering Manager", seniority: "intern" },
    { title: "Founder, Data Analytics", seniority: undefined },
  ])(
    "does not let manager evidence override contradictory seniority for $title",
    ({ title, seniority }) => {
      const r = repo(),
        fixture = bucketFixture("managers", 1);
      fixture.source.currentTitle = title;
      if (seniority)
        fixture.source.providerMetadata = {
          adapterVersion: "fixture-v1",
          responseMappingVersion: "fixture-v1",
          requestContractVersion: "fixture-v1",
          importArchitectureVersion: "fixture-v1",
          providerSeniority: seniority,
        };
      importCandidateBatch(
        r,
        [fixture.company],
        {
          batchId: `fixture-contradiction-${seniority ?? "founder"}`,
          adapterId: "bucket-fixture",
          adapterVersion: "fixture-v1",
          datasetClassification: "provider-shaped-fixture",
          sourceFingerprint: `fixture-contradiction-${seniority ?? "founder"}-fingerprint`,
          records: [fixture.source],
          strategyCompanyDomains: {
            [fixture.company.id]: fixture.source.currentOrganization.domain!,
          },
        },
        FIXTURE_AT,
      );
      expect(r.listImportedCandidates()[0].gateFailures).toContain(
        "prohibited-seniority",
      );
      expect(
        bucketReserve(r, { bucket: "managers" }, FIXTURE_AT, {
          includeSecondary: false,
        }).actionableCapacity,
      ).toBe(0);
    },
  );
  it.each([
    { bucket: "executives" as const, seniority: "intern" },
    { bucket: "executives" as const, seniority: "entry" },
    { bucket: "ceos" as const, seniority: "partner" },
  ])(
    "keeps $bucket review-only when provider seniority $seniority contradicts reviewed scope",
    ({ bucket, seniority }) => {
      const r = repo(),
        fixture = bucketFixture(bucket, 1);
      fixture.source.providerMetadata = {
        adapterVersion: "fixture-v1",
        responseMappingVersion: "fixture-v1",
        requestContractVersion: "fixture-v1",
        importArchitectureVersion: "fixture-v1",
        providerSeniority: seniority,
      };
      importCandidateBatch(
        r,
        [fixture.company],
        {
          batchId: `fixture-${bucket}-${seniority}`,
          adapterId: "bucket-fixture",
          adapterVersion: "fixture-v1",
          datasetClassification: "provider-shaped-fixture",
          sourceFingerprint: `fixture-${bucket}-${seniority}-fingerprint`,
          records: [fixture.source],
          strategyCompanyDomains: {
            [fixture.company.id]: fixture.source.currentOrganization.domain!,
          },
        },
        FIXTURE_AT,
      );
      expect(r.listImportedCandidates()[0].gateFailures).toContain(
        "prohibited-seniority",
      );
      expect(
        bucketReserve(r, { bucket }, FIXTURE_AT, { includeSecondary: false })
          .actionableCapacity,
      ).toBe(0);
    },
  );
  it("adds only the chosen peer cohort and leaves existing stored message/order intact", () => {
    const r = repo();
    add(r, "managers", 1);
    add(r, "peers", 2, true);
    add(r, "peers", 3);
    add(r, "peers", 4, true);
    const first = addBucketDraftsFromRepository(
      r,
      1,
      { bucket: "managers" },
      FIXTURE_AT,
      { includeSecondary: false },
    );
    const before = structuredClone(first.draftReviews);
    const added = addBucketDraftsFromRepository(
      r,
      5,
      { bucket: "peers", earlyCareerOnly: true },
      FIXTURE_AT,
      { includeSecondary: false },
    );
    expect(added.addition).toMatchObject({
      additionalDraftCount: 5,
      addedCount: 2,
      activeBefore: 1,
      activeAfter: 3,
      eligibleReserveRemaining: 0,
      shortfallCode: "scoped-reserve-exhausted",
    });
    expect(
      added.draftReviews?.every((d) => d.recipientBucket?.earlyCareer),
    ).toBe(true);
    const queue = loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false });
    expect(queue[0].subject).toBe(before![0].subject);
    expect(queue[0].body).toBe(before![0].body);
    expect(queue.map((d) => d.candidateId)).toEqual([
      ...first.candidateIds,
      ...added.candidateIds,
    ]);
  });
  it("replays a scoped Add request without creating another generation", () => {
    const r = repo();
    for (let ordinal = 1; ordinal <= 6; ordinal++) add(r, "managers", ordinal);
    const options = {
      includeSecondary: false,
      requestId: "fixture-add-request",
    };
    const first = addBucketDraftsFromRepository(
        r,
        5,
        { bucket: "managers" },
        FIXTURE_AT,
        options,
      ),
      before = readDraftGenerations(r.native);
    const replay = addBucketDraftsFromRepository(
      r,
      5,
      { bucket: "managers" },
      FIXTURE_AT,
      options,
    );
    expect(replay).toEqual(first);
    expect(readDraftGenerations(r.native)).toEqual(before);
    expect(
      loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false }),
    ).toHaveLength(5);
    expect(() =>
      addBucketDraftsFromRepository(
        r,
        1,
        { bucket: "managers" },
        FIXTURE_AT,
        options,
      ),
    ).toThrow("draft-add-request-conflict");
    expect(readDraftGenerations(r.native)).toEqual(before);
  });
  it("replays an empty scoped Add result after reserve supply changes", () => {
    const r = repo(),
      options = { includeSecondary: false, requestId: "fixture-empty-add" };
    const empty = addBucketDraftsFromRepository(
      r,
      5,
      { bucket: "managers" },
      FIXTURE_AT,
      options,
    );
    expect(empty.addition).toMatchObject({
      addedCount: 0,
      shortfallCode: "scoped-reserve-exhausted",
    });
    add(r, "managers", 1);
    expect(
      addBucketDraftsFromRepository(
        r,
        5,
        { bucket: "managers" },
        FIXTURE_AT,
        options,
      ),
    ).toEqual(empty);
    expect(
      loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false }),
    ).toHaveLength(0);
  });
  it("builds auditable base identity evidence for a legacy candidate correction", () => {
    const r = repo(),
      fixture = bucketFixture("managers", 1);
    fixture.source.responsibilityEvidence = undefined;
    importCandidateBatch(
      r,
      [fixture.company],
      {
        batchId: "fixture-legacy-correction",
        adapterId: "bucket-fixture",
        adapterVersion: "fixture-v1",
        datasetClassification: "provider-shaped-fixture",
        sourceFingerprint: "fixture-legacy-correction-fingerprint",
        records: [fixture.source],
        strategyCompanyDomains: {
          [fixture.company.id]: fixture.source.currentOrganization.domain!,
        },
      },
      FIXTURE_AT,
    );
    const candidate = r.listImportedCandidates()[0],
      correction = buildReviewedBucketCorrection(candidate, {
        bucket: "managers",
        field: "analytics",
        responsibility: "leads an analytics team",
        context: "team systems",
        sourceReference: "reviewed provider employer record",
        at: FIXTURE_AT,
      });
    r.reviewCandidate(
      candidate.id,
      "correct",
      "Operator verified role and employment",
      undefined,
      FIXTURE_AT,
      correction,
    );
    expect(r.listImportedCandidates()[0]).toMatchObject({
      state: "eligible",
      reviewState: "corrected",
      recipientBucket: { bucket: "managers", reviewState: "accepted" },
    });
    expect(r.listReviewAudit(candidate.id)).toHaveLength(1);
  });
  it("keeps a correction fail-closed when stored company identity is ambiguous", () => {
    const r = repo(),
      candidate = add(r, "managers", 1),
      ambiguous = {
        ...candidate,
        recipientBucket: null,
        strategyCompanyMatch: null,
        source: {
          ...candidate.source,
          currentOrganization: { name: "Unknown employer" },
          responsibilityEvidence: undefined,
        },
      };
    r.native
      .prepare(
        "UPDATE imported_candidates SET normalized_snapshot_json=? WHERE id=?",
      )
      .run(JSON.stringify(ambiguous), candidate.id);
    const correction = buildReviewedBucketCorrection(ambiguous, {
      bucket: "managers",
      field: "analytics",
      responsibility: "leads a team",
      sourceReference: "operator note without employer proof",
      at: FIXTURE_AT,
    });
    expect(() =>
      r.reviewCandidate(
        candidate.id,
        "correct",
        "Employer identity not established",
        undefined,
        FIXTURE_AT,
        correction,
      ),
    ).toThrow("bucket-correction-evidence-insufficient");
    expect(r.listReviewAudit(candidate.id)).toHaveLength(0);
  });
  it("requires company trust in addition to audited internal-recruiter evidence", () => {
    const r = repo(),
      candidate = add(r, "recruiters", 1),
      stale = {
        ...candidate,
        recruiterClassification: {
          ...candidate.recruiterClassification!,
          accepted: false,
        },
      };
    r.native
      .prepare(
        "UPDATE imported_candidates SET normalized_snapshot_json=? WHERE id=?",
      )
      .run(JSON.stringify(stale), candidate.id);
    const correction = buildReviewedBucketCorrection(stale, {
      bucket: "recruiters",
      field: "technical recruiting",
      responsibility: "recruits for internal engineering roles",
      context: "technical-data-ai",
      sourceReference: "reviewed provider employment record",
      at: FIXTURE_AT,
    });
    r.reviewCandidate(
      candidate.id,
      "correct",
      "Operator verified internal recruiter",
      undefined,
      FIXTURE_AT,
      correction,
    );
    expect(r.listImportedCandidates()[0]).toMatchObject({state:"rejected",recipientBucket:{bucket:"recruiters",reviewState:"review-required"},gateFailures:expect.arrayContaining(["company-trust-unverified"])});
    trustCandidateCompany(r,candidate,"bucket-trust-correction");
    expect(r.listImportedCandidates()[0]).toMatchObject({
      state: "eligible",
      recipientBucket: { bucket: "recruiters", reviewState: "accepted" },
    });
  });
  it("replaces in place and leaves a draft present when same-bucket supply is exhausted", () => {
    const r = repo();
    add(r, "managers", 1);
    add(r, "peers", 2);
    add(r, "managers", 3);
    const first = addBucketDraftsFromRepository(
      r,
      1,
      { bucket: "managers" },
      FIXTURE_AT,
      { includeSecondary: false },
    );
    addBucketDraftsFromRepository(r, 1, { bucket: "peers" }, FIXTURE_AT, {
      includeSecondary: false,
    });
    const replaced = addBucketDraftsFromRepository(
      r,
      1,
      { bucket: "managers" },
      FIXTURE_AT,
      { includeSecondary: false, replacementId: first.candidateIds[0] },
    );
    expect(
      loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false })[0]
        .candidateId,
    ).toBe(replaced.candidateIds[0]);
    const empty = addBucketDraftsFromRepository(
      r,
      1,
      { bucket: "managers" },
      FIXTURE_AT,
      { includeSecondary: false, replacementId: replaced.candidateIds[0] },
    );
    expect(empty.addition?.addedCount).toBe(0);
    expect(
      loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false })[0]
        .candidateId,
    ).toBe(replaced.candidateIds[0]);
  });
  it("audits a correction without changing track, suppression, or immutable approval", () => {
    const r = repo(),
      c = add(r, "executives", 1);
    const result = addBucketDraftsFromRepository(
      r,
      1,
      { bucket: "executives" },
      FIXTURE_AT,
      { includeSecondary: false },
    );
    const snapshot = approvedSnapshot(result.draftReviews![0], FIXTURE_AT);
    approveForGmailDraft(r, snapshot, "fixture-only");
    const immutable = JSON.stringify(
      r.findGmailDraftOperation(snapshot.snapshotId)?.snapshot,
    );
    r.native
      .prepare(
        "INSERT INTO candidate_suppression_entries(candidate_id,reason,created_at_utc) VALUES(?,'fixture suppression',?)",
      )
      .run(c.id, FIXTURE_AT.toISOString());
    const evidence = c
      .recipientBucket!.evidence.filter(
        (e) => e.kind !== "functional-leadership",
      )
      .concat(fixtureEvidence("individual-contributor"));
    r.reviewCandidate(
      c.id,
      "correct",
      "Reviewed fictional IC scope",
      undefined,
      FIXTURE_AT,
      { bucket: "peers", evidence, reviewedBy: "Fictional reviewer" },
    );
    expect(
      r.findImportedCandidate("bucket-fixture", "person-1")?.outreachTrack,
    ).toBe("professional");
    expect(
      r.findImportedCandidate("bucket-fixture", "person-1")?.recipientBucket
        ?.bucket,
    ).toBe("peers");
    expect(r.listReviewAudit(c.id)).toHaveLength(1);
    expect(
      JSON.stringify(r.findGmailDraftOperation(snapshot.snapshotId)?.snapshot),
    ).toBe(immutable);
    expect(
      bucketReserve(r, { bucket: "peers" }, FIXTURE_AT, {
        includeSecondary: false,
      }).actionableCapacity,
    ).toBe(0);
    expect(
      r.native.prepare("SELECT COUNT(*) n FROM imported_candidates").get(),
    ).toEqual({ n: 1 });
  });
  it("preserves unapproved edits after correction until an explicit keep or regenerate choice", () => {
    const r = repo(),
      candidate = add(r, "managers", 1);
    const generation = addBucketDraftsFromRepository(
      r,
      1,
      { bucket: "managers" },
      FIXTURE_AT,
      { includeSecondary: false },
    );
    const originalBody = generation.draftReviews![0].body;
    const evidence = candidate
      .recipientBucket!.evidence.filter((e) => e.kind !== "team-leadership")
      .concat(fixtureEvidence("individual-contributor"));
    r.reviewCandidate(
      candidate.id,
      "correct",
      "Reviewed IC scope",
      undefined,
      FIXTURE_AT,
      { bucket: "peers", evidence, reviewedBy: "Fixture reviewer" },
    );
    const pending = loadQueueReviews(r, FIXTURE_AT, {
      includeSecondary: false,
    })[0];
    expect(pending.body).toBe(originalBody);
    expect(pending.classificationChange?.decisionRequired).toBe(true);
    expect(() => approvedSnapshot(pending, FIXTURE_AT)).toThrow(
      "bucket-correction-copy-review-required",
    );
    const generationCount = readDraftGenerations(r.native).length;
    expect(() =>
      resolveBucketDraftCorrectionInRepository(
        r,
        {
          candidateId: candidate.id,
          snapshotId: "stale-fixture-snapshot",
          decision: "keep-edits",
        },
        FIXTURE_AT,
        { includeSecondary: false },
      ),
    ).toThrow("bucket-copy-decision-stale");
    expect(readDraftGenerations(r.native)).toHaveLength(generationCount);
    resolveBucketDraftCorrectionInRepository(
      r,
      {
        candidateId: candidate.id,
        snapshotId: pending.snapshotId,
        decision: "keep-edits",
        subject: pending.subject,
        body: pending.body,
      },
      FIXTURE_AT,
      { includeSecondary: false },
    );
    const kept = loadQueueReviews(r, FIXTURE_AT, {
      includeSecondary: false,
    })[0];
    expect(kept.body).toBe(originalBody);
    expect(kept.recipientBucket?.bucket).toBe("peers");
    expect(kept.classificationChange).toBeUndefined();
    expect(
      loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false }),
    ).toHaveLength(1);
  });
  it("rehearses additive migration on a copied pre-change database without rewriting legacy snapshots", () => {
    const dir = mkdtempSync(join(tmpdir(), "networkpilot-bucket-migration-"));
    folders.push(dir);
    const migrationDir = mkdtempSync(
      join(tmpdir(), "networkpilot-bucket-old-schema-"),
    );
    folders.push(migrationDir);
    for (const name of readdirSync("migrations").filter(
      (n) => n.endsWith(".sql") && n < "0021",
    ))
      copyFileSync(join("migrations", name), join(migrationDir, name));
    const original = new SqliteSimulationRepository(
      join(dir, "synthetic-old.sqlite"),
    );
    migrateTestDatabase(original, migrationDir);
    const legacy = {
      snapshotId: "legacy-fixture",
      recipientProfessionalEmail: "legacy@example.invalid",
      recipientDisplayName: "Legacy Fixture",
      subject: "Legacy subject",
      body: "Immutable legacy message",
      planningSnapshotId: "legacy-plan",
      templateCatalogVersion: "legacy-catalog",
      evidenceIds: [],
      approvedAt: FIXTURE_AT.toISOString(),
    };
    approveForGmailDraft(original, legacy, "fixture-only");
    const before = original.native
      .prepare("SELECT approved_snapshot_json FROM gmail_draft_operations")
      .get();
    original.native.pragma("wal_checkpoint(TRUNCATE)");
    original.close();
    copyFileSync(
      join(dir, "synthetic-old.sqlite"),
      join(dir, "synthetic-copy.sqlite"),
    );
    const migrated = new SqliteSimulationRepository(
      join(dir, "synthetic-copy.sqlite"),
    );
    repos.push(migrated);
    migrateTestDatabase(migrated);
    expect(
      migrated.native
        .prepare("SELECT approved_snapshot_json FROM gmail_draft_operations")
        .get(),
    ).toEqual(before);
    expect(
      migrated.findGmailDraftOperation(legacy.snapshotId)?.snapshot
        .recipientBucket,
    ).toBeUndefined();
    expect(migrated.getRecruiterDefaultResumeId()).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteSimulationRepository } from "./database";
import { bucketFixture, fixtureEvidence, FIXTURE_AT } from "@/domain/recipient-buckets/test-fixtures";
import { importCandidateBatch } from "@/application/ingestion";
import { addBucketDraftsFromRepository, bucketReserve, resolveBucketDraftCorrectionInRepository } from "./bucket-reserve";
import { loadQueueReviews, readDraftGenerations } from "./draft-queue";
import { approveForGmailDraft } from "@/application/email-drafts";
import { approvedSnapshot } from "@/application/command-center-drafts";
import type { RecipientBucket } from "@/domain/recipient-buckets";

const repos: SqliteSimulationRepository[] = [], folders: string[] = [];
const repo = () => { const r = new SqliteSimulationRepository(":memory:"); r.migrate(); repos.push(r); return r; };
function add(r: SqliteSimulationRepository, bucket: RecipientBucket, ordinal: number, early = false) {
  const fixture = bucketFixture(bucket, ordinal, early);
  importCandidateBatch(r, [fixture.company], { batchId: `fixture-batch-${ordinal}`, adapterId: "bucket-fixture", adapterVersion: "fixture-v1", datasetClassification: "provider-shaped-fixture", sourceFingerprint: `fixture-batch-fingerprint-${ordinal}`, records: [fixture.source], strategyCompanyDomains: { [fixture.company.id]: fixture.source.currentOrganization.domain! } }, FIXTURE_AT);
  return r.findImportedCandidate("bucket-fixture", `person-${ordinal}`)!;
}
beforeEach(() => vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true"));
afterEach(() => { repos.splice(0).forEach(r => r.close()); folders.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })); vi.unstubAllEnvs(); });

describe("bucket persistence and reserve integration", () => {
  it("preserves disabled legacy imports and writes no classification or default preference", () => {
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "false");
    const r = repo(), c = add(r, "peers", 1, true);
    expect(c.recipientBucket).toBeUndefined();
    expect(c.gateFailures).toContain("insufficient-or-unknown-experience");
    expect(r.native.prepare("SELECT recipient_bucket_json FROM imported_candidates").get()).toEqual({ recipient_bucket_json: null });
    expect(() => r.clearRecruiterDefaultResumeId()).toThrow("five-bucket-disabled");
    expect(() => addBucketDraftsFromRepository(r, 5, { bucket: "peers" }, FIXTURE_AT, { includeSecondary: false })).toThrow("five-bucket-disabled");
    expect(readDraftGenerations(r.native)).toEqual([]);
  });
  it.each(["recruiters", "peers", "managers", "executives", "ceos"] as const)("roundtrips qualified evidence for %s", bucket => {
    const r = repo(), c = add(r, bucket, 1, bucket === "peers");
    expect(c).toMatchObject({ state: "eligible", gateFailures: [], recipientBucket: { bucket, reviewState: "accepted" } });
    expect(JSON.parse((r.native.prepare("SELECT recipient_bucket_json FROM imported_candidates").get() as { recipient_bucket_json: string }).recipient_bucket_json)).toEqual(c.recipientBucket);
    if (bucket === "ceos" || bucket === "executives") expect(c.classification.specificRoleId).toBeNull();
  });
  it("keeps a CEO review-only when verified field relevance lacks human review provenance",()=>{
    const r=repo(),fixture=bucketFixture("ceos",1);
    fixture.source.responsibilityEvidence=fixture.source.responsibilityEvidence?.map(item=>item.kind==="relevant-function"?{...item,reviewedBy:undefined}:item);
    importCandidateBatch(r,[fixture.company],{batchId:"fixture-unreviewed-ceo",adapterId:"bucket-fixture",adapterVersion:"fixture-v1",datasetClassification:"provider-shaped-fixture",sourceFingerprint:"fixture-unreviewed-ceo-fingerprint",records:[fixture.source],strategyCompanyDomains:{[fixture.company.id]:fixture.source.currentOrganization.domain!}},FIXTURE_AT);
    expect(r.listImportedCandidates()[0]).toMatchObject({state:"review-required",gateFailures:["recipient-function-unrelated"],recipientBucket:{bucket:"ceos",reviewState:"accepted"}});
  });
  it.each([{title:"Data Engineering Manager",seniority:"intern"},{title:"Founder, Data Analytics",seniority:undefined}])("does not let manager evidence override contradictory seniority for $title",({title,seniority})=>{
    const r=repo(),fixture=bucketFixture("managers",1);fixture.source.currentTitle=title;if(seniority)fixture.source.providerMetadata={adapterVersion:"fixture-v1",responseMappingVersion:"fixture-v1",requestContractVersion:"fixture-v1",importArchitectureVersion:"fixture-v1",providerSeniority:seniority};
    importCandidateBatch(r,[fixture.company],{batchId:`fixture-contradiction-${seniority??"founder"}`,adapterId:"bucket-fixture",adapterVersion:"fixture-v1",datasetClassification:"provider-shaped-fixture",sourceFingerprint:`fixture-contradiction-${seniority??"founder"}-fingerprint`,records:[fixture.source],strategyCompanyDomains:{[fixture.company.id]:fixture.source.currentOrganization.domain!}},FIXTURE_AT);
    expect(r.listImportedCandidates()[0].gateFailures).toContain("prohibited-seniority");
    expect(bucketReserve(r,{bucket:"managers"},FIXTURE_AT,{includeSecondary:false}).actionableCapacity).toBe(0);
  });
  it.each([{bucket:"executives" as const,seniority:"intern"},{bucket:"executives" as const,seniority:"entry"},{bucket:"ceos" as const,seniority:"partner"}])("keeps $bucket review-only when provider seniority $seniority contradicts reviewed scope",({bucket,seniority})=>{
    const r=repo(),fixture=bucketFixture(bucket,1);fixture.source.providerMetadata={adapterVersion:"fixture-v1",responseMappingVersion:"fixture-v1",requestContractVersion:"fixture-v1",importArchitectureVersion:"fixture-v1",providerSeniority:seniority};
    importCandidateBatch(r,[fixture.company],{batchId:`fixture-${bucket}-${seniority}`,adapterId:"bucket-fixture",adapterVersion:"fixture-v1",datasetClassification:"provider-shaped-fixture",sourceFingerprint:`fixture-${bucket}-${seniority}-fingerprint`,records:[fixture.source],strategyCompanyDomains:{[fixture.company.id]:fixture.source.currentOrganization.domain!}},FIXTURE_AT);
    expect(r.listImportedCandidates()[0].gateFailures).toContain("prohibited-seniority");
    expect(bucketReserve(r,{bucket},FIXTURE_AT,{includeSecondary:false}).actionableCapacity).toBe(0);
  });
  it("adds only the chosen peer cohort and leaves existing stored message/order intact", () => {
    const r = repo(); add(r, "managers", 1); add(r, "peers", 2, true); add(r, "peers", 3); add(r, "peers", 4, true);
    const first = addBucketDraftsFromRepository(r, 1, { bucket: "managers" }, FIXTURE_AT, { includeSecondary: false });
    const before = structuredClone(first.draftReviews);
    const added = addBucketDraftsFromRepository(r, 5, { bucket: "peers", earlyCareerOnly: true }, FIXTURE_AT, { includeSecondary: false });
    expect(added.addition).toMatchObject({ additionalDraftCount: 5, addedCount: 2, activeBefore: 1, activeAfter: 3, eligibleReserveRemaining: 0, shortfallCode: "scoped-reserve-exhausted" });
    expect(added.draftReviews?.every(d => d.recipientBucket?.earlyCareer)).toBe(true);
    const queue = loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false });
    expect(queue[0].subject).toBe(before![0].subject); expect(queue[0].body).toBe(before![0].body);
    expect(queue.map(d => d.candidateId)).toEqual([...first.candidateIds, ...added.candidateIds]);
  });
  it("replays a scoped Add request without creating another generation",()=>{
    const r=repo();for(let ordinal=1;ordinal<=6;ordinal++)add(r,"managers",ordinal);
    const options={includeSecondary:false,requestId:"fixture-add-request"};
    const first=addBucketDraftsFromRepository(r,5,{bucket:"managers"},FIXTURE_AT,options),before=readDraftGenerations(r.native);
    const replay=addBucketDraftsFromRepository(r,5,{bucket:"managers"},FIXTURE_AT,options);
    expect(replay).toEqual(first);expect(readDraftGenerations(r.native)).toEqual(before);expect(loadQueueReviews(r,FIXTURE_AT,{includeSecondary:false})).toHaveLength(5);
    expect(()=>addBucketDraftsFromRepository(r,1,{bucket:"managers"},FIXTURE_AT,options)).toThrow("draft-add-request-conflict");
    expect(readDraftGenerations(r.native)).toEqual(before);
  });
  it("replaces in place and leaves a draft present when same-bucket supply is exhausted", () => {
    const r = repo(); add(r, "managers", 1); add(r, "peers", 2); add(r, "managers", 3);
    const first = addBucketDraftsFromRepository(r, 1, { bucket: "managers" }, FIXTURE_AT, { includeSecondary: false });
    addBucketDraftsFromRepository(r, 1, { bucket: "peers" }, FIXTURE_AT, { includeSecondary: false });
    const replaced = addBucketDraftsFromRepository(r, 1, { bucket: "managers" }, FIXTURE_AT, { includeSecondary: false, replacementId: first.candidateIds[0] });
    expect(loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false })[0].candidateId).toBe(replaced.candidateIds[0]);
    const empty = addBucketDraftsFromRepository(r, 1, { bucket: "managers" }, FIXTURE_AT, { includeSecondary: false, replacementId: replaced.candidateIds[0] });
    expect(empty.addition?.addedCount).toBe(0);
    expect(loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false })[0].candidateId).toBe(replaced.candidateIds[0]);
  });
  it("audits a correction without changing track, suppression, or immutable approval", () => {
    const r = repo(), c = add(r, "executives", 1);
    const result = addBucketDraftsFromRepository(r, 1, { bucket: "executives" }, FIXTURE_AT, { includeSecondary: false });
    const snapshot = approvedSnapshot(result.draftReviews![0], FIXTURE_AT); approveForGmailDraft(r, snapshot, "fixture-only");
    const immutable = JSON.stringify(r.findGmailDraftOperation(snapshot.snapshotId)?.snapshot);
    r.native.prepare("INSERT INTO candidate_suppression_entries(candidate_id,reason,created_at_utc) VALUES(?,'fixture suppression',?)").run(c.id, FIXTURE_AT.toISOString());
    const evidence = c.recipientBucket!.evidence.filter(e => e.kind !== "functional-leadership").concat(fixtureEvidence("individual-contributor"));
    r.reviewCandidate(c.id, "correct", "Reviewed fictional IC scope", undefined, FIXTURE_AT, { bucket: "peers", evidence, reviewedBy: "Fictional reviewer" });
    expect(r.findImportedCandidate("bucket-fixture", "person-1")?.outreachTrack).toBe("professional");
    expect(r.findImportedCandidate("bucket-fixture", "person-1")?.recipientBucket?.bucket).toBe("peers");
    expect(r.listReviewAudit(c.id)).toHaveLength(1);
    expect(JSON.stringify(r.findGmailDraftOperation(snapshot.snapshotId)?.snapshot)).toBe(immutable);
    expect(bucketReserve(r, { bucket: "peers" }, FIXTURE_AT, { includeSecondary: false }).actionableCapacity).toBe(0);
    expect(r.native.prepare("SELECT COUNT(*) n FROM imported_candidates").get()).toEqual({ n: 1 });
  });
  it("preserves unapproved edits after correction until an explicit keep or regenerate choice", () => {
    const r = repo(), candidate = add(r, "managers", 1);
    const generation = addBucketDraftsFromRepository(r, 1, { bucket: "managers" }, FIXTURE_AT, { includeSecondary: false });
    const originalBody = generation.draftReviews![0].body;
    const evidence = candidate.recipientBucket!.evidence.filter(e => e.kind !== "team-leadership").concat(fixtureEvidence("individual-contributor"));
    r.reviewCandidate(candidate.id, "correct", "Reviewed IC scope", undefined, FIXTURE_AT, { bucket: "peers", evidence, reviewedBy: "Fixture reviewer" });
    const pending = loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false })[0];
    expect(pending.body).toBe(originalBody);
    expect(pending.classificationChange?.decisionRequired).toBe(true);
    expect(() => approvedSnapshot(pending, FIXTURE_AT)).toThrow("bucket-correction-copy-review-required");
    const generationCount = readDraftGenerations(r.native).length;
    expect(() => resolveBucketDraftCorrectionInRepository(r, { candidateId: candidate.id, snapshotId: "stale-fixture-snapshot", decision: "keep-edits" }, FIXTURE_AT, { includeSecondary: false })).toThrow("bucket-copy-decision-stale");
    expect(readDraftGenerations(r.native)).toHaveLength(generationCount);
    resolveBucketDraftCorrectionInRepository(r, { candidateId: candidate.id, snapshotId: pending.snapshotId, decision: "keep-edits", subject: pending.subject, body: pending.body }, FIXTURE_AT, { includeSecondary: false });
    const kept = loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false })[0];
    expect(kept.body).toBe(originalBody);
    expect(kept.recipientBucket?.bucket).toBe("peers");
    expect(kept.classificationChange).toBeUndefined();
    expect(loadQueueReviews(r, FIXTURE_AT, { includeSecondary: false })).toHaveLength(1);
  });
  it("rehearses additive migration on a copied pre-change database without rewriting legacy snapshots", () => {
    const dir = mkdtempSync(join(tmpdir(), "networkpilot-bucket-migration-")); folders.push(dir);
    const migrationDir = mkdtempSync(join(tmpdir(), "networkpilot-bucket-old-schema-")); folders.push(migrationDir);
    for (const name of readdirSync("migrations").filter(n => n.endsWith(".sql") && n < "0021")) copyFileSync(join("migrations", name), join(migrationDir, name));
    const original = new SqliteSimulationRepository(join(dir, "synthetic-old.sqlite")); original.migrate(migrationDir);
    const legacy = { snapshotId: "legacy-fixture", recipientProfessionalEmail: "legacy@example.invalid", recipientDisplayName: "Legacy Fixture", subject: "Legacy subject", body: "Immutable legacy message", planningSnapshotId: "legacy-plan", templateCatalogVersion: "legacy-catalog", evidenceIds: [], approvedAt: FIXTURE_AT.toISOString() };
    approveForGmailDraft(original, legacy, "fixture-only");
    const before = original.native.prepare("SELECT approved_snapshot_json FROM gmail_draft_operations").get(); original.native.pragma("wal_checkpoint(TRUNCATE)"); original.close();
    copyFileSync(join(dir, "synthetic-old.sqlite"), join(dir, "synthetic-copy.sqlite"));
    const migrated = new SqliteSimulationRepository(join(dir, "synthetic-copy.sqlite")); repos.push(migrated); migrated.migrate();
    expect(migrated.native.prepare("SELECT approved_snapshot_json FROM gmail_draft_operations").get()).toEqual(before);
    expect(migrated.findGmailDraftOperation(legacy.snapshotId)?.snapshot.recipientBucket).toBeUndefined();
    expect(migrated.getRecruiterDefaultResumeId()).toBeNull();
  });
});

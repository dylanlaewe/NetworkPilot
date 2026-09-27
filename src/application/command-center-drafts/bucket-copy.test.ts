import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CANONICAL, TEMPLATE_VERSION } from "@/domain/drafting/bucket-templates";
import { assertDylanVoice } from "@/domain/drafting/voice";
import { primaryAskCount } from "@/domain/drafting/primary-ask";
import { bucketFixture, FIXTURE_AT } from "@/domain/recipient-buckets/test-fixtures";
import type { RecipientBucket } from "@/domain/recipient-buckets";
import { SqliteSimulationRepository } from "@/infrastructure/sqlite/database";
import { importCandidateBatch } from "@/application/ingestion";
import { renderQueueReview } from "@/infrastructure/sqlite/draft-queue";
import { approvedSnapshot } from ".";
import { addResume, attachmentSnapshot } from "@/application/resumes";
import { initialResumeSelection } from "@/application/resumes/recruiter-default";
import { approveForGmailDraft, createApprovedGmailDraft, sendApprovedGmailDraft } from "@/application/email-drafts";
import { renderBucketCopy } from "./bucket-copy";

const repos: SqliteSimulationRepository[] = [];
beforeEach(() => vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true"));
afterEach(() => { repos.splice(0).forEach(r => r.close()); vi.unstubAllEnvs(); });
function setup(bucket: RecipientBucket) {
  const repository = new SqliteSimulationRepository(":memory:"); repos.push(repository); repository.migrate();
  const fixture = bucketFixture(bucket, 1, bucket === "peers");
  importCandidateBatch(repository, [fixture.company], { batchId: "fictional-copy-batch", adapterId: "bucket-fixture", adapterVersion: "fixture-v1", datasetClassification: "provider-shaped-fixture", sourceFingerprint: "fictional-copy-fingerprint", records: [fixture.source], strategyCompanyDomains: { [fixture.company.id]: fixture.source.currentOrganization.domain! } }, FIXTURE_AT);
  const candidate = repository.listImportedCandidates()[0];
  return { repository, candidate, review: renderQueueReview(candidate, 0, FIXTURE_AT)! };
}
const addSyntheticResume = (repository: SqliteSimulationRepository, id: string) => addResume({ repository, id, filename: `${id}.pdf`, bytes: Buffer.from(`%PDF-1.4\n% Fictional ${id}\n%%EOF`), displayLabel: `Synthetic ${id}`, roleLane: "general", now: () => FIXTURE_AT, store: () => {} });

describe("approved bucket copy and explicit resume decisions", () => {
  it("matches the approved canonical source fixture byte-for-byte", () => {
    expect(TEMPLATE_VERSION).toBe("approved-2026-09-22.v1");
    expect(createHash("sha256").update(JSON.stringify(CANONICAL)).digest("hex")).toBe("86c40c47e6defb62bc3e651f4d39405c15b714ebabb188d8151eab3046063b79");
  });
  it.each(["recruiters", "peers", "managers", "executives", "ceos"] as const)("renders %s using supported personalization and one semantic invitation", bucket => {
    const { candidate, review: queuedReview } = setup(bucket);
    const review = renderBucketCopy(candidate);
    expect(queuedReview).not.toBeNull();
    expect(primaryAskCount(review.body)).toBe(1);
    expect(() => assertDylanVoice(review.subject, review.body, { semanticAsks: true })).not.toThrow();
    expect(review.body).not.toMatch(/\[[^\]]+\]/);
    if (bucket === "managers") { expect(review.body).not.toContain("?"); expect(review.body).toContain("experiences and success"); expect(review.body).toContain("Thank you in advance for your guidance,"); }
    if (bucket === "executives") expect(review.body).toContain("throw 10-15 mins on your calendar for a quick chat?");
    if (bucket === "executives" || bucket === "ceos") expect(review.body).toContain("I promise I'll pay your time forward.");
  });
  it("rejects a second ask without relying on punctuation or padding a short invitation", () => {
    const { review } = setup("managers");
    expect(() => assertDylanVoice(review.subject, `${review.body}\n\nPlease send your resume.`, { semanticAsks: true })).toThrow("dylan-voice-cta-count-invalid");
    expect(() => assertDylanVoice("A focused conversation", "Hi Avery,\n\nWould you be open to a brief call?\n\nBest,\nDylan", { semanticAsks: true })).not.toThrow();
  });
  it("requires missing leadership and contact-reason evidence without inventing it", () => {
    for (const bucket of ["executives", "ceos"] as const) {
      const { candidate } = setup(bucket);
      candidate.recipientBucket!.evidence = candidate.recipientBucket!.evidence.filter(e => !["functional-leadership", "contact-reason"].includes(e.kind));
      expect(() => renderBucketCopy(candidate)).toThrow("bucket-copy-evidence-required");
    }
  });
  it("uses one configured active resume for future drafts without lane fallback", () => {
    const { repository } = setup("recruiters");
    const general = addSyntheticResume(repository, "general"), product = addSyntheticResume(repository, "product");
    expect(initialResumeSelection("recruiter", repository)).toMatchObject({ resumeId: null, decisionRequired: true });
    repository.setRecruiterDefaultResumeId(general.id, FIXTURE_AT);
    const first = initialResumeSelection("recruiter", repository);
    repository.setRecruiterDefaultResumeId(product.id, FIXTURE_AT);
    expect(first.resumeId).toBe(general.id);
    expect(initialResumeSelection("recruiter", repository).resumeId).toBe(product.id);
    repository.deactivateResume(product.id);
    expect(initialResumeSelection("recruiter", repository)).toMatchObject({ resumeId: null, decisionRequired: true });
    expect(initialResumeSelection("professional", repository)).toMatchObject({ resumeId: null, decisionRequired: false });
  });
  it("requires explicit None and reviewed attachment-copy correction before approval", () => {
    const { review } = setup("recruiters");
    expect(() => approvedSnapshot(review, FIXTURE_AT)).toThrow("recruiter-resume-decision-required");
    expect(() => approvedSnapshot(review, FIXTURE_AT, undefined, "continue-without-attachment")).toThrow("resume-copy-mismatch");
    const corrected = { ...review, body: review.body.replace(" I've attached my resume.", "") };
    expect(approvedSnapshot(corrected, FIXTURE_AT, undefined, "continue-without-attachment").resumeAttachment).toBeUndefined();
    expect(() => approvedSnapshot({ ...corrected, body: `${corrected.body}\n[unresolved]` }, FIXTURE_AT, undefined, "continue-without-attachment")).toThrow("draft-placeholder-unresolved");
    expect(() => approvedSnapshot({ ...corrected, subject: "Unsafe\r\nBcc: recipient@example.invalid" }, FIXTURE_AT, undefined, "continue-without-attachment")).toThrow("dylan-voice-subject-invalid");
  });
  it.each(["My résumé is attached.","I am attaching my resume.","Please see my attached CV.","The resume is enclosed."])("rejects explicit None when copy claims an attachment: %s",claim=>{
    const {review}=setup("recruiters"),body=review.body.replace("I've attached my resume.",claim);
    expect(()=>approvedSnapshot({...review,body},FIXTURE_AT,undefined,"continue-without-attachment")).toThrow("resume-copy-mismatch");
  });
  it("freezes exact attachment and classification evidence despite later default, metadata and availability changes", () => {
    const { repository, review } = setup("recruiters"), general = addSyntheticResume(repository, "general");
    repository.setRecruiterDefaultResumeId(general.id, FIXTURE_AT);
    const snapshot = approvedSnapshot(review, FIXTURE_AT, attachmentSnapshot(general));
    approveForGmailDraft(repository, snapshot, "fixture-only");
    const before = JSON.stringify(repository.findGmailDraftOperation(snapshot.snapshotId)?.snapshot);
    repository.updateResumeMetadata(general.id, { displayLabel: "Renamed synthetic", roleLane: "product" }); repository.deactivateResume(general.id); repository.clearRecruiterDefaultResumeId(FIXTURE_AT);
    review.recipientBucket!.evidence[0].value = "Later correction";
    expect(JSON.stringify(repository.findGmailDraftOperation(snapshot.snapshotId)?.snapshot)).toBe(before);
  });
  it("blocks bucket externalization when the activation boundary is disabled", async () => {
    const { repository, review } = setup("managers"), snapshot = approvedSnapshot(review, FIXTURE_AT);
    const operation = approveForGmailDraft(repository, snapshot, "fixture-only");
    const creator = { createDraft: vi.fn(async () => ({ draftId: "fictional-draft", messageId: "fictional-message" })) };
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "false");
    await expect(createApprovedGmailDraft({ snapshotId: snapshot.snapshotId, repository, creator, mime: { build: () => "fixture" }, now: () => FIXTURE_AT })).rejects.toThrow("five-bucket-disabled");
    expect(creator.createDraft).not.toHaveBeenCalled();
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true");
    repository.beginGmailDraftAttempt(operation.operationId, FIXTURE_AT); repository.completeGmailDraftOperation(operation.operationId, "fictional-draft", "fictional-message", FIXTURE_AT);
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "false");
    const sender = { sendDraft: vi.fn(async () => ({ messageId: "fictional-sent" })) };
    await expect(sendApprovedGmailDraft({ snapshotId: snapshot.snapshotId, repository, sender, now: () => FIXTURE_AT })).rejects.toThrow("five-bucket-disabled");
    expect(sender.sendDraft).not.toHaveBeenCalled();
  });
});

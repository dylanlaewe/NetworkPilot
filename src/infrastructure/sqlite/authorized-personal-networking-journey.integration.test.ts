import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshScopedCandidateReserve, type ScopedDiscoveryProvider } from "@/application/candidate-refresh/scoped";
import { approvedSnapshot, prepareEditedDraft } from "@/application/command-center-drafts";
import { approveForGmailDraft, createApprovedGmailDraft } from "@/application/email-drafts";
import { addResume, attachmentSnapshot } from "@/application/resumes";
import { mapApolloPerson } from "@/infrastructure/providers/apollo/adapter";
import { addBucketDraftsFromRepository, bucketReserve } from "./bucket-reserve";
import { recordCandidateDispositionInRepository } from "./candidate-disposition";
import { sendAndRecordCommandCenterDraft } from "./command-center-drafts";
import { SqliteSimulationRepository } from "./database";
import { loadQueueReviews } from "./draft-queue";
import { isConfirmedContact, readConfirmedContactIndex } from "./draft-queue";
import { resolveDatastoreTopology } from "./datastore-topology";
import { loadRelationshipWorkspace } from "./relationship-workspace";
import { SqliteScopedDiscoveryStore } from "./scoped-discovery";
import { migrateTestDatabase } from "./test-migrations";

const directories: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

const at = new Date("2026-10-12T14:00:00.000Z");
const providerPerson = (id: string, employer: string, domain: string) => ({
  id,
  first_name: id === "recruiter-one" ? "Avery" : "Morgan",
  last_name: "Fixture",
  title: "Technical Recruiter",
  seniority: "senior",
  city: "Boston",
  state: "Massachusetts",
  country: "United States",
  email: `${id}@${domain}`,
  email_status: "verified",
  updated_at: at.toISOString(),
  organization: { id: `org-${id}`, name: employer, primary_domain: domain, industry: "Software" },
  employment_history: [{ start_date: "2018-01-01", current: true }],
});

describe("authorized personal-networking journey", () => {
  it("discovers, skips, drafts, approves, sends, and records one unverified-employer recruiter", async () => {
    vi.stubEnv("NETWORKPILOT_FIVE_BUCKET_ENABLED", "true");
    vi.stubEnv("NETWORKPILOT_DEMO_MODE", "false");
    const directory = mkdtempSync(join(tmpdir(), "networkpilot-authorized-journey-"));
    directories.push(directory);
    const canonicalPath = join(directory, "canonical.sqlite"), recruiterPath = join(directory, "recruiter.sqlite");
    vi.stubEnv("NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH", canonicalPath);
    vi.stubEnv("NETWORKPILOT_RECRUITER_DATABASE_PATH", recruiterPath);
    const repository = new SqliteSimulationRepository(canonicalPath);
    migrateTestDatabase(repository);
    const recruiterSource = new SqliteSimulationRepository(recruiterPath);
    migrateTestDatabase(recruiterSource);
    recruiterSource.close();
    const base = resolveDatastoreTopology({}, directory), topology = {
      ...base,
      canonical: { ...base.canonical, path: canonicalPath },
      recruiterSource: { ...base.recruiterSource, path: recruiterPath },
    };
    const records = [
      providerPerson("recruiter-one", "Northwind Data Systems", "northwind-data.example"),
      providerPerson("recruiter-two", "Juniper Analytics Works", "juniper-analytics.example"),
    ].map((person) => ({
      ...mapApolloPerson(person, { stage: "enrichment" as const, retrievedAt: at.toISOString(), datasetClassification: "authorized-provider" as const }),
      sourceProviderId: "mock-provider",
      sourceFingerprint: `mock-provider:${person.id}:authorized-fixture`,
    }));
    const provider: ScopedDiscoveryProvider = {
      preflight: vi.fn(),
      discover: vi.fn(async () => ({ records, searchedCandidates: 2, rejectedCandidates: 0, enrichmentAttempts: 2, searchCalls: 1, observedCredits: 2 })),
    };

    const refresh = await refreshScopedCandidateReserve({
      requestId: "authorized-recruiter-journey",
      scope: { bucket: "recruiters" },
      requested: 2,
      usableBefore: 0,
      policy: { maximumPerBatch: 2, maximumPerDay: 2, maximumSearchCalls: 1, hardStop: true },
      store: new SqliteScopedDiscoveryStore(repository, { topology }),
      provider,
      allowProvider: true,
      now: () => at,
    });
    expect(refresh).toMatchObject({ candidatesAdded: 2, qualifiedCandidatesAdded: 2, recruiterCandidatesAdded: 2, remainingActionableCapacity: 2 });
    const discovered = repository.listImportedCandidates();
    expect(discovered).toHaveLength(2);
    expect(discovered).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: "eligible", employerTrust: expect.objectContaining({ state: "unverified", identityVerified: true }), recipientBucket: expect.objectContaining({ bucket: "recruiters", reviewState: "accepted" }) }),
      expect.objectContaining({ state: "eligible", employerTrust: expect.objectContaining({ state: "unverified", identityVerified: true }), recipientBucket: expect.objectContaining({ bucket: "recruiters", reviewState: "accepted" }) }),
    ]));

    const initialReserve = bucketReserve(repository, { bucket: "recruiters" }, at, { includeSecondary: false });
    const skippedId = initialReserve.eligible[0]!.id, draftedId = initialReserve.eligible[1]!.id;
    recordCandidateDispositionInRepository(repository, { candidateId: skippedId, disposition: "skip", at });
    expect(bucketReserve(repository, { bucket: "recruiters" }, at, { includeSecondary: false }).eligible.map((candidate) => candidate.id)).toEqual([draftedId]);

    const resume = addResume({ repository, id: "general-resume", filename: "general-resume.pdf", bytes: Buffer.from("%PDF-1.4\n% General Resume\n%%EOF"), displayLabel: "General Resume", roleLane: "general", now: () => at, store: () => undefined });
    repository.setRecruiterDefaultResumeId(resume.id, at);
    const providerCallsBeforeDrafting = vi.mocked(provider.discover).mock.calls.length;
    const addition = addBucketDraftsFromRepository(repository, 1, { bucket: "recruiters" }, at, { includeSecondary: false, requestId: "authorized-draft-addition" });
    expect(addition).toMatchObject({ candidateIds: [draftedId], providerUsed: false, enrichmentAttempts: 0 });
    expect(provider.discover).toHaveBeenCalledTimes(providerCallsBeforeDrafting);
    const review = loadQueueReviews(repository, at, { includeSecondary: false }).find((item) => item.candidateId === draftedId)!;
    expect(review.resumeSelection).toEqual({ resumeId: resume.id, decisionRequired: false, source: "configured-default" });

    const edited = prepareEditedDraft(review, {
      subject: "A question about data careers",
      body: review.body.replace("getting started in the field", "starting a career in data"),
    });
    const snapshot = approvedSnapshot(edited, new Date(at.getTime() + 60_000), attachmentSnapshot(resume));
    approveForGmailDraft(repository, snapshot, "mock-gmail", "recruiter");
    const creator = { createDraft: vi.fn(async () => ({ draftId: "mock-draft", messageId: "mock-message" })) };
    await createApprovedGmailDraft({ snapshotId: snapshot.snapshotId, repository, creator, mime: { build: (approved) => `${approved.subject}\n\n${approved.body}` }, now: () => new Date(at.getTime() + 120_000) });
    const sender = { sendDraft: vi.fn(async () => ({ messageId: "mock-sent-message" })) };
    const send = () => sendAndRecordCommandCenterDraft({ snapshotId: snapshot.snapshotId, repository, sender, now: () => new Date(at.getTime() + 180_000) });
    const duplicateResults = await Promise.allSettled([send(), send()]);
    expect(duplicateResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(duplicateResults.filter((result) => result.status === "rejected")).toEqual([
      expect.objectContaining({ reason: expect.objectContaining({ message: "gmail-send-reconciliation-required" }) }),
    ]);
    expect(creator.createDraft).toHaveBeenCalledTimes(1);
    expect(sender.sendDraft).toHaveBeenCalledTimes(1);
    expect(repository.native.prepare("SELECT COUNT(*) count FROM manual_outreach_records WHERE candidate_id=?").get(draftedId)).toEqual({ count: 1 });
    expect(loadQueueReviews(repository, new Date(at.getTime() + 240_000), { includeSecondary: false })).toEqual([]);
    const afterSend = bucketReserve(
      repository,
      { bucket: "recruiters" },
      new Date(at.getTime() + 240_000),
      { includeSecondary: false },
    );
    expect(afterSend.eligible.map((candidate) => candidate.id)).not.toContain(draftedId);
    expect(afterSend.totalReserve).toBe(1);
    const sentCandidate = repository.listImportedCandidates().find((candidate) => candidate.id === draftedId)!;
    const reappearedIdentity = structuredClone(sentCandidate);
    reappearedIdentity.id = "reappeared-provider-identity";
    reappearedIdentity.source.providerRecordId = "reappeared-provider-record";
    expect(
      isConfirmedContact(
        reappearedIdentity,
        readConfirmedContactIndex(repository),
      ),
    ).toBe(true);
    const reloaded = new SqliteSimulationRepository(canonicalPath, {
      readonly: true,
      fileMustExist: true,
    });
    expect(
      bucketReserve(
        reloaded,
        { bucket: "recruiters" },
        new Date(at.getTime() + 240_000),
        { includeSecondary: false },
      ).eligible.map((candidate) => candidate.id),
    ).not.toContain(draftedId);
    reloaded.close();
    const relationships = loadRelationshipWorkspace().filter((entry) => entry.snapshotId === snapshot.snapshotId);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({ outreachTrack: "recruiter", confirmationSource: "networkpilot-gmail-send", subject: edited.subject, body: edited.body, resumeLabel: "General Resume" });
    repository.close();
  });
});

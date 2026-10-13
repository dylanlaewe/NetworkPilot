import { describe, expect, it } from "vitest";
import { approveForGmailDraft } from "./create-approved-gmail-draft";
import type {
  GmailDraftOperation,
  GmailDraftOperationRepository,
} from "./types";

function repository(): GmailDraftOperationRepository {
  let stored: GmailDraftOperation | null = null;
  return {
    findGmailDraftOperation: () => stored,
    approveGmailDraftOperation: (operation) => {
      stored = operation;
    },
    beginGmailDraftAttempt: () => {},
    completeGmailDraftOperation: () => {},
    failGmailDraftOperation: () => {},
    beginGmailSend: () => {},
    completeGmailSend: () => {},
    markGmailSendUncertain: () => {},
  };
}

const snapshot = {
  snapshotId: "snapshot-1",
  recipientProfessionalEmail: "person@example.invalid",
  recipientDisplayName: "Person",
  subject: "A useful question",
  body: "Exact reviewed body",
  planningSnapshotId: "plan",
  templateCatalogVersion: "catalog",
  evidenceIds: [],
  approvedAt: "2026-10-12T12:00:00.000Z",
};

describe("Gmail draft approval idempotency", () => {
  it("reuses the immutable operation when only duplicate-submit time differs", () => {
    const store = repository();
    const first = approveForGmailDraft(store, snapshot, "fixture");
    const duplicate = approveForGmailDraft(
      store,
      { ...snapshot, approvedAt: "2026-10-12T12:00:01.000Z" },
      "fixture",
    );
    expect(duplicate).toBe(first);
    expect(duplicate.snapshot.approvedAt).toBe(snapshot.approvedAt);
  });

  it("still rejects different content under the same snapshot identity", () => {
    const store = repository();
    approveForGmailDraft(store, snapshot, "fixture");
    expect(() =>
      approveForGmailDraft(
        store,
        { ...snapshot, body: "Different body" },
        "fixture",
      ),
    ).toThrow("gmail-draft-snapshot-conflict");
  });
});

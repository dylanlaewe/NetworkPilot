import { describe, expect, it, vi } from "vitest";
import { approveAndCreateGmailDraft } from "./approve-and-create";
import type { GmailDraftOperation } from "@/application/email-drafts";

const operation = (state: GmailDraftOperation["state"]): GmailDraftOperation => ({
  operationId: "gmail-draft:fixture",
  snapshot: {
    snapshotId: "approved-snapshot",
    recipientProfessionalEmail: "fixture@example.invalid",
    recipientDisplayName: "Fixture Person",
    subject: "A fixture subject",
    body: "A fixture body",
    planningSnapshotId: "fixture-plan",
    templateCatalogVersion: "fixture-v1",
    evidenceIds: [],
    approvedAt: "2026-10-12T12:00:00.000Z",
    outreachTrack: "professional",
  },
  provider: "gmail",
  state,
  gmailDraftId: state === "gmail-draft-created" ? "draft-one" : null,
  gmailMessageId: null,
  attemptStartedAt: null,
  completedAt: null,
  errorCategory: null,
  adapterVersion: "fixture",
  outreachTrack: "professional",
});

const input = {
  snapshotId: "local-snapshot",
  candidateId: "candidate-one",
  subject: "A fixture subject",
  body: "A fixture body",
};

describe("approve and create Gmail draft orchestration", () => {
  it("persists approval before invoking the injected Gmail creator", async () => {
    const order: string[] = [];
    const approveEdited = vi.fn(async () => {
      order.push("approved");
      return operation("approved-for-gmail-draft");
    });
    const create = vi.fn(async (snapshotId: string) => {
      order.push(`created:${snapshotId}`);
      return operation("gmail-draft-created");
    });
    await expect(
      approveAndCreateGmailDraft(input, { approveEdited, create }),
    ).resolves.toMatchObject({ state: "gmail-draft-created" });
    expect(order).toEqual(["approved", "created:approved-snapshot"]);
  });

  it("leaves the canonical approval intact when Gmail creation fails and supports a creator-only retry", async () => {
    let approved = false;
    const approveEdited = vi.fn(async () => {
      approved = true;
      return operation("approved-for-gmail-draft");
    });
    const create = vi.fn(async () => {
      throw new Error("gmail-provider-transient");
    });
    await expect(
      approveAndCreateGmailDraft(input, { approveEdited, create }),
    ).rejects.toThrow("gmail-provider-transient");
    expect(approved).toBe(true);
    expect(approveEdited).toHaveBeenCalledOnce();

    const retry = vi.fn(async (snapshotId: string) => {
      expect(snapshotId).toBe("approved-snapshot");
      return operation("gmail-draft-created");
    });
    await expect(retry("approved-snapshot")).resolves.toMatchObject({
      state: "gmail-draft-created",
    });
    expect(approveEdited).toHaveBeenCalledOnce();
  });
});

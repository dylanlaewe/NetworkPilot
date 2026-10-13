import { describe, expect, it, vi } from "vitest";
import type { GmailDraftOperation } from "@/application/email-drafts";
import { confirmAndSendDraft } from "./confirm-and-send";

const input = {
  snapshotId: "snapshot-1",
  candidateId: "candidate-1",
  subject: "A useful question",
  body: "An exact reviewed message",
  resumeId: "resume-general",
};

function operation(
  state: GmailDraftOperation["state"],
  overrides: Partial<GmailDraftOperation> = {},
): GmailDraftOperation {
  return {
    operationId: "gmail-draft:fixture",
    snapshot: {
      snapshotId: input.snapshotId,
      candidateId: input.candidateId,
      recipientProfessionalEmail: "person@example.invalid",
      recipientDisplayName: "Person",
      subject: input.subject,
      body: input.body,
      planningSnapshotId: "plan",
      templateCatalogVersion: "catalog",
      evidenceIds: [],
      approvedAt: "2026-10-12T12:00:00.000Z",
      resumeAttachment: {
        resumeId: "resume-general",
        displayLabel: "General Resume",
        filename: "general.pdf",
        sha256: "fixture-sha",
        sizeBytes: 7,
        storageKey: "fixture-key",
      },
    },
    provider: "gmail",
    state,
    gmailDraftId: state === "gmail-draft-created" ? "draft-1" : null,
    gmailMessageId: state === "gmail-draft-created" ? "message-1" : null,
    attemptStartedAt: null,
    completedAt: null,
    errorCategory: null,
    adapterVersion: "fixture",
    ...overrides,
  };
}

function services(existing: GmailDraftOperation | null = null) {
  const approved = operation("approved-for-gmail-draft");
  const created = operation("gmail-draft-created");
  const sent = operation("gmail-draft-created", {
    sendState: "sent",
    sentAt: "2026-10-12T12:03:00.000Z",
  });
  return {
    find: vi.fn(async () => existing),
    approveEdited: vi.fn(async () => approved),
    create: vi.fn(async () => created),
    send: vi.fn(async () => sent),
  };
}

describe("confirmAndSendDraft", () => {
  it("freezes, creates, then sends a new edited message", async () => {
    const dependencies = services();
    await expect(confirmAndSendDraft(input, dependencies)).resolves.toMatchObject({
      sendState: "sent",
    });
    expect(dependencies.approveEdited).toHaveBeenCalledWith(input);
    expect(dependencies.create).toHaveBeenCalledWith(input.snapshotId);
    expect(dependencies.send).toHaveBeenCalledWith(input.snapshotId);
    expect(dependencies.approveEdited.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.create.mock.invocationCallOrder[0]!,
    );
    expect(dependencies.create.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.send.mock.invocationCallOrder[0]!,
    );
  });

  it("reuses the exact existing Gmail draft without another approval or create", async () => {
    const dependencies = services(operation("gmail-draft-created"));
    await confirmAndSendDraft(input, dependencies);
    expect(dependencies.approveEdited).not.toHaveBeenCalled();
    expect(dependencies.create).not.toHaveBeenCalled();
    expect(dependencies.send).toHaveBeenCalledWith(input.snapshotId);
  });

  it("retries a certainly failed create but never sends when create fails", async () => {
    const dependencies = services(operation("failed"));
    dependencies.create.mockRejectedValueOnce(new Error("gmail-draft-create-failed"));
    await expect(confirmAndSendDraft(input, dependencies)).rejects.toThrow(
      "gmail-draft-create-failed",
    );
    expect(dependencies.send).not.toHaveBeenCalled();
  });

  it("does not retry or send an uncertain draft creation", async () => {
    const dependencies = services(operation("reconciliation-required"));
    dependencies.create.mockRejectedValueOnce(
      new Error("gmail-draft-reconciliation-required"),
    );
    await expect(confirmAndSendDraft(input, dependencies)).rejects.toThrow(
      "gmail-draft-reconciliation-required",
    );
    expect(dependencies.send).not.toHaveBeenCalled();
  });

  it("stops after an uncertain send without an automatic resend", async () => {
    const dependencies = services(operation("gmail-draft-created"));
    dependencies.send.mockRejectedValueOnce(new Error("gmail-timeout"));
    await expect(confirmAndSendDraft(input, dependencies)).rejects.toThrow(
      "gmail-timeout",
    );
    expect(dependencies.send).toHaveBeenCalledTimes(1);
  });

  it("does not externalize when the selected candidate changed before approval", async () => {
    const dependencies = services();
    dependencies.approveEdited.mockRejectedValueOnce(new Error("draft-stale"));
    await expect(
      confirmAndSendDraft(
        { ...input, candidateId: "different-candidate" },
        dependencies,
      ),
    ).rejects.toThrow("draft-stale");
    expect(dependencies.create).not.toHaveBeenCalled();
    expect(dependencies.send).not.toHaveBeenCalled();
  });

  it("rejects stale content, attachment, and selection before external activity", async () => {
    for (const changed of [
      { subject: "Changed subject" },
      { body: "Changed body" },
      { resumeId: "different-resume" },
      { candidateId: "different-candidate" },
    ]) {
      const dependencies = services(operation("gmail-draft-created"));
      await expect(
        confirmAndSendDraft({ ...input, ...changed }, dependencies),
      ).rejects.toThrow("draft-stale");
      expect(dependencies.create).not.toHaveBeenCalled();
      expect(dependencies.send).not.toHaveBeenCalled();
    }
  });

  it("delegates duplicate confirmed sends to the idempotent send service", async () => {
    const dependencies = services(
      operation("gmail-draft-created", { sendState: "sent" }),
    );
    await confirmAndSendDraft(input, dependencies);
    expect(dependencies.send).toHaveBeenCalledTimes(1);
  });
});

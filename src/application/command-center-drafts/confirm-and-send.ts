import type { GmailDraftOperation } from "@/application/email-drafts";
import type { ApproveAndCreateDraftInput } from "./approve-and-create";

export type ConfirmAndSendDraftInput = ApproveAndCreateDraftInput;

export interface ConfirmAndSendDraftServices {
  find(snapshotId: string): Promise<GmailDraftOperation | null>;
  approveEdited(
    input: ApproveAndCreateDraftInput,
  ): Promise<GmailDraftOperation>;
  create(snapshotId: string): Promise<GmailDraftOperation>;
  send(snapshotId: string): Promise<GmailDraftOperation>;
}

function assertExactApprovedContent(
  input: ConfirmAndSendDraftInput,
  operation: GmailDraftOperation,
) {
  const snapshot = operation.snapshot;
  const selectedResumeId = input.resumeId || null;
  const frozenResumeId = snapshot.resumeAttachment?.resumeId ?? null;
  if (
    snapshot.snapshotId !== input.snapshotId ||
    snapshot.candidateId !== input.candidateId ||
    snapshot.subject !== input.subject.trim() ||
    snapshot.body !== input.body.trim() ||
    selectedResumeId !== frozenResumeId
  )
    throw new Error("draft-stale");
}

/**
 * The only user-visible send command. It freezes edited content first, creates
 * or reuses the matching Gmail draft, and sends only after both steps succeed.
 */
export async function confirmAndSendDraft(
  input: ConfirmAndSendDraftInput,
  services: ConfirmAndSendDraftServices,
): Promise<GmailDraftOperation> {
  let operation = await services.find(input.snapshotId);
  if (operation) assertExactApprovedContent(input, operation);
  else operation = await services.approveEdited(input);

  if (operation.state !== "gmail-draft-created")
    operation = await services.create(operation.snapshot.snapshotId);

  return services.send(operation.snapshot.snapshotId);
}

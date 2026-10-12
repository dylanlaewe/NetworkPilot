import type { GmailDraftOperation } from "@/application/email-drafts";

export interface ApproveAndCreateDraftInput {
  snapshotId: string;
  candidateId: string;
  subject: string;
  body: string;
  resumeId?: string;
  resumeDecision?: string;
}

/** Approval commits before Gmail is contacted, leaving a safe retry state. */
export async function approveAndCreateGmailDraft(
  input: ApproveAndCreateDraftInput,
  services: {
    approveEdited(input: ApproveAndCreateDraftInput): Promise<GmailDraftOperation>;
    create(snapshotId: string): Promise<GmailDraftOperation>;
  },
): Promise<GmailDraftOperation> {
  const approved = await services.approveEdited(input);
  return services.create(approved.snapshot.snapshotId);
}

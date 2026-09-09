export const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose" as const;

export type GmailDraftOperationState =
  | "approved-for-gmail-draft"
  | "creating-gmail-draft"
  | "gmail-draft-created"
  | "reconciliation-required"
  | "failed";

export interface ApprovedEmailDraftSnapshot {
  snapshotId: string;
  recipientProfessionalEmail: string;
  recipientDisplayName: string;
  subject: string;
  body: string;
  planningSnapshotId: string;
  templateCatalogVersion: string;
  evidenceIds: readonly string[];
  approvedAt: string;
}

export interface GmailDraftOperation {
  operationId: string;
  snapshot: ApprovedEmailDraftSnapshot;
  provider: "gmail";
  state: GmailDraftOperationState;
  gmailDraftId: string | null;
  gmailMessageId: string | null;
  attemptStartedAt: string | null;
  completedAt: string | null;
  errorCategory: string | null;
  adapterVersion: string;
}

export interface GmailDraftOperationRepository {
  findGmailDraftOperation(snapshotId: string): GmailDraftOperation | null;
  approveGmailDraftOperation(operation: GmailDraftOperation): void;
  beginGmailDraftAttempt(operationId: string, at: Date): void;
  completeGmailDraftOperation(operationId: string, gmailDraftId: string, gmailMessageId: string, at: Date): void;
  failGmailDraftOperation(operationId: string, state: "failed" | "reconciliation-required", category: string, at: Date): void;
}

export interface GmailDraftCreator {
  createDraft(rawMessage: string): Promise<{draftId: string; messageId: string}>;
}

export interface GmailConnectionMetadata {accountEmail:string|null;grantedScopes:readonly string[];state:"connected"|"disconnected"|"reauthorization-required";updatedAt:string;}
export interface GmailConnectionMetadataRepository {saveGmailConnectionMetadata(metadata:GmailConnectionMetadata):void;getGmailConnectionMetadata():GmailConnectionMetadata|null;}

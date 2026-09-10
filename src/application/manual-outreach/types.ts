import type { GmailDraftOperation } from "@/application/email-drafts";

export const MANUAL_OUTREACH_OUTCOMES = [
  "awaiting-response",
  "replied",
  "meeting-scheduled",
  "declined",
  "opt-out",
  "no-response",
  "hard-bounce",
] as const;

export type ManualOutreachOutcome = (typeof MANUAL_OUTREACH_OUTCOMES)[number];

export interface ResolvedManualDraft {
  operation: GmailDraftOperation;
  candidateId: string;
  companyId: string;
  identitySource: "prospect" | "imported-candidate";
}

export interface ManualOutreachRecord {
  id: string;
  draftSnapshotId: string;
  gmailOperationId: string;
  candidateId: string;
  companyId: string;
  identitySource: "prospect" | "imported-candidate";
  confirmationSource: "operator";
  confirmedAt: string;
  effectiveSentAt: string;
  outcome: ManualOutreachOutcome;
  operationVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManualOutreachMetrics {
  manuallySent: number;
  outcomes: Record<ManualOutreachOutcome, number>;
  denominator: "operator-confirmed-manual-send";
  observationWindow: { earliest: string | null; latest: string | null };
}

export interface ManualDraftOperatorEntry {
  operatorId: string;
  snapshotId: string;
  operationId: string;
  redactedRecipient: string;
  company: string;
  title: string;
  subject: string;
  gmailDraftCreated: true;
  manualSendConfirmed: boolean;
  effectiveSentAt: string | null;
  outcome: ManualOutreachOutcome | null;
  suppressed: boolean;
  responseState: "awaiting-response" | "response-received" | "closed" | "delivery-failed" | null;
}

export interface ManualOutreachRepository {
  transaction<T>(work: () => T): T;
  resolveManualDraft(snapshotId: string): ResolvedManualDraft | null;
  findManualOutreach(snapshotId: string): ManualOutreachRecord | null;
  createManualOutreach(record: ManualOutreachRecord): void;
  updateManualOutcome(snapshotId: string, outcome: ManualOutreachOutcome, at: Date): ManualOutreachRecord;
  getManualOutreachMetrics(): ManualOutreachMetrics;
}

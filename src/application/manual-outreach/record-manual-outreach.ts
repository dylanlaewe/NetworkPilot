import { createHash } from "node:crypto";
import type {
  ManualOutreachOutcome,
  ManualOutreachRecord,
  ManualOutreachRepository,
} from "./types";

export const MANUAL_OUTREACH_OPERATION_VERSION = "manual-outreach-v2" as const;

export function confirmOperatorManualSend(input: {
  snapshotId: string;
  effectiveSentAt: Date;
  now: () => Date;
  repository: ManualOutreachRepository;
}): ManualOutreachRecord {
  if (!input.snapshotId.trim()) throw new Error("manual-send-snapshot-required");
  if (Number.isNaN(input.effectiveSentAt.getTime())) throw new Error("manual-send-time-invalid");

  return input.repository.transaction(() => {
    const existing = input.repository.findManualOutreach(input.snapshotId);
    if (existing) return existing;

    const resolved = input.repository.resolveManualDraft(input.snapshotId);
    if (!resolved) throw new Error("manual-send-draft-or-identity-unavailable");
    if (resolved.operation.state !== "gmail-draft-created") {
      throw new Error("manual-send-gmail-draft-not-confirmed");
    }

    const confirmedAt = input.now();
    if (Number.isNaN(confirmedAt.getTime())) throw new Error("manual-send-confirmation-time-invalid");
    if (input.effectiveSentAt.getTime() > confirmedAt.getTime()) {
      throw new Error("manual-send-time-cannot-be-future");
    }

    const record: ManualOutreachRecord = {
      id: `manual-outreach:${createHash("sha256").update(input.snapshotId).digest("hex")}`,
      draftSnapshotId: input.snapshotId,
      gmailOperationId: resolved.operation.operationId,
      candidateId: resolved.candidateId,
      companyId: resolved.companyId,
      identitySource: resolved.identitySource,
      confirmationSource: "operator",
      confirmedAt: confirmedAt.toISOString(),
      effectiveSentAt: input.effectiveSentAt.toISOString(),
      outcome: "awaiting-response",
      operationVersion: MANUAL_OUTREACH_OPERATION_VERSION,
      createdAt: confirmedAt.toISOString(),
      updatedAt: confirmedAt.toISOString(),
    };
    input.repository.createManualOutreach(record);
    return input.repository.findManualOutreach(input.snapshotId) ?? record;
  });
}

export function reportManualOutreachOutcome(input: {
  snapshotId: string;
  outcome: ManualOutreachOutcome;
  now: () => Date;
  repository: ManualOutreachRepository;
}): ManualOutreachRecord {
  if(input.outcome==="hard-bounce")throw new Error("manual-hard-bounce-requires-explicit-confirmation");
  const at = input.now();
  if (Number.isNaN(at.getTime())) throw new Error("manual-outcome-time-invalid");
  return input.repository.transaction(() => {
    const existing = input.repository.findManualOutreach(input.snapshotId);
    if (!existing) throw new Error("manual-send-confirmation-required");
    if (existing.outcome === input.outcome) return existing;
    if(existing.outcome==="hard-bounce")throw new Error("manual-hard-bounce-terminal");
    return input.repository.updateManualOutcome(input.snapshotId, input.outcome, at);
  });
}

export function recordOperatorReportedHardBounce(input:{snapshotId:string;effectiveSentAt:Date;now:()=>Date;repository:ManualOutreachRepository;}):ManualOutreachRecord{
  const reportedAt=input.now();
  if(Number.isNaN(reportedAt.getTime()))throw new Error("manual-hard-bounce-time-invalid");
  return input.repository.transaction(()=>{
    const existing=input.repository.findManualOutreach(input.snapshotId);
    if(existing?.outcome==="hard-bounce")return existing;
    if(existing&&existing.outcome!=="awaiting-response")throw new Error("manual-hard-bounce-outcome-conflict");
    const confirmed=existing??confirmOperatorManualSend({snapshotId:input.snapshotId,effectiveSentAt:input.effectiveSentAt,now:()=>reportedAt,repository:input.repository});
    return input.repository.updateManualOutcome(confirmed.draftSnapshotId,"hard-bounce",reportedAt);
  });
}

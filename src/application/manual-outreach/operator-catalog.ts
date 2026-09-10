import { createHash } from "node:crypto";
import { confirmOperatorManualSend } from "./record-manual-outreach";
import type { ManualDraftOperatorEntry, ManualOutreachRecord, ManualOutreachRepository } from "./types";

export const MANUAL_SEND_OPERATOR_ID_PREFIX = "npms-" as const;

export function manualSendOperatorId(operationId: string): string {
  return `${MANUAL_SEND_OPERATOR_ID_PREFIX}${createHash("sha256").update(operationId).digest("hex").slice(0, 16)}`;
}

export function resolveManualSendOperatorEntry(entries: readonly ManualDraftOperatorEntry[], operatorId: string): ManualDraftOperatorEntry {
  if(!new RegExp(`^${MANUAL_SEND_OPERATOR_ID_PREFIX}[a-f0-9]{16}$`).test(operatorId))throw new Error("manual-send-operator-id-invalid");
  const matches=entries.filter((entry)=>entry.operatorId===operatorId);
  if(matches.length===0)throw new Error("manual-send-operator-id-not-found");
  if(matches.length>1)throw new Error("manual-send-operator-id-ambiguous");
  return matches[0]!;
}

export function confirmManualSendByOperatorId(input:{
  entries:readonly ManualDraftOperatorEntry[];
  operatorId:string;
  effectiveSentAt:Date;
  now:()=>Date;
  repository:ManualOutreachRepository;
}):ManualOutreachRecord{
  const entry=resolveManualSendOperatorEntry(input.entries,input.operatorId);
  return confirmOperatorManualSend({snapshotId:entry.snapshotId,effectiveSentAt:input.effectiveSentAt,now:input.now,repository:input.repository});
}

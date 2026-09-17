import type {GmailDraftOperation,GmailDraftOperationRepository} from "./types";
import {confirmOperatorManualSend,type ManualOutreachRepository} from "@/application/manual-outreach";
export type GmailSendReconciliationOutcome="sent"|"not-sent"|"still-uncertain";
export interface GmailSendReconciliationRepository extends GmailDraftOperationRepository,ManualOutreachRepository{recordGmailSendReconciliation(input:{operationId:string;outcome:"sent"|"not-sent";effectiveSentAt:Date|null;at:Date}):"created"|"existing";}
export function reconcileGmailSend(input:{snapshotId:string;outcome:GmailSendReconciliationOutcome;effectiveSentAt?:Date;now:()=>Date;repository:GmailSendReconciliationRepository}):GmailDraftOperation{
  const operation=input.repository.findGmailDraftOperation(input.snapshotId);if(!operation)throw new Error("gmail-send-draft-unavailable");if(input.outcome==="still-uncertain")return operation;
  if(input.outcome==="sent"&&(!input.effectiveSentAt||Number.isNaN(input.effectiveSentAt.getTime())))throw new Error("gmail-reconciliation-sent-time-required");
  const outcome=input.outcome;input.repository.transaction(()=>{const result=input.repository.recordGmailSendReconciliation({operationId:operation.operationId,outcome,effectiveSentAt:outcome==="sent"?input.effectiveSentAt!:null,at:input.now()});if(outcome==="sent"&&result==="created")confirmOperatorManualSend({snapshotId:input.snapshotId,effectiveSentAt:input.effectiveSentAt!,now:input.now,repository:input.repository});});
  return input.repository.findGmailDraftOperation(input.snapshotId)!;
}

import type {GmailDraftOperation,GmailDraftOperationRepository,GmailDraftSender} from "./types";
export async function sendApprovedGmailDraft(input:{snapshotId:string;repository:GmailDraftOperationRepository;sender:GmailDraftSender;now:()=>Date}):Promise<GmailDraftOperation>{
  const operation=input.repository.findGmailDraftOperation(input.snapshotId);
  if(!operation||operation.state!=="gmail-draft-created"||!operation.gmailDraftId)throw new Error("gmail-send-draft-unavailable");
  if(operation.sendState==="sent")return operation;
  if(operation.sendState==="sending"||operation.sendState==="send-status-uncertain")throw new Error("gmail-send-reconciliation-required");
  input.repository.beginGmailSend(operation.operationId,input.now());
  try{const result=await input.sender.sendDraft(operation.gmailDraftId);input.repository.completeGmailSend(operation.operationId,result.messageId,input.now());}
  catch(error){input.repository.markGmailSendUncertain(operation.operationId,input.now());throw error;}
  const sent=input.repository.findGmailDraftOperation(input.snapshotId);if(!sent)throw new Error("gmail-send-persistence-failed");return sent;
}

import {createHash} from "node:crypto";
import type {ApprovedEmailDraftSnapshot,GmailDraftCreator,GmailDraftOperation,GmailDraftOperationRepository} from "./types";

export interface MimeMessageBuilder {build(snapshot:ApprovedEmailDraftSnapshot):string;}
export interface ClassifiedGmailError extends Error {category:string;outcomeUnknown:boolean;}

const operationId=(snapshotId:string)=>`gmail-draft:${createHash("sha256").update(snapshotId).digest("hex")}`;

export function approveForGmailDraft(repository:GmailDraftOperationRepository,snapshot:ApprovedEmailDraftSnapshot,adapterVersion:string):GmailDraftOperation{
  const existing=repository.findGmailDraftOperation(snapshot.snapshotId);
  if(existing){
    if(JSON.stringify(existing.snapshot)!==JSON.stringify(snapshot))throw new Error("gmail-draft-snapshot-conflict");
    return existing;
  }
  const operation:GmailDraftOperation={operationId:operationId(snapshot.snapshotId),snapshot:structuredClone(snapshot),provider:"gmail",state:"approved-for-gmail-draft",gmailDraftId:null,gmailMessageId:null,attemptStartedAt:null,completedAt:null,errorCategory:null,adapterVersion};
  repository.approveGmailDraftOperation(operation);
  return operation;
}

export async function createApprovedGmailDraft(input:{snapshotId:string;repository:GmailDraftOperationRepository;creator:GmailDraftCreator;mime:MimeMessageBuilder;now:()=>Date}):Promise<GmailDraftOperation>{
  const operation=input.repository.findGmailDraftOperation(input.snapshotId);
  if(!operation)throw new Error("gmail-draft-operation-not-found");
  if(operation.state==="gmail-draft-created")return operation;
  if(operation.state==="creating-gmail-draft"||operation.state==="reconciliation-required")throw new Error("gmail-draft-reconciliation-required");
  if(operation.state!=="approved-for-gmail-draft"&&operation.state!=="failed")throw new Error("gmail-draft-operation-not-approved");
  input.repository.beginGmailDraftAttempt(operation.operationId,input.now());
  try{
    const result=await input.creator.createDraft(input.mime.build(operation.snapshot));
    input.repository.completeGmailDraftOperation(operation.operationId,result.draftId,result.messageId,input.now());
  }catch(error){
    const classified=error as Partial<ClassifiedGmailError>,unknown=classified.outcomeUnknown===true,category=typeof classified.category==="string"?classified.category:"gmail-draft-create-failed";
    input.repository.failGmailDraftOperation(operation.operationId,unknown?"reconciliation-required":"failed",category,input.now());
    throw error;
  }
  const completed=input.repository.findGmailDraftOperation(input.snapshotId);
  if(!completed)throw new Error("gmail-draft-operation-persistence-failed");
  return completed;
}

import Database from "better-sqlite3";
import {assertRuntimeSchema} from "./schema-contract";
import {bucketProjection,type RecipientBucketClassification} from "@/domain/recipient-buckets";
import type {ApprovedEmailDraftSnapshot} from "@/application/email-drafts";
import type {ManualDraftOperatorEntry} from "@/application/manual-outreach";
import {listManualDraftOperatorEntries,resolveManualOutreachDatabaseSelection} from "./manual-outreach-operator";

export interface RelationshipTimelineEvent {label:string;at:string;detail?:string;}
export interface RelationshipWorkspaceEntry extends ManualDraftOperatorEntry {
  recipientBucket?:RecipientBucketClassification|null;
  historicalRecipientBucket?:RecipientBucketClassification|null;
  currentRecipientBucket?:RecipientBucketClassification|null;
  bucketLabel?:string;
  body:string;
  approvedAt:string;
  gmailDraftCreatedAt:string|null;
  timeline:RelationshipTimelineEvent[];
}

const auditLabel=(event:string,outcome:string|null)=>{
  if(event==="hard-bounce-reported")return "Delivery failure recorded";
  if(event==="outcome-reported")return outcome==="meeting-scheduled"?"Meeting recorded":outcome==="replied"?"Reply recorded":outcome==="declined"?"Decline recorded":outcome==="opt-out"?"Opt-out recorded":"Outcome updated";
  return null;
};

/** Read-only relationship projection. Provider identifiers never leave this boundary. */
export function loadRelationshipWorkspace():RelationshipWorkspaceEntry[]{
  const path=resolveManualOutreachDatabaseSelection().path,entries=listManualDraftOperatorEntries(path),database=new Database(path,{readonly:true,fileMustExist:true});
  try{assertRuntimeSchema(database);return entries.map(entry=>{
    const operation=database.prepare("SELECT approved_snapshot_json,completed_at_utc FROM gmail_draft_operations WHERE draft_snapshot_id=?").get(entry.snapshotId) as {approved_snapshot_json:string;completed_at_utc:string|null};
    const snapshot=JSON.parse(operation.approved_snapshot_json) as ApprovedEmailDraftSnapshot;
    const audits=entry.manualSendConfirmed?database.prepare("SELECT a.event_type,a.outcome,a.occurred_at_utc FROM manual_outreach_audit a JOIN manual_outreach_records r ON r.id=a.manual_outreach_id WHERE r.draft_snapshot_id=? ORDER BY a.occurred_at_utc,a.id").all(entry.snapshotId) as Array<{event_type:string;outcome:string|null;occurred_at_utc:string}>:[];
    const timeline:RelationshipTimelineEvent[]=[{label:"Draft approved",at:snapshot.approvedAt},...operation.completed_at_utc?[{label:"Gmail draft created",at:operation.completed_at_utc}]:[],...entry.effectiveSentAt?[{label:"Sent",at:entry.effectiveSentAt,detail:entry.confirmationSource==="networkpilot-gmail-send"?"Sent through NetworkPilot Gmail":"Operator-confirmed manual send"}]:[]];
    for(const audit of audits){const label=auditLabel(audit.event_type,audit.outcome);if(label)timeline.push({label,at:audit.occurred_at_utc});}
    timeline.sort((a,b)=>a.at.localeCompare(b.at));
    const currentRow=database.prepare("SELECT normalized_snapshot_json FROM imported_candidates WHERE id=?").get(snapshot.candidateId??"") as {normalized_snapshot_json:string}|undefined;
    const currentRecipientBucket=currentRow?(JSON.parse(currentRow.normalized_snapshot_json) as {recipientBucket?:RecipientBucketClassification|null}).recipientBucket??null:null;
    return{...entry,...bucketProjection(snapshot.recipientBucket),historicalRecipientBucket:snapshot.recipientBucket??null,currentRecipientBucket,body:snapshot.body,approvedAt:snapshot.approvedAt,gmailDraftCreatedAt:operation.completed_at_utc,timeline};
  });}finally{database.close();}
}

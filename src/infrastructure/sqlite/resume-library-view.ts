import Database from "better-sqlite3";
import type {ApprovedEmailDraftSnapshot} from "@/application/email-drafts";
import type {ResumeRecord} from "@/application/resumes";
import {resolveManualOutreachDatabaseSelection} from "./manual-outreach-operator";

export interface ResumeLibraryEntry extends ResumeRecord {usageCount:number;lastUsedAt:string|null;}

/** Read-only metadata projection; storage keys and PDF bytes are intentionally omitted from the UI result. */
export function loadResumeLibrary():ResumeLibraryEntry[]{
  const database=new Database(resolveManualOutreachDatabaseSelection().path,{readonly:true,fileMustExist:true});
  try{
    const rows=database.prepare("SELECT id,display_label,original_filename,size_bytes,sha256,uploaded_at_utc,role_lane,active FROM resume_library ORDER BY active DESC,uploaded_at_utc DESC,id").all() as Array<{id:string;display_label:string;original_filename:string;size_bytes:number;sha256:string;uploaded_at_utc:string;role_lane:ResumeRecord["roleLane"];active:number}>;
    const usage=new Map<string,{count:number;last:string|null}>();
    for(const row of database.prepare("SELECT approved_snapshot_json,COALESCE(sent_at_utc,completed_at_utc) used_at FROM gmail_draft_operations").all() as Array<{approved_snapshot_json:string;used_at:string|null}>){const snapshot=JSON.parse(row.approved_snapshot_json) as ApprovedEmailDraftSnapshot,id=snapshot.resumeAttachment?.resumeId;if(!id)continue;const current=usage.get(id)??{count:0,last:null};usage.set(id,{count:current.count+1,last:row.used_at&&(!current.last||row.used_at>current.last)?row.used_at:current.last});}
    return rows.map(row=>({id:row.id,displayLabel:row.display_label,originalFilename:row.original_filename,storageKey:"",sizeBytes:row.size_bytes,sha256:row.sha256,uploadedAt:row.uploaded_at_utc,roleLane:row.role_lane,active:Boolean(row.active),usageCount:usage.get(row.id)?.count??0,lastUsedAt:usage.get(row.id)?.last??null}));
  }finally{database.close();}
}

import Database from "better-sqlite3";
import { existsSync, statSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { manualSendOperatorId, type ManualDraftOperatorEntry } from "@/application/manual-outreach";
import type { ApprovedEmailDraftSnapshot } from "@/application/email-drafts";
import type { ImportedCandidateSnapshot } from "@/application/ingestion";

export const DEFAULT_MANUAL_OUTREACH_DATABASE = "data/apollo-operational-scale-enrichment.sqlite" as const;
export const MANUAL_OUTREACH_DATABASE_ENV = "NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH" as const;

export interface ManualOutreachDatabaseSelection { path:string; displayPath:string; source:"default-operational"|"environment"; }

export function resolveManualOutreachDatabaseSelection(env:Readonly<Record<string,string|undefined>>=process.env,cwd=process.cwd()):ManualOutreachDatabaseSelection{
  const configured=env[MANUAL_OUTREACH_DATABASE_ENV],path=resolve(cwd,configured??DEFAULT_MANUAL_OUTREACH_DATABASE);
  if(!existsSync(path)||!statSync(path).isFile())throw new Error(`manual-outreach-database-not-found:${sanitizedDatabasePath(path,cwd)}`);
  return{path,displayPath:sanitizedDatabasePath(path,cwd),source:configured?"environment":"default-operational"};
}

export function sanitizedDatabasePath(path:string,cwd=process.cwd()):string{
  const local=relative(resolve(cwd),resolve(path));
  return local&&!local.startsWith("..")?local:`<external>/${basename(path)}`;
}

function redactName(value:string):string{
  const parts=value.trim().split(/\s+/).filter(Boolean),first=parts[0]?.[0]??"?",last=parts.length>1?parts.at(-1)?.[0]:undefined;
  return `${first}***${last?` ${last}.`:""}`;
}

function tableExists(database:Database.Database,name:string):boolean{return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));}

export function listManualDraftOperatorEntries(databasePath:string):ManualDraftOperatorEntry[]{
  const database=new Database(databasePath,{readonly:true,fileMustExist:true});
  try{
    const confirmed=tableExists(database,"manual_outreach_records")?new Set((database.prepare("SELECT draft_snapshot_id FROM manual_outreach_records").all() as Array<{draft_snapshot_id:string}>).map((row)=>row.draft_snapshot_id)):new Set<string>();
    const rows=database.prepare("SELECT operation_id,draft_snapshot_id,approved_snapshot_json FROM gmail_draft_operations WHERE state='gmail-draft-created' ORDER BY completed_at_utc,operation_id").all() as Array<{operation_id:string;draft_snapshot_id:string;approved_snapshot_json:string}>;
    return rows.map((row)=>{
      const snapshot=JSON.parse(row.approved_snapshot_json) as ApprovedEmailDraftSnapshot;
      let company="Unavailable",title="Unavailable";
      const direct=database.prepare("SELECT c.name company,t.professional_title title FROM drafts d JOIN prospects p ON p.id=d.prospect_id JOIN companies c ON c.id=p.company_id LEFT JOIN fictional_targeting_profiles t ON t.prospect_id=p.id WHERE d.id=?").get(row.draft_snapshot_id) as {company:string;title:string|null}|undefined;
      if(direct){company=direct.company;title=direct.title??"Unavailable";}else if(snapshot.planningSnapshotId.startsWith("operational-scale:authorized:")){
        const providerRecordId=snapshot.planningSnapshotId.slice("operational-scale:authorized:".length),imported=database.prepare("SELECT normalized_snapshot_json FROM imported_candidates WHERE provider_record_id=?").get(providerRecordId) as {normalized_snapshot_json:string}|undefined;
        if(imported){const candidate=JSON.parse(imported.normalized_snapshot_json) as ImportedCandidateSnapshot;company=candidate.source.currentOrganization.name;title=candidate.source.currentTitle;}
      }
      return{operatorId:manualSendOperatorId(row.operation_id),snapshotId:row.draft_snapshot_id,operationId:row.operation_id,redactedRecipient:redactName(snapshot.recipientDisplayName),company,title,subject:snapshot.subject,gmailDraftCreated:true,manualSendConfirmed:confirmed.has(row.draft_snapshot_id)};
    });
  }finally{database.close();}
}

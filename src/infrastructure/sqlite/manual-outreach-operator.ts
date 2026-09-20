import Database from "better-sqlite3";
import { existsSync, statSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { manualSendOperatorId, type ManualDraftOperatorEntry, type ManualOutreachOutcome } from "@/application/manual-outreach";
import type { ApprovedEmailDraftSnapshot } from "@/application/email-drafts";
import type { ImportedCandidateSnapshot } from "@/application/ingestion";

export const DEFAULT_MANUAL_OUTREACH_DATABASE = "data/apollo-operational-scale-enrichment.sqlite" as const;
export const MANUAL_OUTREACH_DATABASE_ENV = "NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH" as const;

export interface ManualOutreachDatabaseSelection { path:string; displayPath:string; source:"default-operational"|"environment"; }

export function resolveManualOutreachDatabaseSelection(env:Readonly<Record<string,string|undefined>>=process.env,cwd=process.cwd()):ManualOutreachDatabaseSelection{
  const configured=env[MANUAL_OUTREACH_DATABASE_ENV],path=resolve(cwd,configured??DEFAULT_MANUAL_OUTREACH_DATABASE);
  if(!existsSync(/*turbopackIgnore: true*/ path)||!statSync(/*turbopackIgnore: true*/ path).isFile())throw new Error(`manual-outreach-database-not-found:${sanitizedDatabasePath(path,cwd)}`);
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
function columnExists(database:Database.Database,table:string,column:string):boolean{return (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{name:string}>).some((item)=>item.name===column);}
function responseState(outcome:ManualOutreachOutcome|null):ManualDraftOperatorEntry["responseState"]{if(!outcome)return null;if(outcome==="awaiting-response")return"awaiting-response";if(outcome==="replied"||outcome==="meeting-scheduled")return"response-received";if(outcome==="hard-bounce")return"delivery-failed";return"closed";}

function importedCandidateForPlanningSnapshot(database:Database.Database,planningSnapshotId:string):ImportedCandidateSnapshot|undefined{
  const operationalPrefix="operational-scale:authorized:",commandCenterPrefix="daily-command-center:";
  const row=planningSnapshotId.startsWith(operationalPrefix)
    ?database.prepare("SELECT normalized_snapshot_json FROM imported_candidates WHERE provider_record_id=?").get(planningSnapshotId.slice(operationalPrefix.length))
    :planningSnapshotId.startsWith(commandCenterPrefix)
      ?database.prepare("SELECT normalized_snapshot_json FROM imported_candidates WHERE id=?").get(planningSnapshotId.slice(commandCenterPrefix.length))
      :undefined;
  return row?JSON.parse((row as {normalized_snapshot_json:string}).normalized_snapshot_json) as ImportedCandidateSnapshot:undefined;
}

export function listManualDraftOperatorEntries(databasePath:string):ManualDraftOperatorEntry[]{
  const database=new Database(databasePath,{readonly:true,fileMustExist:true});
  try{
    const manualRows=tableExists(database,"manual_outreach_records")?database.prepare("SELECT draft_snapshot_id,candidate_id,identity_source,confirmation_source,effective_sent_at_utc,outcome FROM manual_outreach_records").all() as Array<{draft_snapshot_id:string;candidate_id:string;identity_source:"prospect"|"imported-candidate";confirmation_source:"operator"|"networkpilot-gmail-send";effective_sent_at_utc:string;outcome:ManualOutreachOutcome}>:[];
    const manualBySnapshot=new Map(manualRows.map((row)=>[row.draft_snapshot_id,row]));
    const suppressedProspects=tableExists(database,"suppression_entries")?new Set((database.prepare("SELECT prospect_id FROM suppression_entries").all() as Array<{prospect_id:string}>).map((row)=>row.prospect_id)):new Set<string>();
    const suppressedCandidates=tableExists(database,"candidate_suppression_entries")?new Set((database.prepare("SELECT candidate_id FROM candidate_suppression_entries").all() as Array<{candidate_id:string}>).map((row)=>row.candidate_id)):new Set<string>();
    const trackColumn=columnExists(database,"gmail_draft_operations","outreach_track")?"outreach_track":"'professional' AS outreach_track";
    const rows=database.prepare(`SELECT operation_id,draft_snapshot_id,approved_snapshot_json,${trackColumn} FROM gmail_draft_operations WHERE state='gmail-draft-created' ORDER BY completed_at_utc,operation_id`).all() as Array<{operation_id:string;draft_snapshot_id:string;approved_snapshot_json:string;outreach_track:"professional"|"recruiter"}>;
    return rows.map((row)=>{
      const snapshot=JSON.parse(row.approved_snapshot_json) as ApprovedEmailDraftSnapshot;
      let company="Unavailable",title="Unavailable",persistedSuppressed=false;
      const direct=database.prepare("SELECT p.id candidate_id,c.name company,t.professional_title title FROM drafts d JOIN prospects p ON p.id=d.prospect_id JOIN companies c ON c.id=p.company_id LEFT JOIN fictional_targeting_profiles t ON t.prospect_id=p.id WHERE d.id=?").get(row.draft_snapshot_id) as {candidate_id:string;company:string;title:string|null}|undefined;
      if(snapshot.candidateId&&snapshot.companyDisplayName&&snapshot.professionalTitle){company=snapshot.companyDisplayName;title=snapshot.professionalTitle;persistedSuppressed=suppressedCandidates.has(snapshot.candidateId);}else if(direct){company=direct.company;title=direct.title??"Unavailable";persistedSuppressed=suppressedProspects.has(direct.candidate_id);}else{
        const candidate=importedCandidateForPlanningSnapshot(database,snapshot.planningSnapshotId);
        if(candidate){company=candidate.source.currentOrganization.name;title=candidate.source.currentTitle;persistedSuppressed=candidate.source.consent.suppressed||suppressedCandidates.has(candidate.id);}
      }
      const manual=manualBySnapshot.get(row.draft_snapshot_id)??null,outcome=manual?.outcome??null,suppressed=persistedSuppressed||(manual?.identity_source==="prospect"?suppressedProspects.has(manual.candidate_id):manual?.identity_source==="imported-candidate"?suppressedCandidates.has(manual.candidate_id):false);
      return{operatorId:manualSendOperatorId(row.operation_id),snapshotId:row.draft_snapshot_id,operationId:row.operation_id,outreachTrack:row.outreach_track,redactedRecipient:redactName(snapshot.recipientDisplayName),company,title,subject:snapshot.subject,gmailDraftCreated:true,manualSendConfirmed:Boolean(manual),confirmationSource:manual?.confirmation_source??null,effectiveSentAt:manual?.effective_sent_at_utc??null,outcome,suppressed,responseState:responseState(outcome),...snapshot.resumeAttachment?{resumeLabel:snapshot.resumeAttachment.displayLabel}:{}};
    });
  }finally{database.close();}
}

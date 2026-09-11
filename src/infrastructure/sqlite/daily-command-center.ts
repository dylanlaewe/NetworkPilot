import Database from "better-sqlite3";
import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {buildDailyCommandCenter,type DailyCommandCenterState,type ReserveCandidate} from "@/application/daily-command-center";
import type {ImportedCandidateSnapshot} from "@/application/ingestion";
import {listManualDraftOperatorEntries,resolveManualOutreachDatabaseSelection} from "./manual-outreach-operator";
import {readApolloConfig} from "@/infrastructure/providers/apollo/config";

const redact=(first:string,last:string)=>`${first[0]??"?"}***${last?` ${last[0]}.`:""}`;
export function loadDailyCommandCenter():DailyCommandCenterState{
  let selected;try{selected=resolveManualOutreachDatabaseSelection();}catch{const fallback=resolve(/*turbopackIgnore: true*/ process.cwd(),process.env.NETWORKPILOT_DATABASE_PATH??"data/networkpilot.sqlite");if(!existsSync(/*turbopackIgnore: true*/ fallback))return buildDailyCommandCenter({drafts:[],reserve:[],gmailState:"not-configured",apolloEnabled:false,apolloExposure:0,apolloObserved:null,cooldownCompanies:0});selected={path:fallback};}
  const drafts=listManualDraftOperatorEntries(selected.path),db=new Database(selected.path,{readonly:true,fileMustExist:true});
  try{
    const now=Date.now(),cooldownCutoff=new Date(now-7*86400000).toISOString(),today=new Date().toISOString().slice(0,10);
    const contacted=new Set((db.prepare("SELECT candidate_id FROM manual_outreach_records").all() as {candidate_id:string}[]).map((r)=>r.candidate_id));
    const cooldown=new Set((db.prepare("SELECT company_id FROM manual_outreach_records WHERE outcome!='hard-bounce' AND effective_sent_at_utc>=?").all(cooldownCutoff) as {company_id:string}[]).map((r)=>r.company_id));
    const suppressed=new Set((db.prepare("SELECT candidate_id FROM candidate_suppression_entries").all() as {candidate_id:string}[]).map((r)=>r.candidate_id));
    const rows=db.prepare("SELECT normalized_snapshot_json,lifecycle_state FROM imported_candidates ORDER BY updated_at_utc DESC").all() as {normalized_snapshot_json:string;lifecycle_state:string}[];
    const reserve:ReserveCandidate[]=rows.map((row)=>{const c=JSON.parse(row.normalized_snapshot_json) as ImportedCandidateSnapshot;const companyId=c.strategyCompanyMatch?.companyId??"";let stage:ReserveCandidate["stage"]=c.source.email.verificationStatus==="verified"&&c.experience.minimumSupportedYears!==null&&c.gateFailures.length===0?"qualified-available":row.lifecycle_state==="eligible"?"enriched-unqualified":"search-only";if(contacted.has(c.id))stage="already-contacted";else if(suppressed.has(c.id)||c.source.consent.suppressed)stage="suppressed";else if(cooldown.has(companyId))stage="cooldown";return{id:c.id,recipient:redact(c.source.person.firstName,c.source.person.lastName),company:c.source.currentOrganization.name,title:c.source.currentTitle,industry:c.source.industrySignals[0]??"Unclassified",functionName:c.recipientFunction.primaryFunction,persona:c.personaId??"unclassified",score:c.dataQualityScore,stage};});
    const gmail=db.prepare("SELECT connection_state FROM gmail_connection_metadata WHERE provider='gmail'").get() as {connection_state:string}|undefined;
    const budget=db.prepare("SELECT estimated_max_exposure,observed_consumption FROM provider_daily_budgets WHERE provider_id='apollo' AND local_date=?").get(today) as {estimated_max_exposure:number;observed_consumption:number|null}|undefined;
    return buildDailyCommandCenter({drafts,reserve,gmailState:gmail?.connection_state??"not-configured",apolloEnabled:readApolloConfig(process.env).enabled,apolloExposure:budget?.estimated_max_exposure??0,apolloObserved:budget?.observed_consumption??null,cooldownCompanies:cooldown.size});
  }finally{db.close();}
}

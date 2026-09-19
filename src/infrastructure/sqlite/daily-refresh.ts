import Database from "better-sqlite3";
import {localCampaignDate,planNextDraftBatch,refreshDailyPipeline,type DailyRefreshRepository,type DailyRefreshResult} from "@/application/daily-refresh";
import {loadDailyCommandCenter} from "./daily-command-center";
import {resolveManualOutreachDatabaseSelection} from "./manual-outreach-operator";
import {SqliteSimulationRepository} from "./database";
import {ApolloDailyReplenisher} from "@/infrastructure/providers/apollo/daily-replenisher";

const tableExists=(db:Database.Database)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='daily_refresh_runs'").get());
export class SqliteDailyRefreshRepository implements DailyRefreshRepository{
 constructor(private readonly db:Database.Database){}
 findLatest(campaignDate:string):DailyRefreshResult|null{if(!tableExists(this.db))return null;const row=this.db.prepare("SELECT result_json FROM daily_refresh_runs WHERE campaign_date=? ORDER BY generation DESC LIMIT 1").get(campaignDate) as {result_json:string}|undefined;return row?JSON.parse(row.result_json) as DailyRefreshResult:null;}
 save(result:DailyRefreshResult):void{this.db.prepare("INSERT INTO daily_refresh_runs(id,campaign_date,generation,created_at_utc,result_json) VALUES(?,?,?,?,?)").run(result.id,result.campaignDate,result.generation,result.createdAt,JSON.stringify(result));}
}
export function loadLatestDailyRefresh():DailyRefreshResult|null{const selection=resolveManualOutreachDatabaseSelection(),db=new Database(selection.path,{readonly:true,fileMustExist:true});try{if(!tableExists(db))return null;const row=db.prepare("SELECT result_json FROM daily_refresh_runs ORDER BY campaign_date DESC,generation DESC LIMIT 1").get() as {result_json:string}|undefined;return row?JSON.parse(row.result_json) as DailyRefreshResult:null;}finally{db.close();}}
export async function runDailyRefreshFromToday(input:{allowProvider:boolean;force:boolean;now?:()=>Date}):Promise<DailyRefreshResult>{const selection=resolveManualOutreachDatabaseSelection(),repository=new SqliteSimulationRepository(selection.path);try{repository.migrate();const state=loadDailyCommandCenter(),store=new SqliteDailyRefreshRepository(repository.native),now=input.now??(()=>new Date());return await refreshDailyPipeline({repository:store,candidates:state.reserve.map((candidate)=>({id:candidate.id,company:candidate.companyId||candidate.company,track:candidate.track??"professional",score:candidate.score,available:candidate.stage==="qualified-available"})),now,allowProvider:input.allowProvider,force:input.force,replenisher:new ApolloDailyReplenisher(repository,process.env,now)});}finally{repository.close();}}

export function runNextDraftBatchFromReserve(target=5,now:()=>Date=()=>new Date()):DailyRefreshResult{
  const selection=resolveManualOutreachDatabaseSelection(),repository=new SqliteSimulationRepository(selection.path);
  try{
    repository.migrate();const state=loadDailyCommandCenter(),store=new SqliteDailyRefreshRepository(repository.native),at=now(),campaignDate=localCampaignDate(at),existing=store.findLatest(campaignDate),priorRows=repository.native.prepare("SELECT result_json FROM daily_refresh_runs WHERE campaign_date=?").all(campaignDate) as Array<{result_json:string}>,alreadyPlanned=new Set(priorRows.flatMap((row)=>(JSON.parse(row.result_json) as {candidateIds:string[]}).candidateIds)),companyByCandidate=new Map(state.reserve.map((candidate)=>[candidate.id,candidate.companyId||candidate.company])),alreadyCompanies=new Set([...alreadyPlanned].map((id)=>companyByCandidate.get(id)).filter((company):company is string=>Boolean(company)));
    const selected=planNextDraftBatch(state.reserve.map((candidate)=>({id:candidate.id,company:candidate.companyId||candidate.company,companyKind:candidate.companyKind,track:candidate.track??"professional",score:candidate.score,available:candidate.stage==="qualified-available"&&!alreadyPlanned.has(candidate.id)&&!alreadyCompanies.has(candidate.companyId||candidate.company)})),target);
    if(!selected.length)throw new Error("draft-reserve-empty");
    const result:DailyRefreshResult={id:`${campaignDate}:${(existing?.generation??0)+1}`,campaignDate,generation:(existing?.generation??0)+1,createdAt:at.toISOString(),candidateIds:selected.map((candidate)=>candidate.id),professionalCount:selected.filter((candidate)=>candidate.track==="professional").length,recruiterCount:selected.filter((candidate)=>candidate.track==="recruiter").length,target,shortfall:target-selected.length,reserveCount:state.pipeline.available,providerUsed:false,enrichmentAttempts:0,creditBefore:null,creditAfter:null,warning:null};
    store.save(result);return result;
  }finally{repository.close();}
}

export function recordDraftDisposition(input:{candidateId:string;permanent:boolean;now?:()=>Date}):void{
  const selection=resolveManualOutreachDatabaseSelection(),repository=new SqliteSimulationRepository(selection.path),now=input.now??(()=>new Date());
  try{repository.migrate();const at=now(),campaignDate=localCampaignDate(at),planned=(repository.native.prepare("SELECT result_json FROM daily_refresh_runs WHERE campaign_date=?").all(campaignDate) as Array<{result_json:string}>).some((row)=>(JSON.parse(row.result_json) as {candidateIds:string[]}).candidateIds.includes(input.candidateId));if(!planned)throw new Error("draft-disposition-candidate-unavailable");if(repository.native.prepare("SELECT 1 FROM manual_outreach_records WHERE candidate_id=?").get(input.candidateId))throw new Error("draft-disposition-already-contacted");const disposition=input.permanent?"permanently-excluded":"skipped",event=input.permanent?"candidate-permanently-excluded":"draft-skipped";repository.transaction(()=>{
    repository.native.prepare("INSERT INTO draft_dispositions(candidate_id,campaign_date,disposition,created_at_utc) VALUES(?,?,?,?) ON CONFLICT(candidate_id,campaign_date) DO UPDATE SET disposition=excluded.disposition").run(input.candidateId,campaignDate,disposition,at.toISOString());
    repository.native.prepare("INSERT INTO draft_disposition_audit(candidate_id,campaign_date,event_type,occurred_at_utc) VALUES(?,?,?,?)").run(input.candidateId,campaignDate,event,at.toISOString());
    if(input.permanent)repository.native.prepare("INSERT OR IGNORE INTO candidate_suppression_entries(candidate_id,reason,created_at_utc) VALUES(?, 'operator-do-not-show-again', ?)").run(input.candidateId,at.toISOString());
  });}finally{repository.close();}
}

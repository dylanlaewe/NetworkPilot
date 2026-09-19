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

export function runNextDraftBatchFromReserve(now:()=>Date=()=>new Date()):DailyRefreshResult{
  const selection=resolveManualOutreachDatabaseSelection(),repository=new SqliteSimulationRepository(selection.path);
  try{
    repository.migrate();const state=loadDailyCommandCenter(),store=new SqliteDailyRefreshRepository(repository.native),at=now(),campaignDate=localCampaignDate(at),existing=store.findLatest(campaignDate),priorRows=repository.native.prepare("SELECT result_json FROM daily_refresh_runs WHERE campaign_date=?").all(campaignDate) as Array<{result_json:string}>,alreadyPlanned=new Set(priorRows.flatMap((row)=>(JSON.parse(row.result_json) as {candidateIds:string[]}).candidateIds));
    const selected=planNextDraftBatch(state.reserve.map((candidate)=>({id:candidate.id,company:candidate.companyId||candidate.company,companyKind:candidate.companyKind,track:candidate.track??"professional",score:candidate.score,available:candidate.stage==="qualified-available"&&!alreadyPlanned.has(candidate.id)})));
    if(!selected.length)throw new Error("draft-reserve-empty");
    const result:DailyRefreshResult={id:`${campaignDate}:${(existing?.generation??0)+1}`,campaignDate,generation:(existing?.generation??0)+1,createdAt:at.toISOString(),candidateIds:selected.map((candidate)=>candidate.id),professionalCount:selected.filter((candidate)=>candidate.track==="professional").length,recruiterCount:selected.filter((candidate)=>candidate.track==="recruiter").length,target:5,shortfall:5-selected.length,reserveCount:state.pipeline.available,providerUsed:false,enrichmentAttempts:0,creditBefore:null,creditAfter:null,warning:null};
    store.save(result);return result;
  }finally{repository.close();}
}

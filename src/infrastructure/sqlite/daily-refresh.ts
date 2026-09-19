import {readDraftGenerations,readQueueCandidates,loadQueueReviews,renderQueueReview,draftIsDismissed} from "./draft-queue";
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
  if(!Number.isInteger(target)||target<1||target>20)throw new Error("draft-batch-size-invalid");
  const repository=new SqliteSimulationRepository(resolveManualOutreachDatabaseSelection().path);
  try{repository.migrate();return repository.transaction(()=>{
    const at=now(),campaignDate=localCampaignDate(at),store=new SqliteDailyRefreshRepository(repository.native),existing=store.findLatest(campaignDate),state=loadDailyCommandCenter(at),generations=readDraftGenerations(repository.native),alreadyPlanned=new Set(generations.filter(g=>g.campaignDate===campaignDate).flatMap(g=>g.candidateIds));
    const operations=(repository.native.prepare("SELECT approved_snapshot_json FROM gmail_draft_operations").all() as {approved_snapshot_json:string}[]).map(row=>JSON.parse(row.approved_snapshot_json) as {candidateId:string});
    for(const op of operations)alreadyPlanned.add(op.candidateId);
    const active=loadQueueReviews(repository,at).filter(r=>r.operation?.sendState!=="sent"&&!repository.findManualOutreach(r.snapshotId)),activeCandidates=active.map(r=>({id:r.candidateId,company:r.companyId,companyKind:state.reserve.find(c=>c.id===r.candidateId)?.companyKind,track:r.outreachTrack,score:r.score,available:true}));
    for(const review of active)alreadyPlanned.add(review.candidateId);
    const occupied=new Set(active.map(r=>r.companyId)),candidates=readQueueCandidates(repository.native),byId=new Map(candidates.map(c=>[c.id,c]));
    const selected=planNextDraftBatch(state.reserve.map(c=>({id:c.id,company:c.companyId||c.company,companyKind:c.companyKind,track:c.track??"professional",score:c.score,available:c.stage==="qualified-available"&&!alreadyPlanned.has(c.id)&&!occupied.has(c.companyId||c.company)&&!draftIsDismissed(repository.native,c.id,campaignDate)})),target,activeCandidates);
    const draftReviews=selected.map((c,i)=>renderQueueReview(byId.get(c.id)!,active.length+i,at)).filter((r):r is NonNullable<typeof r>=>Boolean(r));
    if(!draftReviews.length)throw new Error("draft-reserve-empty");
    const result:DailyRefreshResult={id:`${campaignDate}:${(existing?.generation??0)+1}`,campaignDate,generation:(existing?.generation??0)+1,createdAt:at.toISOString(),candidateIds:draftReviews.map(r=>r.candidateId),draftReviews,professionalCount:draftReviews.filter(r=>r.outreachTrack==="professional").length,recruiterCount:draftReviews.filter(r=>r.outreachTrack==="recruiter").length,target,shortfall:target-draftReviews.length,reserveCount:state.pipeline.available,providerUsed:false,enrichmentAttempts:0,creditBefore:null,creditAfter:null,warning:null};
    store.save(result);return result;
  });}finally{repository.close();}
}

export function recordDraftDisposition(input:{candidateId:string;permanent:boolean;now?:()=>Date}):void{
  const repository=new SqliteSimulationRepository(resolveManualOutreachDatabaseSelection().path);
  try{repository.migrate();repository.transaction(()=>{
    const at=(input.now??(()=>new Date()))(),review=loadQueueReviews(repository,at).find(r=>r.candidateId===input.candidateId),generation=readDraftGenerations(repository.native).filter(g=>g.candidateIds.includes(input.candidateId)).at(-1),campaignDate=generation?.campaignDate??localCampaignDate(at);
    const prior=repository.native.prepare("SELECT disposition FROM draft_dispositions WHERE candidate_id=? AND campaign_date=?").get(input.candidateId,campaignDate) as {disposition:string}|undefined;
    if(prior?.disposition==="permanently-excluded"||(prior?.disposition==="skipped"&&!input.permanent))return;
    if(!review)throw new Error("draft-disposition-candidate-unavailable");
    if(repository.findManualOutreach(review.snapshotId)||review.operation?.sendState==="sent")throw new Error("draft-disposition-already-contacted");
    if(review.operation?.sendState==="sending"||review.operation?.sendState==="send-status-uncertain")throw new Error("draft-disposition-verify-send-first");
    const disposition=input.permanent?"permanently-excluded":"skipped",event=input.permanent?"candidate-permanently-excluded":"draft-skipped";
    repository.native.prepare("INSERT INTO draft_dispositions(candidate_id,campaign_date,disposition,created_at_utc) VALUES(?,?,?,?) ON CONFLICT(candidate_id,campaign_date) DO UPDATE SET disposition=excluded.disposition").run(input.candidateId,campaignDate,disposition,at.toISOString());
    repository.native.prepare("INSERT INTO draft_disposition_audit(candidate_id,campaign_date,event_type,occurred_at_utc) VALUES(?,?,?,?)").run(input.candidateId,campaignDate,event,at.toISOString());
    if(input.permanent)repository.native.prepare("INSERT OR IGNORE INTO candidate_suppression_entries(candidate_id,reason,created_at_utc) VALUES(?, 'operator-do-not-show-again', ?)").run(input.candidateId,at.toISOString());
  });}finally{repository.close();}
}

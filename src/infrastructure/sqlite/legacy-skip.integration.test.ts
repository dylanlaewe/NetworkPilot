import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {approvedSnapshot} from "@/application/command-center-drafts";
import {approveForGmailDraft} from "@/application/email-drafts";
import {localCampaignDate,type DailyRefreshResult} from "@/application/daily-refresh";
import {seedOfflineReserve} from "../fixtures/offline-reserve";
import {SqliteSimulationRepository} from "./database";
import {draftCampaignDate,loadQueueReviews,readDraftGenerations,renderQueueReview} from "./draft-queue";
import {recordDraftDisposition,SqliteDailyRefreshRepository} from "./daily-refresh";

let directory:string,repository:SqliteSimulationRepository;
beforeEach(()=>{
  directory=mkdtempSync(join(tmpdir(),"np-legacy-skip-"));
  vi.stubEnv("NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH",join(directory,"fixture.sqlite"));
  vi.stubEnv("NETWORKPILOT_RECRUITER_DATABASE_PATH",join(directory,"absent.sqlite"));
  vi.stubEnv("NETWORKPILOT_GMAIL_ENABLED","false");vi.stubEnv("NETWORKPILOT_APOLLO_ENABLED","false");
  vi.stubGlobal("fetch",vi.fn(()=>{throw new Error("provider-calls-prohibited");}));
  repository=new SqliteSimulationRepository(join(directory,"fixture.sqlite"));
  seedOfflineReserve(repository,new Date("2026-09-18T12:00:00Z"));
});
afterEach(()=>{expect(fetch).not.toHaveBeenCalled();repository.close();vi.unstubAllEnvs();vi.unstubAllGlobals();rmSync(directory,{recursive:true,force:true});});
function approve(at:Date){
  const candidate=repository.listImportedCandidates().find(c=>c.outreachTrack==="professional")!;
  const review=renderQueueReview(candidate,0,at)!;
  approveForGmailDraft(repository,approvedSnapshot(review,at),"fictional-offline-test");
  return review;
}
const rows=(table:string)=>repository.native.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
const protectedHistory=()=>JSON.stringify(["gmail_draft_operations","gmail_send_audit","gmail_send_reconciliation_audit","manual_outreach_records","manual_outreach_audit","outreach_events","drafts","candidate_suppression_entries","suppression_entries","imported_candidates","daily_refresh_runs"].map(rows));
const skip=(candidateId:string,at:Date,permanent=false)=>recordDraftDisposition({candidateId,permanent,now:()=>at});
function generation(review:ReturnType<typeof approve>,carried=false):DailyRefreshResult{
  return {id:"2026-09-17:1",campaignDate:"2026-09-17",generation:1,createdAt:"2026-09-17T12:00:00Z",candidateIds:carried?[]:[review.candidateId],draftReviews:carried?[]:[review],...(carried?{carriedDraftReviews:[review]}:{}),professionalCount:1,recruiterCount:0,target:1,shortfall:0,reserveCount:1,providerUsed:false,enrichmentAttempts:0,creditBefore:null,creditAfter:null,warning:null};
}

describe("legacy draft disposition campaign date",()=>{
  it.each([
    ["Saturday","2026-09-19T16:00:00Z","2026-09-19"],
    ["Sunday","2026-09-20T16:00:00Z","2026-09-20"],
    ["weekday","2026-09-18T16:00:00Z","2026-09-18"],
    ["UTC Sunday / New York Saturday","2026-09-20T00:49:52.181Z","2026-09-20"],
  ])("dismisses a %s approval immediately, without contact/cooldown side effects",(_day,iso,date)=>{
    const at=new Date(iso),review=approve(at),before=protectedHistory();
    expect(readDraftGenerations(repository.native)).toEqual([]);
    expect(loadQueueReviews(repository,at).map(r=>r.snapshotId)).toContain(review.snapshotId);
    expect(draftCampaignDate([],review.candidateId,iso,at)).toBe(date);
    skip(review.candidateId,at);
    expect(rows("draft_dispositions")).toMatchObject([{candidate_id:review.candidateId,campaign_date:date,disposition:"skipped"}]);
    expect(loadQueueReviews(repository,at).some(r=>r.candidateId===review.candidateId)).toBe(false);
    expect(protectedHistory()).toBe(before);
    expect(repository.listOutreachEvents()).toEqual([]);
    expect(rows("manual_outreach_records")).toEqual([]);
    expect(rows("candidate_suppression_entries")).toEqual([]);
    // Retry even on a later weekday remains keyed to the immutable approval.
    skip(review.candidateId,new Date("2026-09-22T16:00:00Z"));
    expect(rows("draft_dispositions")).toHaveLength(1);expect(rows("draft_disposition_audit")).toHaveLength(1);
    expect(loadQueueReviews(repository,new Date("2026-09-22T16:00:00Z")).some(r=>r.candidateId===review.candidateId)).toBe(false);
  });
  it.each([false,true])("preserves the stored generated campaign date (carried=%s)",carried=>{
    const at=new Date("2026-09-19T16:00:00Z"),review=approve(at),stored=generation(review,carried);
    new SqliteDailyRefreshRepository(repository.native).save(stored);
    const before=protectedHistory();
    expect(localCampaignDate(at)).toBe("2026-09-21");
    expect(draftCampaignDate([stored],review.candidateId,at.toISOString(),at)).toBe("2026-09-17");
    skip(review.candidateId,at);skip(review.candidateId,at);
    expect(rows("draft_dispositions")).toMatchObject([{campaign_date:"2026-09-17"}]);
    expect(loadQueueReviews(repository,at)).toEqual([]);expect(protectedHistory()).toBe(before);
    expect(rows("draft_disposition_audit")).toHaveLength(1);
  });
  it("does not use an unrelated generation's date for a legacy approval",()=>{
    const at=new Date("2026-09-20T16:00:00Z"),review=approve(at);
    new SqliteDailyRefreshRepository(repository.native).save({...generation(review),candidateIds:[],draftReviews:[]});
    skip(review.candidateId,at);
    expect(rows("draft_dispositions")).toMatchObject([{campaign_date:"2026-09-20"}]);
    expect(loadQueueReviews(repository,at)).toEqual([]);
  });
  it("keeps permanent exclusion independent of date and non-downgradable",()=>{
    const at=new Date("2026-09-19T16:00:00Z"),review=approve(at);
    skip(review.candidateId,at,true);skip(review.candidateId,new Date("2026-09-23T12:00:00Z"),true);skip(review.candidateId,at);
    new SqliteDailyRefreshRepository(repository.native).save(generation(review));
    expect(loadQueueReviews(repository,new Date("2026-09-24T12:00:00Z"))).toEqual([]);
    expect(rows("candidate_suppression_entries")).toMatchObject([{candidate_id:review.candidateId,reason:"operator-do-not-show-again"}]);
    expect(rows("draft_dispositions")).toMatchObject([{disposition:"permanently-excluded"}]);
    expect(rows("draft_disposition_audit")).toHaveLength(1);
    expect(repository.listOutreachEvents()).toEqual([]);expect(rows("manual_outreach_records")).toEqual([]);
  });
  it("does not rewrite a historical misdated skip or its audit",()=>{
    const at=new Date("2026-09-20T00:49:52.181Z"),review=approve(at);
    repository.native.prepare("INSERT INTO draft_dispositions(candidate_id,campaign_date,disposition,created_at_utc) VALUES(?,'2026-09-21','skipped',?)").run(review.candidateId,at.toISOString());
    repository.native.prepare("INSERT INTO draft_disposition_audit(candidate_id,campaign_date,event_type,occurred_at_utc) VALUES(?,'2026-09-21','draft-skipped',?)").run(review.candidateId,at.toISOString());
    const historical=rows("draft_dispositions")[0],audit=rows("draft_disposition_audit")[0];
    const before=protectedHistory();skip(review.candidateId,at);
    expect(rows("draft_dispositions")[0]).toEqual(historical);expect(rows("draft_dispositions")).toHaveLength(2);
    expect(rows("draft_disposition_audit")[0]).toEqual(audit);expect(rows("draft_disposition_audit")).toHaveLength(2);
    expect(loadQueueReviews(repository,at)).toEqual([]);expect(protectedHistory()).toBe(before);
  });
  it("fails unknown IDs without creating a disposition or audit",()=>{
    expect(()=>skip("nonexistent",new Date("2026-09-19T16:00:00Z"))).toThrow("draft-disposition-candidate-unavailable");
    expect(rows("draft_dispositions")).toEqual([]);expect(rows("draft_disposition_audit")).toEqual([]);
  });
});

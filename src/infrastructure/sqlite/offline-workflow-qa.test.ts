import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {SqliteSimulationRepository} from "./database";
import {seedOfflineReserve,QA_PROFESSIONAL_TITLES} from "../fixtures/offline-reserve";
import {loadQueueReviews,renderQueueReview,readDraftGenerations} from "./draft-queue";
import {recordDraftDisposition,runNextDraftBatchFromReserve} from "./daily-refresh";
import {loadDailyCommandCenter} from "./daily-command-center";
import {approveEditedCommandCenterDraft} from "./command-center-drafts";
import {gmailDraftReadiness,gmailSendBlockReason,approvedSnapshot} from "@/application/command-center-drafts";
import {approveForGmailDraft,createApprovedGmailDraft} from "@/application/email-drafts";
import {DeterministicPlainTextMimeBuilder} from "@/infrastructure/providers/gmail";
import {activeDrafts} from "@/application/product-workflow";
import {recordOperatorReportedHardBounce} from "@/application/manual-outreach";

let directory:string,repository:SqliteSimulationRepository;
const at=new Date("2026-09-21T14:00:00Z"),now=()=>at;
beforeEach(()=>{
  directory=mkdtempSync(join(tmpdir(),"np-offline-qa-"));
  vi.stubEnv("NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH",join(directory,"fixture.sqlite"));
  vi.stubEnv("NETWORKPILOT_RECRUITER_DATABASE_PATH",join(directory,"absent.sqlite"));
  vi.stubEnv("NETWORKPILOT_GMAIL_ENABLED","false");vi.stubEnv("NETWORKPILOT_APOLLO_ENABLED","false");
  vi.useFakeTimers();vi.setSystemTime(at);
  vi.stubGlobal("fetch",vi.fn(()=>{throw new Error("offline-qa-network-prohibited");}));
  repository=new SqliteSimulationRepository(join(directory,"fixture.sqlite"));seedOfflineReserve(repository,at);
  repository.native.prepare("INSERT INTO provider_daily_budgets(provider_id,local_date,attempted_candidates,estimated_max_exposure,updated_at_utc) VALUES('apollo','2026-09-21',20,20,?)").run(at.toISOString());
});
afterEach(()=>{repository.close();vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();rmSync(directory,{recursive:true,force:true});});
const reviews=()=>loadQueueReviews(repository,at);
const history=()=>JSON.stringify(["gmail_draft_operations","manual_outreach_records","manual_outreach_audit","outreach_events","drafts"].map(table=>repository.native.prepare(`SELECT * FROM ${table}`).all()));
describe("persisted offline queue under exhausted Apollo budget",()=>{
  it("does not retrofit intent or new catalog copy onto historical immutable approvals",()=>{
    const review=runNextDraftBatchFromReserve(1,now).draftReviews![0]!;
    const snapshot={...approvedSnapshot(review,at),outreachIntent:undefined,templateCatalogVersion:"catalog-v8-dylan-outreach-method-v3",subject:"Historical approved subject",body:"Historical operator-approved content, unchanged."};
    const op=approveForGmailDraft(repository,snapshot,"fixture"),before=JSON.stringify(repository.findGmailDraftOperation(op.snapshot.snapshotId));
    runNextDraftBatchFromReserve(10,now);
    expect(JSON.stringify(repository.findGmailDraftOperation(op.snapshot.snapshotId))).toBe(before);
    const hydrated=reviews().find(r=>r.candidateId===review.candidateId)!;
    expect(hydrated.body).toBe(snapshot.body);expect(hydrated.outreachIntent).toBeUndefined();
  });
  it.each([[5,5,10],[5,10,15],[10,5,15],[10,10,20],[10,1,11],[10,20,30],[8,5,13],[12,7,19]])("adds to existing work: %i + %i = %i",(before,additional,after)=>{
    runNextDraftBatchFromReserve(before,now);const prior=reviews().map(r=>[r.candidateId,r.snapshotId,r.body]);
    const result=runNextDraftBatchFromReserve(additional,now);
    expect(result.addition).toMatchObject({additionalDraftCount:additional,addedCount:additional,activeBefore:before,activeAfter:after});
    expect(reviews()).toHaveLength(after);expect(reviews().slice(0,before).map(r=>[r.candidateId,r.snapshotId,r.body])).toEqual(prior);
  });
  it("preserves legacy fallback drafts on the first explicit Add rather than replacing them",()=>{
    const candidates=repository.listImportedCandidates(),legacy=candidates.filter(c=>c.outreachTrack!=="recruiter").slice(0,5);
    // Only these five have the latest pilot retrieval date; exclude recruiters to model the real pre-generation boundary.
    for(const c of candidates){c.source.sourceTimestamps.retrievedAt=legacy.some(r=>r.id===c.id)?at.toISOString():"2026-09-20T14:00:00Z";
      repository.native.prepare("UPDATE imported_candidates SET normalized_snapshot_json=? WHERE id=?").run(JSON.stringify(c),c.id);
      if(c.outreachTrack==="recruiter")repository.native.prepare("INSERT INTO candidate_suppression_entries(candidate_id,reason,created_at_utc) VALUES(?,?,?)").run(c.id,"fixture-suppressed",at.toISOString());
    }
    const batch=repository.native.prepare("SELECT * FROM import_batches LIMIT 1").get() as Record<string,unknown>;batch.id="operational-enrichment-fixture";batch.source_fingerprint="legacy-fixture";repository.native.prepare(`INSERT INTO import_batches(${Object.keys(batch).join(",")}) VALUES(${Object.keys(batch).map(()=>"?").join(",")})`).run(...Object.values(batch));repository.native.prepare("UPDATE imported_candidates SET batch_id=?").run(batch.id);
    const existing=reviews();expect(existing).toHaveLength(5);
    const result=runNextDraftBatchFromReserve(10,now);expect(result.addition?.activeAfter).toBe(15);expect(reviews()).toHaveLength(15);
    expect(reviews().slice(0,5).map(r=>r.snapshotId)).toEqual(existing.map(r=>r.snapshotId));
  });
  it("reports partial and empty additions inline without losing the active queue or persisting empty generations",()=>{
    runNextDraftBatchFromReserve(5,now);const active=new Set(reviews().map(r=>r.candidateId));
    const available=loadDailyCommandCenter(at).reserve.filter(c=>c.stage==="qualified-available");
    for(const c of available.slice(6))repository.native.prepare("INSERT INTO candidate_suppression_entries(candidate_id,reason,created_at_utc) VALUES(?,?,?)").run(c.id,"fixture-exhausted",at.toISOString());
    const partial=runNextDraftBatchFromReserve(10,now);expect(partial.addition).toMatchObject({addedCount:6,activeBefore:5,activeAfter:11,eligibleReserveRemaining:0});
    expect(reviews()).toHaveLength(11);expect(reviews().filter(r=>active.has(r.candidateId))).toHaveLength(5);
    const history=readDraftGenerations(repository.native);expect(runNextDraftBatchFromReserve(10,now).addition).toMatchObject({addedCount:0,activeBefore:11,activeAfter:11});expect(readDraftGenerations(repository.native)).toEqual(history);
  });
  it("generates, skips, replaces twice, excludes, and adds 5/10/1/20 while preserving queue order and snapshots",()=>{
    const before=history(),first=runNextDraftBatchFromReserve(5,now);expect(first.draftReviews).toHaveLength(5);expect(first.recruiterCount).toBe(2);
    const skipped=[reviews()[1]!.candidateId];recordDraftDisposition({candidateId:skipped[0]!,permanent:false,now});
    expect(reviews()).toHaveLength(4);runNextDraftBatchFromReserve(1,now);expect(reviews()).toHaveLength(5);
    skipped.push(reviews()[1]!.candidateId,reviews()[2]!.candidateId);
    for(const id of skipped.slice(1))recordDraftDisposition({candidateId:id,permanent:false,now});
    runNextDraftBatchFromReserve(1,now);runNextDraftBatchFromReserve(1,now);
    const excluded=reviews()[0]!.candidateId;recordDraftDisposition({candidateId:excluded,permanent:true,now});
    const retained=reviews().map(r=>({id:r.candidateId,body:r.body,snapshot:r.snapshotId}));
    for(const count of [5,10,1,20]){const result=runNextDraftBatchFromReserve(count,now);expect(result.target).toBe(count);expect(result.candidateIds).toHaveLength(count);expect(result.providerUsed).toBe(false);}
    const queue=reviews();expect(queue).toHaveLength(40);expect(new Set(queue.map(r=>r.candidateId)).size).toBe(queue.length);expect(new Set(queue.map(r=>r.companyId)).size).toBe(queue.length);
    expect(queue.slice(0,retained.length).map(r=>({id:r.candidateId,body:r.body,snapshot:r.snapshotId}))).toEqual(retained);
    expect(queue.some(r=>skipped.includes(r.candidateId)||r.candidateId===excluded)).toBe(false);
    expect(history()).toBe(before);expect(repository.listOutreachEvents()).toEqual([]);
    expect(queue.filter(r=>r.outreachTrack==="recruiter")).toHaveLength(16);
    const preferred=new Set(repository.listImportedCandidates().filter(c=>c.strategyCompanyMatch?.method!=="discovered-provider").map(c=>c.id));
    expect(queue.filter(r=>preferred.has(r.candidateId)).length).toBeLessThanOrEqual(16);
    const nextDay=new Date("2026-09-22T14:00:00Z");runNextDraftBatchFromReserve(5,()=>nextDay);
    expect(loadQueueReviews(repository,nextDay).some(r=>r.candidateId===excluded)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not resurrect fallback recommendations when the whole generation is skipped",()=>{
    const batch=runNextDraftBatchFromReserve(5,now);for(const id of batch.candidateIds)recordDraftDisposition({candidateId:id,permanent:false,now});expect(reviews()).toEqual([]);
    const next=runNextDraftBatchFromReserve(5,now);expect(next.candidateIds.some(id=>batch.candidateIds.includes(id))).toBe(false);
  });
  it("keeps prior-day active drafts and counts only unused reserve",()=>{
    const batch=runNextDraftBatchFromReserve(5,now),after=loadDailyCommandCenter(at);
    expect(after.pipeline.available).toBe(85);expect(after.reserve.filter(c=>c.stage==="in-draft-queue")).toHaveLength(5);
    const nextDay=new Date("2026-09-22T14:00:00Z");expect(loadQueueReviews(repository,nextDay)).toHaveLength(5);expect(loadDailyCommandCenter(nextDay).pipeline.available).toBe(85);
    const added=runNextDraftBatchFromReserve(5,()=>nextDay);expect(added.candidateIds.some(id=>batch.candidateIds.includes(id))).toBe(false);
  });
  it("makes skip idempotent and permanent exclusion non-downgradable",()=>{
    const id=runNextDraftBatchFromReserve(1,now).candidateIds[0]!;recordDraftDisposition({candidateId:id,permanent:true,now});recordDraftDisposition({candidateId:id,permanent:false,now});
    expect(repository.native.prepare("SELECT disposition FROM draft_dispositions").get()).toEqual({disposition:"permanently-excluded"});
    expect(repository.native.prepare("SELECT COUNT(*) count FROM draft_disposition_audit").get()).toEqual({count:1});
    expect(loadDailyCommandCenter(at).reserve.find(c=>c.id===id)?.stage).toBe("suppressed");
  });
  it("validates custom counts without writing a generation",()=>{
    for(const n of [0,21,NaN,1.5])expect(()=>runNextDraftBatchFromReserve(n,now)).toThrow("draft-batch-size-invalid");
    expect(readDraftGenerations(repository.native)).toHaveLength(0);
  });
  it("does not count a rejected recruiter as available just because its title remains relevant",()=>{
    const candidate=repository.listImportedCandidates().find(c=>c.outreachTrack==="recruiter")!;
    repository.reviewCandidate(candidate.id,"reject","Fictional QA rejection",undefined,at);
    expect(loadDailyCommandCenter(at).reserve.find(c=>c.id===candidate.id)?.stage).not.toBe("qualified-available");
    expect(runNextDraftBatchFromReserve(20,now).candidateIds).not.toContain(candidate.id);expect(fetch).not.toHaveBeenCalled();
  });
  it.each(QA_PROFESSIONAL_TITLES.filter(t=>/Product/.test(t)))("carries %s through classification, planning, filter, and truthful copy",(title)=>{
    const candidate=repository.listImportedCandidates().find(c=>c.source.currentTitle===title)!;
    expect(candidate.recipientFunction.primaryFunction).toBe("product");const review=renderQueueReview(candidate,0,at)!;
    expect(review).not.toBeNull();expect(review.lane).toBe("product-management");expect(review.body).not.toMatch(/I (was|am|worked as) (a |an )?(technical )?product manager/i);expect(review.body.match(/\?/g)).toHaveLength(1);
    expect(loadDailyCommandCenter(at).reserve.find(c=>c.id===candidate.id)?.functionName).toBe("product");
  });
  it("allows editing/approval and Gmail readiness independently of Apollo exhaustion, using only mocked Gmail",async()=>{
    runNextDraftBatchFromReserve(5,now);const review=reviews()[0]!,edited=await approveEditedCommandCenterDraft({snapshotId:review.snapshotId,candidateId:review.candidateId,subject:"A practical career question",body:review.body});
    expect(edited.snapshot.subject).toBe("A practical career question");const readiness=gmailDraftReadiness({featureEnabled:true,connected:true,scopeValid:true,providerConfigured:true,credentialAvailable:true,credentialScopeValid:true,accountPinned:true});expect(readiness.available).toBe(true);
    const creator={createDraft:vi.fn(async()=>({draftId:"fixture-draft",messageId:"fixture-message"}))};
    await createApprovedGmailDraft({snapshotId:edited.snapshot.snapshotId,repository,creator,mime:new DeterministicPlainTextMimeBuilder(),now});
    const created=reviews().find(r=>r.candidateId===review.candidateId)!;expect(gmailSendBlockReason(created,readiness)).toBeNull();expect(activeDrafts(reviews(),[])).toHaveLength(5);
    const locked=JSON.stringify(repository.findGmailDraftOperation(created.snapshotId)?.snapshot);runNextDraftBatchFromReserve(10,now);expect(JSON.stringify(repository.findGmailDraftOperation(created.snapshotId)?.snapshot)).toBe(locked);
    expect(loadDailyCommandCenter(at).safety.apolloExposure).toBe(20);expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps uncertain sends visible and refuses to skip them",()=>{
    const review=runNextDraftBatchFromReserve(1,now).draftReviews![0]!,op=approveForGmailDraft(repository,approvedSnapshot(review,at),"fixture");
    repository.native.prepare("UPDATE gmail_draft_operations SET send_state='send-status-uncertain' WHERE operation_id=?").run(op.operationId);
    expect(()=>recordDraftDisposition({candidateId:review.candidateId,permanent:false,now})).toThrow("draft-disposition-verify-send-first");expect(activeDrafts(reviews(),[])[0]?.state).toBe("needs-send-verification");
  });
  it("hydrates the newest persisted approval after an earlier failed operation without changing either snapshot",()=>{
    const review=runNextDraftBatchFromReserve(1,now).draftReviews![0]!;
    const old=approveForGmailDraft(repository,approvedSnapshot(review,at),"fixture");
    repository.native.prepare("UPDATE gmail_draft_operations SET state='failed' WHERE operation_id=?").run(old.operationId);
    const next={...approvedSnapshot(review,new Date(at.getTime()+1000)),snapshotId:"fixture-new-approval",subject:"A different approved subject"};
    approveForGmailDraft(repository,next,"fixture");const before=history();
    expect(reviews().find(r=>r.candidateId===review.candidateId)).toMatchObject({snapshotId:next.snapshotId,subject:next.subject,body:next.body});expect(history()).toBe(before);
  });
  it("keeps hard-bounce same-day company protection without applying a seven-day company hold",async()=>{
    const review=runNextDraftBatchFromReserve(1,now).draftReviews![0]!;
    const original=repository.listImportedCandidates().find(c=>c.id===review.candidateId)!;
    const colleague=repository.listImportedCandidates().find(c=>c.id!==review.candidateId&&c.outreachTrack==="professional")!;
    colleague.strategyCompanyMatch=original.strategyCompanyMatch;
    colleague.source.currentOrganization=original.source.currentOrganization;
    repository.native.prepare("UPDATE imported_candidates SET normalized_snapshot_json=? WHERE id=?").run(JSON.stringify(colleague),colleague.id);
    approveForGmailDraft(repository,approvedSnapshot(review,at),"fixture");
    await createApprovedGmailDraft({snapshotId:review.snapshotId,repository,creator:{createDraft:async()=>({draftId:"fixture-bounce",messageId:"fixture-bounce-message"})},mime:new DeterministicPlainTextMimeBuilder(),now});
    recordOperatorReportedHardBounce({snapshotId:review.snapshotId,effectiveSentAt:at,repository,now});
    expect(loadDailyCommandCenter(at).reserve.find(c=>c.id===colleague.id)?.stage).toBe("cooldown");
    expect(loadDailyCommandCenter(new Date("2026-09-22T14:00:00Z")).reserve.find(c=>c.id===colleague.id)?.stage).toBe("qualified-available");
    expect(fetch).not.toHaveBeenCalled();
  });
});

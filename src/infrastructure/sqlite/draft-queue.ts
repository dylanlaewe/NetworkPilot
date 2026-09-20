import Database from "better-sqlite3";
import {existsSync} from "node:fs";
import {resolve} from "node:path";
import type {ImportedCandidateSnapshot} from "@/application/ingestion";
import type {CommandCenterDraftReview} from "@/application/command-center-drafts";
import {commandCenterSnapshotId,mutableDraftBlockReason} from "@/application/command-center-drafts";
import {prepareControlledRealCampaign} from "@/application/providers/prepare-controlled-real-campaign";
import {renderRecruiterDraft} from "@/domain/recruiters";
import {CONTACT_IMPACTING_EVENT_TYPES} from "@/domain/outreach";
import type {DailyRefreshResult} from "@/application/daily-refresh";
import type {SqliteSimulationRepository} from "./database";

export const hasTable=(db:Database.Database,name:string)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
export function recruiterDatabasePath(){return resolve(/*turbopackIgnore: true*/ process.cwd(),process.env.NETWORKPILOT_RECRUITER_DATABASE_PATH??"data/apollo-recruiter-enrichment.sqlite");}
export function readQueueCandidates(db:Database.Database):ImportedCandidateSnapshot[]{
  const read=(source:Database.Database)=>(source.prepare("SELECT normalized_snapshot_json FROM imported_candidates ORDER BY created_at_utc,id").all() as {normalized_snapshot_json:string}[]).map(row=>JSON.parse(row.normalized_snapshot_json) as ImportedCandidateSnapshot);
  const candidates=read(db),path=recruiterDatabasePath();
  if(existsSync(/*turbopackIgnore: true*/ path)&&resolve(db.name)!==path){const other=new Database(path,{readonly:true,fileMustExist:true});try{candidates.push(...read(other));}finally{other.close();}}
  // The primary operational store wins if the same person has since been refreshed.
  return [...new Map(candidates.reverse().map(candidate=>[candidate.id,candidate])).values()].reverse();
}
export function readDraftGenerations(db:Database.Database):DailyRefreshResult[]{return hasTable(db,"daily_refresh_runs")?(db.prepare("SELECT result_json FROM daily_refresh_runs ORDER BY created_at_utc,generation").all() as {result_json:string}[]).map(row=>JSON.parse(row.result_json) as DailyRefreshResult):[];}
export function readQueueOperations(repository:SqliteSimulationRepository){return (repository.native.prepare("SELECT draft_snapshot_id FROM gmail_draft_operations ORDER BY updated_at_utc,operation_id").all() as {draft_snapshot_id:string}[]).map(row=>repository.findGmailDraftOperation(row.draft_snapshot_id)!);}
// A disposition belongs to the displayed draft, not the next scheduling day.
// Generated (including carried) drafts retain their persisted campaign date.
// Legacy approvals are anchored to their immutable UTC approval date, even on weekends.
export function draftCampaignDate(generations:readonly DailyRefreshResult[],candidateId:string,approvedAt:string|undefined,at:Date):string{
  const generation=generations.findLast(g=>g.candidateIds.includes(candidateId)||g.carriedDraftReviews?.some(r=>r.candidateId===candidateId));
  return generation?.campaignDate??approvedAt?.slice(0,10)??at.toISOString().slice(0,10);
}
export function draftIsDismissed(db:Database.Database,candidateId:string,campaignDate:string):boolean{return hasTable(db,"draft_dispositions")&&Boolean(db.prepare("SELECT 1 FROM draft_dispositions WHERE candidate_id=? AND (campaign_date=? OR disposition='permanently-excluded')").get(candidateId,campaignDate));}
export function renderQueueReview(candidate:ImportedCandidateSnapshot,ordinal=0,at=new Date()):CommandCenterDraftReview|null{
  if(candidate.state!=="eligible"||candidate.gateFailures.length||candidate.source.email.verificationStatus!=="verified"||candidate.source.consent.suppressed||candidate.source.consent.optedOut||!candidate.strategyCompanyMatch)return null;
  const recruiter=candidate.outreachTrack==="recruiter",classification=candidate.recruiterClassification;
  const professional=recruiter?null:prepareControlledRealCampaign([candidate],{target:1,now:at,variationOrdinal:ordinal}).drafts[0];
  if(recruiter?!classification?.accepted:!professional)return null;
  const draft=recruiter?renderRecruiterDraft({firstName:candidate.source.person.firstName,company:candidate.source.currentOrganization.name,title:candidate.source.currentTitle,classification:classification!,variationOrdinal:ordinal}):professional!.draft;
  const catalogVersion="catalogVersion" in draft?draft.catalogVersion:draft.templateCatalogVersion;
  return {outreachIntent:draft.outreachIntent,outreachTrack:recruiter?"recruiter":"professional",candidateId:candidate.id,recipient:`${candidate.source.person.firstName} ${candidate.source.person.lastName.slice(0,1)}.`,recipientEmail:candidate.source.email.address,company:candidate.source.currentOrganization.name,companyId:candidate.strategyCompanyMatch.companyId,title:candidate.source.currentTitle,primaryFunction:recruiter?"recruiting":candidate.recipientFunction.primaryFunction,secondaryFunctions:candidate.recipientFunction.secondaryFunctions,persona:recruiter?classification!.recruiterType:professional!.persona,experience:candidate.experience.minimumSupportedYears??0,industry:candidate.source.industrySignals[0]??"unclassified",location:candidate.source.location,score:recruiter?classification!.score:professional!.targetingScore,lane:recruiter?"recruiter":professional!.lane,templateVariant:"variant" in draft?draft.variant:professional!.templateVariant,qualification:"qualified",whySelected:recruiter?"Internal recruiter whose role matches your target work.":professional!.whySelected,subject:draft.subject,body:draft.body,wordCount:draft.body.trim().split(/\s+/).length,factIds:[...("referencedEvidence" in draft?draft.referencedEvidence:draft.referencedFactIds)],catalogVersion,snapshotId:commandCenterSnapshotId({candidateId:candidate.id,subject:draft.subject,body:draft.body,catalogVersion}),operation:null,blockedReason:null};
}
export function loadQueueReviews(repository:SqliteSimulationRepository,at=new Date()):CommandCenterDraftReview[]{
  const db=repository.native,candidates=readQueueCandidates(db),byId=new Map(candidates.map(c=>[c.id,c])),generations=readDraftGenerations(db),base=new Map<string,{review:CommandCenterDraftReview;date:string}>();
  for(const generation of generations){for(const review of generation.carriedDraftReviews??[])base.set(review.candidateId,{review,date:generation.campaignDate});for(const [ordinal,id] of generation.candidateIds.entries()){const review=generation.draftReviews?.find(d=>d.candidateId===id)??(byId.has(id)?renderQueueReview(byId.get(id)!,ordinal,new Date(generation.createdAt)):null);if(review)base.set(id,{review,date:generation.campaignDate});}}
  // Preserve pre-queue pilot recommendations until the first explicit generation.
  if(!generations.length){const latest=(db.prepare("SELECT date(MAX(updated_at_utc)) day FROM imported_candidates WHERE batch_id LIKE 'operational-enrichment-%'").get() as {day:string|null}).day;
    for(const candidate of (latest?candidates.filter(c=>c.outreachTrack!=="recruiter"&&c.source.sourceTimestamps.retrievedAt.slice(0,10)===latest).slice(0,10).concat(candidates.filter(c=>c.outreachTrack==="recruiter").slice(0,5)):[])){const review=renderQueueReview(candidate,base.size,at);if(review)base.set(candidate.id,{review,date:at.toISOString().slice(0,10)});}}
  const operations=readQueueOperations(repository);
  for(const operation of operations){const snapshot=operation.snapshot,id=snapshot.candidateId;if(!id||operation.sendState==="sent")continue;const prior=base.get(id),candidate=byId.get(id),review=prior?.review??(candidate?renderQueueReview(candidate,base.size,at):null);if(!review)continue;base.set(id,{date:draftCampaignDate(generations,id,snapshot.approvedAt,at),review:{...review,outreachIntent:snapshot.outreachIntent,operation,snapshotId:snapshot.snapshotId,subject:snapshot.subject,body:snapshot.body,wordCount:snapshot.body.trim().split(/\s+/).length,catalogVersion:snapshot.templateCatalogVersion,recipient:snapshot.recipientDisplayName,recipientEmail:snapshot.recipientProfessionalEmail,company:snapshot.companyDisplayName??review.company,title:snapshot.professionalTitle??review.title}});}
  const events=repository.listOutreachEvents().filter(e=>CONTACT_IMPACTING_EVENT_TYPES.has(e.type)||e.type==="operator-reported-hard-bounce"),today=at.toLocaleDateString("en-CA",{timeZone:"America/New_York"}),suppressed=new Set((db.prepare("SELECT candidate_id FROM candidate_suppression_entries").all() as {candidate_id:string}[]).map(row=>row.candidate_id));
  return [...base.values()].filter(({review,date})=>!draftIsDismissed(db,review.candidateId,date)).map(({review})=>{const candidate=byId.get(review.candidateId);return {...review,blockedReason:mutableDraftBlockReason({suppressed:suppressed.has(review.candidateId)||Boolean(candidate?.source.consent.suppressed),optedOut:Boolean(candidate?.source.consent.optedOut),previousContact:events.some(e=>e.prospectId===review.candidateId||e.prospectId===`authorized:${candidate?.source.providerRecordId}`),companyCooldown:events.some(e=>e.companyId===review.companyId&&(e.type==="operator-reported-hard-bounce"?e.occurredAt.toLocaleDateString("en-CA",{timeZone:"America/New_York"})===today:e.occurredAt.getTime()>=at.getTime()-7*86400000)),existingGmailDraft:review.operation?.state==="gmail-draft-created"})};}).filter(review=>review.blockedReason===null||Boolean(review.operation));
}

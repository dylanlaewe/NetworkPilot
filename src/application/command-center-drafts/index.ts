import {createHash} from "node:crypto";
import {assertFiveBucketEnabled,fiveBucketEnabled,verifiedBucketEvidence} from "@/domain/recipient-buckets";
import type {ApprovedEmailDraftSnapshot,GmailDraftOperation} from "@/application/email-drafts";
import type {ImportedCandidateSnapshot} from "@/application/ingestion";
import {assertDylanVoice} from "@/domain/drafting/voice";
import {hasResumeAttachmentClaim,type ResumeAttachmentSnapshot} from "@/application/resumes";
export {
  gmailDraftReadiness,
  gmailSendBlockReason,
  humanDraftError,
  humanSendError,
} from "./client-contract";
export type {
  GmailDraftReadiness,
  GmailDraftReadinessInput,
} from "./client-contract";

export interface CommandCenterDraftReview {
  recipientBucket?:import("@/domain/recipient-buckets").RecipientBucketClassification|null;
  classificationChange?:{previous:import("@/domain/recipient-buckets").RecipientBucketClassification|null;current:import("@/domain/recipient-buckets").RecipientBucketClassification;decisionRequired:true};
  bucketLabel?:string;bucketReviewState?:string;bucketReviewReason?:string|null;bucketEvidenceReferences?:string[];bucketClassifierVersion?:string|null;
  resumeSelection?:{resumeId:string|null;decisionRequired:boolean;source:"configured-default"|"explicit"|"none"|"unavailable"};
  outreachIntent?:import("@/domain/drafting/outreach-intent").IntentSelection;
  outreachTrack:"professional"|"recruiter";candidateId:string;recipient:string;recipientEmail:string;company:string;companyId:string;title:string;primaryFunction:string;secondaryFunctions:ImportedCandidateSnapshot["recipientFunction"]["secondaryFunctions"];persona:string;experience:number;industry:string;location:string;score:number;lane:string;templateVariant:string;qualification:"qualified";whySelected:string;subject:string;body:string;wordCount:number;factIds:string[];catalogVersion:string;snapshotId:string;operation:GmailDraftOperation|null;blockedReason:string|null;recruiterType?:string;recruitingDomain?:string;technicalRecruiting?:boolean;earlyCareerRecruiting?:boolean;
}
export const commandCenterSnapshotId=(input:{candidateId:string;subject:string;body:string;catalogVersion:string})=>`command-center:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
export function prepareEditedDraft(review:CommandCenterDraftReview,input:{subject:string;body:string}):CommandCenterDraftReview{
  const subject=input.subject.trim(),body=input.body.trim();
  assertDylanVoice(subject,body,{semanticAsks:Boolean(review.recipientBucket)});
  return{...review,subject,body,wordCount:body.split(/\s+/).length,snapshotId:commandCenterSnapshotId({candidateId:review.candidateId,subject,body,catalogVersion:review.catalogVersion}),operation:null};
}
export const selectReviewableDrafts=(items:readonly CommandCenterDraftReview[],maximum=5)=>items.filter((item)=>item.blockedReason===null).slice(0,maximum);
export function approvedSnapshot(review:CommandCenterDraftReview,now:Date,resumeAttachment?:ResumeAttachmentSnapshot,resumeDecision?:string):ApprovedEmailDraftSnapshot{
  if(review.classificationChange?.decisionRequired)throw new Error("bucket-correction-copy-review-required");
  if(fiveBucketEnabled()&&review.resumeSelection&&review.outreachTrack==="recruiter"&&!resumeAttachment&&resumeDecision!=="continue-without-attachment")throw new Error("recruiter-resume-decision-required");
  if(review.recipientBucket){
    assertFiveBucketEnabled();
    if(review.recipientBucket.reviewState!=="accepted"||!review.recipientBucket.bucket)throw new Error("recipient-bucket-review-required");
    if(review.blockedReason)throw new Error(review.blockedReason);
    if(review.outreachTrack==="recruiter"&&!resumeAttachment&&resumeDecision!=="continue-without-attachment")throw new Error("recruiter-resume-decision-required");
    if(!resumeAttachment&&hasResumeAttachmentClaim(review.body))throw new Error("resume-copy-mismatch");
    if(/\[[^\]]+\]/.test(review.subject+"\n"+review.body))throw new Error("draft-placeholder-unresolved");
    if(/current student|I(?:\'m| am) a student|found you on LinkedIn|previously (?:a |worked as a )?product manager/i.test(review.body))throw new Error("draft-unsupported-claim");
    if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(review.recipientEmail))throw new Error("draft-recipient-invalid");
    if(/your role leading /i.test(review.body)&&!verifiedBucketEvidence(review.recipientBucket.evidence,"functional-leadership")&&!verifiedBucketEvidence(review.recipientBucket.evidence,"division-leadership"))throw new Error("draft-unsupported-leadership-claim");
    assertDylanVoice(review.subject,review.body,{semanticAsks:true});
  }
  const bucketCatalog=review.recipientBucket?`${review.catalogVersion}|bucket:${JSON.stringify(review.recipientBucket)}`:review.catalogVersion;
  const snapshotId=resumeAttachment?commandCenterSnapshotId({candidateId:review.candidateId,subject:review.subject,body:review.body,catalogVersion:`${bucketCatalog}|resume:${resumeAttachment.resumeId}:${resumeAttachment.sha256}:${resumeAttachment.filename}`}):review.recipientBucket?commandCenterSnapshotId({candidateId:review.candidateId,subject:review.subject,body:review.body,catalogVersion:bucketCatalog}):review.snapshotId;return{...review.recipientBucket?{recipientBucket:structuredClone(review.recipientBucket)}:{},...review.outreachIntent?{outreachIntent:review.outreachIntent}:{},snapshotId,recipientProfessionalEmail:review.recipientEmail,recipientDisplayName:review.recipient,subject:review.subject,body:review.body,planningSnapshotId:`daily-command-center:${review.candidateId}`,templateCatalogVersion:review.catalogVersion,evidenceIds:review.factIds,approvedAt:now.toISOString(),outreachTrack:review.outreachTrack,candidateId:review.candidateId,companyId:review.companyId,companyDisplayName:review.company,professionalTitle:review.title,...resumeAttachment?{resumeAttachment}:{}};}
export function mutableDraftBlockReason(input:{suppressed:boolean;optedOut:boolean;previousContact:boolean;companyCooldown:boolean;existingGmailDraft:boolean}):string|null{return input.suppressed?"suppressed":input.optedOut?"opted-out":input.previousContact?"previous-contact":input.companyCooldown?"company-cooldown":input.existingGmailDraft?"existing-gmail-draft":null;}
export const humanEditError=(code:string):string=>({"dylan-voice-em-dash-prohibited":"Use a comma, colon, or full stop instead of an em dash.","dylan-voice-generic-phrase-prohibited":"Revise the generic outreach phrase before approving.","dylan-voice-subject-invalid":"Use a short, plain subject without emoji or ending punctuation.","dylan-voice-word-count-invalid":"Keep this message concise enough for a thoughtful introduction.","dylan-voice-cta-count-invalid":"Include one clear primary invitation; it does not need a question mark.","recipient-bucket-review-required":"Review and resolve the recipient-bucket evidence before approval.","recruiter-resume-decision-required":"Choose an active resume or explicitly continue without an attachment.","resume-copy-mismatch":"The message says a resume is attached, but no attachment is selected. Review and correct the copy or select a resume.","draft-placeholder-unresolved":"Replace every bracketed placeholder with reviewed evidence before approval.","draft-unsupported-claim":"Remove or correct the unsupported claim before approval.","draft-recipient-invalid":"The reviewed professional email address is not valid for approval.","draft-stale":"This draft changed after you opened it. Review the current message before sending."}[code]??"The edited message does not meet the outreach quality checks yet.");

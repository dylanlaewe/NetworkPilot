import {gmailSendBlockReason,humanDraftError,humanSendError,type GmailDraftReadiness} from "@/application/command-center-drafts";
import {humanSelectionReason,type SimpleDraft} from "@/application/product-workflow";
import type {ManualDraftOperatorEntry} from "@/application/manual-outreach";
import type {ResumeRecord} from "@/application/resumes";

export type WorkspaceDraftState=SimpleDraft["state"];

export interface WorkspaceResume {
  id:string;
  label:string;
  lane:string;
}

export interface WorkspaceDraft {
  snapshotId:string;
  candidateId:string;
  recipient:string;
  company:string;
  title:string;
  track:"professional"|"recruiter";
  state:WorkspaceDraftState;
  subject:string;
  body:string;
  blockedReason:string|null;
  blockedMessage:string|null;
  sendBlockedMessage:string|null;
  selectionReason:string;
  intent:string;
  roleRelevance:string;
  companyEvidence:string;
  lane:string;
  location:string;
  industry:string;
  catalogVersion:string;
  factCount:number;
  approvedAt:string|null;
  attachment:{label:string;filename:string}|null;
  manualOperatorId:string|null;
  recipientBucket:import("@/domain/recipient-buckets").RecipientBucketClassification|null;
  bucketLabel:string;
  bucketReviewState:string;
  bucketReviewReason:string|null;
  bucketEvidenceReferences:string[];
  bucketClassifierVersion:string|null;
  resumeSelection:{resumeId:string|null;decisionRequired:boolean;source:"configured-default"|"explicit"|"none"|"unavailable"}|null;
  classificationChange:{previous:import("@/domain/recipient-buckets").RecipientBucketClassification|null;current:import("@/domain/recipient-buckets").RecipientBucketClassification;decisionRequired:true}|null;
}

export function workspacePrimaryBlockReason(draft:WorkspaceDraft|null,gmailAvailable:boolean,gmailReason:string|null):string|null{
  if(!draft)return "Select a draft first.";
  if(draft.classificationChange?.decisionRequired)return "Review the corrected recipient bucket and explicitly keep your edits or regenerate this unapproved message.";
  if(draft.bucketReviewState==="review-required")return draft.bucketReviewReason?`Bucket review required: ${draft.bucketReviewReason}.`:"Bucket evidence needs review before this draft can be approved or externalized.";
  if(draft.state==="ready")return draft.blockedMessage;
  if(draft.state==="approved")return draft.blockedMessage??(gmailAvailable?null:gmailReason??"Gmail draft creation is unavailable.");
  if(draft.state==="gmail-draft-created")return draft.sendBlockedMessage;
  return null;
}

function humanize(value:string){return value.replaceAll("-"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());}

export function buildWorkspaceDrafts(input:{rows:readonly SimpleDraft[];outreach:readonly ManualDraftOperatorEntry[];readiness:GmailDraftReadiness}):WorkspaceDraft[]{
  return input.rows.map(({review,state})=>{
    const immutable=state!=="ready"?review.operation?.snapshot:null;
    const attachment=immutable?.resumeAttachment??null;
    const manual=input.outreach.find((entry)=>entry.snapshotId===review.snapshotId&&!entry.manualSendConfirmed)??null;
    const sendBlock=state==="gmail-draft-created"?gmailSendBlockReason(review,input.readiness):null;
    return{
      snapshotId:review.snapshotId,
      candidateId:review.candidateId,
      recipient:immutable?.recipientDisplayName??review.recipient,
      company:immutable?.companyDisplayName??review.company,
      title:immutable?.professionalTitle??review.title,
      track:review.outreachTrack,
      state,
      subject:immutable?.subject??review.subject,
      body:immutable?.body??review.body,
      blockedReason:review.blockedReason,
      blockedMessage:review.blockedReason?humanDraftError(review.blockedReason):null,
      sendBlockedMessage:sendBlock?humanSendError(sendBlock):null,
      selectionReason:humanSelectionReason(review.whySelected),
      intent:review.outreachIntent?.reason??"Use the approved evidence and ask one focused professional question.",
      roleRelevance:humanize(review.primaryFunction),
      companyEvidence:review.outreachTrack==="recruiter"?`Internal recruiting role at ${review.company}, carried from the reviewed candidate profile.`:`Current role at ${review.company}, carried from the reviewed candidate profile.`,
      lane:review.lane==="product-management"?"Product":humanize(review.lane),
      location:review.location,
      industry:humanize(review.industry),
      catalogVersion:immutable?.templateCatalogVersion??review.catalogVersion,
      factCount:immutable?.evidenceIds.length??review.factIds.length,
      approvedAt:immutable?.approvedAt??null,
      attachment:attachment?{label:attachment.displayLabel,filename:attachment.filename}:null,
      manualOperatorId:manual?.operatorId??null,
      recipientBucket:review.recipientBucket??null,
      bucketLabel:review.bucketLabel??(review.recipientBucket?.bucket?({recruiters:"Recruiters",peers:"Peers & practitioners",managers:"Managers & team leaders",executives:"Executives",ceos:"CEOs & presidents"} as const)[review.recipientBucket.bucket]:"Legacy / unclassified"),
      bucketReviewState:review.bucketReviewState??(review.recipientBucket?.reviewState??"legacy-unclassified"),
      bucketReviewReason:review.bucketReviewReason??review.recipientBucket?.explanationCodes.join(", ")??null,
      bucketEvidenceReferences:review.bucketEvidenceReferences??review.recipientBucket?.evidenceReferences??[],
      bucketClassifierVersion:review.bucketClassifierVersion??review.recipientBucket?.classifierVersion??null,
      resumeSelection:review.resumeSelection??null,
      classificationChange:review.classificationChange??null,
    };
  });
}

export function buildWorkspaceResumes(resumes:readonly ResumeRecord[]):WorkspaceResume[]{
  return resumes.filter((resume)=>resume.active).map((resume)=>({id:resume.id,label:resume.displayLabel,lane:resume.roleLane?humanize(resume.roleLane):"Unassigned"}));
}

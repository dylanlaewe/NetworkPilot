import type {CommandCenterDraftReview} from "@/application/command-center-drafts";
import type {ManualDraftOperatorEntry} from "@/application/manual-outreach";

export type SimpleDraftState="ready"|"approved"|"gmail-draft-created"|"needs-send-verification";
export type SimpleDraftAction="review-and-approve"|"create-gmail-draft"|"send-email"|"verify-send";
export interface SimpleDraft {review:CommandCenterDraftReview;state:SimpleDraftState;primaryAction:SimpleDraftAction;}

export function activeDrafts(reviews:readonly CommandCenterDraftReview[],outreach:readonly ManualDraftOperatorEntry[]):SimpleDraft[]{
  const sent=new Set(outreach.filter((item)=>item.manualSendConfirmed).map((item)=>item.snapshotId));
  return reviews.filter((review)=>review.operation?.sendState!=="sent"&&!sent.has(review.snapshotId)).map((review)=>{
    if(review.operation?.sendState==="sending"||review.operation?.sendState==="send-status-uncertain")return{review,state:"needs-send-verification",primaryAction:"verify-send"};
    if(review.operation?.state==="gmail-draft-created")return{review,state:"gmail-draft-created",primaryAction:"send-email"};
    if(review.operation?.state==="approved-for-gmail-draft")return{review,state:"approved",primaryAction:"create-gmail-draft"};
    return{review,state:"ready",primaryAction:"review-and-approve"};
  });
}

export const sentOutreach=<T extends ManualDraftOperatorEntry>(entries:readonly T[])=>entries.filter((entry):entry is T=>entry.manualSendConfirmed);
export const humanSelectionReason=(reason:string)=>({"selected-by-targeting-rank":"Strong match for your target roles, experience, and company criteria.","eligible-below-targeting-cutoff":"Qualified for outreach and ready for review.","duplicate-company-in-plan":"Relevant candidate held for company spacing."}[reason]??reason.replaceAll("-"," "));

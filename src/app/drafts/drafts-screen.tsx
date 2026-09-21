import {notFound} from "next/navigation";
import {draftAdditionMessage} from "@/application/daily-refresh/addition-feedback";
import {humanDraftError,humanEditError,humanSendError} from "@/application/command-center-drafts";
import {activeDrafts} from "@/application/product-workflow";
import {loadCommandCenterDraftReviews} from "@/infrastructure/sqlite/command-center-drafts";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {DraftsWorkspace} from "./drafts-workspace";
import {buildWorkspaceDrafts,buildWorkspaceResumes} from "./workspace-data";

export interface DraftsSearchParams {
  candidate?:string;
  error?:string;
  sendError?:string;
  sendStatus?:string;
  skipStatus?:string;
  replacementStatus?:string;
  reconciliationStatus?:string;
  added?:string;
  requested?:string;
  reserveRemaining?:string;
}

function feedback(params:DraftsSearchParams){
  if(params.error)return{tone:"error" as const,message:humanEditError(params.error)};
  if(params.sendError)return{tone:"error" as const,message:humanSendError(params.sendError)};
  if(params.sendStatus==="sent")return{tone:"success" as const,message:"Sent. Continue with the next draft."};
  if(params.reconciliationStatus==="recorded")return{tone:"success" as const,message:"Send status recorded."};
  if(params.skipStatus==="skipped")return{tone:"success" as const,message:"Skipped without contact, cooldown, or suppression."};
  if(params.skipStatus==="excluded")return{tone:"success" as const,message:"Person removed from future outreach."};
  if(params.replacementStatus==="ready")return{tone:"success" as const,message:"Replacement added from the qualified reserve."};
  if(params.replacementStatus==="empty")return{tone:"caution" as const,message:"No eligible replacement is available in the qualified reserve."};
  if(params.added!==undefined)return{tone:Number(params.added)>0?"success" as const:"caution" as const,message:draftAdditionMessage(Number(params.added)||0,Number(params.requested)||0,Number(params.reserveRemaining)||0)};
  return null;
}

export async function DraftsScreen({params,reviewMode=false}:{params:DraftsSearchParams;reviewMode?:boolean}){
  const workflow=await loadCommandCenterDraftReviews();
  const commandCenter=loadDailyCommandCenter();
  const rows=activeDrafts(workflow.items,commandCenter.drafts);
  const candidateId=params.candidate?decodeURIComponent(params.candidate):undefined;
  if(reviewMode&&(!candidateId||!rows.some((row)=>row.review.candidateId===candidateId)))notFound();
  return <DraftsWorkspace
    drafts={buildWorkspaceDrafts({rows,outreach:commandCenter.drafts,readiness:workflow.gmail.readiness})}
    resumes={buildWorkspaceResumes(workflow.resumes)}
    gmailAvailable={workflow.gmail.readiness.available}
    gmailReason={workflow.gmail.readiness.reason?humanDraftError(workflow.gmail.readiness.reason):null}
    hasReserve={commandCenter.reserve.some((candidate)=>candidate.stage==="qualified-available")}
    initialCandidateId={candidateId}
    initialMobileReview={reviewMode}
    feedback={feedback(params)}
  />;
}

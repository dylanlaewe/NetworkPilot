import Link from "next/link";
import {activeDrafts} from "@/application/product-workflow";
import {gmailSendBlockReason,humanSendError} from "@/application/command-center-drafts";
import {loadCommandCenterDraftReviews} from "@/infrastructure/sqlite/command-center-drafts";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {ProductNav} from "@/app/product-nav";
import {confirmAlreadySent,createGmailDraft,reconcileGmailSendStatus,sendGmailDraft} from "@/app/today/actions";
import {GmailDraftControl} from "@/app/today/gmail-draft-control";
import {GmailSendControl} from "@/app/today/gmail-send-control";
import {GmailReconciliationControl} from "@/app/today/gmail-reconciliation-control";
import {GmailReadinessPanel} from "@/app/today/gmail-readiness-panel";

export const dynamic="force-dynamic";
const stateLabel={ready:"Ready to review",approved:"Approved", "gmail-draft-created":"Gmail draft created","needs-send-verification":"Check send status"} as const;
export default async function DraftsPage({searchParams}:{searchParams:Promise<{sendError?:string}>}){
  const workflow=await loadCommandCenterDraftReviews(),outreach=loadDailyCommandCenter().drafts,rows=activeDrafts(workflow.items,outreach),params=await searchParams;
  return <main><ProductNav current="drafts"/><header className="product-header compact-header"><div><h1>Drafts</h1><p>Review and send messages. Contacted recipients move to Sent.</p></div><strong>{rows.length} waiting</strong></header>
    {params.sendError?<p role="alert" className="block-message send-result">{humanSendError(params.sendError)}</p>:null}<GmailReadinessPanel connectionState={workflow.gmail.connectionState} readiness={workflow.gmail.readiness}/>
    <section className="product-section"><div className="draft-table" role="table" aria-label="Unsent drafts"><div className="draft-table-head" role="row"><span>Person</span><span>Track</span><span>Role</span><span>State</span><span>Next step</span></div>{rows.length===0?<div className="empty"><strong>No drafts waiting for review.</strong><p>Refresh candidates when you are ready to prepare more outreach.</p><Link className="text-action" href="/candidates">Open Candidates</Link></div>:rows.map(({review,state})=>{const sendBlock=gmailSendBlockReason(review,workflow.gmail.readiness),manual=outreach.find((entry)=>entry.snapshotId===review.snapshotId&&!entry.manualSendConfirmed);return <article className="draft-table-row" role="row" key={review.snapshotId}>
      <div><strong>{review.recipient}</strong><span>{review.company}</span></div><span className="track-label">{review.outreachTrack}</span><span>{review.title}</span><span className="state-label">{stateLabel[state]}</span>
      <div className="row-action">{state==="ready"?<Link className="primary-action" href={`/drafts/review?candidate=${encodeURIComponent(review.candidateId)}`}>Review</Link>:state==="approved"?<GmailDraftControl snapshotId={review.snapshotId} readiness={workflow.gmail.readiness} action={createGmailDraft}/>:state==="gmail-draft-created"?(sendBlock?<p className="block-message">{humanSendError(sendBlock)}</p>:<><GmailSendControl snapshotId={review.snapshotId} recipient={review.recipient} company={review.company} subject={review.subject} track={review.outreachTrack} action={sendGmailDraft}/>{manual?<details className="manual-fallback"><summary>Sent outside NetworkPilot?</summary><form action={confirmAlreadySent}><input type="hidden" name="id" value={manual.operatorId}/><label>Sent time<input type="datetime-local" name="sentAt" required/></label><button name="confirmation" value="confirmed">Record manual send</button></form></details>:null}</>):<GmailReconciliationControl snapshotId={review.snapshotId} action={reconcileGmailSendStatus}/>}</div>
    </article>;})}</div></section>
  </main>;
}

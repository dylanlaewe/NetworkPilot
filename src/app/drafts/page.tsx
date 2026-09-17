import {activeDrafts} from "@/application/product-workflow";
import {gmailSendBlockReason,humanDraftError,humanSendError} from "@/application/command-center-drafts";
import {loadCommandCenterDraftReviews} from "@/infrastructure/sqlite/command-center-drafts";
import {loadDailyCommandCenter} from "@/infrastructure/sqlite/daily-command-center";
import {ProductNav} from "@/app/product-nav";
import {approveDraft,confirmAlreadySent,createGmailDraft,reconcileGmailSendStatus,sendGmailDraft} from "@/app/today/actions";
import {GmailDraftControl} from "@/app/today/gmail-draft-control";
import {GmailSendControl} from "@/app/today/gmail-send-control";
import {GmailReconciliationControl} from "@/app/today/gmail-reconciliation-control";
import {GmailReadinessPanel} from "@/app/today/gmail-readiness-panel";

export const dynamic="force-dynamic";
const stateLabel={ready:"Ready for review",approved:"Approved", "gmail-draft-created":"Gmail draft created","needs-send-verification":"Needs send verification"} as const;
export default async function DraftsPage({searchParams}:{searchParams:Promise<{sendError?:string}>}){
  const workflow=await loadCommandCenterDraftReviews(),outreach=loadDailyCommandCenter().drafts,rows=activeDrafts(workflow.items,outreach),params=await searchParams;
  return <main><ProductNav current="drafts"/><header className="product-header"><div><h1>Drafts</h1><p>Messages that still need review or sending. Sent outreach moves to Sent automatically.</p></div><strong>{rows.length} active</strong></header>
    {params.sendError?<p role="alert" className="block-message send-result">{humanSendError(params.sendError)}</p>:null}<GmailReadinessPanel connectionState={workflow.gmail.connectionState} readiness={workflow.gmail.readiness}/>
    <section className="product-section"><div className="inbox-list" aria-label="Unsent drafts">{rows.length===0?<p className="empty">No active drafts.</p>:rows.map(({review,state})=>{const sendBlock=gmailSendBlockReason(review,workflow.gmail.readiness),manual=outreach.find((entry)=>entry.snapshotId===review.snapshotId&&!entry.manualSendConfirmed);return <article className="inbox-row" key={review.snapshotId}>
      <div><strong>{review.recipient}</strong><span>{review.company} · {review.title}</span></div><span>{review.outreachTrack}</span><span>{stateLabel[state]}</span>
      <details><summary>Review message</summary><div className="draft-preview"><p><strong>Subject:</strong> {review.subject}</p><pre>{review.body}</pre></div></details>
      <div className="row-action">{state==="ready"?(review.blockedReason?<p className="block-message">{humanDraftError(review.blockedReason)}</p>:<form action={approveDraft}><input type="hidden" name="snapshotId" value={review.snapshotId}/><button className="simulate-button">Approve</button></form>):state==="approved"?<GmailDraftControl snapshotId={review.snapshotId} readiness={workflow.gmail.readiness} action={createGmailDraft}/>:state==="gmail-draft-created"?(sendBlock?<p className="block-message">{humanSendError(sendBlock)}</p>:<><GmailSendControl snapshotId={review.snapshotId} recipient={review.recipient} company={review.company} subject={review.subject} track={review.outreachTrack} action={sendGmailDraft}/>{manual?<details className="manual-fallback"><summary>I already sent this</summary><form action={confirmAlreadySent}><input type="hidden" name="id" value={manual.operatorId}/><input type="datetime-local" name="sentAt" required/><button name="confirmation" value="confirmed">Record manual send</button></form></details>:null}</>):<GmailReconciliationControl snapshotId={review.snapshotId} action={reconcileGmailSendStatus}/>}</div>
    </article>;})}</div></section>
  </main>;
}

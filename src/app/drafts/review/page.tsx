import Link from "next/link";
import {notFound} from "next/navigation";
import {humanDraftError,humanEditError} from "@/application/command-center-drafts";
import {humanSelectionReason} from "@/application/product-workflow";
import {loadCommandCenterDraftReviews} from "@/infrastructure/sqlite/command-center-drafts";
import {ProductNav} from "@/app/product-nav";
import {approveEditedDraft} from "@/app/today/actions";

export const dynamic="force-dynamic";
export default async function DraftReviewPage({searchParams}:{searchParams:Promise<{candidate?:string;error?:string}>}){
  const {candidate,error}=await searchParams;
  const candidateId=decodeURIComponent(candidate??"");
  const workflow=await loadCommandCenterDraftReviews();
  const review=workflow.items.find((item)=>item.candidateId===candidateId);
  if(!review||(review.operation&&review.operation.state!=="failed"))notFound();
  return <main>
    <ProductNav current="drafts"/>
    <header className="product-header compact-header"><div><Link className="back-link" href="/drafts">← Drafts</Link><h1>Review message</h1><p>{review.recipient} · {review.company} · {review.title}</p></div></header>
    <section className="review-layout">
      <aside><h2>Why this person</h2><p>{humanSelectionReason(review.whySelected)}</p><dl><div><dt>Track</dt><dd>{review.outreachTrack}</dd></div><div><dt>Role family</dt><dd>{review.lane==="product-management"?"Product":review.primaryFunction.replaceAll("-"," ")}</dd></div><div><dt>Email</dt><dd>Professionally verified</dd></div></dl></aside>
      <form action={approveEditedDraft} className="message-editor">
        <input type="hidden" name="snapshotId" value={review.snapshotId}/><input type="hidden" name="candidateId" value={review.candidateId}/>
        <div className="editor-heading"><div><p className="kicker">Message</p><h2>Edit before approval</h2></div><span>{review.wordCount} words</span></div>
        {review.blockedReason?<p role="alert" className="block-message">{humanDraftError(review.blockedReason)}</p>:null}{error?<p role="alert" className="block-message">{humanEditError(error)}</p>:null}
        <label>Subject<input name="subject" defaultValue={review.subject} required maxLength={64}/></label><label>Body<textarea name="body" defaultValue={review.body} required rows={14}/></label>
        <p className="form-help">Approval locks this exact subject and body. Keep one clear question and avoid em dashes.</p><button className="primary-action" disabled={Boolean(review.blockedReason)}>Approve message</button>
      </form>
    </section>
  </main>;
}

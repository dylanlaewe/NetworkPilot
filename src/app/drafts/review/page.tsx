import Link from "next/link";
import {notFound} from "next/navigation";
import {humanDraftError,humanEditError} from "@/application/command-center-drafts";
import {humanSelectionReason} from "@/application/product-workflow";
import {loadCommandCenterDraftReviews} from "@/infrastructure/sqlite/command-center-drafts";
import {ProductNav} from "@/app/product-nav";
import {approveEditedDraft} from "@/app/today/actions";
import {suggestedResumeId} from "@/application/resumes";

export const dynamic="force-dynamic";
export default async function DraftReviewPage({searchParams}:{searchParams:Promise<{candidate?:string;error?:string}>}){
  const {candidate,error}=await searchParams;
  const candidateId=decodeURIComponent(candidate??"");
  const workflow=await loadCommandCenterDraftReviews();
  const review=workflow.items.find((item)=>item.candidateId===candidateId);
  if(!review||(review.operation&&review.operation.state!=="failed"))notFound();
  const activeResumes=workflow.resumes.filter(item=>item.active),suggestionLane=review.outreachTrack==="recruiter"&&/\bproduct\b/i.test(review.title)?"product-management":review.lane,suggested=suggestedResumeId({track:review.outreachTrack,lane:suggestionLane,resumes:activeResumes}),suggestedResume=activeResumes.find(item=>item.id===suggested);
  return <main className="product-shell review-page">
    <ProductNav current="drafts"/>
    <header id="workspace-content" tabIndex={-1} className="product-header compact-header"><div><Link scroll={false} className="back-link" href="/drafts">← Drafts</Link><h1>Review message</h1><p>{review.recipient} · {review.company} · {review.title}</p></div></header>
    <section className="review-layout">
      <aside><h2>Why this person</h2><p>{humanSelectionReason(review.whySelected)}</p><dl><div><dt>Track</dt><dd>{review.outreachTrack}</dd></div><div><dt>Role family</dt><dd>{review.lane==="product-management"?"Product":review.primaryFunction.replaceAll("-"," ")}</dd></div><div><dt>Email</dt><dd>Professionally verified</dd></div></dl></aside>
      <form action={approveEditedDraft} className="message-editor">
        <input type="hidden" name="snapshotId" value={review.snapshotId}/><input type="hidden" name="candidateId" value={review.candidateId}/>
        <div className="editor-heading"><div><span className="field-caption">To</span><h2>{review.recipient}</h2><p>{review.company}</p></div><span>Editable draft</span></div>
        {review.blockedReason?<p role="alert" className="block-message">{humanDraftError(review.blockedReason)}</p>:null}{error?<p role="alert" className="block-message">{humanEditError(error)}</p>:null}
        <label className="subject-field">Subject<input name="subject" defaultValue={review.subject} required maxLength={64}/></label><label className="body-field">Message<textarea name="body" defaultValue={review.body} required rows={14}/></label><label className="resume-selection">Attach resume<select name="resumeId" defaultValue=""><option value="">None</option>{activeResumes.map(item=><option key={item.id} value={item.id}>{item.displayLabel}</option>)}</select>{suggestedResume?<small>Suggested for this recruiter message: {suggestedResume.displayLabel}. Nothing is attached unless you select it.</small>:<small>Optional. Nothing is attached by default.</small>}</label>
        <footer className="editor-footer"><p className="form-help">Approval locks this subject and body. One clear question, no em dashes.</p><button className="primary-action" disabled={Boolean(review.blockedReason)}>Approve message</button></footer>
      </form>
    </section>
  </main>;
}

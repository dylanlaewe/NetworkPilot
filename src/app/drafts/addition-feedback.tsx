import Link from "next/link";

export function DraftAdditionFeedback({added,requested,remaining}:{added:number;requested:number;remaining:number}){
  const message=added===0
    ? "No drafts could be created. No candidates are ready right now."
    : added<requested
      ? `${added} of ${requested} drafts created. ${remaining===0?"No more candidates are ready.":"Some candidates still need attention."}`
      : `${added} ${added===1?"draft":"drafts"} created.`;
  return <div role="status" className="refresh-result"><strong>{message}</strong>{remaining===0||added<requested?<Link className="primary-action" href="/candidates">Find people</Link>:null}</div>;
}

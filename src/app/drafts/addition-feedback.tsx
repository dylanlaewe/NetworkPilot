import Link from "next/link";
import {draftAdditionMessage} from "@/application/daily-refresh/addition-feedback";

export function DraftAdditionFeedback({added,requested,remaining}:{added:number;requested:number;remaining:number}){
  return <div role="status" className="refresh-result"><strong>{draftAdditionMessage(added,requested,remaining)}</strong>{remaining===0||added<requested?<Link className="primary-action" href="/candidates">Refresh Candidates</Link>:null}</div>;
}

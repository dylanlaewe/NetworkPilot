import {humanDraftError,type GmailDraftReadiness} from "@/application/command-center-drafts";

export function GmailDraftControl({snapshotId,readiness,action}:{snapshotId:string;readiness:GmailDraftReadiness;action:(formData:FormData)=>void|Promise<void>}){
  return <form action={action}>
    <input type="hidden" name="snapshotId" value={snapshotId}/>
    <button className="simulate-button" disabled={!readiness.available}>Create Gmail Draft</button>
    {readiness.reason
      ? <p role="status" className="block-message">{humanDraftError(readiness.reason)}</p>
      : <small>Creates one Gmail draft from this immutable approved message. It never sends email.</small>}
  </form>;
}

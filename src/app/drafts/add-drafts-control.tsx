export function AddDraftsControl({action}:{action:(form:FormData)=>void|Promise<void>}){
  return <details className="add-drafts"><summary>Create drafts</summary><div className="add-drafts-panel">
    <p>Create messages for candidates who are already ready. Your edits, attachments, and queue order stay intact. No Apollo call.</p>
    <form action={action}><button name="additionalDraftCount" value="5">Create 5</button><button name="additionalDraftCount" value="10">Create 10</button></form>
    <form action={action}><label>Custom (1–20)<input name="additionalDraftCount" type="number" min="1" max="20" defaultValue="5" required/></label><button>Create custom</button></form>
  </div></details>;
}

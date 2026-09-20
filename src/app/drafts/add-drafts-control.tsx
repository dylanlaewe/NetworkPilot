export function AddDraftsControl({action}:{action:(form:FormData)=>void|Promise<void>}){
  return <details className="add-drafts"><summary>Add Drafts</summary><div className="add-drafts-panel">
    <p>Use your available candidates. Each count adds new drafts without replacing your queue. No search credits needed.</p>
    <form action={action}><button name="additionalDraftCount" value="5">Add 5</button><button name="additionalDraftCount" value="10">Add 10</button></form>
    <form action={action}><label>Custom (1–20)<input name="additionalDraftCount" type="number" min="1" max="20" defaultValue="5" required/></label><button>Add custom</button></form>
  </div></details>;
}

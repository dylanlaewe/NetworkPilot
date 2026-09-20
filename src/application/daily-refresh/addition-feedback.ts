import type {DraftAdditionMetrics} from ".";

export function draftAdditionDestination(result:DraftAdditionMetrics):string{
  return `/drafts?${new URLSearchParams({added:String(result.addedCount),requested:String(result.additionalDraftCount),reserveRemaining:String(result.eligibleReserveRemaining)})}`;
}
export function draftAdditionMessage(added:number,requested:number,remaining:number):string{
  if(added===0)return "No eligible candidates are available right now.";
  const message=`${added} ${added===1?"draft":"drafts"} added.`;
  if(remaining===0)return `${message} Your available candidate reserve is exhausted.`;
  if(added<requested)return `${message} Refresh candidates to find more.`;
  return message;
}

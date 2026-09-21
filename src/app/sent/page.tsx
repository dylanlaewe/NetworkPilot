import {sentOutreach} from "@/application/product-workflow";
import {NetworkCommandShell} from "@/app/network-command-shell";
import {loadRelationshipWorkspace} from "@/infrastructure/sqlite/relationship-workspace";
import {RelationshipWorkspace} from "./relationship-workspace";
import {isDemoMode} from "@/demo/mode";
import {DEMO_RELATIONSHIPS} from "@/demo/network-command-c3";
export const dynamic="force-dynamic";

export default async function SentPage({searchParams}:{searchParams:Promise<{outcome?:string;relationship?:string}>}){
  const params=await searchParams,all=sentOutreach(isDemoMode()?DEMO_RELATIONSHIPS:loadRelationshipWorkspace()),rows=params.outcome?all.filter(row=>row.outcome===params.outcome):all;
  const awaiting=all.filter(row=>row.outcome==="awaiting-response").length,attention=all.filter(row=>row.outcome==="replied"||row.outcome==="meeting-scheduled").length;
  return <NetworkCommandShell current="sent" status={`${awaiting} awaiting reply · ${attention} active relationships`}><RelationshipWorkspace rows={rows} total={all.length} outcome={params.outcome} initialSelectedId={params.relationship}/></NetworkCommandShell>;
}

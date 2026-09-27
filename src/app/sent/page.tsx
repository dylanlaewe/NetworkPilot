import {sentOutreach} from "@/application/product-workflow";
import {NetworkCommandShell} from "@/app/network-command-shell";
import {loadRelationshipWorkspace} from "@/infrastructure/sqlite/relationship-workspace";
import {RelationshipWorkspace} from "./relationship-workspace";
import {isDemoMode} from "@/demo/mode";
import {DEMO_RELATIONSHIPS} from "@/demo/network-command-c3";
import {fiveBucketEnabled,RECIPIENT_BUCKETS} from "@/domain/recipient-buckets";
import type {BucketSelection,RecipientBucketCounts} from "@/app/recipient-bucket-navigation";
export const dynamic="force-dynamic";

export default async function SentPage({searchParams}:{searchParams:Promise<{outcome?:string;relationship?:string;bucket?:string}>}){
  const params=await searchParams,all=sentOutreach(isDemoMode()?DEMO_RELATIONSHIPS:loadRelationshipWorkspace()),byOutcome=params.outcome?all.filter(row=>row.outcome===params.outcome):all,bucketEnabled=fiveBucketEnabled(),requested=params.bucket??"all",selected:BucketSelection=requested==="legacy"||requested==="all"||RECIPIENT_BUCKETS.includes(requested as typeof RECIPIENT_BUCKETS[number])?requested as BucketSelection:"all",rows=!bucketEnabled||selected==="all"?byOutcome:selected==="legacy"?byOutcome.filter(row=>!row.historicalRecipientBucket?.bucket):byOutcome.filter(row=>row.historicalRecipientBucket?.bucket===selected),bucketCounts=Object.fromEntries(RECIPIENT_BUCKETS.map(bucket=>[bucket,byOutcome.filter(row=>row.historicalRecipientBucket?.bucket===bucket).length])) as RecipientBucketCounts;
  const awaiting=all.filter(row=>row.outcome==="awaiting-response").length,attention=all.filter(row=>row.outcome==="replied"||row.outcome==="meeting-scheduled").length;
  const bucketNavigation=bucketEnabled?{enabled:true as const,current:"sent" as const,selected,counts:bucketCounts,total:byOutcome.length,legacyCount:byOutcome.filter(row=>!row.historicalRecipientBucket?.bucket).length,preservedQuery:{outcome:params.outcome}}:undefined;
  return <NetworkCommandShell current="sent" status={`${awaiting} awaiting reply · ${attention} active relationships`} bucketNavigation={bucketNavigation}><RelationshipWorkspace rows={rows} total={rows.length} hasAny={all.length>0} outcome={params.outcome} initialSelectedId={params.relationship} showHistoricalBucket={bucketEnabled} bucket={selected}/></NetworkCommandShell>;
}

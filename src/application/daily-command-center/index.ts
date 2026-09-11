import type { ManualDraftOperatorEntry, ManualOutreachOutcome } from "@/application/manual-outreach";

export const DAILY_SOURCE_REQUEST_CAP = 46;
export const DAILY_ENRICHMENT_CAP = 30;
export const DAILY_RECOMMENDATION_CAP = 5;

export type ReserveStage = "search-only" | "enriched-unqualified" | "qualified-available" | "cooldown" | "suppressed" | "already-contacted";
export interface ReserveCandidate { id:string; recipient:string; company:string; title:string; industry:string; functionName:string; persona:string; score:number; stage:ReserveStage; }
export interface DailyCommandCenterState {
  outreach:{attempted:number;replyEligible:number;outcomes:Record<ManualOutreachOutcome,number>;bounceRate:number};
  pipeline:{sourced:number;preEnrichment:number;enriched:number;qualified:number;available:number;gmailDraftCreated:number;manuallySent:number};
  drafts:ManualDraftOperatorEntry[];
  reserve:ReserveCandidate[];
  recommendation:ReserveCandidate[];
  safety:{suppressed:number;cooldownCompanies:number;gmailState:string;apolloEnabled:boolean;apolloExposure:number;apolloObserved:number|null};
}

const outcomes:ManualOutreachOutcome[]=["awaiting-response","replied","meeting-scheduled","declined","opt-out","no-response","hard-bounce"];
export function buildDailyCommandCenter(input:{drafts:ManualDraftOperatorEntry[];reserve:ReserveCandidate[];gmailState:string;apolloEnabled:boolean;apolloExposure:number;apolloObserved:number|null;cooldownCompanies:number}):DailyCommandCenterState{
  const counts=Object.fromEntries(outcomes.map((outcome)=>[outcome,input.drafts.filter((d)=>d.outcome===outcome).length])) as Record<ManualOutreachOutcome,number>;
  const attempted=input.drafts.filter((d)=>d.manualSendConfirmed).length,hardBounces=counts["hard-bounce"];
  const candidates=[...input.reserve].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const recommendation:ReserveCandidate[]=[];const companies=new Set<string>(),functions=new Set<string>();
  for(const candidate of candidates){if(candidate.stage!=="qualified-available"||companies.has(candidate.company))continue;const addsFunction=!functions.has(candidate.functionName);if(recommendation.length<2||addsFunction||functions.size>=3){recommendation.push(candidate);companies.add(candidate.company);functions.add(candidate.functionName);}if(recommendation.length===DAILY_RECOMMENDATION_CAP)break;}
  return{outreach:{attempted,replyEligible:attempted-hardBounces,outcomes:counts,bounceRate:attempted?hardBounces/attempted:0},pipeline:{sourced:candidates.length,preEnrichment:candidates.filter((c)=>c.stage==="search-only").length,enriched:candidates.filter((c)=>c.stage!=="search-only").length,qualified:candidates.filter((c)=>["qualified-available","cooldown","already-contacted"].includes(c.stage)).length,available:candidates.filter((c)=>c.stage==="qualified-available").length,gmailDraftCreated:input.drafts.length,manuallySent:attempted},drafts:input.drafts,reserve:candidates,recommendation,safety:{suppressed:candidates.filter((c)=>c.stage==="suppressed").length,cooldownCompanies:input.cooldownCompanies,gmailState:input.gmailState,apolloEnabled:input.apolloEnabled,apolloExposure:input.apolloExposure,apolloObserved:input.apolloObserved}};
}

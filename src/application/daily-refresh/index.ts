export const DAILY_REFRESH_TOTAL_TARGET=15;
export const DAILY_REFRESH_PROFESSIONAL_TARGET=10;
export const DAILY_REFRESH_RECRUITER_TARGET=5;
export const DAILY_REFRESH_ENRICHMENT_CAP=20;

export type OutreachTrack="professional"|"recruiter";
export type CompanyKind="preferred"|"discovered";
export interface RefreshCandidate {id:string;company:string;track:OutreachTrack;score:number;available:boolean;companyKind?:CompanyKind;}
export interface DailyRefreshResult {id:string;campaignDate:string;generation:number;createdAt:string;candidateIds:string[];professionalCount:number;recruiterCount:number;target:number;shortfall:number;reserveCount:number;providerUsed:boolean;enrichmentAttempts:number;creditBefore:number|null;creditAfter:number|null;warning:string|null;}
export interface DailyRefreshRepository {findLatest(campaignDate:string):DailyRefreshResult|null;save(result:DailyRefreshResult):void;}
export interface DailyRefreshReplenisher {replenish(maximum:number):Promise<{candidates:RefreshCandidate[];attempts:number;searchCalls?:number;creditBefore:number|null;creditAfter:number|null}>;}

export const localCampaignDate=(now:Date)=>{
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).formatToParts(now),value=(type:string)=>parts.find((part)=>part.type===type)?.value??"";
  let date=`${value("year")}-${value("month")}-${value("day")}`;const weekday=value("weekday");if(weekday==="Sat"||weekday==="Sun"){const next=new Date(now);next.setUTCDate(next.getUTCDate()+(weekday==="Sat"?2:1));date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(next);}return date;
};

export function planTrackAwareCandidates(candidates:readonly RefreshCandidate[]):RefreshCandidate[]{
  const eligible=[...candidates].filter((candidate)=>candidate.available).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)),selected:RefreshCandidate[]=[],companies=new Set<string>(),people=new Set<string>();
  const add=(track:OutreachTrack,maximum:number)=>{for(const candidate of eligible){if(selected.filter((item)=>item.track===track).length>=maximum)break;if(candidate.track!==track||companies.has(candidate.company)||people.has(candidate.id))continue;selected.push(candidate);companies.add(candidate.company);people.add(candidate.id);}};
  // Recruiter supply is intentionally scarcer, so reserve its five slots before
  // filling the larger Professional allocation. Score ordering remains stable
  // within each track and company uniqueness still spans the combined plan.
  add("recruiter",DAILY_REFRESH_RECRUITER_TARGET);add("professional",DAILY_REFRESH_PROFESSIONAL_TARGET);
  for(const candidate of eligible){if(selected.length>=DAILY_REFRESH_TOTAL_TARGET)break;if(people.has(candidate.id)||companies.has(candidate.company))continue;selected.push(candidate);companies.add(candidate.company);people.add(candidate.id);}
  return selected;
}

export const NEXT_DRAFT_BATCH_TARGET=5;
export const NEXT_DRAFT_PROFESSIONAL_TARGET=3;
export const NEXT_DRAFT_RECRUITER_TARGET=2;
export const NEXT_DRAFT_PREFERRED_MAXIMUM=2;
export function planNextDraftBatch(candidates:readonly RefreshCandidate[],target=NEXT_DRAFT_BATCH_TARGET):RefreshCandidate[]{
  if(!Number.isInteger(target)||target<1||target>20)throw new Error("draft-batch-size-invalid");
  const eligible=[...candidates].filter((candidate)=>candidate.available).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const selected:RefreshCandidate[]=[],companies=new Set<string>(),people=new Set<string>();
  const recruiterTarget=Math.round(target*.4),professionalTarget=target-recruiterTarget,preferredMaximum=Math.ceil(target*.4);
  const add=(predicate:(candidate:RefreshCandidate)=>boolean,maximum:number)=>{for(const candidate of eligible){if(selected.length>=target||maximum<=0)break;if(!predicate(candidate)||people.has(candidate.id)||companies.has(candidate.company))continue;selected.push(candidate);people.add(candidate.id);companies.add(candidate.company);maximum--;}};
  add((candidate)=>candidate.track==="recruiter"&&candidate.companyKind==="discovered",recruiterTarget);
  add((candidate)=>candidate.track==="recruiter",recruiterTarget-selected.filter((item)=>item.track==="recruiter").length);
  add((candidate)=>candidate.track==="professional"&&candidate.companyKind==="discovered",professionalTarget);
  add((candidate)=>candidate.track==="professional",professionalTarget-selected.filter((item)=>item.track==="professional").length);
  add((candidate)=>candidate.companyKind==="discovered",target-selected.length);
  add((candidate)=>candidate.companyKind!=="preferred"||selected.filter((item)=>item.companyKind==="preferred").length<preferredMaximum,target-selected.length);
  add(()=>true,target-selected.length);
  return selected;
}

export async function refreshDailyPipeline(input:{repository:DailyRefreshRepository;candidates:RefreshCandidate[];now:()=>Date;replenisher?:DailyRefreshReplenisher;allowProvider:boolean;force?:boolean}):Promise<DailyRefreshResult>{
  const now=input.now(),campaignDate=localCampaignDate(now),existing=input.repository.findLatest(campaignDate);if(existing&&!input.force)return existing;if(input.force&&!input.allowProvider)throw new Error("refresh-again-explicit-confirmation-required");
  const reserveCount=input.candidates.filter((candidate)=>candidate.available).length;let candidates=[...input.candidates],selected=planTrackAwareCandidates(candidates),providerUsed=false,enrichmentAttempts=0,creditBefore:null|number=null,creditAfter:null|number=null,warning:null|string=null;
  if(selected.length<DAILY_REFRESH_TOTAL_TARGET&&input.allowProvider&&input.replenisher){const replenished=await input.replenisher.replenish(DAILY_REFRESH_ENRICHMENT_CAP);if(replenished.attempts>DAILY_REFRESH_ENRICHMENT_CAP)throw new Error("daily-refresh-enrichment-cap-exceeded");providerUsed=replenished.attempts>0;enrichmentAttempts=replenished.attempts;creditBefore=replenished.creditBefore;creditAfter=replenished.creditAfter;candidates=candidates.concat(replenished.candidates);selected=planTrackAwareCandidates(candidates);if(creditBefore!==null&&creditAfter!==null&&creditAfter-creditBefore>enrichmentAttempts)warning="Apollo credit use differed from the expected one-credit-per-enrichment model. Further enrichment was stopped.";}
  const result:DailyRefreshResult={id:`${campaignDate}:${(existing?.generation??0)+1}`,campaignDate,generation:(existing?.generation??0)+1,createdAt:now.toISOString(),candidateIds:selected.map((candidate)=>candidate.id),professionalCount:selected.filter((candidate)=>candidate.track==="professional").length,recruiterCount:selected.filter((candidate)=>candidate.track==="recruiter").length,target:DAILY_REFRESH_TOTAL_TARGET,shortfall:DAILY_REFRESH_TOTAL_TARGET-selected.length,reserveCount,providerUsed,enrichmentAttempts,creditBefore,creditAfter,warning};input.repository.save(result);return result;
}

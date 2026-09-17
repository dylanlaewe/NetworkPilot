export const DEFAULT_RESERVE_TARGET=40;
export const DEFAULT_REFRESH_PROVIDER_CAP=20;
export interface CandidateRefreshPlan {usableBefore:number;target:number;deficit:number;providerCap:number;maximumProviderUsage:number;providerRequired:boolean;}
export interface CandidateRefreshResult extends CandidateRefreshPlan {id:string;createdAt:string;searchCalls:number;enrichmentCreditsUsed:number;candidatesAdded:number;qualifiedCandidatesAdded:number;usableAfter:number;}
export interface CandidateRefreshRepository {saveCandidateRefresh(result:CandidateRefreshResult):void;}
export interface CandidateRefreshProvider {replenish(maximum:number):Promise<{candidates:Array<{available:boolean}>;attempts:number;searchCalls?:number}>;}

export function planCandidateRefresh(usableBefore:number,target=DEFAULT_RESERVE_TARGET,providerCap=DEFAULT_REFRESH_PROVIDER_CAP):CandidateRefreshPlan{
  if(!Number.isInteger(usableBefore)||usableBefore<0||!Number.isInteger(target)||target<1||!Number.isInteger(providerCap)||providerCap<0)throw new Error("candidate-refresh-configuration-invalid");
  const deficit=Math.max(0,target-usableBefore);return{usableBefore,target,deficit,providerCap,maximumProviderUsage:Math.min(deficit,providerCap),providerRequired:deficit>0};
}
export async function refreshCandidateReserve(input:{usableBefore:number;repository:CandidateRefreshRepository;provider?:CandidateRefreshProvider;allowProvider:boolean;now:()=>Date;target?:number;providerCap?:number}):Promise<CandidateRefreshResult>{
  const plan=planCandidateRefresh(input.usableBefore,input.target,input.providerCap),id=`candidate-refresh:${input.now().toISOString()}`;let attempts=0,searchCalls=0,candidatesAdded=0,qualifiedCandidatesAdded=0;
  if(plan.providerRequired&&input.allowProvider&&input.provider&&plan.maximumProviderUsage>0){const supplied=await input.provider.replenish(plan.maximumProviderUsage);if(supplied.attempts>plan.maximumProviderUsage)throw new Error("candidate-refresh-provider-cap-exceeded");attempts=supplied.attempts;searchCalls=supplied.searchCalls??0;candidatesAdded=supplied.candidates.length;qualifiedCandidatesAdded=supplied.candidates.filter((candidate)=>candidate.available).length;}
  const result={...plan,id,createdAt:input.now().toISOString(),searchCalls,enrichmentCreditsUsed:attempts,candidatesAdded,qualifiedCandidatesAdded,usableAfter:input.usableBefore+qualifiedCandidatesAdded};input.repository.saveCandidateRefresh(result);return result;
}

import type { ScoreComponent, TargetCandidate, TargetingScore, TargetingWeights } from "./types";

export const TARGETING_SCORE_VERSION = "targeting-v1";
export const DEFAULT_TARGETING_WEIGHTS: TargetingWeights = { companyDesirability: 22, desiredRoleAlignment: 20, recipientFunctionalRelevance: 16, recipientExperience: 12, industryPriority: 10, geographicRelevance: 7, sharedSignal: 7, dataQuality: 6 };

export function validateWeights(weights: TargetingWeights): void {
  const values = Object.values(weights);
  if (values.some((value)=>!Number.isFinite(value)||value<0)) throw new RangeError("Targeting weights must be finite and non-negative");
  if (values.reduce((sum,value)=>sum+value,0)!==100) throw new RangeError("Targeting weights must total 100");
}
const bounded=(value:number)=>Math.max(0,Math.min(100,value));
export function scoreTarget(candidate: TargetCandidate, weights: TargetingWeights=DEFAULT_TARGETING_WEIGHTS): TargetingScore {
  validateWeights(weights);
  if (!candidate.company) return { eligible:false,total:0,version:TARGETING_SCORE_VERSION,components:[],explanationCodes:["company-unknown"],rejectionCode:"company-unknown" };
  if (!candidate.company.enabled || candidate.company.tier==="excluded" || candidate.company.tier==="unreviewed") return { eligible:false,total:0,version:TARGETING_SCORE_VERSION,components:[],explanationCodes:["company-prohibited"],rejectionCode:"company-prohibited" };
  if (!candidate.role.enabled) return { eligible:false,total:0,version:TARGETING_SCORE_VERSION,components:[],explanationCodes:["role-disabled"],rejectionCode:"role-disabled" };
  if (!candidate.persona.enabled) return { eligible:false,total:0,version:TARGETING_SCORE_VERSION,components:[],explanationCodes:["persona-disabled"],rejectionCode:"persona-disabled" };
  if (!candidate.industry.enabled) return { eligible:false,total:0,version:TARGETING_SCORE_VERSION,components:[],explanationCodes:["industry-disabled"],rejectionCode:"industry-disabled" };
  if (candidate.company.tier==="tier-3" && candidate.roleSpecificUpside<85) return { eligible:false,total:0,version:TARGETING_SCORE_VERSION,components:[],explanationCodes:["tier-3-needs-exceptional-fit"],rejectionCode:"tier-3-needs-exceptional-fit" };
  const experienceFit = candidate.yearsExperience<5?20:candidate.yearsExperience<=20?100:65;
  const experience = experienceFit*.7+candidate.persona.priority*.3;
  const tierAdjustment=candidate.company.tier==="tier-1"?5:candidate.company.tier==="tier-3"?-15:0;
  const companyValue=(candidate.company.recognitionScore+candidate.company.careerUpsideScore+candidate.company.technicalInterestScore)/3+tierAdjustment;
  const definitions: Array<[ScoreComponent["id"],number,number,string]> = [
    ["company-desirability",companyValue,weights.companyDesirability,"company-reviewed-and-desirable"],["desired-role-alignment",candidate.roleAlignment,weights.desiredRoleAlignment,"current-role-fit"],["recipient-functional-relevance",candidate.functionalRelevance,weights.recipientFunctionalRelevance,"recipient-function-relevant"],["recipient-experience",experience,weights.recipientExperience,"recipient-has-experience-advantage"],["industry-priority",candidate.industry.score,weights.industryPriority,candidate.industry.tier==="primary"?"primary-industry":"secondary-industry"],["geographic-relevance",candidate.geographyScore,weights.geographicRelevance,"geography-preference"],["shared-signal",candidate.sharedSignal,weights.sharedSignal,"shared-career-signal"],["data-quality",candidate.dataQuality,weights.dataQuality,"data-complete"],
  ];
  const components=definitions.map(([id,raw,weight,explanationCode])=>({id,raw:bounded(raw),weight,weighted:bounded(raw)*weight/100,explanationCode}));
  return { eligible:true,total:Number(components.reduce((sum,c)=>sum+c.weighted,0).toFixed(2)),version:TARGETING_SCORE_VERSION,components,explanationCodes:components.map((c)=>c.explanationCode) };
}
export function rankTargets(candidates:TargetCandidate[],weights:TargetingWeights=DEFAULT_TARGETING_WEIGHTS):Array<{candidate:TargetCandidate;score:TargetingScore}>{return candidates.map((candidate)=>({candidate,score:scoreTarget(candidate,weights)})).sort((a,b)=>Number(b.score.eligible)-Number(a.score.eligible)||b.score.total-a.score.total||a.candidate.id.localeCompare(b.candidate.id));}

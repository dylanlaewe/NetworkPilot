import type { ExperienceEvidence,ExperienceInterpretation,SpecificRoleClassification } from "./types";

export const ROLE_CLASSIFICATION_VERSION="role-classification-v2" as const;
export const EXPERIENCE_INTERPRETATION_VERSION="experience-v1" as const;
export const SPECIFIC_ROLE_TAXONOMY={
  "data-analyst":"data-analytics","business-intelligence-analyst":"data-analytics","business-analyst":"business-delivery",
  "financial-analyst":"industry-professional","investment-analyst":"industry-professional","consulting-analyst":"industry-professional",
  "operations-analyst":"business-delivery","data-scientist":"data-analytics","data-engineer":"data-analytics",
  "analytics-engineer":"data-analytics","software-engineer":"technical-product","ai-ml-engineer":"technical-product",
  "project-coordinator":"business-delivery","project-manager":"business-delivery","program-analyst":"business-delivery","commodities-analyst":"industry-professional",
} as const;
export type SpecificRoleId=keyof typeof SPECIFIC_ROLE_TAXONOMY;
const canonical:Record<string,SpecificRoleId>={
  "data analyst":"data-analyst","business intelligence analyst":"business-intelligence-analyst","bi analyst":"business-intelligence-analyst",
  "business analyst":"business-analyst","financial analyst":"financial-analyst","finance analyst":"financial-analyst","investment analyst":"investment-analyst",
  "consulting analyst":"consulting-analyst","operations analyst":"operations-analyst","data scientist":"data-scientist","data engineer":"data-engineer",
  "analytics engineer":"analytics-engineer","software engineer":"software-engineer","ai engineer":"ai-ml-engineer","ml engineer":"ai-ml-engineer",
  "ai ml engineer":"ai-ml-engineer","machine learning engineer":"ai-ml-engineer","project coordinator":"project-coordinator",
  "project manager":"project-manager","program analyst":"program-analyst","technical program leader":"project-manager","commodities analyst":"commodities-analyst","analytics manager":"data-analyst",
};
const normalize=(value:string)=>value.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const modifiers=new Set(["senior","sr","lead","principal","staff","associate","asst"]);
export function classifySpecificRole(title:string):SpecificRoleClassification{
  const normalizedTitle=normalize(title); const tokens=normalizedTitle.split(" ").filter(Boolean);
  if(tokens.some((token)=>["chief","president","director","intern","junior"].includes(token))||tokens.includes("vp")||normalizedTitle.includes("vice president"))return{normalizedTitle,specificRoleId:null,roleFamilyId:null,matchedSignals:[],classificationVersion:ROLE_CLASSIFICATION_VERSION,reviewCode:"prohibited-target-seniority"};
  const stripped=tokens.filter((token)=>!modifiers.has(token)).join(" ");
  const matches=new Set<SpecificRoleId>();
  for(const [phrase,id] of Object.entries(canonical))if(stripped===phrase||stripped===`${phrase} associate`||stripped===`associate ${phrase}`)matches.add(id);
  if(matches.size!==1)return{normalizedTitle,specificRoleId:null,roleFamilyId:null,matchedSignals:[],classificationVersion:ROLE_CLASSIFICATION_VERSION,reviewCode:matches.size?"role-title-ambiguous":"role-title-unknown"};
  const specificRoleId=[...matches][0];
  return{normalizedTitle,specificRoleId,roleFamilyId:SPECIFIC_ROLE_TAXONOMY[specificRoleId],matchedSignals:[`exact-title:${stripped}`],classificationVersion:ROLE_CLASSIFICATION_VERSION,reviewCode:null};
}
export function interpretExperience(evidence:readonly ExperienceEvidence[]):ExperienceInterpretation{
  const valid=evidence.filter((item)=>item.kind==="unknown"||(item.kind==="range"?Number.isFinite(item.minimum)&&Number.isFinite(item.maximum)&&item.minimum>=0&&item.maximum>=item.minimum:Number.isFinite(item.years)&&item.years>=0));
  if(!valid.length||valid.every((item)=>item.kind==="unknown"))return{minimumSupportedYears:null,maximumSupportedYears:null,kind:"unknown",evidence:[...evidence],interpretationVersion:EXPERIENCE_INTERPRETATION_VERSION,confidence:"low",reviewState:"review-required",explanationCodes:["experience-unknown"]};
  const intervals=valid.filter((item)=>item.kind!=="unknown").map((item)=>item.kind==="range"?[item.minimum,item.maximum] as const:item.kind==="exact"?[item.years,item.years] as const:[Math.max(0,item.years-1),item.years+1] as const);
  const minimum=Math.max(...intervals.map(([min])=>min)),maximum=Math.min(...intervals.map(([,max])=>max));
  if(minimum>maximum)return{minimumSupportedYears:null,maximumSupportedYears:null,kind:"unknown",evidence:[...evidence],interpretationVersion:EXPERIENCE_INTERPRETATION_VERSION,confidence:"low",reviewState:"review-required",explanationCodes:["experience-evidence-conflict"]};
  const approximate=valid.some((item)=>item.kind==="approximate"); const exact=intervals.every(([min,max])=>min===max)&&minimum===maximum;
  return{minimumSupportedYears:minimum,maximumSupportedYears:maximum,kind:exact?"exact":approximate?"inferred":"bounded",evidence:[...evidence],interpretationVersion:EXPERIENCE_INTERPRETATION_VERSION,confidence:approximate?"medium":"high",reviewState:approximate?"review-required":"accepted",explanationCodes:[exact?"experience-exact":approximate?"experience-approximate":"experience-bounded"]};
}

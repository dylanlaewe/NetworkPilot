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
  if(tokens.some((token)=>["chief","president","intern","junior","founder","owner"].includes(token))||tokens.includes("vp")||normalizedTitle.includes("vice president"))return{normalizedTitle,specificRoleId:null,roleFamilyId:null,matchedSignals:[],classificationVersion:ROLE_CLASSIFICATION_VERSION,reviewCode:"prohibited-target-seniority"};
  const stripped=tokens.filter((token,index)=>!modifiers.has(token)&&token!=="director"&&!(token==="of"&&index>0&&tokens[index-1]==="director")).join(" ").replace("data engineering","data engineer");
  const matches=new Set<SpecificRoleId>();
  for(const [phrase,id] of Object.entries(canonical))if(stripped===phrase||stripped===`${phrase} associate`||stripped===`associate ${phrase}`)matches.add(id);
  if(matches.size!==1)return{normalizedTitle,specificRoleId:null,roleFamilyId:null,matchedSignals:[],classificationVersion:ROLE_CLASSIFICATION_VERSION,reviewCode:matches.size?"role-title-ambiguous":"role-title-unknown"};
  const specificRoleId=[...matches][0];
  return{normalizedTitle,specificRoleId,roleFamilyId:SPECIFIC_ROLE_TAXONOMY[specificRoleId],matchedSignals:[`exact-title:${stripped}`],classificationVersion:ROLE_CLASSIFICATION_VERSION,reviewCode:null};
}
export function interpretExperience(evidence:readonly ExperienceEvidence[]):ExperienceInterpretation{
  const historyInterval=(item:Extract<ExperienceEvidence,{kind:"employment-history"}>):readonly[number,number]|null=>{const reference=new Date(item.referenceDate);if(Number.isNaN(reference.getTime())||item.periods.length===0||item.periods.some((period)=>!period.startDate||(!period.endDate&&!period.current)))return null;const ranges=item.periods.map((period)=>{const start=new Date(`${period.startDate!.slice(0,10)}T00:00:00Z`),end=period.current?reference:new Date(`${period.endDate!.slice(0,10)}T00:00:00Z`);return[start.getTime(),end.getTime()] as const;});if(ranges.some(([start,end])=>Number.isNaN(start)||Number.isNaN(end)||end<start))return null;ranges.sort((a,b)=>a[0]-b[0]);const merged:Array<[number,number]>=[];for(const [start,end] of ranges){const last=merged.at(-1);if(last&&start<=last[1])last[1]=Math.max(last[1],end);else merged.push([start,end]);}const years=merged.reduce((sum,[start,end])=>sum+(end-start)/(365.2425*24*60*60*1000),0);return[Math.floor(years*100)/100,Math.ceil(years*100)/100];};
  const valid=evidence.filter((item)=>item.kind==="unknown"||item.kind==="employment-history"||(item.kind==="range"?Number.isFinite(item.minimum)&&Number.isFinite(item.maximum)&&item.minimum>=0&&item.maximum>=item.minimum:Number.isFinite(item.years)&&item.years>=0));
  if(!valid.length||valid.every((item)=>item.kind==="unknown"))return{minimumSupportedYears:null,maximumSupportedYears:null,kind:"unknown",evidence:[...evidence],interpretationVersion:EXPERIENCE_INTERPRETATION_VERSION,confidence:"low",reviewState:"review-required",explanationCodes:["experience-unknown"]};
  const missingHistory=valid.some((item)=>item.kind==="employment-history"&&!historyInterval(item));if(missingHistory)return{minimumSupportedYears:null,maximumSupportedYears:null,kind:"unknown",evidence:[...evidence],interpretationVersion:EXPERIENCE_INTERPRETATION_VERSION,confidence:"low",reviewState:"review-required",explanationCodes:["employment-history-incomplete"]};
  const intervals=valid.filter((item)=>item.kind!=="unknown").map((item)=>item.kind==="range"?[item.minimum,item.maximum] as const:item.kind==="exact"?[item.years,item.years] as const:item.kind==="approximate"?[Math.max(0,item.years-1),item.years+1] as const:historyInterval(item)!);
  const minimum=Math.max(...intervals.map(([min])=>min)),maximum=Math.min(...intervals.map(([,max])=>max));
  if(minimum>maximum)return{minimumSupportedYears:null,maximumSupportedYears:null,kind:"unknown",evidence:[...evidence],interpretationVersion:EXPERIENCE_INTERPRETATION_VERSION,confidence:"low",reviewState:"review-required",explanationCodes:["experience-evidence-conflict"]};
  const approximate=valid.some((item)=>item.kind==="approximate"),history=valid.some((item)=>item.kind==="employment-history"); const exact=intervals.every(([min,max])=>min===max)&&minimum===maximum;
  return{minimumSupportedYears:minimum,maximumSupportedYears:maximum,kind:exact?"exact":approximate||history?"inferred":"bounded",evidence:[...evidence],interpretationVersion:EXPERIENCE_INTERPRETATION_VERSION,confidence:approximate||history?"medium":"high",reviewState:approximate?"review-required":"accepted",explanationCodes:[exact?"experience-exact":approximate?"experience-approximate":history?"employment-history-interpreted":"experience-bounded"]};
}

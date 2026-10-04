import {RECRUITER_CLASSIFICATION_VERSION,RECRUITER_RELEVANCE_VERSION,type RecruiterClassification,type RecruiterType,type RecruitingDomain} from "./types";
import {hasAgencyConcept} from "./agency-vocabulary";

const normalize=(value:string)=>value.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const has=(value:string,phrases:readonly string[])=>phrases.some((phrase)=>` ${value} `.includes(` ${phrase} `));
const recruiterTitles=["recruiter","technical recruiter","talent acquisition","talent partner","technical talent partner","campus recruiter","university recruiter","early careers recruiter","emerging talent recruiter","engineering recruiter","recruiting lead","recruiting manager"];
const excludedTitles=["recruiting coordinator","sourcing coordinator","human resources","hr business partner","people operations","people partner","compensation","benefits","payroll","learning and development","dei","employer brand","chief human resources officer","chro","vp people","vp hr","vp talent","executive recruiter","executive search","clinical recruiter","healthcare recruiter","warehouse recruiter","retail recruiter","sales recruiter"];
const technical=["technical","technology","engineering","software","data","analytics","artificial intelligence"," ai ","machine learning"," ml ","product"];
const early=["campus","university","early career","early careers","emerging talent","graduate"];

export function classifyRecruiter(input:{title:string;employerName:string;internalCompanyMatch:boolean;minimumExperience:number|null;maximumExperience:number|null;reviewedInternalRecruiting?:boolean;reviewedRecruitingDomain?:RecruitingDomain}):RecruiterClassification{
  const title=normalize(input.title),employer=normalize(input.employerName),codes:string[]=[];
  const titleMatch=has(title,recruiterTitles),agency=hasAgencyConcept(employer),internal=input.internalCompanyMatch&&!agency,reviewedInternal=Boolean(input.reviewedInternalRecruiting&&input.reviewedRecruitingDomain&&["technical-data-ai","early-career","general"].includes(input.reviewedRecruitingDomain)&&internal),excluded=has(title,excludedTitles.filter(value=>!(reviewedInternal&&value==="executive recruiter")));
  const earlyCareerRelevance=has(title,early),technicalRelevance=technical.some((phrase)=>phrase.startsWith(" ")?` ${title} `.includes(phrase):has(title,[phrase]));
  const seniority=has(title,["coordinator","intern","assistant"])?"coordinator":has(title,["chief","vice president","vp","head of"])?"executive":has(title,["manager","lead"])?"manager":has(title,["senior","sr"])?"senior-recruiter":titleMatch?"recruiter":"unknown";
  const recruiterType:RecruiterType=earlyCareerRelevance?"early-career-recruiter":technicalRelevance?"technical-recruiter":has(title,["talent acquisition partner","talent partner"])?"talent-acquisition-partner":seniority==="manager"?"recruiting-manager":titleMatch?"general-recruiter":"ambiguous";
  const recruitingDomain:RecruitingDomain=reviewedInternal?input.reviewedRecruitingDomain!:earlyCareerRelevance?"early-career":technicalRelevance?"technical-data-ai":titleMatch?"general":"unknown";
  // Relationship-bucket eligibility is based on current recruiter role and
  // employer evidence. Total career history is not recruiter tenure and must
  // not impose the legacy 2–20 year recruiter-track cap.
  if(!titleMatch)codes.push("recruiter-title-ambiguous");if(excluded)codes.push("recruiter-title-excluded");if(agency)codes.push("recruiter-agency-employer");else if(!internal)codes.push("recruiter-employer-ambiguous");if(seniority==="coordinator"||seniority==="executive"&&!reviewedInternal)codes.push("recruiter-seniority-excluded");
  const accepted=titleMatch&&!excluded&&internal&&!agency&&seniority!=="coordinator"&&(seniority!=="executive"||reviewedInternal);
  const score=Math.max(0,Math.min(100,45+(internal?20:0)+(technicalRelevance?20:0)+(earlyCareerRelevance?15:0)+(seniority==="senior-recruiter"?5:seniority==="manager"?-5:0)-(recruitingDomain==="general"?10:0)));
  return{track:titleMatch?"recruiter":"professional",recruiterType,recruitingDomain,internalStatus:agency?"agency":internal?"internal":"ambiguous",seniority,technicalRelevance,earlyCareerRelevance,accepted,score,explanationCodes:codes.length?codes:["recruiter-qualified"],classificationVersion:RECRUITER_CLASSIFICATION_VERSION,relevanceVersion:RECRUITER_RELEVANCE_VERSION};
}

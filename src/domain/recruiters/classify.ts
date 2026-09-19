import {RECRUITER_CLASSIFICATION_VERSION,RECRUITER_RELEVANCE_VERSION,type RecruiterClassification,type RecruiterType,type RecruitingDomain} from "./types";

const normalize=(value:string)=>value.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const has=(value:string,phrases:readonly string[])=>phrases.some((phrase)=>` ${value} `.includes(` ${phrase} `));
const recruiterTitles=["recruiter","technical recruiter","talent acquisition","talent partner","technical talent partner","campus recruiter","university recruiter","early careers recruiter","emerging talent recruiter","engineering recruiter","recruiting lead","recruiting manager"];
const excludedTitles=["recruiting coordinator","sourcing coordinator","human resources","hr business partner","people operations","people partner","compensation","benefits","payroll","learning and development","dei","employer brand","chief human resources officer","chro","vp people","vp hr","vp talent","executive recruiter","executive search"];
const agencyEmployers=["staffing","recruitment agency","executive search","headhunter","talent solutions","search firm","rpo"];
const technical=["technical","technology","engineering","software","data","analytics","artificial intelligence"," ai ","machine learning"," ml ","product"];
const early=["campus","university","early career","early careers","emerging talent","graduate"];

export function classifyRecruiter(input:{title:string;employerName:string;internalCompanyMatch:boolean;minimumExperience:number|null;maximumExperience:number|null}):RecruiterClassification{
  const title=normalize(input.title),employer=normalize(input.employerName),codes:string[]=[];
  const titleMatch=has(title,recruiterTitles),excluded=has(title,excludedTitles),agency=has(employer,agencyEmployers),internal=input.internalCompanyMatch&&!agency;
  const earlyCareerRelevance=has(title,early),technicalRelevance=technical.some((phrase)=>phrase.startsWith(" ")?` ${title} `.includes(phrase):has(title,[phrase]));
  const seniority=has(title,["coordinator","intern","assistant"])?"coordinator":has(title,["chief","vice president","vp","head of"])?"executive":has(title,["manager","lead"])?"manager":has(title,["senior","sr"])?"senior-recruiter":titleMatch?"recruiter":"unknown";
  const recruiterType:RecruiterType=earlyCareerRelevance?"early-career-recruiter":technicalRelevance?"technical-recruiter":has(title,["talent acquisition partner","talent partner"])?"talent-acquisition-partner":seniority==="manager"?"recruiting-manager":titleMatch?"general-recruiter":"ambiguous";
  const recruitingDomain:RecruitingDomain=earlyCareerRelevance?"early-career":technicalRelevance?"technical-data-ai":titleMatch?"general":"unknown";
  const experiencePass=input.minimumExperience!==null&&input.maximumExperience!==null&&input.maximumExperience>=2&&input.minimumExperience<=20;
  if(!titleMatch)codes.push("recruiter-title-ambiguous");if(excluded)codes.push("recruiter-title-excluded");if(agency)codes.push("recruiter-agency-employer");else if(!internal)codes.push("recruiter-employer-ambiguous");if(seniority==="coordinator"||seniority==="executive")codes.push("recruiter-seniority-excluded");if(!experiencePass)codes.push("recruiter-experience-unsupported");
  const accepted=titleMatch&&!excluded&&internal&&!agency&&!(["coordinator","executive"] as const).includes(seniority as "coordinator"|"executive")&&experiencePass;
  const score=Math.max(0,Math.min(100,45+(internal?20:0)+(technicalRelevance?20:0)+(earlyCareerRelevance?15:0)+(seniority==="senior-recruiter"?5:seniority==="manager"?-5:0)-(recruitingDomain==="general"?10:0)));
  return{track:titleMatch?"recruiter":"professional",recruiterType,recruitingDomain,internalStatus:agency?"agency":internal?"internal":"ambiguous",seniority,technicalRelevance,earlyCareerRelevance,accepted,score,explanationCodes:codes.length?codes:["recruiter-qualified"],classificationVersion:RECRUITER_CLASSIFICATION_VERSION,relevanceVersion:RECRUITER_RELEVANCE_VERSION};
}

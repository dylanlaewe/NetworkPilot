import type {DraftRecipient} from "./types";
import {renderDraft,selectTemplate} from "./render-draft";
import {classifyRecruiter,renderRecruiterDraft} from "@/domain/recruiters";

const groups:[string,string[],string,string][]=[
  ["Data/Analytics",["Data Analyst","Analytics Manager","Business Intelligence Analyst","AI & Data Analytics Manager","Senior Data Analyst","Analytics Lead","Reporting Analyst","BI Manager"],"data-analytics","data-analytics"],
  ["Data Engineering",["Data Engineer","Senior Data Engineer","Analytics Engineer","Data Platform Engineer","Data Integration Engineer"],"data-analytics","data-analytics"],
  ["Software/AI",["Software Engineer","Backend Engineer","Automation Engineer","Machine Learning Engineer","AI Engineer"],"software-engineering","technical-product"],
  ["Product",["Product Manager","Associate Product Manager","Technical Product Manager","Product Analyst","Product Operations","AI Product Manager","Data Product Manager","Platform Product Manager"],"product","technical-product"],
  ["Project/Program",["Project Manager","Program Manager","Technical Program Manager","Technology Project Manager"],"project-program","business-delivery"],
  ["Finance/Investment",["Financial Analyst","Investment Analyst","Portfolio Analyst","Finance Manager"],"finance-investment","industry-professional"],
  ["Commodities/Energy",["Commodities Analyst","Energy Trader","Market Analyst"],"commodities-markets","industry-professional"],
];
export function offlineIntentReview(){
  const types=["preferred employer (fictional scenario)","discovered regional employer","discovered startup","discovered private employer"],companies=["Fictional Systems","Fictional Regional Group","Fictional NewTech","Fictional Partners"];
  let ordinal=0;
  const records=groups.flatMap(([group,titles,fn,family])=>titles.map((title,index)=>{
    const i=ordinal++,industry=group==="Finance/Investment"?"financial-services":group==="Commodities/Energy"?"commodities-energy":title==="AI & Data Analytics Manager"?"consulting":"technology-ai";
    const recipient:DraftRecipient={id:`fictional-intent-${i}`,firstName:"Avery",companyName:companies[i%4],professionalTitle:title,primaryRecipientFunction:fn,roleFamilyId:family,industryId:industry,personaId:"experienced-practitioner"};
    const template=selectTemplate(recipient,{runId:"offline-intent-review"},index),draft=renderDraft(recipient,[],()=>new Date("2026-09-21T14:00:00Z"),template);
    return{group,role:title,companyType:types[i%4],...draft,wordCount:draft.body.trim().split(/\s+/).length,cta:draft.body.split("\n\n").find(p=>p.endsWith("?"))!};
  }));
  for(const [i,title] of ["Technical Recruiter","Product Recruiter","Campus Recruiter"].entries()){
    const company=companies[i],classification=classifyRecruiter({title,employerName:company,internalCompanyMatch:true,minimumExperience:4,maximumExperience:5}),draft=renderRecruiterDraft({firstName:"Avery",company,title,classification,variationOrdinal:i});
    records.push({group:"Recruiter",role:title,companyType:types[i],...draft,templateId:"recruiter",templateVersion:"6",templateCatalogVersion:draft.catalogVersion,referencedFactIds:draft.referencedEvidence,evidenceIds:[],generatedAt:"2026-09-21T14:00:00Z",status:"draft-only-simulation",usedEvidence:true,cta:draft.body.split("\n\n").find(p=>p.endsWith("?"))!});
  }
  return records;
}

import type {RecruiterClassification,RecruiterDraft} from "./types";

const words=(value:string)=>value.trim().split(/\s+/).length;
export function renderRecruiterDraft(input:{firstName:string;company:string;title:string;classification:RecruiterClassification}):RecruiterDraft{
  if(!input.classification.accepted)throw new Error("recruiter-not-qualified");
  const variant=input.classification.earlyCareerRelevance?"early-career-alignment":input.classification.technicalRelevance?"technical-recruiting-alignment":input.classification.recruiterType==="general-recruiter"?"general-internal-recruiter":"direct-introduction";
  const subject=input.classification.earlyCareerRelevance?`CS graduate exploring roles at ${input.company}`:input.classification.technicalRelevance?`Data and engineering opportunities at ${input.company}`:`Quick introduction — ${input.company}`;
  const alignment=input.classification.earlyCareerRelevance?`Your early-career recruiting work at ${input.company} made this a relevant introduction.`:input.classification.technicalRelevance?`Your work in technical recruiting at ${input.company} made this a relevant introduction.`:`I wanted to introduce myself to an internal recruiting contact at ${input.company}.`;
  const body=`Hi ${input.firstName},\n\nI’m Dylan, a May 2026 computer science graduate with hands-on BI and data engineering experience across SQL, Python, APIs, ETL, and automation. ${alignment}\n\nI’m exploring early-career data, software, AI/ML, analytics, and technical program roles. If relevant opportunities come across your desk, I’d appreciate being kept on your radar or pointed toward the right recruiting channel.\n\nBest,\nDylan`;
  return{track:"recruiter",subject,body,variant,wordCount:words(body),referencedEvidence:["dylan-cs-graduation","dylan-bi-data-experience",...(input.classification.technicalRelevance?["recruiter-technical-title"]:[]),...(input.classification.earlyCareerRelevance?["recruiter-early-career-title"]:[])],catalogVersion:"recruiter-catalog-v1",subjectVersion:"recruiter-subject-v1"};
}

import type {RecruiterClassification,RecruiterDraft} from "./types";

const words=(value:string)=>value.trim().split(/\s+/).length;
export function renderRecruiterDraft(input:{firstName:string;company:string;title:string;classification:RecruiterClassification}):RecruiterDraft{
  if(!input.classification.accepted)throw new Error("recruiter-not-qualified");
  const variant=input.classification.earlyCareerRelevance?"early-career-alignment":input.classification.technicalRelevance?"technical-recruiting-alignment":input.classification.recruiterType==="general-recruiter"?"general-internal-recruiter":"direct-introduction";
  const subject=input.classification.earlyCareerRelevance?`Early-career data and engineering at ${input.company}`:input.classification.technicalRelevance?`Data engineering and analytics at ${input.company}`:`Quick introduction about roles at ${input.company}`;
  const alignment=input.classification.earlyCareerRelevance?`Your early-career recruiting work at ${input.company} made this a relevant introduction.`:input.classification.technicalRelevance?`Your work in technical recruiting at ${input.company} made this a relevant introduction.`:`I wanted to introduce myself to an internal recruiting contact at ${input.company}.`;
  const target=input.classification.earlyCareerRelevance?"early-career data, analytics, and software engineering roles":"data engineering, analytics, and related software roles";
  const body=`Hi ${input.firstName},\n\nI’m Dylan. I graduated in May 2026 with a B.S. in Computer Science and have hands-on production experience from a BI/Data Engineering internship, working with SQL, Python, and ETL. ${alignment}\n\nI’m looking for ${target}. If you support hiring in those areas, I’d be glad to stay on your radar. If someone else covers them, I’d appreciate being pointed in the right direction.\n\nBest,\nDylan`;
  return{track:"recruiter",subject,body,variant,wordCount:words(body),referencedEvidence:["dylan-cs-graduation","dylan-bi-data-experience",...(input.classification.technicalRelevance?["recruiter-technical-title"]:[]),...(input.classification.earlyCareerRelevance?["recruiter-early-career-title"]:[])],catalogVersion:"recruiter-catalog-v1",subjectVersion:"recruiter-subject-v1"};
}

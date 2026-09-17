import type {RecruiterClassification,RecruiterDraft} from "./types";
import {assertDylanVoice} from "@/domain/drafting/voice";

const words=(value:string)=>value.trim().split(/\s+/).length;
export function renderRecruiterDraft(input:{firstName:string;company:string;title:string;classification:RecruiterClassification}):RecruiterDraft{
  if(!input.classification.accepted)throw new Error("recruiter-not-qualified");
  const variant=input.classification.earlyCareerRelevance?"early-career-alignment":input.classification.technicalRelevance?"technical-recruiting-alignment":input.classification.recruiterType==="general-recruiter"?"general-internal-recruiter":"direct-introduction";
  const subject=input.classification.earlyCareerRelevance?`Early-career data and engineering at ${input.company}`:input.classification.technicalRelevance?`Data engineering and analytics at ${input.company}`:`Quick introduction about roles at ${input.company}`;
  const alignment=input.classification.earlyCareerRelevance?`I saw that you work on early-career recruiting at ${input.company}, so I figured you might be a good person to reach out to.`:input.classification.technicalRelevance?`I saw that you work in technical recruiting at ${input.company}, so I wanted to introduce myself.`:`I saw that you recruit internally at ${input.company}, so I wanted to introduce myself.`;
  const target=input.classification.earlyCareerRelevance?"early-career data, analytics, and software engineering roles":"data engineering, analytics, and related software roles";
  const body=`Hi ${input.firstName},\n\n${alignment}\n\nI graduated in May 2026 with a B.S. in Computer Science and have hands-on production experience from a BI/Data Engineering internship using SQL, Python, ETL, APIs, and integrations. That work taught me how much careful implementation matters. I’m focused on ${target}.\n\nIf those roles fall within your area, would you be open to keeping me in mind?\n\nBest,\nDylan`;
  assertDylanVoice(subject,body);return{track:"recruiter",subject,body,variant,wordCount:words(body),referencedEvidence:["dylan-cs-graduation","dylan-bi-data-experience",...(input.classification.technicalRelevance?["recruiter-technical-title"]:[]),...(input.classification.earlyCareerRelevance?["recruiter-early-career-title"]:[])],catalogVersion:"recruiter-catalog-v3-dylan-outreach-method-v2",subjectVersion:"recruiter-subject-v3"};
}

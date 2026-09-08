import { factById } from "./facts";
import { DRAFT_TEMPLATES } from "./templates";
import type { DraftRecipient, DraftTemplate, PersonalizationEvidence, RenderedDraft } from "./types";

export const PROHIBITED_DRAFT_PHRASES = ["i hope this email finds you well","i came across your impressive profile","your journey is truly inspiring","pick your brain","synergy","leverage your expertise"];
export function selectTemplate(recipient:DraftRecipient):DraftTemplate {
  return DRAFT_TEMPLATES.find((template)=>template.id==="career-path-leader"&&template.personaIds.includes(recipient.personaId))
    ??DRAFT_TEMPLATES.find((template)=>template.industryIds.includes(recipient.industryId)&&(template.roleFamilyIds.length===0||template.roleFamilyIds.includes(recipient.roleFamilyId)))
    ??DRAFT_TEMPLATES.find((template)=>template.roleFamilyIds.includes(recipient.roleFamilyId))
    ??DRAFT_TEMPLATES[0];
}
export function draftWordCount(body:string):number { return body.trim().split(/\s+/).filter(Boolean).length; }
export function renderDraft(recipient:DraftRecipient,evidence:PersonalizationEvidence[],now:()=>Date,template=selectTemplate(recipient)):RenderedDraft {
  const facts=template.factIds.map(factById);
  const verified=evidence.filter((item)=>item.verificationStatus==="verified");
  const evidenceSentence=verified[0]?`I noted that ${verified[0].claim}. `:"";
  const introduction=`My name is ${factById("sender-name").value}, and I’m completing a ${factById("degree").value} with a ${factById("graduation").value}.`;
  const experience=`Through my ${factById("internship").value}, I’ve gained ${facts.some((f)=>f.id==="technical-work")?factById("technical-work").value:factById("systems-scale").value}.`;
  const body=[`Hi ${recipient.firstName},`,introduction,experience,`${evidenceSentence}${template.reason}`,template.question,"Thank you for considering it,","Dylan"].join("\n\n");
  const lowered=body.toLowerCase();
  if(PROHIBITED_DRAFT_PHRASES.some((phrase)=>lowered.includes(phrase))) throw new Error("Template contains prohibited outreach language");
  return { subject:template.subject.replace("{{company}}",recipient.companyName),body,templateId:template.id,templateVersion:template.version,referencedFactIds:["sender-name",...template.factIds],evidenceIds:verified.slice(0,1).map((item)=>item.id),generatedAt:now().toISOString(),status:"draft-only-simulation",usedEvidence:verified.length>0 };
}

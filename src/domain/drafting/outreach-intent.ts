import type {DraftRecipient,OutreachLane} from "./types";

export const OUTREACH_INTENT_VERSION="outreach-intent-v1" as const;
export type OutreachIntent="experience-forward"|"career-transition"|"recruiter-opportunity";
export interface IntentSelection {version:typeof OUTREACH_INTENT_VERSION;intent:OutreachIntent;reason:string;evidenceReferences:string[];}
export function selectOutreachIntent(recipient:DraftRecipient,lane:OutreachLane,track:"professional"|"recruiter"="professional"):IntentSelection{
  const choose=(intent:OutreachIntent,reason:string,evidenceReferences:string[]=[]):IntentSelection=>({version:OUTREACH_INTENT_VERSION,intent,reason,evidenceReferences});
  if(track==="recruiter")return choose("recruiter-opportunity","Recruiter contact: concise relevant background and one opportunity-focused question.");
  const title=recipient.professionalTitle??"",fn=recipient.primaryRecipientFunction;
  if(fn==="product"||/\bproduct (manager|management|operations|analyst)\b/i.test(title))return choose("career-transition","Product role: Dylan's approved motivation is new technology, prioritization and cross-functional leadership, not prior PM employment.");
  if(fn==="data-analytics"||/\b(data|analytics|business intelligence|BI)\b/i.test(title)&&!/(product|program|project)/i.test(title))return choose("experience-forward","Recipient's data/analytics work directly overlaps Dylan's BI, data engineering and systems experience; industry adds context, not claimed industry expertise.");
  if(fn==="project-program"||/\b(project|program)\b/i.test(title)){
    const evidence=recipient.intentEvidence;
    if(evidence?.verified&&evidence.relationship==="hands-on-data-systems")return choose("experience-forward","Reviewed evidence identifies hands-on data/systems work within this program role; frame related technical experience without claiming formal program management.",[evidence.sourceReference]);
    return choose("career-transition","Project/program role: move from coordinating technical work toward broader ownership, without claiming formal management experience.");
  }
  if(["software-engineering","technical-infrastructure","ai-ml"].includes(fn??"")||/\b(software|engineer|AI|machine learning)\b/i.test(title))return choose("experience-forward","Technical work is adjacent to Dylan's integrations and automation experience; do not claim specialist software or ML experience.");
  if(["product-management","project-operations","finance","commodities-energy","consulting"].includes(lane))return choose("career-transition","Recipient's work is a distinct career lane; use Dylan's technical/data background as a transferable starting point, not sector employment.");
  return choose("experience-forward","Use the supported technical/data background and ask about the recipient's more advanced work.");
}

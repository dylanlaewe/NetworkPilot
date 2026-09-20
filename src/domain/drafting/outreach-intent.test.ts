import {describe,expect,it} from "vitest";
import {offlineIntentReview} from "./intent-review-fixtures";
import {selectOutreachIntent} from "./outreach-intent";
import {renderDraft,selectTemplate} from "./render-draft";
import {assertDylanVoice} from "./voice";
import type {DraftRecipient} from "./types";

const all=offlineIntentReview();
describe("outreach-intent-v1",()=>{
  it("covers the complete forty-message offline review with safe copy",()=>{
    expect(all).toHaveLength(40);
    expect(Object.fromEntries([...new Set(all.map(d=>d.group))].map(g=>[g,all.filter(d=>d.group===g).length]))).toEqual({"Data/Analytics":8,"Data Engineering":5,"Software/AI":5,Product:8,"Project/Program":4,"Finance/Investment":4,"Commodities/Energy":3,Recruiter:3});
    for(const d of all){expect(()=>assertDylanVoice(d.subject,d.body),d.role).not.toThrow();expect(d.wordCount).toBeLessThanOrEqual(120);expect(d.body).not.toMatch(/not a real engineer|bad at engineering|good product people|technical product work|caught my attention|I (was|am) a (product|program|project) manager/i);}
  });
  it.each(["Data/Analytics","Data Engineering","Software/AI"])("uses supported experience for %s",group=>{for(const d of all.filter(d=>d.group===group))expect(d.outreachIntent.intent).toBe("experience-forward");});
  it("does not confuse Data Engineering with a move into software engineering",()=>{
    for(const d of all.filter(d=>d.group==="Data Engineering")){expect(d.templateId).toMatch(/^data-analytics-/);expect(d.body).not.toMatch(/deeper software|production software|broader engineering team/);}
  });
  it.each(["Product","Project/Program","Finance/Investment","Commodities/Energy"])("uses positive transition framing for %s",group=>{const messages=all.filter(d=>d.group===group);expect(messages.every(d=>d.outreachIntent.intent==="career-transition")).toBe(true);expect(new Set(messages.map(d=>d.cta)).size).toBeGreaterThanOrEqual(3);});
  it("grounds Product motivation in the user-approved frontier, people, and prioritization story",()=>{
    for(const d of all.filter(d=>d.group==="Product")){expect(d.referencedFactIds).toContain("product-motivation");expect(d.body).toMatch(/new technology|new features/);expect(d.body).toMatch(/working across teams|working with people|across technical and business teams/);expect(d.body).toMatch(/first product role|next step|move into product/);}
  });
  it("preserves the good consulting-analytics style without forcing industry transition",()=>{
    const r:DraftRecipient={id:"fictional-good-style",firstName:"Avery",companyName:"Fictional Consulting",professionalTitle:"AI & Data Analytics Manager",primaryRecipientFunction:"data-analytics",roleFamilyId:"data-analytics",industryId:"consulting",personaId:"team-manager"};
    const d=renderDraft(r,[],()=>new Date("2026-09-21"),selectTemplate(r,{runId:"good-style"},2));expect(d.outreachIntent.intent).toBe("experience-forward");expect(d.body).toContain("recommendations people can actually use");expect(d.body).toContain("which skill you use most often");
  });
  it("uses reviewed adjacent-work evidence for program contacts, never unreviewed evidence",()=>{
    const r:DraftRecipient={id:"fictional",firstName:"Avery",companyName:"Fictional Systems",professionalTitle:"Technical Program Manager",primaryRecipientFunction:"project-program",roleFamilyId:"business-delivery",industryId:"technology-ai",personaId:"project-leader",intentEvidence:{verified:false,relationship:"hands-on-data-systems",sourceReference:"fictional://reviewed-work"}};
    expect(selectOutreachIntent(r,"project-operations").intent).toBe("career-transition");r.intentEvidence!.verified=true;
    const d=renderDraft(r,[],()=>new Date("2026-09-21"),selectTemplate(r,{runId:"test"}));expect(d.outreachIntent).toMatchObject({intent:"experience-forward",evidenceReferences:["fictional://reviewed-work"]});expect(d.body).not.toMatch(/I have managed|I led programs/);
  });
  it("keeps recruiters opportunity-focused with concise Product transition context",()=>{
    for(const d of all.filter(d=>d.group==="Recruiter"))expect(d.outreachIntent.intent).toBe("recruiter-opportunity");
    const product=all.find(d=>d.role==="Product Recruiter")!;expect(product.body).toContain("first technical product role");expect(product.cta).toContain("recruiting area");
  });
});

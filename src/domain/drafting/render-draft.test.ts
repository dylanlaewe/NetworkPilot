import { describe,expect,it } from "vitest";
import { DYLAN_FACTS } from "./facts";
import { draftWordCount,PROHIBITED_DRAFT_PHRASES,renderDraft,selectTemplate } from "./render-draft";
import { DRAFT_TEMPLATES } from "./templates";
import type { DraftRecipient,PersonalizationEvidence } from "./types";
const recipient:DraftRecipient={id:"fictional-person",firstName:"Fictional",companyName:"Imaginary Venture",roleFamilyId:"data-analytics",industryId:"technology-ai",personaId:"experienced-practitioner"};
const evidence=(verificationStatus:"verified"|"unverified"):PersonalizationEvidence=>({id:"fictional-evidence",sourceType:"fictional-simulation",sourceReference:"fictional://evidence",reviewedAt:"2026-09-07T00:00:00.000Z",claim:"their fictional team is improving an analytics workflow",verificationStatus});
describe("deterministic drafts",()=>{
  it("selects genuinely different templates by persona, industry, and role family",()=>{expect(selectTemplate(recipient).id).toBe("data-practitioner");expect(selectTemplate({...recipient,personaId:"team-manager"}).id).toBe("career-path-leader");expect(selectTemplate({...recipient,roleFamilyId:"industry-professional",industryId:"commodities-energy",personaId:"experienced-practitioner"}).id).toBe("commodities-energy");});
  it.each(DRAFT_TEMPLATES)("renders $id within the expected word range without prohibited language",(template)=>{const draft=renderDraft(recipient,[],()=>new Date("2026-09-07T00:00:00Z"),template);expect(draftWordCount(draft.body)).toBeGreaterThanOrEqual(70);expect(draftWordCount(draft.body)).toBeLessThanOrEqual(130);for(const phrase of PROHIBITED_DRAFT_PHRASES)expect(draft.body.toLowerCase()).not.toContain(phrase);expect(draft.status).toBe("draft-only-simulation");});
  it("references only approved atomic facts required by the template",()=>{const draft=renderDraft(recipient,[],()=>new Date(),DRAFT_TEMPLATES[0]);const approved=new Set(DYLAN_FACTS.map((f)=>f.id));expect(draft.referencedFactIds).toEqual(expect.arrayContaining(DRAFT_TEMPLATES[0].factIds));expect(draft.referencedFactIds.every((id)=>approved.has(id))).toBe(true);});
  it("renders and traces verified fictional evidence",()=>{const draft=renderDraft(recipient,[evidence("verified")],()=>new Date());expect(draft.body).toContain(evidence("verified").claim);expect(draft.evidenceIds).toEqual(["fictional-evidence"]);expect(draft.usedEvidence).toBe(true);});
  it("uses a clean fallback for missing or unverified evidence",()=>{for(const items of [[],[evidence("unverified")]]){const draft=renderDraft(recipient,items,()=>new Date());expect(draft.evidenceIds).toEqual([]);expect(draft.usedEvidence).toBe(false);expect(draft.body).not.toContain(evidence("unverified").claim);}});
});

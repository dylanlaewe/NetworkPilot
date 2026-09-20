import { describe, expect, it } from "vitest";
import { DYLAN_FACTS, FACT_FRAGMENTS } from "./facts";
import { draftWordCount, fnv1a32, PROHIBITED_DRAFT_PHRASES, renderDraft, selectTemplate, validateTemplateProvenance } from "./render-draft";
import { DRAFT_TEMPLATES, TEMPLATE_CATALOG_VERSION } from "./templates";
import type { DraftRecipient, PersonalizationEvidence } from "./types";

const recipient = (id = "fictional-person"): DraftRecipient => ({ id, firstName: "Fictional", companyName: "Imaginary Venture", roleFamilyId: "data-analytics", industryId: "technology-ai", personaId: "experienced-practitioner" });
const evidence = (verificationStatus: "verified" | "unverified"): PersonalizationEvidence => ({ id: "fictional-evidence", sourceType: "fictional-simulation", sourceReference: "fictional://evidence", reviewedAt: "2026-09-07T00:00:00.000Z", claim: "their fictional team is improving an analytics workflow", verificationStatus });

describe("deterministic drafts", () => {
  it("defines three substantive variants for every outreach lane", () => {
    const lanes = new Set(DRAFT_TEMPLATES.map((item) => item.laneId));
    expect(lanes.size).toBe(9);
    for (const lane of lanes) {
      const variants = DRAFT_TEMPLATES.filter((item) => item.laneId === lane);
      expect(variants).toHaveLength(3);
      expect(new Set(variants.map((item) => item.structure)).size).toBe(3);
      expect(new Set(variants.map((item) => `${item.structure}|${item.fragmentIds.join("|")}|${item.reason}|${item.question}`)).size).toBe(3);
      expect(new Set(variants.map((item) => item.subject)).size).toBe(3);
    }
  });

  it.each(DRAFT_TEMPLATES)("renders $id with accurate provenance and safe length", (template) => {
    const draft = renderDraft(recipient(), [], () => new Date("2026-09-07T00:00:00Z"), template);
    expect(draftWordCount(draft.body)).toBeGreaterThanOrEqual(60);
    expect(draftWordCount(draft.body)).toBeLessThanOrEqual(130);
    expect(draft.status).toBe("draft-only-simulation");
    expect(draft.referencedFactIds).toEqual(template.factIds);
    expect(new Set(draft.referencedFactIds).size).toBe(draft.referencedFactIds.length);
    for (const fragmentId of template.fragmentIds) for (const marker of FACT_FRAGMENTS.find((item) => item.id === fragmentId)!.claimMarkers) expect(draft.body).toContain(marker);
    for (const phrase of [...PROHIBITED_DRAFT_PHRASES, "completing a", "with a May 2026 graduation", "will graduate", "expect to graduate", "making that move thoughtfully", "engineering and technical delivery", "what has mattered most in your work"]) expect(draft.body.toLowerCase()).not.toContain(phrase.toLowerCase());
  });

  it("aligns every fragment claim with explicitly approved fact IDs", () => {
    for (const template of DRAFT_TEMPLATES) {
      const facts = validateTemplateProvenance(template, DYLAN_FACTS);
      const draft = renderDraft(recipient(), [], () => new Date(), template);
      const derived = [...new Set(template.fragmentIds.flatMap((id) => FACT_FRAGMENTS.find((item) => item.id === id)!.factIds))];
      expect([...facts.keys()]).toEqual(derived);
      expect([...facts.values()].every((fact) => fact.approved && fact.enabled)).toBe(true);
      for (const fragmentId of template.fragmentIds) for(const marker of FACT_FRAGMENTS.find((item)=>item.id===fragmentId)!.claimMarkers)expect(draft.body).toContain(marker);
    }
  });

  it("keeps leadership aspiration concise and avoids duplicate wording",()=>{for(const template of DRAFT_TEMPLATES){expect(template.fragmentIds).not.toContain("leadership-direction");const draft=renderDraft(recipient(),[],()=>new Date(),template);expect(draft.body).not.toMatch(/long-term.{0,20}long-term/i);}});

  it("fails closed for unknown, disabled, unapproved, duplicate, or mismatched fact metadata", () => {
    const template = DRAFT_TEMPLATES[0];
    expect(() => renderDraft(recipient(), [], () => new Date(), template, DYLAN_FACTS.map((fact) => fact.id === template.factIds[0] ? { ...fact, enabled: false } : fact))).toThrow("disabled");
    expect(() => renderDraft(recipient(), [], () => new Date(), template, DYLAN_FACTS.map((fact) => fact.id === template.factIds[0] ? { ...fact, approved: false } : fact))).toThrow("unapproved");
    expect(() => renderDraft(recipient(), [], () => new Date(), { ...template, factIds: [...template.factIds, "unknown"] })).toThrow("metadata mismatch");
    expect(() => renderDraft(recipient(), [], () => new Date(), { ...template, factIds: [template.factIds[0], template.factIds[0]] })).toThrow("metadata mismatch");
  });

  it("uses a specified FNV-1a 32-bit hash and stable context rotation", () => {
    expect(fnv1a32("hello")).toBe(0x4f9f2cab);
    const context = { runId: "run-2026-09-07" };
    expect(selectTemplate(recipient("person-1"), context)).toEqual(selectTemplate(recipient("person-1"), context));
    expect(selectTemplate(recipient("person-1"), context).catalogVersion).toBe(TEMPLATE_CATALOG_VERSION);
  });

  it("distributes different recipients across all three lane variants", () => {
    const variants = new Set(Array.from({ length: 60 }, (_, index) => selectTemplate(recipient(`person-${index}`), { runId: "run-2026-09-07" }).variantId));
    expect(variants).toEqual(new Set(["direct-practical", "career-curiosity", "common-ground"]));
  });

  it("uses specific function evidence before manager persona fallback", () => {
    expect(selectTemplate({ ...recipient(), personaId: "team-manager",professionalTitle:"Program Manager",primaryRecipientFunction:"project-program" }, { runId: "run" }).laneId).toBe("project-operations");
    expect(selectTemplate({ ...recipient(), personaId: "team-manager",roleFamilyId:"",primaryRecipientFunction:undefined }, { runId: "run" }).laneId).toBe("career-path-leader");
    expect(selectTemplate({ ...recipient(), industryId: "commodities-energy", roleFamilyId: "industry-professional" }, { runId: "run" }).laneId).toBe("commodities-energy");
  });

  it("uses an explicit product path without claiming Dylan held a PM title",()=>{const item={...recipient(),professionalTitle:"Technical Product Manager",primaryRecipientFunction:"product",roleFamilyId:"technical-product"},template=selectTemplate(item,{runId:"product-run"}),draft=renderDraft(item,[],()=>new Date(),template);expect(template.laneId).toBe("product-management");expect(draft.subject.toLowerCase()).toMatch(/product/);expect(draft.body).toContain("Technical Product Manager");expect(draft.body).toMatch(/background is on the technical side|BI and data engineering|integrations/i);expect(draft.body).not.toMatch(/I(?:’m| am| was| have been) (?:a |an )?(?:technical )?product manager/i);});

  it("puts factual recipient personalization before Dylan context",()=>{for(const template of DRAFT_TEMPLATES){const item={...recipient(),professionalTitle:"Senior Data Engineer"},draft=renderDraft(item,[],()=>new Date(),template),opener=draft.body.indexOf("Senior Data Engineer"),biography=Math.min(...["I graduated","My background","My BI and data engineering","I’m a May 2026"].map((marker)=>draft.body.indexOf(marker)).filter((index)=>index>=0));expect(opener,template.id).toBeGreaterThanOrEqual(0);expect(opener,template.id).toBeLessThan(biography);}});

  it("keeps known industry-language regressions out",()=>{const defense={...recipient(),industryId:"defense-aerospace",professionalTitle:"Systems Engineer"},commodities={...recipient(),industryId:"commodities-energy",professionalTitle:"Market Data Analyst"};for(const id of Array.from({length:30},(_,index)=>`run-${index}`)){expect(renderDraft(defense,[],()=>new Date(),selectTemplate(defense,{runId:id})).body).not.toMatch(/autonomous weapons|AI autonomy/i);expect(renderDraft(commodities,[],()=>new Date(),selectTemplate(commodities,{runId:id})).body).not.toMatch(/cyber|security/i);}});

  it("varies opener, context, CTA, signoff, and subject deterministically",()=>{const item={...recipient(),professionalTitle:"Senior Data Analyst",primaryRecipientFunction:"data-analytics"},drafts=Array.from({length:80},(_,index)=>renderDraft(item,[],()=>new Date(),selectTemplate(item,{runId:`variation-${index}`}))),byVariant=new Map(drafts.map((draft)=>[draft.templateId,draft]));expect(byVariant.size).toBe(3);expect(new Set([...byVariant.values()].map((draft)=>draft.subject)).size).toBe(3);expect(new Set([...byVariant.values()].map((draft)=>draft.body.split("\n\n")[1])).size).toBe(3);expect(new Set([...byVariant.values()].map((draft)=>draft.body.split("\n\n").at(-2))).size).toBe(3);});

  it("uses immutable title/company evidence without indiscriminate leadership language",()=>{const item={...recipient(),personaId:"team-manager",professionalTitle:"Security Program Manager",primaryRecipientFunction:"project-program"},template=selectTemplate(item,{runId:"run"}),draft=renderDraft(item,[],()=>new Date(),template);expect(template.laneId).toBe("project-operations");expect(draft.body).toContain("Security Program Manager");expect(draft.body).toContain("Imaginary Venture");expect(draft.referencedFactIds).not.toContain("long-term-direction");expect(draft.body).not.toMatch(/long-term.{0,20}long-term/i);});

  it("renders and traces only verified fictional evidence", () => {
    const template = DRAFT_TEMPLATES[0];
    const verified = renderDraft(recipient(), [evidence("verified")], () => new Date(), template);
    expect(verified.body).toContain(evidence("verified").claim);
    expect(verified.evidenceIds).toEqual(["fictional-evidence"]);
    for (const items of [[], [evidence("unverified")]]) expect(renderDraft(recipient(), items, () => new Date(), template).evidenceIds).toEqual([]);
  });
});

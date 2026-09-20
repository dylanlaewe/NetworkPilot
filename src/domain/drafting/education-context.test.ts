import {describe,expect,it} from "vitest";
import {renderDraft} from "./render-draft";
import {DRAFT_TEMPLATES} from "./templates";
import type {OutreachLane} from "./types";
import {classifyRecruiter,renderRecruiterDraft} from "@/domain/recruiters";

const professional=(lane:OutreachLane,variant:string,title:string)=>{const template=DRAFT_TEMPLATES.find(item=>item.laneId===lane&&item.variantId===variant)!;return renderDraft({id:`${lane}-${variant}`,firstName:"Avery",companyName:"Fictional Systems",roleFamilyId:"data-analytics",industryId:"technology-ai",personaId:"experienced-practitioner",professionalTitle:title},[],()=>new Date("2026-09-20T12:00:00Z"),template);};
const recruiter=(title:string,variationOrdinal:number)=>renderRecruiterDraft({firstName:"Morgan",company:"Fictional Systems",title,variationOrdinal,classification:classifyRecruiter({title,employerName:"Fictional Systems",internalCompanyMatch:true,minimumExperience:3,maximumExperience:5})});
const safe=(body:string)=>{expect(body.match(/\?/g)).toHaveLength(1);expect(body).not.toContain("—");expect(body).not.toMatch(/not a real engineer|bad at engineering/i);};

describe("education-context copy review",()=>{
  it("covers Product professional transition with positive build, people, priority, and first-role motivation",()=>{const draft=professional("product-management","direct-practical","Senior Product Manager");expect(draft.body).toMatch(/Marist University.*Poughkeepsie, New York.*May 2026/s);expect(draft.body).toMatch(/understand what can be built/);expect(draft.body).toMatch(/setting priorities|deciding what should be built/);expect(draft.body).toMatch(/first full-time role/i);safe(draft.body);});
  it("covers Product recruiter outreach without claiming prior PM employment",()=>{const draft=recruiter("Product Recruiter",0);expect(draft.body).toMatch(/Marist University.*Poughkeepsie, New York.*May 2026/s);expect(draft.body).toMatch(/Product as my first full-time role/);expect(draft.body).not.toMatch(/I(?:’m| am| was| have been) (?:a |an )?product manager/i);safe(draft.body);});
  it("covers Data professional and recruiter outreach with natural education context",()=>{const professionalDraft=professional("data-analytics","career-curiosity","Senior Data Engineer"),recruiterDraft=recruiter("Technical Recruiter",2);expect(professionalDraft.body).toContain("Marist University");expect(professionalDraft.body).not.toContain("Poughkeepsie");expect(recruiterDraft.body).toContain("Marist University");safe(professionalDraft.body);safe(recruiterDraft.body);});
  it("covers Project/Program and Finance transitions without forcing the full location into every sample",()=>{const project=professional("project-operations","common-ground","Program Manager"),finance=professional("finance","common-ground","Financial Data Analyst");expect(project.body).toContain("Marist University");expect(project.body).not.toContain("Poughkeepsie");expect(finance.body).toContain("Marist University");expect(finance.body).not.toContain("Poughkeepsie");expect(finance.body).toMatch(/finance|financial/i);safe(project.body);safe(finance.body);});
});

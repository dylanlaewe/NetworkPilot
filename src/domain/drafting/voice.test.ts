import {describe,expect,it} from "vitest";
import {classifyRecruiter,renderRecruiterDraft} from "@/domain/recruiters";
import {renderDraft} from "./render-draft";
import {DRAFT_TEMPLATES} from "./templates";
import {assertDylanVoice,BANNED_OUTREACH_PHRASES,DYLAN_VOICE_VERSION} from "./voice";

const recipient={id:"fictional",firstName:"Avery",companyName:"Fictional Systems",roleFamilyId:"data-analytics",industryId:"technology-ai",personaId:"experienced-practitioner"};

describe("Dylan voice v1",()=>{
  it("version-controls every professional template without em dashes or generic phrases",()=>{expect(DYLAN_VOICE_VERSION).toBe("dylan-voice-v1");for(const template of DRAFT_TEMPLATES){const draft=renderDraft(recipient,[],()=>new Date("2026-09-15T12:00:00Z"),template),text=`${draft.subject}\n${draft.body}`.toLowerCase();expect(draft.templateCatalogVersion).toContain(DYLAN_VOICE_VERSION);expect(text).not.toContain("—");for(const phrase of BANNED_OUTREACH_PHRASES)expect(text).not.toContain(phrase);}});
  it.each(["Technical Recruiter","Early Careers Recruiter","Recruiter"])("applies the same voice rules to recruiter type %s",(title)=>{const draft=renderRecruiterDraft({firstName:"Avery",company:"Fictional Systems",title,classification:classifyRecruiter({title,employerName:"Fictional Systems",internalCompanyMatch:true,minimumExperience:3,maximumExperience:5})}),text=`${draft.subject}\n${draft.body}`.toLowerCase();expect(draft.catalogVersion).toContain(DYLAN_VOICE_VERSION);expect(text).not.toContain("—");for(const phrase of BANNED_OUTREACH_PHRASES)expect(text).not.toContain(phrase);});
  it("fails closed if a future renderer introduces prohibited style",()=>{expect(()=>assertDylanVoice("A subject — with a dash","Body")).toThrow("dylan-voice-em-dash-prohibited");expect(()=>assertDylanVoice("Subject","I hope this message finds you well")).toThrow("dylan-voice-generic-phrase-prohibited");});
});

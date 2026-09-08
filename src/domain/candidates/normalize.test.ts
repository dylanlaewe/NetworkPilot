import { describe, expect, it } from "vitest";
import { classifyCandidate, matchCompanyRegistry, normalizeTitle, scoreCandidateDataQuality, type CandidateInput } from ".";
import { TARGET_COMPANIES } from "@/domain/targeting";

const candidate=(professionalTitle:string,overrides:Partial<CandidateInput>={}):CandidateInput=>({internalId:"candidate-1",externalSourceReference:"fixture:1",sourceType:"fictional-fixture",retrievedAt:"2026-09-08T12:00:00.000Z",firstName:"Fictional",lastName:"Person",professionalTitle,employerName:"Fictional Scenario",industry:"technology-ai",geography:"boston-ma",yearsExperience:10,professionalEmail:"fictional@example.test",emailVerificationStatus:"verified",roleSignals:[],sharedSignals:[],dataQualityIndicators:[],rawRecordFingerprint:"fixture-v1",...overrides});

describe("candidate normalization",()=>{
  it("normalizes title tokens without unsafe substring matching",()=>{expect(normalizeTitle("Sr. Data Engineer")).toBe("senior data engineer");expect(classifyCandidate(candidate("Chiefly Data Engineer")).reviewCode).not.toBe("c-suite-rejected");});
  it("rejects C-suite titles",()=>expect(classifyCandidate(candidate("Chief Data Officer")).reviewCode).toBe("c-suite-rejected"));
  it.each(["CEO","CFO","CTO","CIO","COO","President","Founder","Co-Founder","Owner","Executive Chair"])("rejects executive variant %s",(title)=>expect(classifyCandidate(candidate(title)).reviewCode).toBe("c-suite-rejected"));
  it.each(["Chiefly Data Engineer","Ownership Analyst"])("does not reject partial token %s as executive",(title)=>expect(classifyCandidate(candidate(title)).reviewCode).not.toBe("c-suite-rejected"));
  it("applies selective VP handling",()=>{expect(classifyCandidate(candidate("VP Data Analytics",{yearsExperience:12})).reviewCode).toBe("vp-not-selective-fit");expect(classifyCandidate(candidate("VP Data Analytics",{yearsExperience:18})).personaId).toBe("select-vp");});
  it("rejects entry-level peers",()=>expect(classifyCandidate(candidate("Entry Level Data Analyst",{yearsExperience:1})).reviewCode).toBe("entry-level-peer-rejected"));
  it("keeps recipient persona separate from desired role",()=>{const result=classifyCandidate(candidate("Senior Data Engineer"));expect(result.personaId).toBe("senior-ic");expect(result.desiredRoleId).not.toContain("senior");});
  it("fails ambiguous mappings closed",()=>expect(classifyCandidate(candidate("Wizard",{industry:"unknown",geography:"unknown"})).reviewCode).toBeDefined());
  it("rejects unknown employers and company-domain conflicts",()=>{expect(matchCompanyRegistry({employerName:"Unknown",employerDomain:"unknown.test"},TARGET_COMPANIES).explanationCode).toBe("company-domain-unreviewed");expect(matchCompanyRegistry({employerName:"Microsoft",employerDomain:"google.test"},TARGET_COMPANIES,{microsoft:"microsoft.test",google:"google.test"}).explanationCode).toBe("company-domain-conflict");});
  it("accepts reviewed fictional aliases without making an employment match",()=>expect(matchCompanyRegistry(candidate("Data Engineer",{publicCompanyRegistryMatch:{companyId:"microsoft",matchedBy:"simulation-alias",reviewed:true}}),TARGET_COMPANIES)).toMatchObject({explanationCode:"company-fictional-alias-reviewed",method:"simulation-alias"}));
  it("scores deterministic normalized data quality",()=>expect(scoreCandidateDataQuality(candidate("Data Engineer"))).toBe(100));
});

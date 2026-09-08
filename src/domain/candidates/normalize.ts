import { CONTACT_PERSONAS, GEOGRAPHY_PREFERENCES, INDUSTRY_PREFERENCES, TARGET_ROLES } from "@/domain/targeting";
import type { CandidateClassification, CandidateInput } from "./types";
import type { TargetCompany } from "@/domain/targeting";

const tokens = (value: string): string[] => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
const hasSequence = (haystack: string[], phrase: string): boolean => {
  const needle = tokens(phrase);
  return haystack.some((_, index) => needle.every((token, offset) => haystack[index + offset] === token));
};

export function normalizeTitle(value: string): string {
  return tokens(value).map((token) => ({ sr: "senior", jr: "junior", mgr: "manager" })[token] ?? token).join(" ");
}

export function interpretYearsExperience(input:Pick<CandidateInput,"yearsExperience"|"experienceRange">):number|undefined{
  if(input.yearsExperience!==undefined)return Number.isFinite(input.yearsExperience)&&input.yearsExperience>=0?input.yearsExperience:undefined;
  if(!input.experienceRange||input.experienceRange.minimum<0||input.experienceRange.maximum<input.experienceRange.minimum)return undefined;
  return (input.experienceRange.minimum+input.experienceRange.maximum)/2;
}

export function scoreCandidateDataQuality(input:CandidateInput):number{
  const checks=[input.firstName,input.lastName,input.professionalTitle,input.employerName,input.industry,input.geography,input.professionalEmail,input.rawRecordFingerprint,interpretYearsExperience(input)];
  return Math.round(checks.filter((value)=>value!==undefined&&String(value).trim().length>0).length/checks.length*100);
}

export function matchCompanyRegistry(input:Pick<CandidateInput,"employerName"|"employerDomain"|"publicCompanyRegistryMatch">,registry:readonly TargetCompany[],domains:Readonly<Record<string,string>>={}):{company:TargetCompany|null;explanationCode:string;method?:"domain"|"simulation-alias"}{
  if(input.publicCompanyRegistryMatch?.matchedBy==="simulation-alias"){const company=registry.find((item)=>item.id===input.publicCompanyRegistryMatch?.companyId&&item.enabled);return company&&input.publicCompanyRegistryMatch.reviewed?{company,explanationCode:"company-fictional-alias-reviewed",method:"simulation-alias"}:{company:null,explanationCode:"company-alias-unreviewed"};}
  const normalizedName=tokens(input.employerName).join(" ");const nameMatch=registry.find((item)=>tokens(item.canonicalName).join(" ")===normalizedName);
  const normalizedDomain=input.employerDomain?.toLowerCase().replace(/^www\./,"");const domainMatch=normalizedDomain?registry.find((item)=>domains[item.id]?.toLowerCase()===normalizedDomain):undefined;
  if(normalizedDomain&&nameMatch&&domainMatch?.id!==nameMatch.id)return{company:null,explanationCode:"company-domain-conflict"};
  if(normalizedDomain&&!domainMatch)return{company:null,explanationCode:"company-domain-unreviewed"};
  const company=domainMatch??nameMatch;return company?.enabled?{company,explanationCode:domainMatch?"company-domain-match":"company-name-exact-match",method:domainMatch?"domain":undefined}:{company:null,explanationCode:"company-unknown"};
}

export function classifyCandidate(input: CandidateInput): CandidateClassification {
  const title = normalizeTitle(input.professionalTitle);
  const titleTokens = tokens(title);
  const explanations: string[] = ["title-normalized"];
  const years = interpretYearsExperience(input);
  if (titleTokens.some((token) => ["chief", "ceo", "cfo", "cto", "cio", "coo"].includes(token))) return { normalizedTitle: title, yearsExperience: years, explanationCodes: [...explanations, "c-suite-title"], reviewCode: "c-suite-rejected" };
  if (titleTokens.some((token) => ["intern", "student"].includes(token)) || hasSequence(titleTokens, "entry level")) return { normalizedTitle: title, yearsExperience: years, explanationCodes: [...explanations, "entry-level-peer"], reviewCode: "entry-level-peer-rejected" };
  const isVp = titleTokens.includes("vp") || hasSequence(titleTokens, "vice president");
  if (isVp && (years === undefined || years < 15)) return { normalizedTitle: title, yearsExperience: years, explanationCodes: [...explanations, "vp-policy"], reviewCode: "vp-not-selective-fit" };
  const role = TARGET_ROLES.find((candidate) => candidate.enabled && candidate.positiveTitlePatterns.some((pattern) => hasSequence(titleTokens, pattern)))
    ?? TARGET_ROLES.find((candidate) => candidate.enabled && candidate.themes.some((theme) => titleTokens.includes(theme.toLowerCase())));
  const personaId = isVp ? "select-vp" : titleTokens.includes("director") ? "functional-director" : titleTokens.includes("manager") ? "team-manager" : titleTokens.includes("principal") ? "consulting-principal" : years !== undefined && years >= 8 ? "senior-ic" : years !== undefined && years >= 5 ? "experienced-practitioner" : undefined;
  const industryId = INDUSTRY_PREFERENCES.find((industry) => industry.id === input.industry)?.id;
  const geographyId = GEOGRAPHY_PREFERENCES.find((geography) => geography.id === input.geography)?.id;
  const persona = CONTACT_PERSONAS.find((item) => item.id === personaId);
  const missing = [[role, "role-ambiguous"], [persona, "persona-ambiguous"], [industryId, "industry-ambiguous"], [geographyId, "geography-ambiguous"]] as const;
  const reviewCode = missing.find(([value]) => !value)?.[1];
  return { normalizedTitle: title, roleFamilyId: role?.familyId, desiredRoleId: role?.id, personaId: persona?.id, industryId, geographyId, yearsExperience: years, explanationCodes: [...explanations, ...(role ? ["role-token-match"] : []), ...(persona ? ["persona-policy-match"] : [])], reviewCode };
}

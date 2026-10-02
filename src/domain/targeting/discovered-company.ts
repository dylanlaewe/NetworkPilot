import {
  classifyRecruiterEmployerDomain,
  hasAgencyConcept,
  normalizeRecruiterEmployerDomain,
} from "@/domain/recruiters/agency-vocabulary";
import type {TargetCompany} from "./types";
import {discoveredCompanyIdentity} from "@/domain/company-trust";
const scamSignals=/\b(crypto returns|guaranteed income|work from home earnings|shell company)\b/i;
const industryMappings:Array<[RegExp,string]>=[
  [/\b(consulting|professional services|research services|market research)\b/i,"consulting"],
  [/\b(bank|banking|financial|fintech|investment|capital markets|asset management)\b/i,"financial-services"],
  [/\b(insurance|insurtech)\b/i,"insurance"],
  [/\b(health|hospital|medical|biotech|pharma|life sciences)\b/i,"healthcare-life-sciences"],
  [/\b(energy|renewable|utilities|oil|gas|commodity|commodities)\b/i,"energy-renewables"],
  [/\b(aerospace|defense|aviation|government contractor)\b/i,"defense-aerospace"],
  [/\b(telecom|telecommunications|infrastructure)\b/i,"infrastructure-telecom"],
  [/\b(manufacturing|industrial|logistics|transportation|supply chain|automotive)\b/i,"complex-operations"],
  [/\b(software|technology|information technology|internet|computer|data|analytics|artificial intelligence|machine learning|cybersecurity|semiconductor|cloud|saas)\b/i,"technology-ai"],
];
const mappedIndustry=(value?:string)=>value?industryMappings.find(([pattern])=>pattern.test(value))?.[1]:undefined;
export interface CompanyDiscoveryResult {eligible:boolean;reason:string|null;company:TargetCompany|null;kind:"preferred"|"discovered"|"blocked";}
export function classifyInternalRecruiterCompany(input:{name:string;domain?:string;providerNamespace?:string;providerEmployerId?:string;recruiterTitleRelevant:boolean}):CompanyDiscoveryResult{
  const name=input.name.trim().replace(/\s+/g," "),domain=normalizeRecruiterEmployerDomain(input.domain),domainEvidence=classifyRecruiterEmployerDomain(input.domain),providerId=input.providerEmployerId?.trim(),generic=/^(unknown|confidential|stealth|self[- ]employed|n\/a)$/i.test(name);
  const reason=!input.recruiterTitleRelevant?"recruiter-function-unrelated":hasAgencyConcept(name)||domainEvidence==="agency-contradiction"?"recruiter-agency-employer":domainEvidence==="ambiguous"?"recruiter-company-domain-ambiguous":scamSignals.test(name)?"company-scam-indicator":generic||name.length<2||(!providerId&&!domain)?"recruiter-company-identity-unverifiable":null;
  if(reason)return{eligible:false,reason,company:null,kind:"blocked"};
  const id=discoveredCompanyIdentity({employerDomain:domain,providerNamespace:input.providerNamespace,providerEmployerId:providerId});
  if(!id)return{eligible:false,reason:"recruiter-company-identity-unverifiable",company:null,kind:"blocked"};
  return{eligible:true,reason:null,kind:"discovered",company:{id,canonicalName:name,industryId:"employer-identity-only",tier:"tier-2",enabled:true,recognitionScore:50,careerUpsideScore:65,technicalInterestScore:65,geographicRelevance:["broader-us","remote-us"],rationale:"Internal recruiter employer established from provider-backed company identity and employment relationship; no industry claim made.",provenance:"authorized-provider-recruiter-identity",lastReviewedDate:"1970-01-01",operatorNotes:"Recruiter-only company eligibility. Provider employer identity is supported; industry remains unspecified."}};
}
export function classifyDiscoveredCompany(input:{name:string;domain?:string;providerNamespace?:string;providerEmployerId?:string;industrySignal?:string;preferred?:TargetCompany|null;suppressed?:boolean;recruiterTitleRelevant?:boolean}):CompanyDiscoveryResult{
  if(input.preferred)return{eligible:input.preferred.enabled&&input.preferred.tier!=="excluded"&&input.preferred.tier!=="unreviewed",reason:null,company:input.preferred,kind:"preferred"};
  const name=input.name.trim().replace(/\s+/g," "),domain=input.domain?.trim().toLowerCase().replace(/^www\./,""),domainEvidence=input.recruiterTitleRelevant?classifyRecruiterEmployerDomain(input.domain):"no-domain-evidence";
  const industryId=mappedIndustry(input.industrySignal);
  const reason=input.suppressed?"company-suppressed":hasAgencyConcept(name)||domainEvidence==="agency-contradiction"?"company-agency":domainEvidence==="ambiguous"?"recruiter-company-domain-ambiguous":scamSignals.test(name)?"company-scam-indicator":name.length<2||!domain||!domain.includes(".")?"company-identity-unverifiable":!industryId?"company-industry-unsupported":null;
  if(reason)return{eligible:false,reason,company:null,kind:"blocked"};
  const id=discoveredCompanyIdentity({employerDomain:domain,providerNamespace:input.providerNamespace,providerEmployerId:input.providerEmployerId});
  if(!id)return{eligible:false,reason:"company-identity-unverifiable",company:null,kind:"blocked"};
  return{eligible:true,reason:null,kind:"discovered",company:{id,canonicalName:name,industryId:industryId!,tier:"tier-2",enabled:true,recognitionScore:65,careerUpsideScore:70,technicalInterestScore:70,geographicRelevance:["broader-us","remote-us"],rationale:"Legitimate employer discovered from an authorized provider result; no preferred-brand assumption.",provenance:"authorized-provider-discovery",lastReviewedDate:"1970-01-01",operatorNotes:"Discovered company; eligibility comes from provider-backed identity, domain, industry, and employee evidence, not brand recognition."}};
}

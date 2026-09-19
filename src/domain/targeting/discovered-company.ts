import {createHash} from "node:crypto";
import type {TargetCompany} from "./types";
const agencySignals=/\b(staffing|recruiting|recruitment|talent solutions|placement|headhunt|employment agency)\b/i;
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
export function classifyDiscoveredCompany(input:{name:string;domain?:string;industrySignal?:string;preferred?:TargetCompany|null;suppressed?:boolean}):CompanyDiscoveryResult{
  if(input.preferred)return{eligible:input.preferred.enabled&&input.preferred.tier!=="excluded"&&input.preferred.tier!=="unreviewed",reason:null,company:input.preferred,kind:"preferred"};
  const name=input.name.trim().replace(/\s+/g," "),domain=input.domain?.trim().toLowerCase().replace(/^www\./,"");
  const industryId=mappedIndustry(input.industrySignal);
  const reason=input.suppressed?"company-suppressed":agencySignals.test(name)?"company-agency":scamSignals.test(name)?"company-scam-indicator":name.length<2||!domain||!domain.includes(".")?"company-identity-unverifiable":!industryId?"company-industry-unsupported":null;
  if(reason)return{eligible:false,reason,company:null,kind:"blocked"};
  const id=`discovered-${createHash("sha256").update(domain!).digest("hex").slice(0,16)}`;
  return{eligible:true,reason:null,kind:"discovered",company:{id,canonicalName:name,industryId:industryId!,tier:"tier-2",enabled:true,recognitionScore:65,careerUpsideScore:70,technicalInterestScore:70,geographicRelevance:["broader-us","remote-us"],rationale:"Legitimate employer discovered from an authorized provider result; no preferred-brand assumption.",provenance:"authorized-provider-discovery",lastReviewedDate:"1970-01-01",operatorNotes:"Discovered company; eligibility comes from provider-backed identity, domain, industry, and employee evidence, not brand recognition."}};
}

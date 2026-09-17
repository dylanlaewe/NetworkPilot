import {createHash} from "node:crypto";
import type {TargetCompany} from "./types";
const agencySignals=/\b(staffing|recruiting|recruitment|talent solutions|placement|headhunt|employment agency)\b/i;
const scamSignals=/\b(crypto returns|guaranteed income|work from home earnings|shell company)\b/i;
export interface CompanyDiscoveryResult {eligible:boolean;reason:string|null;company:TargetCompany|null;kind:"preferred"|"discovered"|"blocked";}
export function classifyDiscoveredCompany(input:{name:string;domain?:string;industrySignal?:string;preferred?:TargetCompany|null;suppressed?:boolean}):CompanyDiscoveryResult{
  if(input.preferred)return{eligible:input.preferred.enabled&&input.preferred.tier!=="excluded"&&input.preferred.tier!=="unreviewed",reason:null,company:input.preferred,kind:"preferred"};
  const name=input.name.trim().replace(/\s+/g," "),domain=input.domain?.trim().toLowerCase().replace(/^www\./,"");
  const reason=input.suppressed?"company-suppressed":agencySignals.test(name)?"company-agency":scamSignals.test(name)?"company-scam-indicator":name.length<2||!domain||!domain.includes(".")?"company-identity-unverifiable":null;
  if(reason)return{eligible:false,reason,company:null,kind:"blocked"};
  const industryId=input.industrySignal&&["consulting","financial-services","commodities-energy","technology-ai","defense-aerospace"].includes(input.industrySignal)?input.industrySignal:"technology-ai";
  const id=`discovered-${createHash("sha256").update(domain!).digest("hex").slice(0,16)}`;
  return{eligible:true,reason:null,kind:"discovered",company:{id,canonicalName:name,industryId,tier:"tier-2",enabled:true,recognitionScore:50,careerUpsideScore:55,technicalInterestScore:55,geographicRelevance:["broader-us","remote-us"],rationale:"Legitimate employer discovered from an authorized provider result; no preferred-brand assumption.",provenance:"authorized-provider-discovery",lastReviewedDate:"1970-01-01",operatorNotes:"Discovered company; eligibility comes from identity and role evidence, not brand recognition."}};
}

import type {ImportedCandidateSnapshot} from "@/application/ingestion";
export function planRecruiterCandidates(candidates:readonly ImportedCandidateSnapshot[],blockedCompanies:ReadonlySet<string>,contacted:ReadonlySet<string>,maximum=5):ImportedCandidateSnapshot[]{
  const selected:ImportedCandidateSnapshot[]=[],companies=new Set<string>();
  for(const candidate of [...candidates].sort((a,b)=>(b.recruiterClassification?.score??0)-(a.recruiterClassification?.score??0)||a.id.localeCompare(b.id))){const company=candidate.strategyCompanyMatch?.companyId;if(candidate.outreachTrack!=="recruiter"||!candidate.recruiterClassification?.accepted||candidate.source.email.verificationStatus!=="verified"||candidate.source.consent.suppressed||candidate.source.consent.optedOut||candidate.state!=="eligible"||!company||blockedCompanies.has(company)||companies.has(company)||contacted.has(candidate.id))continue;selected.push(candidate);companies.add(company);if(selected.length===maximum)break;}
  return selected;
}

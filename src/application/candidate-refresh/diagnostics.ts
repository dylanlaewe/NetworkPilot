export interface RefreshDiagnostics {
  searchCalls:number;
  searchPages:Array<{query:string;page:number;raw:number;normalized:number}>;
  rawCandidates:number;normalizedCandidates:number;uniqueCandidates:number;
  rawUniqueEmployers:number;rawPreferredEmployers:number;rawDiscoveredEmployers:number;rawUnknownEmployerRecords:number;
  shortlistSize:number;preferredAttempts:number;discoveredAttempts:number;professionalAttempts:number;recruiterAttempts:number;
  verifiedEmails:number;qualifiedProfessionals:number;qualifiedRecruiters:number;qualifiedPreferred:number;qualifiedDiscovered:number;
  candidatesAdded:number;qualifiedCandidatesAdded:number;uniqueCompaniesAdded:number;productCandidatesAdded:number;
  enrichmentAttempts:number;observedCreditsUsed:number|null;estimatedCreditsUsed:number;rejectionReasons:Record<string,number>;failure:string|null;
}
export const emptyRefreshDiagnostics=():RefreshDiagnostics=>({searchCalls:0,searchPages:[],rawCandidates:0,normalizedCandidates:0,uniqueCandidates:0,rawUniqueEmployers:0,rawPreferredEmployers:0,rawDiscoveredEmployers:0,rawUnknownEmployerRecords:0,shortlistSize:0,preferredAttempts:0,discoveredAttempts:0,professionalAttempts:0,recruiterAttempts:0,verifiedEmails:0,qualifiedProfessionals:0,qualifiedRecruiters:0,qualifiedPreferred:0,qualifiedDiscovered:0,candidatesAdded:0,qualifiedCandidatesAdded:0,uniqueCompaniesAdded:0,productCandidatesAdded:0,enrichmentAttempts:0,observedCreditsUsed:null,estimatedCreditsUsed:0,rejectionReasons:{},failure:null});

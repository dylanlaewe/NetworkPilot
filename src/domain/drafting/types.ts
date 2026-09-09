export interface SenderFact { id:string; value:string; category:"identity"|"education"|"experience"|"skills"|"scale"|"interest"|"geography"|"direction"; approved:boolean; enabled:boolean; }
export interface FactFragment { id:string; factIds:string[]; render:(facts:ReadonlyMap<string,SenderFact>)=>string; claimMarkers:string[]; }
export interface PersonalizationEvidence { id:string; sourceType:"fictional-simulation"; sourceReference:string; reviewedAt:string; claim:string; verificationStatus:"verified"|"unverified"; }
export type OutreachLane="data-analytics"|"engineering-technical"|"project-operations"|"consulting"|"finance"|"commodities-energy"|"defense-technology"|"career-path-leader";
export interface DraftTemplate { id:string; laneId:OutreachLane; variantId:"direct-practical"|"career-curiosity"|"common-ground"; catalogVersion:string; version:string; displayName:string; fragmentIds:string[]; factIds:string[]; structure:"facts-first"|"reason-first"|"experience-first"; subject:string; reason:string; question:string; }
export interface DraftRecipient { id:string; firstName:string; companyName:string; roleFamilyId:string; industryId:string; personaId:string; professionalTitle?:string; primaryRecipientFunction?:string; }
export interface DraftContext { runId:string; }
export interface DraftTemplateSelection {template:DraftTemplate;reason:string;}
export interface RenderedDraft { subject:string; body:string; templateId:string; templateVersion:string; templateCatalogVersion:string; referencedFactIds:string[]; evidenceIds:string[]; generatedAt:string; status:"draft-only-simulation"; usedEvidence:boolean; }

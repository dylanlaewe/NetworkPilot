export interface SenderFact { id: string; value: string; category: "identity"|"education"|"experience"|"skills"|"scale"|"interest"|"geography"|"direction"; approved: true; }
export interface PersonalizationEvidence { id: string; sourceType: "fictional-simulation"; sourceReference: string; reviewedAt: string; claim: string; verificationStatus: "verified"|"unverified"; }
export interface DraftTemplate { id: string; version: string; displayName: string; roleFamilyIds: string[]; industryIds: string[]; personaIds: string[]; factIds: string[]; subject: string; reason: string; question: string; }
export interface DraftRecipient { id: string; firstName: string; companyName: string; roleFamilyId: string; industryId: string; personaId: string; }
export interface RenderedDraft { subject: string; body: string; templateId: string; templateVersion: string; referencedFactIds: string[]; evidenceIds: string[]; generatedAt: string; status: "draft-only-simulation"; usedEvidence: boolean; }

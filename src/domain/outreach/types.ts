export type CompanyId = string;
export type ProspectId = string;
export const INDUSTRIES = ["Consulting", "Finance", "Commodities", "Technology", "Defense"] as const;
export type Industry = (typeof INDUSTRIES)[number];
export interface Prospect { id: ProspectId; firstName: string; lastName: string; companyId: CompanyId; companyName: string; industry: Industry; email: string; emailVerified: boolean; yearsExperience: number; suppressed: boolean; optedOut: boolean; /** @deprecated Migration-only input; targeting-first planning never reads it. */ relevanceScore: number; }
export const OUTREACH_EVENT_TYPES = ["qualified", "rejected", "selected", "drafted", "simulated-sent", "actually-sent", "operator-confirmed-manual-send", "replied", "suppressed", "cancelled"] as const;
export type OutreachEventType = (typeof OUTREACH_EVENT_TYPES)[number];
export const CONTACT_IMPACTING_EVENT_TYPES: ReadonlySet<OutreachEventType> = new Set(["simulated-sent", "actually-sent", "operator-confirmed-manual-send"]);
export interface OutreachEvent { prospectId: ProspectId; companyId: CompanyId; type: OutreachEventType; occurredAt: Date; }
export const DECISION_REASON_CODES = ["suppressed", "opted-out", "email-unverified", "insufficient-experience", "previously-contacted", "company-in-cooldown", "duplicate-company-in-run", "eligible-below-cutoff", "selected"] as const;
export type DecisionReasonCode = (typeof DECISION_REASON_CODES)[number];
export interface QualificationDecision { prospect: Prospect; reasonCode: DecisionReasonCode; accepted: boolean; }
export interface SelectionConfig { minimumDailyTarget: number; maximumDailyTarget: number; companyCooldownDays: number; minimumYearsExperience: number; campaignTimezone: string; }
export interface SelectionOptions { now: () => Date; random: () => number; config?: Partial<SelectionConfig>; }
export interface DailySelectionResult { date: string; target: number; selected: Prospect[]; decisions: QualificationDecision[]; isWeekday: boolean; shortfall: number; }

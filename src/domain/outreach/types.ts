export type CompanyId = string;
export type ProspectId = string;

export const INDUSTRIES = [
  "Consulting",
  "Finance",
  "Commodities",
  "Technology",
  "Defense",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export interface Prospect {
  id: ProspectId;
  firstName: string;
  lastName: string;
  companyId: CompanyId;
  companyName: string;
  industry: Industry;
  email: string;
  emailVerified: boolean;
  yearsExperience: number;
  suppressed: boolean;
  optedOut: boolean;
  relevanceScore: number;
}

export type OutreachEventType = "selected" | "sent" | "replied" | "opted-out";

export interface OutreachEvent {
  prospectId: ProspectId;
  companyId: CompanyId;
  type: OutreachEventType;
  occurredAt: Date;
}

export interface SelectionConfig {
  minimumDailyTarget: number;
  maximumDailyTarget: number;
  companyCooldownDays: number;
  minimumYearsExperience: number;
}

export interface SelectionOptions {
  now: () => Date;
  random: () => number;
  config?: Partial<SelectionConfig>;
}

export interface DailySelectionResult {
  date: string;
  target: number;
  selected: Prospect[];
  isWeekday: boolean;
  shortfall: number;
}

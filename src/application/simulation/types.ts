import type { DecisionReasonCode, Industry, Prospect } from "@/domain/outreach";
import type { CampaignPlanStatus, PlanningCandidate, QuotaRelaxation, TargetingPlanSnapshot } from "@/domain/planning";

export interface RunSummary {
  id: string;
  campaignDate: string;
  campaignTimezone: string;
  startedAtUtc: string;
  completedAtUtc: string;
  status: "completed" | "weekend-no-send";
  target: number;
  selectedCount: number;
  shortfall: number;
  existing: boolean;
}
export interface PersistedDecision {
  prospectId: string;
  reasonCode: DecisionReasonCode;
  accepted: boolean;
  prospectName: string;
  companyName: string;
  industry: Industry;
  email: string;
  yearsExperience: number;
  relevanceScore: number;
}
export interface SimulationRunView extends RunSummary { decisions: PersistedDecision[]; selected: PersistedDecision[]; }
export interface CampaignPlanView { id:string; status:CampaignPlanStatus; planVersion:string; targetingVersion:string; decisions:TargetingPlanSnapshot[]; selected:TargetingPlanSnapshot[]; quotaRelaxations:QuotaRelaxation[]; }
export interface DashboardData { today: string; isWeekday: boolean; timezone: string; latestRun: SimulationRunView | null; latestPlan:CampaignPlanView|null; recentRuns: RunSummary[]; suppressionCount: number; prospectCount: number; simulationReady: boolean; }
export interface CreateRunInput { instant: Date; random: () => number; }
export interface SimulationRepository {
  transaction<T>(work: () => T): T;
  getSetting(key: string): string | undefined;
  getDatasetStatus(): { datasetType?: string; prospectCount: number };
  setSetting(key: string, value: string, at: Date): void;
  findRunByDate(date: string): SimulationRunView | null;
  listProspects(): Prospect[];
  listPlanningCandidates(): PlanningCandidate[];
  listOutreachEvents(): import("@/domain/outreach").OutreachEvent[];
  createRun(run: Omit<RunSummary, "existing">): void;
  createDecisions(runId: string, decisions: import("@/domain/outreach").QualificationDecision[]): void;
  createCampaignPlan(input:{id:string;planVersion:string;targetingVersion:string;status:CampaignPlanStatus;diversificationConfig:unknown;quotaRelaxations:QuotaRelaxation[];at:Date}):void;
  createPlanDecisions(planId:string,decisions:TargetingPlanSnapshot[]):void;
  findCampaignPlan(planId:string):CampaignPlanView|null;
  updateCampaignPlanStatus(planId:string,status:CampaignPlanStatus,at:Date):void;
  createSimulatedSendEvents(runId: string, prospects: Prospect[], at: Date): void;
  recentRuns(limit: number): RunSummary[];
  countSuppressions(): number;
  countProspects(): number;
}

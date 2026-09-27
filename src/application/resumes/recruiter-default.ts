import type { ResumeRepository } from "./types";
export interface ResumeSelection { resumeId: string | null; decisionRequired: boolean; source: "configured-default" | "explicit" | "none" | "unavailable"; }
export function initialResumeSelection(track: "professional" | "recruiter", repository: Pick<ResumeRepository, "getRecruiterDefaultResumeId" | "findResume">): ResumeSelection {
  if (track !== "recruiter") return { resumeId: null, decisionRequired: false, source: "none" };
  const id = repository.getRecruiterDefaultResumeId(), record = id ? repository.findResume(id) : null;
  return record?.active ? { resumeId: record.id, decisionRequired: false, source: "configured-default" } : { resumeId: null, decisionRequired: true, source: "unavailable" };
}

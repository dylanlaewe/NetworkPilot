"use server";
import { revalidatePath } from "next/cache";
import { generateDraftsForRun } from "@/application/drafts";
import type { DraftStatus } from "@/application/drafts";
import { getSimulationRepository } from "@/infrastructure/sqlite/runtime";
export async function generateRunDrafts(formData:FormData):Promise<void>{const runId=String(formData.get("runId")??"");if(!runId)throw new Error("A completed fictional simulation run is required");generateDraftsForRun(getSimulationRepository(),runId,()=>new Date());revalidatePath("/draft-studio");}
export async function changeDraftStatus(formData:FormData):Promise<void>{const id=String(formData.get("draftId")??"");const status=String(formData.get("status")??"") as DraftStatus;if(status!=="approved-for-simulation"&&status!=="rejected")throw new Error("Invalid simulation draft transition");getSimulationRepository().updateDraftStatus(id,status,new Date());revalidatePath("/draft-studio");}

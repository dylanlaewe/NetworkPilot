"use server";
import {revalidatePath} from "next/cache";
import {runCandidateRefresh} from "@/infrastructure/sqlite/candidate-refresh";
export async function refreshCandidates(formData:FormData){if(formData.get("confirmation")!=="confirmed")throw new Error("candidate-refresh-confirmation-required");await runCandidateRefresh({allowProvider:formData.get("allowProvider")==="yes"});revalidatePath("/candidates");revalidatePath("/today");}

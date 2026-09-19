"use server";
import {revalidatePath} from "next/cache";
import {runCandidateRefresh} from "@/infrastructure/sqlite/candidate-refresh";
import {redirect} from "next/navigation";
export async function refreshCandidates(formData:FormData){if(formData.get("confirmation")!=="confirmed")throw new Error("candidate-refresh-confirmation-required");const result=await runCandidateRefresh({allowProvider:formData.get("allowProvider")==="yes"});revalidatePath("/candidates");revalidatePath("/today");const query=new URLSearchParams({added:String(result.qualifiedCandidatesAdded),professional:String(result.professionalCandidatesAdded),recruiter:String(result.recruiterCandidatesAdded),companies:String(result.companiesAdded),credits:String(result.enrichmentCreditsUsed)});redirect(`/candidates?${query}`);}

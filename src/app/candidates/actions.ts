"use server";
import {revalidatePath} from "next/cache";
import {runCandidateRefresh} from "@/infrastructure/sqlite/candidate-refresh";
import {parseBucketScope} from "@/domain/recipient-buckets";
import {redirect} from "next/navigation";

export async function refreshCandidates(formData:FormData){
  if(formData.get("confirmation")!=="confirmed")throw new Error("candidate-refresh-confirmation-required");
  const bucket=formData.get("bucket"),scope=typeof bucket==="string"?parseBucketScope({bucket,earlyCareerOnly:formData.get("earlyCareerOnly")==="true"}):undefined,requestId=formData.get("requestId");
  let result;
  try{
    const requested=Number(formData.get("requested")??5);
    result=await runCandidateRefresh({allowProvider:formData.get("allowProvider")==="yes",scope,requestId:typeof requestId==="string"?requestId:undefined,requested:scope?requested:undefined});
  }catch(error){
    if(scope&&error instanceof Error&&error.message==="scoped-discovery-live-validation-required"){
      const query=new URLSearchParams({bucket:scope.bucket,refreshError:"scoped-provider-validation-required"});
      if(scope.earlyCareerOnly)query.set("earlyCareerOnly","true");
      redirect(`/candidates?${query}`);
    }
    throw error;
  }
  revalidatePath("/candidates");
  revalidatePath("/today");
  const query=new URLSearchParams({
    added:String(result.added??result.qualifiedCandidatesAdded),
    professional:String(result.professionalCandidatesAdded),
    recruiter:String(result.recruiterCandidatesAdded),
    companies:String(result.companiesAdded),
    credits:String(result.enrichmentCreditsUsed),
  });
  if(result.requested!==undefined)query.set("requested",String(result.requested));
  if(result.searchedCandidates!==undefined)query.set("searched",String(result.searchedCandidates));
  if(result.enrichedCandidates!==undefined)query.set("enriched",String(result.enrichedCandidates));
  if(result.rejectedCandidates!==undefined)query.set("rejected",String(result.rejectedCandidates));
  query.set("qualified",String(result.qualifiedCandidatesAdded));
  if(result.shortfallCode)query.set("shortfallCode",result.shortfallCode);
  if(scope){query.set("bucket",scope.bucket);if(scope.earlyCareerOnly)query.set("earlyCareerOnly","true");}
  redirect(`/candidates?${query}`);
}

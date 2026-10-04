"use server";
import {revalidatePath} from "next/cache";
import {runCandidateRefresh} from "@/infrastructure/sqlite/candidate-refresh";
import {parseBucketScope} from "@/domain/recipient-buckets";
import {redirect} from "next/navigation";
import {ScopedDiscoveryReadinessError} from "@/application/candidate-refresh/scoped-readiness";
import {reviewCompanyTrust} from "@/application/company-trust";
import {fiveBucketEnabled} from "@/domain/recipient-buckets";
import {resolveManualOutreachDatabaseSelection} from "@/infrastructure/sqlite/manual-outreach-operator";
import {openRuntimeRepository} from "@/infrastructure/sqlite/runtime";

const TRUST_DECISIONS = [
  "trusted-operating",
  "disallowed-recruiting-service",
] as const;

export async function reviewCandidateCompanyTrust(formData: FormData) {
  if (!fiveBucketEnabled()) throw new Error("five-bucket-disabled");
  const candidateId = String(formData.get("candidateId") ?? "").trim();
  const commandId = String(formData.get("commandId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const decision = String(formData.get("decision") ?? "");
  const expectedVersion = Number(formData.get("expectedVersion"));
  const reviewedAt = new Date(String(formData.get("reviewedAt") ?? ""));
  if (!candidateId) throw new Error("company-trust-candidate-required");
  if (!TRUST_DECISIONS.includes(decision as (typeof TRUST_DECISIONS)[number]))
    throw new Error("company-trust-decision-invalid");
  if (!reason || reason.length > 500)
    throw new Error("company-trust-reason-required");
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0)
    throw new Error("company-trust-version-invalid");
  if (!Number.isFinite(reviewedAt.getTime()))
    throw new Error("company-trust-time-invalid");
  const now = Date.now();
  if (
    reviewedAt.getTime() < now - 24 * 60 * 60 * 1000 ||
    reviewedAt.getTime() > now + 5 * 60 * 1000
  )
    throw new Error("company-trust-time-outside-review-window");

  const repository = openRuntimeRepository(
    resolveManualOutreachDatabaseSelection().path,
  );
  try {
    const candidate = repository
      .listImportedCandidates()
      .find((item) => item.id === candidateId);
    if (!candidate) throw new Error("candidate-not-found");
    const companyId = candidate.strategyCompanyMatch?.companyId;
    if (!companyId) throw new Error("company-trust-company-required");
    reviewCompanyTrust(repository, {
      commandId,
      companyId,
      identity: {
        employerDomain: candidate.source.currentOrganization.domain,
        providerNamespace: candidate.source.currentOrganization.providerId
          ? candidate.source.sourceProviderId
          : null,
        providerEmployerId:
          candidate.source.currentOrganization.providerId ?? null,
      },
      expectedVersion,
      resultingTrustState: decision as (typeof TRUST_DECISIONS)[number],
      reason,
      reviewerActor: "local-operator",
      sourceReference: `candidates-ui:${candidate.id}`,
      at: reviewedAt,
    });
  } finally {
    repository.close();
  }
  revalidatePath("/candidates");
  revalidatePath("/today");
  revalidatePath("/drafts");
  revalidatePath("/candidate-review");
}

export async function refreshCandidates(formData:FormData){
  if(formData.get("confirmation")!=="confirmed")throw new Error("candidate-refresh-confirmation-required");
  const bucket=formData.get("bucket"),scope=typeof bucket==="string"?parseBucketScope({bucket,earlyCareerOnly:formData.get("earlyCareerOnly")==="true"}):undefined,requestId=formData.get("requestId");
  let result;
  try{
    const requested=Number(formData.get("requested")??5);
    result=await runCandidateRefresh({allowProvider:formData.get("allowProvider")==="yes",scope,requestId:typeof requestId==="string"?requestId:undefined,requested:scope?requested:undefined});
  }catch(error){
    if(scope&&error instanceof ScopedDiscoveryReadinessError){
      const query=new URLSearchParams({bucket:scope.bucket,refreshError:"scoped-readiness-blocked"});
      if(scope.earlyCareerOnly)query.set("earlyCareerOnly","true");
      redirect(`/candidates?${query}`);
    }
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

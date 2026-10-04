import { NetworkCommandShell } from "@/app/network-command-shell";
import { loadDailyCommandCenter } from "@/infrastructure/sqlite/daily-command-center";
import { CandidateRefreshControl } from "./refresh-control";
import { CandidatesWorkspace } from "./candidates-workspace";
import {
  fiveBucketEnabled,
  RECIPIENT_BUCKETS,
} from "@/domain/recipient-buckets";
import type {
  BucketSelection,
  RecipientBucketCounts,
} from "@/app/recipient-bucket-navigation";
import { readApolloConfig } from "@/infrastructure/providers/apollo/config";
import {loadBucketReserveMetrics} from "@/infrastructure/sqlite/bucket-reserve";
import {loadScopedDiscoveryReadiness} from "@/infrastructure/sqlite/candidate-refresh";
import {migrationRequiredView} from "@/app/migration-required";

export const dynamic = "force-dynamic";

async function renderCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    selected?: string;
    filters?: string;
    added?: string;
    searched?: string;
    enriched?: string;
    qualified?: string;
    rejected?: string;
    professional?: string;
    recruiter?: string;
    companies?: string;
    credits?: string;
    requested?: string;
    shortfallCode?: string;
    refreshError?: string;
    bucket?: string;
    earlyCareerOnly?: string;
  }>;
}) {
  const data = loadDailyCommandCenter(),
    params = await searchParams,
    bucketEnabled = fiveBucketEnabled(),
    requestedBucket = params.bucket ?? "all",
    selectedBucket: BucketSelection =
      requestedBucket === "legacy" ||
      requestedBucket === "all" ||
      RECIPIENT_BUCKETS.includes(
        requestedBucket as (typeof RECIPIENT_BUCKETS)[number],
      )
        ? (requestedBucket as BucketSelection)
        : "all",
    earlyCareerOnly =
      selectedBucket === "peers" && params.earlyCareerOnly === "true",
    counts = Object.fromEntries(
      RECIPIENT_BUCKETS.map((bucket) => [
        bucket,
        data.reserve.filter((row) => row.recipientBucket?.bucket === bucket)
          .length,
      ]),
    ) as RecipientBucketCounts,
    legacyCount = data.reserve.filter(
      (row) => !row.recipientBucket?.bucket,
    ).length;
  if (earlyCareerOnly)
    counts.peers = data.reserve.filter(
      (row) =>
        row.recipientBucket?.bucket === "peers" &&
        row.recipientBucket.earlyCareer,
    ).length;
  const scopedBucket =
      selectedBucket !== "all" && selectedBucket !== "legacy"
        ? selectedBucket
        : undefined,
    scopeRows = scopedBucket
      ? data.reserve.filter(
          (row) =>
            row.recipientBucket?.bucket === scopedBucket &&
            (!earlyCareerOnly || row.recipientBucket.earlyCareer),
        )
      : selectedBucket === "legacy"
        ? []
        : data.reserve,
    scopedAvailable = scopeRows.filter(
      (row) =>
        row.stage === "qualified-available" &&
        (!bucketEnabled || row.recipientBucket?.reviewState === "accepted"),
    ),
    metrics=bucketEnabled&&scopedBucket?loadBucketReserveMetrics({bucket:scopedBucket,...earlyCareerOnly?{earlyCareerOnly:true}:{}}):null,
    sourcingReadiness=bucketEnabled&&scopedBucket?loadScopedDiscoveryReadiness({bucket:scopedBucket,...earlyCareerOnly?{earlyCareerOnly:true}:{}}):undefined,
    showResult = params.added !== undefined;
  const refreshRequestId = crypto.randomUUID(),
    apolloConfig = readApolloConfig(process.env);
  const workspaceCandidates = data.reserve.map((candidate) => ({
    ...candidate,
    ...(candidate.employerTrust?.state === "unverified" && candidate.companyId
      ? {
          companyTrustReview: {
            commandId: `company-trust-ui:${crypto.randomUUID()}`,
            reviewedAt: new Date().toISOString(),
          },
        }
      : {}),
  }));
  const health =
    data.safety.apolloExposure >= apolloConfig.maxEnrichmentsPerDay
      ? "Candidate refresh available tomorrow"
      : `${data.pipeline.available} candidates available · ${Math.max(0, apolloConfig.maxEnrichmentsPerDay - data.safety.apolloExposure)} refresh credits available`;
  const refresh = (
    <CandidateRefreshControl
      available={metrics?.actionableCapacity??scopedAvailable.length}
      totalReserve={metrics?.totalReserve??scopeRows.length}
      exposure={data.safety.apolloExposure}
      maximumPerBatch={apolloConfig.maxEnrichmentsPerBatch}
      maximumPerDay={apolloConfig.maxEnrichmentsPerDay}
      fiveBucketEnabled={bucketEnabled}
      bucket={scopedBucket}
      earlyCareerOnly={earlyCareerOnly}
      legacyView={bucketEnabled && selectedBucket === "legacy"}
      requestId={bucketEnabled && scopedBucket ? refreshRequestId : undefined}
      readiness={sourcingReadiness}
    />
  );
  const result =
    params.refreshError === "scoped-readiness-blocked"
      ? "No candidates were added. Find More is blocked until its local data and provider readiness checks pass."
      : params.refreshError === "scoped-provider-validation-required"
      ? "No candidates were added. This bucket’s provider search needs validation before it can continue; the existing reserve was left unchanged."
      : showResult
        ? `${params.searched ?? 0} searched · ${params.enriched ?? 0} enriched · ${params.qualified ?? params.added ?? 0} qualified · ${params.added} added · ${params.rejected ?? 0} rejected${params.requested && Number(params.added) < Number(params.requested) ? ` · ${Number(params.requested) - Number(params.added)} shortfall` : ""} · ${params.companies ?? 0} companies · ${params.credits ?? 0} credits used${params.shortfallCode ? ` · ${params.shortfallCode.replaceAll("-", " ")}` : ""}`
        : null;
  const bucketNavigation = bucketEnabled
    ? {
        enabled: true as const,
        current: "candidates" as const,
        selected: selectedBucket,
        counts,
        total: data.reserve.length,
        legacyCount,
        earlyCareerOnly,
        preservedQuery: {
          earlyCareerOnly: earlyCareerOnly ? "true" : undefined,
        },
      }
    : undefined;
  return (
    <NetworkCommandShell
      current="candidates"
      status={health}
      bucketNavigation={bucketNavigation}
    >
      <CandidatesWorkspace
        candidates={workspaceCandidates}
        initialSelectedId={params.selected}
        initialFilterOpen={params.filters === "open"}
        refreshControl={refresh}
        refreshResult={result}
        bucketNavigation={bucketNavigation}
        actionableCapacity={metrics?.actionableCapacity}
      />
    </NetworkCommandShell>
  );
}
export default async function CandidatesPage(input:{searchParams:Promise<{selected?:string;filters?:string;added?:string;searched?:string;enriched?:string;qualified?:string;rejected?:string;professional?:string;recruiter?:string;companies?:string;credits?:string;requested?:string;shortfallCode?:string;refreshError?:string;bucket?:string;earlyCareerOnly?:string}>}){try{return await renderCandidatesPage(input);}catch(error){return migrationRequiredView(error);}}

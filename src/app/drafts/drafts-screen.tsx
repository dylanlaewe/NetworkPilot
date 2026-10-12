import { notFound } from "next/navigation";
import { draftAdditionMessage } from "@/application/daily-refresh/addition-feedback";
import {
  humanDraftError,
  humanEditError,
  humanSendError,
} from "@/application/command-center-drafts";
import { activeDrafts } from "@/application/product-workflow";
import { loadCommandCenterDraftReviews } from "@/infrastructure/sqlite/command-center-drafts";
import { loadDailyCommandCenter } from "@/infrastructure/sqlite/daily-command-center";
import { DraftsWorkspace } from "./drafts-workspace";
import { buildWorkspaceDrafts, buildWorkspaceResumes } from "./workspace-data";
import {
  fiveBucketEnabled,
  RECIPIENT_BUCKETS,
} from "@/domain/recipient-buckets";
import type {
  BucketSelection,
  RecipientBucketCounts,
} from "@/app/recipient-bucket-navigation";
import {
  loadBucketReserveMetricsForScopes,
} from "@/infrastructure/sqlite/bucket-reserve";

export interface DraftsSearchParams {
  candidate?: string;
  error?: string;
  gmailError?: string;
  sendError?: string;
  sendStatus?: string;
  skipStatus?: string;
  replacementStatus?: string;
  reconciliationStatus?: string;
  bucketCorrection?: string;
  added?: string;
  requested?: string;
  reserveRemaining?: string;
  bucket?: string;
  earlyCareerOnly?: string;
  gmailStatus?: string;
  add?: string;
}

function feedback(params: DraftsSearchParams) {
  if (params.error)
    return { tone: "error" as const, message: humanEditError(params.error) };
  if (params.gmailError)
    return {
      tone: "error" as const,
      message: humanDraftError(params.gmailError),
    };
  if (params.sendError)
    return {
      tone: "error" as const,
      message: humanSendError(params.sendError),
    };
  if (params.sendStatus === "sent")
    return {
      tone: "success" as const,
      message: "Sent. Continue with the next draft.",
    };
  if (params.gmailStatus === "created")
    return {
      tone: "success" as const,
      message: "Approved and created in Gmail. Review once more before sending.",
    };
  if (params.reconciliationStatus === "recorded")
    return { tone: "success" as const, message: "Send status recorded." };
  if (params.bucketCorrection === "keep-edits")
    return {
      tone: "success" as const,
      message:
        "Your edits were kept against the corrected bucket. The draft remains unapproved.",
    };
  if (params.bucketCorrection === "regenerate")
    return {
      tone: "success" as const,
      message:
        "The draft was regenerated from the corrected bucket. It remains unapproved.",
    };
  if (params.skipStatus === "skipped")
    return {
      tone: "success" as const,
      message: "Skipped without contact, cooldown, or suppression.",
    };
  if (params.skipStatus === "excluded")
    return {
      tone: "success" as const,
      message: "Person removed from future outreach.",
    };
  if (params.replacementStatus === "ready")
    return {
      tone: "success" as const,
      message: "Replacement added from the qualified reserve.",
    };
  if (params.replacementStatus === "empty")
    return {
      tone: "caution" as const,
      message: "No eligible replacement is available in the qualified reserve.",
    };
  if (params.added !== undefined)
    return {
      tone:
        Number(params.added) > 0 ? ("success" as const) : ("caution" as const),
      message: draftAdditionMessage(
        Number(params.added) || 0,
        Number(params.requested) || 0,
        Number(params.reserveRemaining) || 0,
      ),
    };
  return null;
}

export async function DraftsScreen({
  params,
  reviewMode = false,
}: {
  params: DraftsSearchParams;
  reviewMode?: boolean;
}) {
  const workflowPromise = loadCommandCenterDraftReviews();
  const commandCenter = loadDailyCommandCenter();
  const workflow = await workflowPromise;
  const rows = activeDrafts(workflow.items, commandCenter.drafts);
  const candidateId = params.candidate
    ? decodeURIComponent(params.candidate)
    : undefined;
  if (
    reviewMode &&
    (!candidateId ||
      !rows.some((row) => row.review.candidateId === candidateId))
  )
    notFound();
  const drafts = buildWorkspaceDrafts({
      rows,
      outreach: commandCenter.drafts,
      readiness: workflow.gmail.readiness,
    }),
    bucketEnabled = fiveBucketEnabled(),
    requested = params.bucket ?? "all",
    selectedBucket: BucketSelection =
      requested === "legacy" ||
      requested === "all" ||
      RECIPIENT_BUCKETS.includes(
        requested as (typeof RECIPIENT_BUCKETS)[number],
      )
        ? (requested as BucketSelection)
        : "all",
    bucketCounts = Object.fromEntries(
      RECIPIENT_BUCKETS.map((bucket) => [
        bucket,
        drafts.filter((draft) => draft.recipientBucket?.bucket === bucket)
          .length,
      ]),
    ) as RecipientBucketCounts;
  const earlyCareerOnly =
    selectedBucket === "peers" && params.earlyCareerOnly === "true";
  if (earlyCareerOnly)
    bucketCounts.peers = drafts.filter(
      (draft) =>
        draft.recipientBucket?.bucket === "peers" &&
        draft.recipientBucket.earlyCareer,
    ).length;
  const scopedReserve = !bucketEnabled ? commandCenter.reserve.filter((candidate) => candidate.stage === "qualified-available") : [];
  const reserveMetrics = bucketEnabled ? loadBucketReserveMetricsForScopes([...RECIPIENT_BUCKETS.map((bucket) => ({ bucket })), { bucket: "peers", earlyCareerOnly: true }]) : null;
  const reserveCapacity = reserveMetrics ? Object.fromEntries(RECIPIENT_BUCKETS.map((bucket) => [bucket, reserveMetrics.byBucket[bucket]?.actionableCapacity ?? 0])) : undefined;
  const hasReserve = !bucketEnabled ? scopedReserve.length > 0 : selectedBucket === "legacy" ? false : selectedBucket === "all" ? Boolean(reserveMetrics?.actionableCapacity) : Boolean(reserveCapacity?.[selectedBucket]);
  const bucketNavigation = bucketEnabled
    ? {
        enabled: true as const,
        current: "drafts" as const,
        selected: selectedBucket,
        counts: bucketCounts,
        total: drafts.length,
        legacyCount: drafts.filter((draft) => !draft.recipientBucket?.bucket)
          .length,
        earlyCareerOnly,
        preservedQuery: {
          earlyCareerOnly: earlyCareerOnly ? "true" : undefined,
        },
      }
    : undefined;
  return (
    <DraftsWorkspace
      drafts={drafts}
      resumes={buildWorkspaceResumes(workflow.resumes)}
      gmailAvailable={workflow.gmail.readiness.available}
      gmailReason={
        workflow.gmail.readiness.reason
          ? humanDraftError(workflow.gmail.readiness.reason)
          : null
      }
      hasReserve={hasReserve}
      reserveCapacity={reserveCapacity}
      earlyCareerPeerCapacity={reserveMetrics?.byScope["peers:early-career"]?.actionableCapacity}
      initialCandidateId={candidateId}
      initialMobileReview={reviewMode || drafts.length > 0}
      feedback={feedback(params)}
      bucketNavigation={bucketNavigation}
      addRequestId={crypto.randomUUID()}
      initialAddOpen={params.add === "true"}
    />
  );
}

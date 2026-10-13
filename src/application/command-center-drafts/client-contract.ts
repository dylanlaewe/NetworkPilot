import type { GmailDraftOperation } from "@/application/email-drafts";

export interface GmailDraftReadinessInput {
  featureEnabled: boolean;
  connected: boolean;
  scopeValid: boolean;
  providerConfigured: boolean;
  credentialAvailable: boolean;
  credentialScopeValid: boolean;
  accountPinned: boolean;
}

export interface GmailDraftReadiness {
  available: boolean;
  reason: string | null;
}

interface DraftSendReview {
  operation: GmailDraftOperation | null;
  blockedReason: string | null;
}

export function gmailDraftReadiness(
  input: GmailDraftReadinessInput,
): GmailDraftReadiness {
  const reason = !input.featureEnabled
    ? "gmail-feature-disabled"
    : !input.connected
      ? "gmail-connection-invalid"
      : !input.scopeValid
        ? "gmail-scope-invalid"
        : !input.providerConfigured
          ? "gmail-oauth-configuration-missing"
          : !input.credentialAvailable
            ? "gmail-credential-unavailable"
            : !input.credentialScopeValid
              ? "gmail-credential-scope-invalid"
              : !input.accountPinned
                ? "gmail-account-unpinned"
                : null;
  return { available: reason === null, reason };
}

export function gmailSendBlockReason(
  review: DraftSendReview,
  readiness: GmailDraftReadiness,
): string | null {
  if (review.operation?.sendState === "sent") return null;
  if (
    review.operation?.sendState === "sending" ||
    review.operation?.sendState === "send-status-uncertain"
  )
    return "gmail-send-reconciliation-required";
  if (
    review.operation?.state !== "gmail-draft-created" ||
    !review.operation.gmailDraftId
  )
    return "gmail-send-draft-unavailable";
  if (
    review.blockedReason &&
    review.blockedReason !== "existing-gmail-draft"
  )
    return review.blockedReason;
  return readiness.reason;
}

export const humanDraftError = (code: string): string =>
  ({
    "bucket-correction-copy-review-required":
      "Review the corrected bucket and explicitly keep your edits or regenerate this unapproved message.",
    "recipient-bucket-review-required":
      "Review the recipient bucket evidence before approval or externalization.",
    "five-bucket-disabled":
      "The five-bucket feature is disabled for new actions.",
    "recruiter-resume-decision-required":
      "Choose an active resume or explicitly continue without an attachment.",
    "resume-copy-mismatch":
      "Remove the attachment claim for review or select an active resume.",
    suppressed: "This contact is suppressed and cannot be contacted.",
    "opted-out": "This contact opted out and cannot be contacted.",
    "previous-contact": "This person was already contacted.",
    "company-cooldown": "Someone at this company was contacted recently.",
    "existing-gmail-draft":
      "A Gmail draft already exists for this exact approved message.",
    "gmail-feature-disabled":
      "Gmail draft creation is unavailable because the local Gmail draft feature is disabled.",
    "gmail-connection-invalid":
      "Gmail draft creation is unavailable because Gmail is not connected.",
    "gmail-scope-invalid":
      "Gmail draft creation is unavailable because the saved connection does not have only the required compose scope.",
    "gmail-oauth-configuration-missing":
      "Gmail draft creation is unavailable because the local OAuth configuration is incomplete.",
    "gmail-credential-unavailable":
      "Gmail draft creation is unavailable because its Keychain credential could not be loaded.",
    "gmail-credential-scope-invalid":
      "Gmail draft creation is unavailable because the Keychain credential does not have only the required compose scope.",
    "gmail-account-unpinned":
      "Gmail draft creation is unavailable because the approved Gmail account is not pinned consistently.",
    "gmail-draft-reconciliation-required":
      "Gmail may have created this draft. Check Gmail before taking another action; NetworkPilot will not retry an uncertain request.",
    "gmail-draft-create-failed":
      "Your approval is saved, but Gmail draft creation did not complete. Review the current state before retrying.",
    "gmail-timeout":
      "Gmail draft creation is uncertain. Check Gmail before taking another action; NetworkPilot will not retry automatically.",
    "gmail-response-malformed":
      "Gmail returned an unreadable result. Check Gmail before taking another action; NetworkPilot will not retry automatically.",
    "gmail-transport-failure":
      "NetworkPilot lost certainty while creating the Gmail draft. Check Gmail before taking another action.",
    "draft-not-approved":
      "Approve this exact draft before creating it in Gmail.",
  })[code] ?? "This action could not be completed safely.";

export const humanSendError = (code: string): string =>
  ({
    "gmail-send-draft-unavailable":
      "Only an approved, NetworkPilot-created Gmail draft can be sent.",
    "gmail-send-reconciliation-required":
      "A send attempt started, but NetworkPilot did not record a final Gmail result. Do not retry this message until its status is reconciled in Gmail.",
    "gmail-feature-disabled":
      "Sending is unavailable because the local Gmail feature is disabled.",
    "gmail-connection-invalid":
      "Sending is unavailable because Gmail is not connected.",
    "gmail-scope-invalid":
      "Sending is unavailable because the saved connection does not have only the required compose scope.",
    "gmail-oauth-configuration-missing":
      "Sending is unavailable because the local OAuth configuration is incomplete.",
    "gmail-credential-unavailable":
      "Sending is unavailable because its Keychain credential could not be loaded.",
    "gmail-credential-scope-invalid":
      "Sending is unavailable because the Keychain credential does not have only the required compose scope.",
    "gmail-account-unpinned":
      "Sending is unavailable because the approved Gmail account is not pinned consistently.",
    "gmail-authentication-failed":
      "Gmail rejected the saved authorization. Reconnect Gmail before trying a different message.",
    "gmail-authorization-failed":
      "Gmail did not authorize this send. No retry was attempted.",
    "gmail-request-invalid":
      "Gmail rejected the prepared draft request. No retry was attempted.",
    "gmail-draft-not-found":
      "Gmail could not find this immutable draft. No email was sent by NetworkPilot.",
    "gmail-rate-limited":
      "Gmail rate-limited the send request. Its result must be reconciled before any retry.",
    "gmail-provider-transient":
      "Gmail returned a temporary provider error. Its result must be reconciled before any retry.",
    "gmail-timeout":
      "Gmail did not return a certain send result. Do not retry this message until its status is reconciled.",
    "gmail-response-malformed":
      "Gmail returned an unreadable send result. Do not retry this message until its status is reconciled.",
    "gmail-transport-failure":
      "NetworkPilot lost certainty while contacting Gmail. Do not retry this message until its status is reconciled.",
    "gmail-account-ambiguous":
      "Sending is unavailable because the approved Gmail account cannot be verified.",
  })[code] ?? humanDraftError(code);

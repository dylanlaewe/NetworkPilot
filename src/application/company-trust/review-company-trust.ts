import { createHash } from "node:crypto";
import {
  COMPANY_TRUST_STATES,
  companyIdentityMatchesKey,
  normalizeCompanyIdentityEvidence,
  resolveCompanyTrust,
  type CompanyIdentityEvidence,
  type CompanyTrustRecord,
  type CompanyTrustState,
} from "@/domain/company-trust";

export interface CompanyTrustAuditEvent {
  id: string;
  companyId: string;
  providerNamespace: string | null;
  providerEmployerId: string | null;
  reviewedDomain: string | null;
  previousTrustState: CompanyTrustState;
  resultingTrustState: CompanyTrustState;
  reviewerActor: "local-operator";
  occurredAt: string;
  reason: string;
  sourceKind: "human-review";
  sourceReference: string;
  commandId: string;
  commandFingerprint: string;
  resultingVersion: number;
}

export interface CompanyTrustReviewRepository {
  transaction<T>(work: () => T): T;
  companyIdentityExists(companyId: string): boolean;
  findCompanyTrustRecord(companyId: string): CompanyTrustRecord | null;
  findCompanyTrustAuditByCommand(commandId: string): CompanyTrustAuditEvent | null;
  appendCompanyTrustAudit(event: CompanyTrustAuditEvent): void;
}

export interface ReviewCompanyTrustCommand {
  commandId: string;
  companyId: string;
  identity: Omit<CompanyIdentityEvidence, "companyId">;
  expectedVersion: number;
  resultingTrustState: CompanyTrustState;
  reason: string;
  reviewerActor: "local-operator";
  sourceReference: string;
  at: Date;
}

export interface ReviewCompanyTrustResult {
  event: CompanyTrustAuditEvent;
  current: CompanyTrustRecord;
  replayed: boolean;
}

const commandPattern = /^[a-z0-9][a-z0-9._:-]{7,127}$/i;
const canonicalCommand = (command: ReviewCompanyTrustCommand) => {
  const identity = normalizeCompanyIdentityEvidence(command.identity);
  return {
      companyId: command.companyId,
      identity,
      expectedVersion: command.expectedVersion,
      resultingTrustState: command.resultingTrustState,
      reason: command.reason.trim(),
      reviewerActor: command.reviewerActor,
      sourceReference: command.sourceReference.trim(),
      at: command.at.toISOString(),
    };
};
const fingerprint = (command: ReviewCompanyTrustCommand) =>
  createHash("sha256")
    .update(JSON.stringify(canonicalCommand(command)))
    .digest("hex");

export function reviewCompanyTrust(
  repository: CompanyTrustReviewRepository,
  command: ReviewCompanyTrustCommand,
): ReviewCompanyTrustResult {
  if (!commandPattern.test(command.commandId)) throw new Error("company-trust-command-id-invalid");
  if (!command.companyId.trim()) throw new Error("company-trust-company-id-required");
  if (!companyIdentityMatchesKey(command.companyId, command.identity))
    throw new Error("company-trust-identity-mismatch");
  if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 0)
    throw new Error("company-trust-version-invalid");
  if (!COMPANY_TRUST_STATES.includes(command.resultingTrustState))
    throw new Error("company-trust-state-invalid");
  if (!command.reason.trim()) throw new Error("company-trust-reason-required");
  if (command.reviewerActor !== "local-operator") throw new Error("company-trust-reviewer-invalid");
  if (!command.sourceReference.trim()) throw new Error("company-trust-source-reference-required");
  if (!Number.isFinite(command.at.getTime())) throw new Error("company-trust-time-invalid");

  const identity = normalizeCompanyIdentityEvidence(command.identity);
  const digest = fingerprint(command);
  return repository.transaction(() => {
    const replay = repository.findCompanyTrustAuditByCommand(command.commandId);
    if (replay) {
      if (replay.commandFingerprint !== digest) throw new Error("company-trust-command-conflict");
      const current = repository.findCompanyTrustRecord(command.companyId);
      if (!current) throw new Error("company-trust-replay-state-missing");
      return { event: replay, current, replayed: true };
    }
    if (!repository.companyIdentityExists(command.companyId))
      throw new Error("company-trust-company-not-found");
    const previous = repository.findCompanyTrustRecord(command.companyId);
    const version = previous?.version ?? 0;
    if (version !== command.expectedVersion) throw new Error("company-trust-stale-version");
    const previousTrustState=previous&&previous.version>0?previous.trustState:resolveCompanyTrust({companyId:command.companyId,...identity}).state;
    const event: CompanyTrustAuditEvent = {
      id: `company-trust-${createHash("sha256").update(command.commandId).digest("hex").slice(0, 24)}`,
      companyId: command.companyId,
      providerNamespace: identity.providerNamespace,
      providerEmployerId: identity.providerEmployerId,
      reviewedDomain: identity.employerDomain,
      previousTrustState,
      resultingTrustState: command.resultingTrustState,
      reviewerActor: command.reviewerActor,
      occurredAt: command.at.toISOString(),
      reason: command.reason.trim(),
      sourceKind: "human-review",
      sourceReference: command.sourceReference.trim(),
      commandId: command.commandId,
      commandFingerprint: digest,
      resultingVersion: version + 1,
    };
    repository.appendCompanyTrustAudit(event);
    const current = repository.findCompanyTrustRecord(command.companyId);
    if (!current) throw new Error("company-trust-derived-state-missing");
    return { event, current, replayed: false };
  });
}

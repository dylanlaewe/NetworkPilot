import { createHash } from "node:crypto";
import {
  COMPANY_TRUST_STATES,
  resolveCompanyTrust,
  type CompanyTrustRecord,
  type CompanyTrustState,
} from "@/domain/company-trust";
import {AUTHORITATIVE_OPERATING_COMPANY_DOMAINS} from "@/domain/targeting";

export interface CompanyTrustAuditEvent {
  id: string;
  companyId: string;
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
  saveCompanyTrustRecord(record: CompanyTrustRecord): void;
}

export interface ReviewCompanyTrustCommand {
  commandId: string;
  companyId: string;
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
const fingerprint = (command: ReviewCompanyTrustCommand) =>
  createHash("sha256")
    .update(JSON.stringify({
      companyId: command.companyId,
      expectedVersion: command.expectedVersion,
      resultingTrustState: command.resultingTrustState,
      reason: command.reason.trim(),
      reviewerActor: command.reviewerActor,
      sourceReference: command.sourceReference.trim(),
    }))
    .digest("hex");

export function reviewCompanyTrust(
  repository: CompanyTrustReviewRepository,
  command: ReviewCompanyTrustCommand,
): ReviewCompanyTrustResult {
  if (!commandPattern.test(command.commandId)) throw new Error("company-trust-command-id-invalid");
  if (!command.companyId.trim()) throw new Error("company-trust-company-id-required");
  if (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 0)
    throw new Error("company-trust-version-invalid");
  if (!COMPANY_TRUST_STATES.includes(command.resultingTrustState))
    throw new Error("company-trust-state-invalid");
  if (!command.reason.trim()) throw new Error("company-trust-reason-required");
  if (command.reviewerActor !== "local-operator") throw new Error("company-trust-reviewer-invalid");
  if (!command.sourceReference.trim()) throw new Error("company-trust-source-reference-required");
  if (!Number.isFinite(command.at.getTime())) throw new Error("company-trust-time-invalid");

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
    const previousTrustState=previous&&previous.version>0?previous.trustState:resolveCompanyTrust({companyId:command.companyId,employerDomain:AUTHORITATIVE_OPERATING_COMPANY_DOMAINS[command.companyId]}).state;
    const event: CompanyTrustAuditEvent = {
      id: `company-trust-${createHash("sha256").update(command.commandId).digest("hex").slice(0, 24)}`,
      companyId: command.companyId,
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
    const current: CompanyTrustRecord = {
      companyId: command.companyId,
      trustState: command.resultingTrustState,
      latestAuditEventId: event.id,
      version: event.resultingVersion,
      updatedAt: event.occurredAt,
    };
    repository.saveCompanyTrustRecord(current);
    return { event, current, replayed: false };
  });
}

import { createHash } from "node:crypto";
import { AUTHORITATIVE_OPERATING_COMPANY_DOMAINS } from "@/domain/targeting/authoritative-company-registry";

export const COMPANY_TRUST_STATES = [
  "unverified",
  "trusted-operating",
  "disallowed-recruiting-service",
] as const;
export type CompanyTrustState = (typeof COMPANY_TRUST_STATES)[number];
export type CompanyTrustSourceKind =
  | "audited-human-review"
  | "authoritative-curated-registry"
  | "provider-discovery-default"
  | "identity-unverified";

export interface CompanyTrustRecord {
  companyId: string;
  trustState: CompanyTrustState;
  latestAuditEventId: string | null;
  version: number;
  updatedAt: string;
  providerNamespace: string | null;
  providerEmployerId: string | null;
  reviewedDomain: string | null;
}

export interface CompanyTrustResolution {
  companyId: string | null;
  state: CompanyTrustState;
  sourceKind: CompanyTrustSourceKind;
  sourceReference: string | null;
  auditEventId: string | null;
  version: number;
  identityVerified: boolean;
}

export interface CompanyIdentityEvidence {
  companyId: string | null;
  employerDomain?: string | null;
  providerNamespace?: string | null;
  providerEmployerId?: string | null;
}

export interface NormalizedCompanyIdentityEvidence {
  employerDomain: string | null;
  providerNamespace: string | null;
  providerEmployerId: string | null;
}

export function normalizeCompanyDomain(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/, 1)[0] ?? "";
  return normalized.includes(".") ? normalized : null;
}

export function normalizeCompanyIdentityEvidence(
  input: Pick<CompanyIdentityEvidence, "employerDomain" | "providerNamespace" | "providerEmployerId">,
): NormalizedCompanyIdentityEvidence {
  const providerEmployerId = input.providerEmployerId?.trim() || null;
  return {
    employerDomain: normalizeCompanyDomain(input.employerDomain),
    providerNamespace: providerEmployerId ? input.providerNamespace?.trim().toLowerCase() || null : null,
    providerEmployerId,
  };
}

export function discoveredCompanyIdentity(
  input: Pick<CompanyIdentityEvidence, "employerDomain" | "providerNamespace" | "providerEmployerId">,
): string | null {
  const evidence = normalizeCompanyIdentityEvidence(input);
  // A provider-native ID is authoritative only inside its provider namespace.
  // Its domain corroborates the identity but never replaces it.
  if (evidence.providerEmployerId && !evidence.providerNamespace) return null;
  const identity = evidence.providerEmployerId
    ? `provider:${evidence.providerNamespace}:${evidence.providerEmployerId}`
    : evidence.employerDomain
      ? `domain:${evidence.employerDomain}`
      : null;
  return identity ? `discovered-${createHash("sha256").update(identity).digest("hex").slice(0, 16)}` : null;
}

export function companyIdentityMatchesKey(
  companyId: string,
  input: Pick<CompanyIdentityEvidence, "employerDomain" | "providerNamespace" | "providerEmployerId">,
): boolean {
  const domain = normalizeCompanyDomain(input.employerDomain);
  const curatedDomain = AUTHORITATIVE_OPERATING_COMPANY_DOMAINS[companyId];
  return Boolean(
    (curatedDomain && domain === curatedDomain) ||
      discoveredCompanyIdentity(input) === companyId,
  );
}

function reviewedIdentityMatches(
  identity: CompanyIdentityEvidence,
  current: CompanyTrustRecord,
  curatedIdentity: boolean,
): boolean {
  if (curatedIdentity) return true;
  const evidence = normalizeCompanyIdentityEvidence(identity);
  if (current.providerEmployerId) {
    return (
      evidence.providerNamespace === current.providerNamespace &&
      evidence.providerEmployerId === current.providerEmployerId &&
      evidence.employerDomain === current.reviewedDomain
    );
  }
  return (
    evidence.providerEmployerId === null &&
    evidence.employerDomain !== null &&
    evidence.employerDomain === current.reviewedDomain
  );
}

export function resolveCompanyTrust(
  identity: CompanyIdentityEvidence,
  current: CompanyTrustRecord | null = null,
): CompanyTrustResolution {
  const companyId = identity.companyId?.trim() || null;
  const domain = normalizeCompanyDomain(identity.employerDomain);
  const curatedDomain = companyId ? AUTHORITATIVE_OPERATING_COMPANY_DOMAINS[companyId] : undefined;
  const curatedIdentity = Boolean(curatedDomain && domain === curatedDomain);
  const discoveredIdentity = Boolean(companyId && discoveredCompanyIdentity(identity) === companyId);
  const identityVerified = curatedIdentity || discoveredIdentity;

  if (
    current &&
    current.companyId === companyId &&
    current.latestAuditEventId &&
    current.version > 0 &&
    identityVerified &&
    reviewedIdentityMatches(identity, current, curatedIdentity)
  ) {
    return {
      companyId,
      state: current.trustState,
      sourceKind: "audited-human-review",
      sourceReference: current.latestAuditEventId,
      auditEventId: current.latestAuditEventId,
      version: current.version,
      identityVerified: true,
    };
  }
  if (curatedIdentity) {
    return {
      companyId,
      state: "trusted-operating",
      sourceKind: "authoritative-curated-registry",
      sourceReference: `curated-company-domain:${companyId}:${domain}`,
      auditEventId: null,
      version: 0,
      identityVerified: true,
    };
  }
  return {
    companyId,
    state: "unverified",
    sourceKind: discoveredIdentity ? "provider-discovery-default" : "identity-unverified",
    sourceReference: discoveredIdentity ? `stable-company:${companyId}` : null,
    auditEventId: null,
    version: current?.version ?? 0,
    identityVerified,
  };
}

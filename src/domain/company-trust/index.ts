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
  providerEmployerId?: string | null;
}

export function normalizeCompanyDomain(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const normalized = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/, 1)[0] ?? "";
  return normalized.includes(".") ? normalized : null;
}

export function discoveredCompanyIdentity(input: Pick<CompanyIdentityEvidence, "employerDomain" | "providerEmployerId">): string | null {
  const domain = normalizeCompanyDomain(input.employerDomain);
  const providerId = input.providerEmployerId?.trim();
  const identity = domain ?? (providerId ? `provider:${providerId}` : null);
  return identity ? `discovered-${createHash("sha256").update(identity).digest("hex").slice(0, 16)}` : null;
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

  if (current && current.companyId === companyId && current.latestAuditEventId && current.version > 0 && identityVerified) {
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

import { describe, expect, it } from "vitest";
import { fixtureEvidence } from "@/domain/recipient-buckets/test-fixtures";
import type { CompanyTrustResolution } from "@/domain/company-trust";
import { qualifyRecruiterWithCompanyTrust } from "./recruiter-company-trust";

const evidence = [
  fixtureEvidence("professional-identity"),
  fixtureEvidence("current-employment"),
  fixtureEvidence("company-identity"),
  fixtureEvidence("relevant-function", "recruiting"),
  fixtureEvidence("recruiting-function", "Technical Recruiter"),
  fixtureEvidence("internal-recruiting", "internal"),
  fixtureEvidence("recruiting-domain", "technical-data-ai"),
];
const trust = (overrides: Partial<CompanyTrustResolution> = {}): CompanyTrustResolution => ({
  companyId: "discovered-fixture",
  state: "unverified",
  sourceKind: "provider-discovery-default",
  sourceReference: "fixture",
  auditEventId: null,
  version: 0,
  identityVerified: true,
  ...overrides,
});
const qualify = (overrides: Partial<Parameters<typeof qualifyRecruiterWithCompanyTrust>[0]> = {}) => qualifyRecruiterWithCompanyTrust({
  title: "Technical Recruiter",
  employerName: "Northwind Technology",
  employerDomain: "northwind.example",
  minimumExperience: 7,
  maximumExperience: 7,
  trust: trust(),
  evidence,
  allowUnverifiedEmployerForPersonalNetworking: true,
  ...overrides,
});

describe("unverified recruiter personal-networking policy", () => {
  it("keeps stable provider-backed employer trust unverified while making it advisory", () => {
    expect(qualify()).toMatchObject({
      classification: {
        accepted: true,
        internalStatus: "ambiguous",
        explanationCodes: expect.arrayContaining(["company-trust-unverified-advisory", "recruiter-qualified"]),
      },
      hardGates: [],
      reviewGates: [],
    });
  });

  it("does not relax identity, policy-mode, agency, ambiguity, disallow, or role protections", () => {
    expect(qualify({ allowUnverifiedEmployerForPersonalNetworking: false })).toMatchObject({ classification: { accepted: false }, reviewGates: ["company-trust-unverified"] });
    expect(qualify({ trust: trust({ identityVerified: false, sourceKind: "identity-unverified" }) })).toMatchObject({ classification: { accepted: false }, reviewGates: ["company-trust-unverified"] });
    expect(qualify({ employerDomain: "northwindstaffing.com" })).toMatchObject({ classification: { accepted: false }, hardGates: expect.arrayContaining(["recruiter-agency-employer"]) });
    expect(qualify({ employerDomain: "staffordsoftware.com" })).toMatchObject({ classification: { accepted: false }, reviewGates: expect.arrayContaining(["recruiter-company-domain-ambiguous"]) });
    expect(qualify({ trust: trust({ state: "disallowed-recruiting-service", sourceKind: "audited-human-review", version: 1, auditEventId: "audit-1" }) })).toMatchObject({ classification: { accepted: false }, hardGates: expect.arrayContaining(["company-trust-disallowed"]) });
    expect(qualify({ title: "Sales Recruiter" })).toMatchObject({ classification: { accepted: false }, hardGates: expect.arrayContaining(["recruiter-title-excluded"]) });
  });
});

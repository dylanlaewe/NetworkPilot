import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CandidatesWorkspace, type CandidateWorkspaceRow } from "./candidates-workspace";

const candidate: CandidateWorkspaceRow = {
  id: "fixture-recruiter",
  recipient: "R*** C.",
  company: "Fixture Technology",
  companyId: "discovered-fixture",
  companyKind: "discovered",
  title: "Technical Recruiter",
  industry: "Technology",
  functionName: "technical-data-ai",
  persona: "technical-recruiter",
  score: 90,
  stage: "qualified-available",
  track: "recruiter",
  recipientBucket: {
    bucket: "recruiters",
    classifierVersion: "recipient-bucket-v1",
    confidence: "low",
    reviewState: "review-required",
    explanationCodes: ["company-trust-unverified"],
    evidence: [],
    evidenceReferences: [],
    earlyCareer: false,
  },
  bucketLabel: "Recruiters",
  bucketReviewState: "review-required",
  bucketReviewReason: "company-trust-unverified",
  employerTrust: {
    companyId: "discovered-fixture",
    state: "unverified",
    sourceKind: "provider-discovery-default",
    sourceReference: "stable-company:discovered-fixture",
    auditEventId: null,
    version: 0,
    identityVerified: true,
  },
  employerIdentity: {
    domain: "fixture.example",
    providerNamespace: "apollo",
    providerEmployerId: "org-fixture",
  },
  companyTrustReview: {
    commandId: "company-trust-ui:fixture-command",
    reviewedAt: "2026-10-04T12:00:00.000Z",
  },
};

describe("Candidates employer-trust review", () => {
  it("shows evidence, both audited decisions, and the leave-unverified path", () => {
    const html = renderToStaticMarkup(
      <CandidatesWorkspace
        candidates={[candidate]}
        initialSelectedId={candidate.id}
        refreshControl={null}
        refreshResult={null}
      />,
    );
    expect(html).toContain("Employer review required");
    expect(html).toContain("fixture.example");
    expect(html).toContain("apollo · org-fixture");
    expect(html).toContain("Trust operating employer");
    expect(html).toContain("Mark recruiting/staffing service");
    expect(html).toContain("Leave unverified by taking no action");
    expect(html).toContain('name="reason"');
    expect(html).toContain('required=""');
    expect(html).not.toContain("Create Gmail Draft");
  });
});

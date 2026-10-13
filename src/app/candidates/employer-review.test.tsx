import { readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("Candidates employer context", () => {
  it("keeps unfamiliar-employer context optional and avoids a mandatory trust workflow", () => {
    const html = renderToStaticMarkup(
      <CandidatesWorkspace
        candidates={[candidate]}
        initialSelectedId={candidate.id}
        refreshControl={null}
        refreshResult={null}
        apolloEnabled={false}
        apolloReady={false}
      />,
    );
    expect(html).toContain("Details");
    expect(html).toContain("Employer not independently verified");
    expect(html).toContain("Keep the message limited to the person’s verified title and company");
    expect(html).not.toContain("Trust operating employer");
    expect(html).not.toContain("Mark recruiting/staffing service");
    expect(html).not.toContain("Leave unverified");
    expect(html).not.toContain("org-fixture");
    expect(html).not.toContain('name="reason"');
    expect(html).not.toContain("Create Gmail Draft");
  });

  it("opens an existing draft in the composed mobile review route", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/candidates/candidates-workspace.tsx"),
      "utf8",
    );
    expect(source).toContain(
      "href={`/drafts/review?candidate=${encodeURIComponent(candidate.id)}`}",
    );
    expect(source).toContain("Open draft");
  });
});

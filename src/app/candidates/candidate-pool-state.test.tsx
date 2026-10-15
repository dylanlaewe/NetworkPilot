import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BucketNavigationData } from "@/app/recipient-bucket-navigation";
import {
  candidateBlockerSummary,
  candidateSourcingHref,
  CandidatesWorkspace,
  type CandidateWorkspaceRow,
} from "./candidates-workspace";
import { candidateWorkspaceRouteKey } from "./workspace-route";

function navigation(
  total: number,
  legacyCount = 0,
  selected: BucketNavigationData["selected"] = "recruiters",
): BucketNavigationData {
  return {
    enabled: true,
    current: "candidates",
    selected,
    counts: { recruiters: total },
    total,
    legacyCount,
  };
}

function candidate(
  id: string,
  overrides: Partial<CandidateWorkspaceRow> = {},
): CandidateWorkspaceRow {
  return {
    id,
    recipient: `Candidate ${id}`,
    company: "Fixture Company",
    companyId: "fixture-company",
    companyKind: "discovered",
    title: "Technical Recruiter",
    industry: "Technology",
    functionName: "technical-data-ai",
    persona: "technical-recruiter",
    score: 90,
    stage: "qualified-available",
    planningReady: true,
    track: "recruiter",
    recipientBucket: {
      bucket: "recruiters",
      classifierVersion: "recipient-bucket-v1",
      confidence: "high",
      reviewState: "accepted",
      explanationCodes: [],
      evidence: [],
      evidenceReferences: [],
      earlyCareer: false,
    },
    bucketLabel: "Recruiters",
    bucketReviewState: "accepted",
    ...overrides,
  };
}

function render(
  candidates: CandidateWorkspaceRow[],
  actionable: number,
  legacyCount = 0,
  selected: BucketNavigationData["selected"] = "recruiters",
) {
  return renderToStaticMarkup(
    <CandidatesWorkspace
      candidates={candidates}
      refreshControl={<span>Find people · May use Apollo</span>}
      refreshResult={null}
      bucketNavigation={navigation(
        candidates.filter((row) => row.recipientBucket?.bucket).length,
        legacyCount,
        selected,
      )}
      actionableCapacityByBucket={{ recruiters: actionable }}
      unionActionableCapacity={actionable}
      refreshScope="recruiters"
      apolloEnabled
      apolloReady
    />,
  );
}

describe("Candidates pool states", () => {
  it("makes provider-backed sourcing the first action for a zero-candidate pool", () => {
    const html = render([], 0, 0, "all");

    expect(html).toContain("No candidates yet");
    expect(html).toContain("Find people to start building your networking queue.");
    expect(html).toContain("Find people");
    expect(html).toContain("Search may use Apollo credits");
    expect(html).not.toContain("Add drafts");
  });

  it("opens the scoped confirmation after first-run sourcing navigation without a document reload", () => {
    const initialKey = candidateWorkspaceRouteKey("all", false, false);
    const scopedKey = candidateWorkspaceRouteKey("peers", false, true);
    expect(candidateSourcingHref("peers")).toBe(
      "/candidates?bucket=peers&findMore=true",
    );
    expect(scopedKey).not.toBe(initialKey);

    const scopedHtml = renderToStaticMarkup(
      <CandidatesWorkspace
        candidates={[]}
        refreshControl={
          <details open>
            <summary>Find people</summary>
            <div>
              <p>Scoped Apollo confirmation</p>
              <button>Find peers</button>
            </div>
          </details>
        }
        refreshResult={null}
        bucketNavigation={{
          enabled: true,
          current: "candidates",
          selected: "peers",
          counts: { peers: 0 },
          total: 0,
          legacyCount: 1,
        }}
        actionableCapacityByBucket={{ peers: 0 }}
        unionActionableCapacity={0}
        refreshScope="peers"
        findMoreOpen
        apolloEnabled
        apolloReady
      />,
    );

    expect(scopedHtml).toContain("No candidates yet");
    expect(scopedHtml).toContain("Scoped Apollo confirmation");
    expect(scopedHtml).toContain("View Legacy");
    expect(scopedHtml).not.toMatch(
      /<(?:a|button)[^>]*>Find people<\/(?:a|button)>/,
    );
    expect(scopedHtml).toContain("Find people");
    expect(scopedHtml).toContain("Find peers");
    const css = readFileSync(
      join(process.cwd(), "src/app/candidates/candidates-command.module.css"),
      "utf8",
    );
    const workspace = readFileSync(
      join(process.cwd(), "src/app/candidates/candidates-workspace.tsx"),
      "utf8",
    );
    expect(css).toContain(
      ".expandedSourcingEmpty { min-height: 0; place-content: start center; padding-top: 12px; padding-bottom: calc(76px + env(safe-area-inset-bottom)); }",
    );
    expect(css).toContain(
      ".sourcingDisclosure :global(.refresh-candidates > div) { position: static; inset: auto; z-index: auto; width: 100%;",
    );
    expect(workspace).toContain(
      'showScopedConfirmation ? styles.expandedSourcingEmpty : ""',
    );
  });

  it("summarizes a populated pool with no actionable capacity", () => {
    const review = candidate("review", {
      bucketReviewState: "review-required",
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
      employerTrust: {
        companyId: "fixture-company",
        state: "unverified",
        sourceKind: "provider-discovery-default",
        sourceReference: "stable-company:fixture-company",
        auditEventId: null,
        version: 0,
        identityVerified: true,
      },
    });
    const html = render(
      [
        review,
        candidate("cooldown", { stage: "cooldown" }),
        candidate("contacted", { stage: "already-contacted" }),
        candidate("suppressed", { stage: "suppressed" }),
      ],
      0,
    );

    expect(candidateBlockerSummary([review])).toMatchObject({
      employerReview: 1,
      eligibilityReview: 0,
    });
    expect(html).toContain("No candidates are ready for drafts");
    expect(html).toContain("1</strong> employer review required");
    expect(html).toContain("1</strong> in company cooldown");
    expect(html).toContain("1</strong> already contacted");
    expect(html).toContain("1</strong> suppressed");
    expect(html).toContain("Review candidates");
    expect(html).not.toContain("Add drafts");
  });

  it("renders one scoped sourcing confirmation for a blocked populated pool", () => {
    const html = renderToStaticMarkup(
      <CandidatesWorkspace
        candidates={[
          candidate("contacted", {
            stage: "in-draft-queue",
          }),
        ]}
        refreshControl={<div>Scoped Apollo confirmation</div>}
        refreshResult={null}
        bucketNavigation={navigation(1)}
        actionableCapacityByBucket={{ recruiters: 0 }}
        unionActionableCapacity={0}
        refreshScope="recruiters"
        findMoreOpen
        apolloEnabled
        apolloReady
      />,
    );

    expect(html.match(/Scoped Apollo confirmation/g)).toHaveLength(1);
  });

  it("keeps per-person drafting distinct from sourcing in a mixed pool", () => {
    const html = render(
      [
        candidate("ready"),
        candidate("review", {
          bucketReviewState: "review-required",
          recipientBucket: {
            bucket: "recruiters",
            classifierVersion: "recipient-bucket-v1",
            confidence: "low",
            reviewState: "review-required",
            explanationCodes: ["responsibility-review-required"],
            evidence: [],
            evidenceReferences: [],
            earlyCareer: false,
          },
          employerTrust: {
            companyId: "fixture-company",
            state: "unverified",
            sourceKind: "provider-discovery-default",
            sourceReference: "stable-company:fixture-company",
            auditEventId: null,
            version: 0,
            identityVerified: true,
          },
        }),
      ],
      1,
    );

    expect(html).toContain("Create draft");
    expect(html).toContain("1 ready for drafts");
    expect(html).toContain("Review needed");
    expect(html).toContain("Find people");
    expect(html).toContain("May use Apollo credits");
    expect(html).toContain("Skip");
    expect(html).toContain("Don&#x27;t show again");
    expect(html).toContain('name="nextCandidateId" value="review"');
    expect(html).toContain('value="do-not-show-again" name="confirmation"');
    expect(html).not.toContain("Add drafts");
  });

  it("shows healthy actionable capacity without blocker framing", () => {
    const html = render([candidate("one"), candidate("two")], 2);

    expect(html).toContain("Create draft");
    expect(html).toContain("2 ready for drafts");
    expect(html).toContain("Find people");
    expect(html).not.toContain("Add drafts");
    expect(html).not.toContain("No candidates are ready for drafts");
  });

  it("keeps long person, role, company, and status copy in the rendered list", () => {
    const html = render(
      [
        candidate("long-peer", {
          recipient: "Alexandria Montgomery-Worthington",
          title:
            "Junior Data Analyst, Population Health Research and Clinical Outcomes",
          company:
            "American Association of Community Health Research Professionals",
          track: "professional",
          recipientBucket: {
            bucket: "peers",
            classifierVersion: "recipient-bucket-v1",
            confidence: "high",
            reviewState: "accepted",
            explanationCodes: [],
            evidence: [],
            evidenceReferences: [],
            earlyCareer: true,
          },
          bucketLabel: "Peers & practitioners",
        }),
      ],
      1,
      0,
      "all",
    );

    expect(html).toContain("Alexandria Montgomery-Worthington");
    expect(html).toContain(
      "Junior Data Analyst, Population Health Research and Clinical Outcomes",
    );
    expect(html).toContain(
      "American Association of Community Health Research Professionals",
    );
    expect(html).toContain("Peers &amp; practitioners");
    expect(html).toContain("Available");
    expect(html).toContain("Candidate");
    expect(html).toContain("Status");
    expect(html).not.toContain("Why now");
  });

  it("keeps Legacy explicit while offering it from the first-run state", () => {
    const legacy = candidate("legacy", {
      recipientBucket: null,
      bucketReviewState: "legacy-unclassified",
    });
    const html = render(
      [legacy],
      0,
      1,
      "all",
    );

    expect(html).toContain("No candidates yet");
    expect(html).toContain("View Legacy");
    expect(html).toContain("Legacy <small>1</small>");
    expect(html).not.toContain("Add drafts");

    const legacyHtml = render([legacy], 0, 1, "legacy");
    expect(legacyHtml).toContain("Legacy or unclassified people cannot enter the five-bucket draft queue.");
    expect(legacyHtml).not.toContain("No candidates are ready for drafts");
    expect(legacyHtml).not.toContain("Review candidates");
  });
});

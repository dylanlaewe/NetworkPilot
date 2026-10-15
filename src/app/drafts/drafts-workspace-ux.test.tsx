import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DraftCreationForm, DraftsWorkspace } from "./drafts-workspace";
import { DraftAdditionFeedback } from "./addition-feedback";
import type { WorkspaceDraft } from "./workspace-data";

const workspace = () =>
  readFileSync(
    join(process.cwd(), "src/app/drafts/drafts-workspace.tsx"),
    "utf8",
  );
const workspaceStyles = () =>
  readFileSync(
    join(process.cwd(), "src/app/drafts/drafts-workspace.module.css"),
    "utf8",
  );

describe("Drafts preferred CRM workflow", () => {
  it("renders the real primary Create drafts form with visible scope and quantity selections", () => {
    const html = renderToStaticMarkup(
      <DraftCreationForm
        action={vi.fn()}
        requestId="fixture-request"
        bucketEnabled
        bucket="ceos"
        bucketLocked={false}
        earlyCareerOnly={false}
        capacity={2}
        countMode="5"
        customCount={5}
        pending={false}
        onBucketChange={vi.fn()}
        onCountModeChange={vi.fn()}
        onCustomCountChange={vi.fn()}
      />,
    );
    expect(html).toContain("Create drafts");
    expect(html).toContain("Recipient group");
    expect(html).toContain('value="ceos" selected=""');
    expect(html).toContain('name="draftQuantity"');
    expect(html).toContain('name="draftQuantity" checked="" value="5"');
    expect(html).toContain('value="10"');
    expect(html).toContain("Custom");
    expect(html).toContain('name="additionalDraftCount" value="5"');
    expect(html).toContain("2 candidates are ready in this group.");
    expect(html).toContain("No Apollo or Gmail call");
    expect(html).not.toMatch(/<details|<summary|Add Drafts|Generate|reserve/i);
  });

  it("shows immediate pending language and the custom 1–20 input", () => {
    const html = renderToStaticMarkup(
      <DraftCreationForm
        action={vi.fn()}
        requestId="fixture-custom"
        bucketEnabled
        bucket="peers"
        bucketLocked
        earlyCareerOnly
        capacity={0}
        countMode="custom"
        customCount={17}
        pending
        onBucketChange={vi.fn()}
        onCountModeChange={vi.fn()}
        onCustomCountChange={vi.fn()}
      />,
    );
    expect(html).toContain("Creating drafts…");
    expect(html).toContain("Custom, 1–20");
    expect(html).toContain('min="1" max="20" required="" disabled="" value="17"');
    expect(html).toContain('name="earlyCareerOnly" value="true"');
    expect(html).toContain("No candidates are currently ready in this group.");
  });

  it("keeps creation feedback persistent and points recovery to Candidates", () => {
    const partial = renderToStaticMarkup(
      <DraftAdditionFeedback added={2} requested={5} remaining={0} />,
    );
    expect(partial).toContain("2 of 5 drafts created");
    expect(partial).toContain("No more candidates are ready");
    expect(partial).toContain('href="/candidates"');
    expect(partial).toContain("Find people");
  });

  it("keeps an existing long-message workspace calm until the operator opens secondary controls", () => {
    const draft: WorkspaceDraft = {
      snapshotId: "fixture-long-draft",
      candidateId: "fixture-long-peer",
      recipient: "Alexandria Montgomery-Worthington",
      recipientEmail: "alexandria@example.invalid",
      company:
        "American Association of Community Health Research Professionals",
      title:
        "Junior Data Analyst, Population Health Research and Clinical Outcomes",
      track: "professional",
      state: "ready",
      subject: "A question about population health analytics and early-career growth",
      body: `Hi Alexandria,\n\nI’m building my data analytics career and noticed your work in population health research. I’d value your perspective on one skill that helped you become useful quickly in a clinically focused analytics team.\n\nBest,\nDylan`,
      blockedReason: null,
      blockedMessage: null,
      sendBlockedMessage: null,
      selectionReason: "Relevant early-career analytics peer.",
      intent: "Ask one truthful professional question.",
      roleRelevance: "Data analytics",
      companyEvidence: "Current employer supplied by the candidate profile.",
      lane: "Data",
      location: "Philadelphia, Pennsylvania, United States",
      industry: "Health care",
      catalogVersion: "fixture-v1",
      factCount: 2,
      approvedAt: null,
      attachment: null,
      manualOperatorId: null,
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
      bucketReviewState: "accepted",
      bucketReviewReason: null,
      bucketEvidenceReferences: [],
      bucketClassifierVersion: "recipient-bucket-v1",
      resumeSelection: null,
      classificationChange: null,
    };
    const html = renderToStaticMarkup(
      <DraftsWorkspace
        drafts={[draft]}
        resumes={[
          {
            id: "general-resume",
            label: "General Resume — Data & Product",
            lane: "General",
          },
        ]}
        gmailAvailable
        gmailReason={null}
        hasReserve
        reserveCapacity={{ peers: 4 }}
        earlyCareerPeerCapacity={4}
        initialCandidateId={draft.candidateId}
        initialMobileReview
        feedback={null}
        bucketNavigation={{
          enabled: true,
          current: "drafts",
          selected: "peers",
          counts: { peers: 1 },
          total: 1,
          legacyCount: 0,
          earlyCareerOnly: true,
        }}
        addRequestId="fixture-add-request"
      />,
    );

    const creationDisclosure = html.match(
      /<details[^>]*aria-label="Create drafts"[^>]*>/,
    )?.[0];
    expect(creationDisclosure).toBeTruthy();
    expect(creationDisclosure).not.toContain("open");
    expect(html).toContain("Choose group and quantity");
    expect(html).toContain("Alexandria Montgomery-Worthington");
    expect(html).toContain("General Resume — Data &amp; Product");
    expect(html).toContain("Subject");
    expect(html).toContain("Details");
    expect(html).toContain("Send");
    expect(html).toContain('aria-keyshortcuts="X"');
    expect(html).toContain('aria-keyshortcuts="R"');
    expect(html).toContain('<span>Skip</span><kbd aria-hidden="true">X</kbd>');
    expect(workspaceStyles()).toContain(
      ".dock .secondaryActions button>span{color:inherit;font:inherit}",
    );
    expect(html).not.toContain("Context and evidence");
  });

  it("presents edit to Send as one confirmed external action", () => {
    const source = workspace();
    expect(source).toContain('ready: "Send"');
    expect(source).toContain('approved: "Send"');
    expect(source).toContain('"gmail-draft-created": "Send"');
    expect(source).toContain("Send this message?");
    for (const field of [
      "snapshotId",
      "candidateId",
      "nextCandidateId",
      "subject",
      "body",
      "resumeId",
      "resumeDecision",
    ]) {
      expect(source).toContain(`name="${field}"`);
    }
    expect(source).toContain('value="send-draft-now"');
    expect(source).toContain("selected?.recipient");
    expect(source).toContain("selected?.recipientEmail");
    expect(source).toContain("editedSubject");
    expect(source).toContain("editedBody");
    expect(source).toContain("confirmationAttachment");
    expect(source).toContain("selected?.attachment?.resumeId");
    expect(source).not.toContain("approveAndCreateGmailDraft");
    expect(source).not.toContain("createGmailDraft");
    expect(source).not.toContain("sendGmailDraft");
  });

  it("uses the exact empty-state handoff to Candidates", () => {
    const source = workspace();
    expect(source).toContain("No drafts yet");
    expect(source).toContain("No candidates yet. Find people first.");
    expect(source).toContain('href="/candidates"');
    expect(source).toContain("Go to Candidates");
  });
});

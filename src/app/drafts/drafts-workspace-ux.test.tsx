import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DraftCreationForm } from "./drafts-workspace";
import { DraftAdditionFeedback } from "./addition-feedback";

const workspace = () =>
  readFileSync(
    join(process.cwd(), "src/app/drafts/drafts-workspace.tsx"),
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

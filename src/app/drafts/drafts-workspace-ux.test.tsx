import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AddDraftsControl } from "./add-drafts-control";
import { DraftAdditionFeedback } from "./addition-feedback";

const workspace = () =>
  readFileSync(
    join(process.cwd(), "src/app/drafts/drafts-workspace.tsx"),
    "utf8",
  );

describe("Drafts preferred CRM workflow", () => {
  it("uses Create drafts language for the bounded batch control", () => {
    const html = renderToStaticMarkup(<AddDraftsControl action={vi.fn()} />);
    expect(html).toContain("Create drafts");
    expect(html).toContain("Create 5");
    expect(html).toContain("Create 10");
    expect(html).toContain("Create custom");
    expect(html).toContain("No Apollo call");
    expect(html).not.toMatch(/Add Drafts|Generate|reserve/i);
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

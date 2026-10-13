import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");
describe("v1 daily workflow UX", () => {
  it("keeps responsive metadata, keyboard landmarks and persistent queue selection", () => {
    const css = source("src/app/product.css"),
      workspace = source("src/app/drafts/drafts-workspace.tsx"),
      workspaceCss = source("src/app/drafts/drafts-workspace.module.css");
    expect(source("src/app/product-nav.tsx")).toContain("Skip to content");
    expect(source("src/app/network-command-shell.tsx")).toContain(
      'id="workspace-content"',
    );
    expect(source("src/app/sent/page.tsx")).toContain("NetworkCommandShell");
    expect(workspace).toContain('id="workspace-content"');
    expect(css).toContain(":focus-visible");
    expect(css).toContain("content:attr(data-label)");
    expect(workspaceCss).toContain(":focus-visible");
    expect(workspaceCss).toContain("@media(max-width:760px)");
    expect(workspace).toContain("setSelectedId");
    expect(workspace).toContain("window.history.replaceState");
    expect(workspace).toContain('key === "j" || key === "k"');
  });
  it("keeps dialogs keyboard-contained and respects reduced motion", () => {
    const workspace = source("src/app/drafts/drafts-workspace.tsx"),
      css = source("src/app/drafts/drafts-workspace.module.css");
    expect(workspace).toContain('input:not([type="hidden"]):not(:disabled)');
    expect(workspace).toContain('event.key !== "Tab"');
    expect(workspace).toContain("returnFocus");
    expect(workspace).toContain("closeMobileReview");
    expect(workspace).toContain('document.getElementById(`queue-${candidateId}`)?.focus()');
    expect(css).not.toContain("@keyframes");
    expect(css).toContain("prefers-reduced-motion:reduce");
  });
  it("keeps the four primary destinations and a secondary system destination", () => {
    const nav = source("src/app/network-command-shell.tsx");
    for (const value of ["Today", "Drafts", "Sent", "Candidates"])
      expect(nav).toContain(value);
    expect(nav).toContain("secondaryDestinations");
    expect(nav).toContain("aria-current");
  });
  it("keeps sent work out of Drafts and maps one primary action per draft state", () => {
    const workflow = source("src/application/product-workflow/index.ts"),
      ui = source("src/app/drafts/drafts-workspace.tsx");
    expect(workflow).toContain("manualSendConfirmed");
    expect(workflow).toContain('sendState!=="sent"');
    expect(ui).toContain('ready: "Send"');
    expect(ui).toContain('approved: "Send"');
    expect(ui).toContain('"gmail-draft-created": "Send"');
    expect(ui).toContain("Resolve send status");
  });
  it("supports pre-approval editing and immutable approval", () => {
    const review = source("src/app/drafts/drafts-workspace.tsx"),
      projection = source("src/app/drafts/workspace-data.ts"),
      infra = source("src/infrastructure/sqlite/command-center-drafts.ts");
    expect(review).toContain('name="subject"');
    expect(review).toContain('name="body"');
    expect(review).toContain("Send this message?");
    expect(review).toContain("action={sendDraft}");
    expect(review).toContain('value="send-draft-now"');
    expect(projection).toContain(
      'state!=="ready"?review.operation?.snapshot:null',
    );
    expect(infra).toContain("prepareEditedDraft");
    expect(infra).toContain("approveForGmailDraft");
  });
  it("offers explicit controlled resume selection with a None option and private management surface", () => {
    const review = source("src/app/drafts/drafts-workspace.tsx"),
      resumes = source("src/app/resumes/page.tsx");
    expect(review).toContain('name="resumeId"');
    expect(review).toContain("value={selectedResumeId}");
    expect(review).toContain('<option value="">None</option>');
    expect(review).toContain('selected.state === "ready"');
    expect(review).toContain("continueWithoutAttachment");
    expect(review).toContain('className={styles.subjectFullText}');
    expect(review).toContain('className={styles.attachmentFullText}');
    for (const text of [
      "Add a resume",
      "PDF only, up to 10 MB",
      "Deactivate",
      "Historical attachments remain intact",
      "Use as recruiter default",
      "Clear recruiter default",
    ])
      expect(resumes).toContain(text);
  });
  it("exposes audited bucket correction and replay-safe scoped Create drafts controls", () => {
    const review = source("src/app/candidate-review/page.tsx"),
      actions = source("src/app/candidate-review/actions.ts"),
      correction = source("src/application/ingestion/review-bucket.ts"),
      drafts = source("src/app/drafts/drafts-workspace.tsx"),
      screen = source("src/app/drafts/drafts-screen.tsx");
    expect(review).toContain("Save audited bucket correction");
    expect(actions).toContain("correctRecipientBucketAction");
    expect(actions).toContain("buildReviewedBucketCorrection");
    expect(correction).toContain('reviewedBy: "local-operator"');
    expect(drafts).toContain('name="requestId"');
    expect(screen).toContain("loadBucketReserveMetricsForScopes");
    expect(screen).not.toContain("hasActionableBucketReserve");
  });
  it("uses stable candidate lookup and the newest immutable operation after a failed attempt", () => {
    const screen = source("src/app/drafts/drafts-screen.tsx"),
      projection = source("src/app/drafts/workspace-data.ts"),
      infra = source("src/infrastructure/sqlite/draft-queue.ts");
    expect(screen).toContain("row.review.candidateId === candidateId");
    expect(projection).toContain("review.operation?.snapshot");
    expect(infra).toContain("ORDER BY updated_at_utc,operation_id");
  });
  it("shows Product and scoped sourcing confirmation in product language", () => {
    const candidates = source("src/app/candidates/candidates-workspace.tsx"),
      refresh = source("src/app/candidates/refresh-control.tsx");
    expect(candidates).toContain('"Product"');
    expect(candidates).toContain("Role family");
    for (const text of [
      "Ready for drafts",
      "Desired candidates",
      "Maximum credits this run",
      "Remaining daily allowance",
      "Find people",
    ])
      expect(refresh).toContain(text);
  });
  it("covers reconnect, uncertain send, empty states, filters, and cross-page refresh", () => {
    const workspace = source("src/app/drafts/drafts-workspace.tsx"),
      actions = source("src/app/today/actions.ts"),
      sent = source("src/app/sent/relationship-workspace.tsx");
    expect(source("src/app/today/gmail-readiness-panel.tsx")).toContain(
      "Reconnect Gmail",
    );
    expect(workspace).toContain("could not confirm whether Gmail sent");
    expect(workspace).toContain("No drafts yet");
    expect(workspace).toContain("No candidates yet. Find people first.");
    expect(workspace).toContain("Create drafts");
    expect(workspace).toContain("Find people");
    expect(actions).toContain("sendStatus=sent");
    expect(actions).not.toContain("/sent?sendStatus=sent");
    expect(actions).toContain(
      'code==="draft-stale")redirect(`/drafts?candidate=',
    );
    expect(
      source("src/application/command-center-drafts/index.ts"),
    ).toContain('"draft-stale":"This draft changed');
    expect(sent).toContain("No outreach sent yet");
    expect(source("src/app/candidates/candidates-workspace.tsx")).toContain("No candidates match these filters");
    expect(source("src/app/candidates/candidates-workspace.tsx")).toContain("View Legacy");
    expect(source("src/app/candidates/candidates-workspace.tsx")).toContain('name="bucket"');
    expect(source("src/app/candidates/candidates-workspace.tsx")).toContain('name="earlyCareerOnly"');
    expect(source("src/app/candidates/page.tsx")).toContain("Skipped. This person stays out of today’s candidate queue.");
    expect(source("src/app/candidates/page.tsx")).toContain("Won’t show again. This person was removed from future candidate and draft queues.");
    expect(sent).toContain("aria-current={outcome===filter");
    expect(sent).toContain("aria-pressed={selected?.operatorId===row.operatorId}");
    expect(sent).not.toContain('role="listbox"');
    for (const page of ["/today", "/drafts", "/sent", "/candidates"])
      expect(actions).toContain(`"${page}"`);
  });
  it("exposes bounded draft controls and keeps System secondary", () => {
    const drafts = source("src/app/drafts/drafts-workspace.tsx"),
      today = source("src/app/today/page.tsx"),
      nav = source("src/app/network-command-shell.tsx");
    expect(drafts).toContain("Create drafts");
    expect(drafts).toContain('"5", "10", "custom"');
    expect(drafts).toContain('min="1"');
    expect(drafts).toContain('max="20"');
    expect(drafts).toContain("Skip");
    expect(drafts).toContain("Don&apos;t show this person again");
    expect(drafts).toContain("Replace");
    expect(today).not.toContain("AddDraftsControl");
    expect(today).toContain("loadBucketReserveMetricsForScopes");
    expect(nav).toContain("secondaryDestinations");
  });
});

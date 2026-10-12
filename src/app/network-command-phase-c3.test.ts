import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Network Command supporting surfaces", () => {
  it("unifies all six surfaces without changing the four primary destinations", () => {
    const shell = source("src/app/network-command-shell.tsx");
    for (const value of [
      "today",
      "drafts",
      "sent",
      "candidates",
      "resumes",
      "system",
    ])
      expect(shell).toContain(value);
    expect(shell).toContain("const primaryDestinations = [");
    expect(shell).toContain('{ id: "today", label: "Today" }');
    expect(shell).toContain('{ id: "drafts", label: "Drafts" }');
    expect(shell).toContain('{ id: "candidates", label: "Candidates" }');
    expect(shell).toContain('{ id: "sent", label: "Sent" }');
  });
  it("treats Sent as relationship memory with truthful message, timeline, and outcomes", () => {
    const view = source("src/app/sent/relationship-workspace.tsx");
    for (const value of [
      "Relationship memory",
      "Message sent",
      "Timeline",
      "Current outcome",
      "Awaiting reply",
      "Replied",
      "Meeting",
      "Declined",
      "Bounced",
      "Opt-out",
    ])
      expect(view).toContain(value);
    expect(view).not.toMatch(/gmailDraftId|gmailMessageId|operationId/);
  });
  it("keeps relationship and resume projections read-only and privacy conscious", () => {
    const relationship = source(
        "src/infrastructure/sqlite/relationship-workspace.ts",
      ),
      resumes = source("src/infrastructure/sqlite/resume-library-view.ts");
    for (const value of [relationship, resumes]) {
        expect(value.replaceAll(" ", "")).toContain("readonly:true");
      expect(value).not.toMatch(/INSERT|UPDATE|DELETE/);
    }
      expect(resumes.replaceAll(" ", "")).toContain('storageKey:""');
  });
  it("presents resumes as immutable assets with explicit upload and historical use", () => {
    const page = source("src/app/resumes/page.tsx");
    for (const value of [
      "Private working assets",
      "Add a resume",
      "PDF only, up to 10 MB",
      "Optional role lane",
      "Historical use",
      "Deactivate version",
      "Historical attachments remain intact",
    ])
      expect(page).toContain(value);
    expect(page).not.toContain("storageKey");
  });
  it("makes System quiet, progressive, and free of provider actions or secrets", () => {
    const page = source("src/app/page.tsx");
    for (const value of [
      "Settings and operational health",
      "Health",
      "Gmail",
      "Apollo",
      "Data & migrations",
      "Safety boundaries",
      "Simulation utilities",
    ])
      expect(page).toContain(value);
    for (const forbidden of [
      "APOLLO_API_KEY",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      ">Send<",
    ])
      expect(page).not.toContain(forbidden);
  });
  it("supports responsive detail transitions, focus, and reduced motion", () => {
    const shell = source("src/app/network-command.module.css"),
      sent = source("src/app/sent/sent-command.module.css"),
      resumes = source("src/app/resumes/resume-command.module.css"),
      system = source("src/app/system-command.module.css");
    expect(shell).toContain(":focus-visible");
    expect(shell).toContain("prefers-reduced-motion:reduce");
    expect(sent).toContain("@media(max-width:760px)");
    expect(resumes).toContain(".mobileBack");
    expect(system).toContain("@media(max-width:760px)");
  });
  it("keeps every mobile surface usable with compact widths and long content", () => {
    const shell = source("src/app/network-command.module.css"),
      sent = source("src/app/sent/sent-command.module.css"),
      resumes = source("src/app/resumes/resume-command.module.css"),
      system = source("src/app/system-command.module.css"),
      view = source("src/app/sent/relationship-workspace.tsx");
    expect(view).toContain('aria-label="Filter relationships by outcome"');
    expect(sent).toContain(".mobileFilter");
    expect(sent).toContain("overflow-wrap:anywhere");
    expect(resumes).toContain("env(safe-area-inset-bottom)");
    expect(resumes).toContain(".detail>dl{grid-template-columns:1fr}");
    expect(system).toContain("overflow-wrap:anywhere");
    expect(shell).toContain("overflow-x: clip");
    expect(shell.replaceAll(" ", "")).toContain("height:calc(64px+env(safe-area-inset-bottom))");
    expect(shell.replaceAll(" ", "")).toContain("grid-template-columns:repeat(4,minmax(0,1fr))");
  });
});

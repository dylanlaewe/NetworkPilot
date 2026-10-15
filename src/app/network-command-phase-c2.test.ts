import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Network Command experience reset", () => {
  it("uses a work-first Today hierarchy and reveals live state only for exceptions", () => {
    const page = source("src/app/today/page.tsx"),
      styles = source("src/app/today/today-command.module.css");
    for (const text of [
      "One clear next step.",
      "Continue",
    ])
      expect(page).toContain(text);
    for (const text of ["Operational state", "Queue", "Relationships", "Supply", "Gmail", "Apollo"])
      expect(page).toContain(text);
    expect(page).not.toMatch(/Good morning|Good afternoon|Good evening|KPI/i);
    expect(styles).toContain(".primaryTask");
    expect(page).toContain("uncertain>0||!gmailReady?<details");
    expect(styles).toContain("max-width:760px");
  });

  it("keeps Today read-only while retaining the explicit bounded candidate refresh", () => {
    const page = source("src/app/today/page.tsx"),
      candidates = source("src/app/candidates/page.tsx");
    expect(page).not.toContain("AddDraftsControl");
    expect(page).not.toContain("CandidateRefreshControl");
    expect(candidates).toContain("CandidateRefreshControl");
    expect(`${page}\n${candidates}`).not.toMatch(
      /ApolloAdapter|GmailDraftAdapter|FetchGmailTransport|replenish\(/,
    );
  });

  it("uses identity-first candidates, contextual detail, and all functional filters", () => {
    const workspace = source("src/app/candidates/candidates-workspace.tsx"),
      styles = source("src/app/candidates/candidates-command.module.css"),
      projection = source("src/infrastructure/sqlite/daily-command-center.ts");
    for (const text of [
      "Search candidates",
      "Filter candidates",
      "Role family",
      "Industry",
      "Geography",
      "Availability",
      "Product",
      "Why this person",
      "Role relevance",
      "Company evidence",
      "History",
      "Current status",
      "Create draft",
    ])
      expect(workspace).toContain(text);
    expect(workspace).toContain("window.history.replaceState");
    expect(workspace).toContain("styles.controlBar");
    expect(workspace).not.toContain("data-density={density}");
    expect(workspace).toContain("evidenceGroups");
    expect(workspace.indexOf("CandidateDraftAction candidate={selected}")).toBeLessThan(
      workspace.indexOf("evidenceGroups"),
    );
    expect(workspace).toContain("/drafts/review?candidate=");
    expect(workspace).toContain('data-active={active ? "true" : undefined}');
    expect(styles).toContain('.row[aria-selected="true"]');
    expect(styles).not.toContain("linear-gradient");
    expect(styles).toContain('.filter[data-active="true"]');
    expect(projection).toContain("candidatePresentationName(c)");
    expect(projection).not.toContain("recipient:redact(");
    expect(workspace).not.toMatch(/prestige/i);
  });

  it("composes one primary recommendation and secondary work without inventing tasks", () => {
    const page = source("src/app/today/page.tsx"),
      styles = source("src/app/today/today-command.module.css");
    expect(page).toContain("const primary=tasks[0]");
    expect(page).toContain("const later=tasks.slice(1)");
    expect(page).toContain("const hasWork=tasks.length>0");
    expect(page).toContain('actionLabel:workflow.gmail.connectionState==="reauthorization-required"?"Reconnect Gmail":"Open System"');
    expect(styles).toContain(".primaryTask");
    expect(styles).toContain(".later");
    expect(page).not.toMatch(/placeholder task|sample task|fictional task/i);
  });

  it("keeps Apollo exhaustion local to candidate refresh", () => {
    const refresh = source("src/app/candidates/refresh-control.tsx"),
      today = source("src/app/today/page.tsx");
    expect(refresh).toContain("local daily allowance is fully accounted or held");
    expect(refresh).toContain("separate from the Apollo account balance");
    expect(today).toContain(
      "Drafts, Gmail, and relationship work remain available.",
    );
  });

  it("recomposes Today and Candidates for mobile", () => {
    const shell = source("src/app/network-command.module.css"),
      today = source("src/app/today/today-command.module.css"),
      candidates = source("src/app/candidates/candidates-command.module.css");
    expect(shell).toContain(".mobileNav");
    expect(today).toContain("@media(max-width:760px)");
    expect(candidates).toContain(".detailOpen { display: block; }");
    expect(candidates).toContain("inset: 56px 0 calc(64px + env(safe-area-inset-bottom))");
    expect(shell.replaceAll(" ", "")).toContain("min-height:44px");
  });
});

import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";

const source=(path:string)=>readFileSync(join(process.cwd(),path),"utf8");

describe("Network Command Phase C.2",()=>{
  it("uses a work-first Today hierarchy with a quiet live-state rail",()=>{
    const page=source("src/app/today/page.tsx"),styles=source("src/app/today/today-command.module.css");
    for(const text of ["Now","Prepared work, ordered by consequence.","Live state","Queue","Relationships","Supply","Gmail","Apollo"])expect(page).toContain(text);
    expect(page).not.toMatch(/Good morning|Good afternoon|Good evening|KPI/i);
    expect(styles).toContain(".tasks>a:first-child");
    expect(styles).toContain("grid-template-columns:minmax(0,1fr) 306px");
  });

  it("reuses existing bounded actions without introducing provider logic",()=>{
    const page=source("src/app/today/page.tsx"),candidates=source("src/app/candidates/page.tsx");
    expect(page).toContain("AddDraftsControl");
    expect(page).toContain("CandidateRefreshControl");
    expect(candidates).toContain("CandidateRefreshControl");
    expect(`${page}\n${candidates}`).not.toMatch(/ApolloAdapter|GmailDraftAdapter|FetchGmailTransport|replenish\(/);
  });

  it("uses identity-first candidates, contextual detail, and all functional filters",()=>{
    const workspace=source("src/app/candidates/candidates-workspace.tsx"),styles=source("src/app/candidates/candidates-command.module.css"),projection=source("src/infrastructure/sqlite/daily-command-center.ts");
    for(const text of ["Search candidates","Filter candidates","Role family","Industry","Geography","Availability","Product","Why this person","Role relevance","Company evidence","History","Planning eligibility"])expect(workspace).toContain(text);
    expect(workspace).toContain("window.history.replaceState");
    expect(workspace).toContain('data-density={density}');
    expect(workspace).toContain("evidenceGroups");
    expect(workspace).toContain('data-active={active?"true":undefined}');
    expect(styles).toContain('.row[aria-selected="true"]{background:linear-gradient');
    expect(styles).toContain('.filter[data-active="true"]');
    expect(projection).toContain("candidatePresentationName(c)");
    expect(projection).not.toContain("recipient:redact(");
    expect(workspace).not.toMatch(/prestige/i);
  });

  it("composes sparse, two-task, and normal Today states without inventing work",()=>{
    const page=source("src/app/today/page.tsx"),styles=source("src/app/today/today-command.module.css");
    expect(page).toContain('data-task-count={Math.min(tasks.length,3)}');
    expect(page).toContain("const hasWork=tasks.length>0");
    expect(styles).toContain('.now[data-task-count="1"]');
    expect(styles).toContain('.now[data-task-count="2"]');
    expect(page).not.toMatch(/placeholder task|sample task|fictional task/i);
  });

  it("keeps Apollo exhaustion local to candidate refresh",()=>{
    const refresh=source("src/app/candidates/refresh-control.tsx"),today=source("src/app/today/page.tsx");
    expect(refresh).toContain("Candidate refresh is available again tomorrow.");
    expect(refresh).toContain("Your drafts and outreach are still available.");
    expect(today).toContain("Drafts, Gmail, and relationship work remain available.");
  });

  it("recomposes Today and Candidates for mobile",()=>{
    const shell=source("src/app/network-command.module.css"),today=source("src/app/today/today-command.module.css"),candidates=source("src/app/candidates/candidates-command.module.css");
    expect(shell).toContain(".mobileNav");
    expect(today).toContain("grid-template-columns:1fr");
    expect(today).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
    expect(candidates).toContain(".detailOpen{display:block}");
    expect(candidates).toContain("inset:auto 0 58px");
  });
});

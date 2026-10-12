import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EmployerReview,
  ExperiencePrototype,
  INITIAL_SYNTHETIC_DRAFTS,
  SYNTHETIC_CANDIDATES,
  ZeroDraftResult,
  candidateDraftFor,
  draftHeaderLabel,
  filterCandidatesForBucket,
  filterDraftsForBucket,
} from "./experience-prototype";

describe("experience reset prototype", () => {
  it("renders a synthetic side-effect-free daily workspace", () => {
    const html = renderToStaticMarkup(<ExperiencePrototype />);

    expect(html).toContain("Interactive prototype");
    expect(html).toContain("Synthetic people and local UI state only");
    expect(html).toContain("No Apollo, Gmail, email, or production data");
    expect(html).toContain("Good afternoon, Dylan");
  });

  it("keeps the global navigation intentionally small", () => {
    const html = renderToStaticMarkup(<ExperiencePrototype />);

    for (const label of ["Today", "Drafts", "Candidates", "Sent", "Resumes", "Settings"])
      expect(html).toContain(label);
    expect(html).not.toContain("System health");
  });

  it("makes a zero-result Add Drafts outcome explicit and recoverable", () => {
    const html = renderToStaticMarkup(
      <ZeroDraftResult onReview={() => undefined} onDismiss={() => undefined} />,
    );

    expect(html).toContain("No drafts could be added");
    expect(html).toContain("2 employers need review");
    expect(html).toContain("1 person already has a draft");
    expect(html).toContain("Review employers");
    expect(html).toContain('role="status"');
  });

  it("labels every employer-review action as synthetic-only", () => {
    const html = renderToStaticMarkup(
      <EmployerReview
        onTrust={() => undefined}
        onStaffing={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain("Trust operating employer");
    expect(html).toContain("Mark recruiting service");
    expect(html).toContain("Leave unverified");
    expect(html).toContain("Prototype state only");
    expect(html).toContain("No company-trust record will be written");
  });

  it.each([
    ["amara", "Amara Patel", "Vela Labs", "Hi Amara"],
    ["marcus", "Marcus Reed", "Northstar Auto", "Hi Marcus"],
    ["elena", "Elena Rossi", "Fieldnote", "Hi Elena"],
  ])("keeps %s candidate identity continuous into its draft", (id, name, company, greeting) => {
    const draft = candidateDraftFor(id);

    expect(draft).toMatchObject({ candidateId: id, id, name, company });
    expect(draft?.subject).toContain(company);
    expect(draft?.body).toContain(greeting);
  });

  it("filters local draft and candidate queues by recipient group", () => {
    expect(filterDraftsForBucket(INITIAL_SYNTHETIC_DRAFTS, "Recruiters").map((draft) => draft.name))
      .toEqual(["Maya Chen", "Aisha Bell"]);
    expect(filterCandidatesForBucket(SYNTHETIC_CANDIDATES, "Peers").map((candidate) => candidate.name))
      .toEqual(["Elena Rossi"]);
    expect(filterDraftsForBucket(INITIAL_SYNTHETIC_DRAFTS, "CEOs")).toEqual([]);
    expect(filterCandidatesForBucket(SYNTHETIC_CANDIDATES, "CEOs")).toEqual([]);
  });

  it("keeps the lifecycle header at Gmail draft during explicit send confirmation", () => {
    expect(draftHeaderLabel("gmail")).toBe("Gmail draft");
    expect(draftHeaderLabel("confirm")).toBe("Gmail draft");
    expect(draftHeaderLabel("sent")).toBe("Sent");
  });

  it("sets mobile lifecycle and metadata to the 12px design floor", () => {
    const css = readFileSync(new URL("./experience-reset.module.css", import.meta.url), "utf8");

    expect(css).toContain(".lifecycle>span{display:grid;justify-items:center;gap:5px;font-size:12px");
    expect(css).toContain(".mobilePeopleButton small,.quietState,.queue em,.resumeRow small,.candidateList em,.candidateCue");
    expect(css).toContain("font-size:12px!important");
  });
});

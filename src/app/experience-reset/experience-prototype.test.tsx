import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmployerReview, ExperiencePrototype, ZeroDraftResult } from "./experience-prototype";

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
});

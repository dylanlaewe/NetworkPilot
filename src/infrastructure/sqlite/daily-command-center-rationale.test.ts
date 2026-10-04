import { describe, expect, it } from "vitest";
import { recruiterSelectionRationale } from "./daily-command-center";

describe("recruiter selection rationale", () => {
  it("never describes an unverified provider employer as reviewed", () => {
    const rationale = recruiterSelectionRationale({
      trustState: "unverified",
      technicalRecruiting: true,
      earlyCareerRecruiting: false,
    });
    expect(rationale).toContain("employer review is still required");
    expect(rationale).not.toMatch(/reviewed (?:target|operating) (?:company|employer)/i);
  });

  it("uses reviewed-employer language only after operating trust", () => {
    expect(
      recruiterSelectionRationale({
        trustState: "trusted-operating",
        technicalRecruiting: true,
        earlyCareerRecruiting: true,
      }),
    ).toBe(
      "Internal early-career technology recruiter at a reviewed operating employer.",
    );
  });

  it("states the staffing-service block explicitly", () => {
    expect(
      recruiterSelectionRationale({
        trustState: "disallowed-recruiting-service",
        technicalRecruiting: false,
        earlyCareerRecruiting: false,
      }),
    ).toContain("marked as a recruiting or staffing service");
  });
});

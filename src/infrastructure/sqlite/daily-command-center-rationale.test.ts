import { describe, expect, it } from "vitest";
import type { ImportedCandidateSnapshot } from "@/application/ingestion";
import {
  candidatePresentationTitle,
  recruiterSelectionRationale,
} from "./daily-command-center";

const candidateWithTitle = (title: string) =>
  ({ source: { currentTitle: title } }) as ImportedCandidateSnapshot;

describe("candidate title projection", () => {
  it("displays retained provider title evidence without normalizing it to the bucket", () => {
    expect(
      candidatePresentationTitle(
        candidateWithTitle("President & Chief Executive Officer (CEO)"),
      ),
    ).toBe("President & Chief Executive Officer (CEO)");
    expect(candidatePresentationTitle(candidateWithTitle("CEO"))).toBe("CEO");
    expect(candidatePresentationTitle(candidateWithTitle("President"))).toBe(
      "President",
    );
  });

  it("uses an explicit unavailable state instead of fabricating a combined title", () => {
    const title = candidatePresentationTitle(candidateWithTitle("   "));
    expect(title).toBe("Title unavailable");
    expect(title).not.toBe("CEO & President");
    expect(title).not.toBe("CEOs & presidents");
  });
});

describe("recruiter selection rationale", () => {
  it("never describes an unverified provider employer as reviewed", () => {
    const rationale = recruiterSelectionRationale({
      trustState: "unverified",
      technicalRecruiting: true,
      earlyCareerRecruiting: false,
    });
    expect(rationale).toContain("employer type remains unverified");
    expect(rationale).toContain("personal introduction");
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

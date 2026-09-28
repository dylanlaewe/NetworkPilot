import { describe, expect, it } from "vitest";
import { mapApolloPerson } from "./adapter";
import { mapApolloProviderEvidence } from "./evidence";
import { APOLLO_PEOPLE } from "./fixtures";

const observedAt = "2026-09-28T12:00:00.000Z";

function person(overrides: Record<string, unknown> = {}) {
  return {
    ...APOLLO_PEOPLE.senior,
    organization: {
      ...APOLLO_PEOPLE.senior.organization,
      id: "org-fixture-001",
    },
    ...overrides,
  };
}

const kinds = (value: unknown) =>
  mapApolloProviderEvidence(value, { observedAt }).evidence.map(
    (item) => item.kind,
  );

describe("Apollo provider-neutral evidence mapping", () => {
  it("maps identity, employment, employer, function, seniority, and provenance separately", () => {
    const mapped = mapApolloProviderEvidence(person(), { observedAt });
    expect(mapped.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "professional-identity",
          sourceReference: "apollo.person.id",
          verified: true,
        }),
        expect.objectContaining({
          kind: "current-employment",
          sourceReference: "apollo.person.organization",
          verified: true,
        }),
        expect.objectContaining({
          kind: "company-identity",
          sourceReference: "apollo.person.organization.id",
          verified: true,
        }),
        expect.objectContaining({
          kind: "relevant-function",
          sourceReference: "apollo.person.title",
          verified: true,
        }),
        expect.objectContaining({
          kind: "individual-contributor",
          sourceReference: "apollo.person.seniority",
          verified: true,
        }),
      ]),
    );
    expect(mapped.sourceFields).toMatchObject({
      rawTitle: "apollo.person.title",
      seniority: "apollo.person.seniority",
      responsibility: "apollo.person.seniority",
    });
  });

  it.each([
    ["Analytics Manager", "manager"],
    ["VP of Data", "vp"],
    ["Chief Data Officer", "c_suite"],
    ["President, East Region", "c_suite"],
  ])(
    "does not turn title-only leadership into responsibility proof for %s",
    (title, seniority) => {
      const evidenceKinds = kinds(person({ title, seniority }));
      expect(evidenceKinds).not.toEqual(
        expect.arrayContaining([
          "team-leadership",
          "functional-leadership",
          "division-leadership",
          "company-leadership",
        ]),
      );
    },
  );

  it("does not infer early-career status, age, or graduation from entry seniority", () => {
    const evidenceKinds = kinds(
      person({ title: "Associate Data Analyst", seniority: "entry" }),
    );
    expect(evidenceKinds).toContain("individual-contributor");
    expect(evidenceKinds).not.toContain("early-career");
  });

  it("qualifies internal recruiting evidence only with employer identity", () => {
    const mapped = mapApolloProviderEvidence(
      person({
        title: "Senior Technical Recruiter",
        seniority: "senior",
      }),
      { observedAt },
    );
    expect(mapped.recruiterEmployerStatus).toBe("internal");
    expect(mapped.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "recruiting-function", verified: true }),
        expect.objectContaining({
          kind: "internal-recruiting",
          value: "internal",
          sourceReference: "apollo.person.organization.id",
          verified: true,
        }),
        expect.objectContaining({
          kind: "recruiting-domain",
          value: "technical-data-ai",
          verified: true,
        }),
      ]),
    );
  });

  it("preserves agency contradiction and its provenance instead of discarding it", () => {
    const mapped = mapApolloProviderEvidence(
      person({
        title: "Technical Recruiter",
        organization: {
          id: "org-agency",
          name: "Example Staffing",
          primary_domain: "example-staffing.test",
          industry: "staffing and recruiting",
        },
      }),
      { observedAt },
    );
    expect(mapped.recruiterEmployerStatus).toBe("agency");
    expect(mapped.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "recruiting-function", verified: true }),
        expect.objectContaining({
          kind: "internal-recruiting",
          value: "agency",
          sourceReference: "apollo.person.organization.industry",
          verified: false,
        }),
      ]),
    );
  });

  it("attributes a name-only staffing signal to the employer name", () => {
    const mapped = mapApolloProviderEvidence(
      person({
        title: "Technical Recruiter",
        organization: {
          id: "org-agency-name",
          name: "Example Staffing",
          primary_domain: "example-staffing.test",
          industry: "technology",
        },
      }),
      { observedAt },
    );
    expect(mapped.evidence).toContainEqual(
      expect.objectContaining({
        kind: "internal-recruiting",
        value: "agency",
        sourceReference: "apollo.person.organization.name",
        verified: false,
      }),
    );
  });

  it("keeps missing employer identity missing", () => {
    const mapped = mapApolloProviderEvidence(
      person({
        title: "Technical Recruiter",
        organization: { name: "Unknown", industry: "technology" },
      }),
      { observedAt },
    );
    expect(mapped.recruiterEmployerStatus).toBe("ambiguous");
    expect(mapped.evidence.some((item) => item.kind === "company-identity")).toBe(
      false,
    );
    expect(mapped.evidence).toContainEqual(
      expect.objectContaining({
        kind: "internal-recruiting",
        value: "ambiguous",
        verified: false,
      }),
    );
  });

  it("survives the Apollo-to-candidate normalization boundary", () => {
    const record = mapApolloPerson(person(), {
      stage: "enrichment",
      retrievedAt: observedAt,
      datasetClassification: "provider-shaped-fixture",
    });
    expect(record.responsibilityEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "individual-contributor",
          sourceReference: "apollo.person.seniority",
        }),
      ]),
    );
    expect(
      record.responsibilityEvidence?.every((item) =>
        item.sourceReference.startsWith("apollo.person."),
      ),
    ).toBe(true);
  });
});

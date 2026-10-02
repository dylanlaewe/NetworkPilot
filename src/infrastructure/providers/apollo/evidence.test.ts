import { describe, expect, it } from "vitest";
import { classifyRecipientBucket } from "@/domain/recipient-buckets";
import {
  mapApolloPerson,
  mapApolloPersonNameProvenance,
} from "./adapter";
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
          sourceReference: "apollo.person.title",
          sourceReferences: [
            "apollo.person.title",
            "apollo.person.organization.name",
          ],
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
      employment: [
        "apollo.person.title",
        "apollo.person.organization.name",
      ],
      industries: ["apollo.person.organization.industry"],
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

  it("keeps absent provider fields absent from evidence lineage", () => {
    const mapped = mapApolloProviderEvidence({}, { observedAt });
    expect(mapped.evidence).toEqual([]);
    expect(mapped.sourceFields).toEqual({
      rawTitle: null,
      employment: null,
      providerPersonId: null,
      providerEmployerId: null,
      employerDomain: null,
      industries: [],
      function: null,
      seniority: null,
      responsibility: null,
    });
  });

  it.each([
    [
      { first_name: "First" },
      ["apollo.person.first_name"],
    ],
    [
      { last_name: "Last" },
      ["apollo.person.last_name"],
    ],
    [
      { first_name: "First", last_name: "Last" },
      ["apollo.person.first_name", "apollo.person.last_name"],
    ],
  ])("records only exact person-name source fields", (value, sourceFields) => {
    expect(mapApolloPersonNameProvenance(value, observedAt)).toMatchObject({
      sourceField: sourceFields[0],
      sourceFields,
    });
  });

  it("removes the nonexistent aggregate person.name provenance", () => {
    const record = mapApolloPerson(person(), {
      stage: "enrichment",
      retrievedAt: observedAt,
      datasetClassification: "provider-shaped-fixture",
    });
    expect(record.fieldProvenance.person).toMatchObject({
      sourceField: "apollo.person.first_name",
      sourceFields: [
        "apollo.person.first_name",
        "apollo.person.last_name",
      ],
    });
    expect(record.fieldProvenance.person?.sourceFields).not.toContain(
      "apollo.person.name",
    );
  });

  it.each(["Senior Technical Recruiter", "Talent Acquisition Partner"])(
    "qualifies %s only with identity and positive operating-company evidence",
    (title) => {
      const mapped = mapApolloProviderEvidence(
        person({
          title,
          seniority: "senior",
        }),
        { observedAt },
      );
      expect(mapped.recruiterEmployerStatus).toBe("internal");
      expect(mapped.evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "recruiting-function",
            verified: true,
          }),
          expect.objectContaining({
            kind: "internal-recruiting",
            value: "internal",
            sourceReference: "apollo.person.organization.industry",
            sourceReferences: [
              "apollo.person.organization.industry",
              "apollo.person.organization.id",
            ],
            verified: true,
          }),
          expect.objectContaining({
            kind: "recruiting-domain",
            value: title.includes("Technical")
              ? "technical-data-ai"
              : "general",
            verified: true,
          }),
        ]),
      );
      expect(
        classifyRecipientBucket({
          title,
          outreachTrack: "recruiter",
          recruiterAccepted: true,
          evidence: mapped.evidence,
        }),
      ).toMatchObject({ bucket: "recruiters", reviewState: "accepted" });
    },
  );

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

  it.each([
    ["neutral staffing industry", "Northwind Partners", "Staffing and Recruiting"],
    ["human resources services", "Northwind Partners", "Human Resources Services"],
    ["executive search name", "Northwind Executive Search", "Technology"],
  ])("rejects %s as agency evidence", (_case, name, industry) => {
    const mapped = mapApolloProviderEvidence(
      person({
        title: "Technical Recruiter",
        organization: {
          id: "org-agency-case",
          name,
          primary_domain: "northwind.example",
          industry,
        },
      }),
      { observedAt },
    );
    expect(mapped.recruiterEmployerStatus).toBe("agency");
    expect(
      mapped.evidence.find((item) => item.kind === "internal-recruiting"),
    ).toMatchObject({ value: "agency", verified: false });
  });

  it.each([
    ["northwindstaffing.com", "agency-contradiction", "agency"],
    ["northwindstaffinggroup.com", "agency-contradiction", "agency"],
    ["northwind-recruiting.com", "agency-contradiction", "agency"],
    ["northwindrecruitinggroup.com", "agency-contradiction", "agency"],
    ["northwind-recruiters.com", "agency-contradiction", "agency"],
    ["northwind-executive-search.com", "agency-contradiction", "agency"],
    ["northwindexecutivesearchgroup.com", "agency-contradiction", "agency"],
    ["northwind-headhunting.com", "agency-contradiction", "agency"],
    ["northwindheadhunting.com", "agency-contradiction", "agency"],
    ["northwind-headhunters.com", "agency-contradiction", "agency"],
    ["northwindrposolutions.com", "agency-contradiction", "agency"],
    ["northwind-rpo-solutions.com", "agency-contradiction", "agency"],
    ["northwindrposervices.com", "agency-contradiction", "agency"],
    ["northwindrpogroup.com", "agency-contradiction", "agency"],
    ["northwindrpopartners.com", "agency-contradiction", "agency"],
    ["northwindrpofirm.com", "agency-contradiction", "agency"],
    ["northwindrpoagency.com", "agency-contradiction", "agency"],
    ["northwindrposearch.com", "agency-contradiction", "agency"],
    ["northwindrpooutsourcing.com", "agency-contradiction", "agency"],
    ["northwindrpoproviders.com", "agency-contradiction", "agency"],
    ["northwindrpoexperts.com", "agency-contradiction", "agency"],
    ["northwindplacementgroup.com", "agency-contradiction", "agency"],
    ["northwindtalentsolutionsgroup.com", "agency-contradiction", "agency"],
    ["northwindemploymentagencygroup.com", "agency-contradiction", "agency"],
    ["northwindemploymentagencies.com", "agency-contradiction", "agency"],
    ["WWW.NORTHWINDSTAFFINGGROUP.COM", "agency-contradiction", "agency"],
    ["careers.northwindstaffinggroup.com", "agency-contradiction", "agency"],
    ["jobs.careers.northwindstaffing.com", "agency-contradiction", "agency"],
    ["jobs.NORTHWINDSTAFFINGGROUP.CO.UK", "agency-contradiction", "agency"],
    ["http://northwindstaffing.com", "agency-contradiction", "agency"],
    ["http://northwindstaffing.com:80", "agency-contradiction", "agency"],
    ["https://northwindstaffing.com", "agency-contradiction", "agency"],
    ["https://northwindstaffing.com:443", "agency-contradiction", "agency"],
    [
      "https://www.northwindstaffing.com/jobs?team=engineering",
      "agency-contradiction",
      "agency",
    ],
    ["staffingnorthwind.com", "ambiguous", "ambiguous"],
    ["recruitingnorthwind.com", "ambiguous", "ambiguous"],
    ["executivesearchnorthwind.com", "ambiguous", "ambiguous"],
    ["rponorthwind.com", "ambiguous", "ambiguous"],
    ["northwindrpo.com", "ambiguous", "ambiguous"],
    ["northwindstaffers.com", "ambiguous", "ambiguous"],
    ["northwindrecruit.com", "ambiguous", "ambiguous"],
    ["northwindtalentsolution.com", "ambiguous", "ambiguous"],
    ["northwindsearchfirm.com", "agency-contradiction", "agency"],
    ["searchfirmnorthwind.com", "ambiguous", "ambiguous"],
    ["staffington.com", "ambiguous", "ambiguous"],
    ["stafford.com", "ambiguous", "ambiguous"],
    ["staffordsoftware.com", "ambiguous", "ambiguous"],
    ["staffordshire.co.uk", "ambiguous", "ambiguous"],
    ["staffwise.com", "ambiguous", "ambiguous"],
    ["researchfirm.com", "ambiguous", "ambiguous"],
    ["researchfirmware.com", "ambiguous", "ambiguous"],
    ["displacement.com", "ambiguous", "ambiguous"],
    ["replacement.com", "ambiguous", "ambiguous"],
    ["misplacement.com", "ambiguous", "ambiguous"],
    ["replacementservices.com", "ambiguous", "ambiguous"],
    ["displacementgroup.com", "ambiguous", "ambiguous"],
    ["misplacementpartners.com", "ambiguous", "ambiguous"],
    ["recruitingdale.com", "ambiguous", "ambiguous"],
    ["staff-ing-like.com", "ambiguous", "ambiguous"],
    ["northwindѕtaffing.com", "ambiguous", "ambiguous"],
    ["xn--northwindtaffing-0vn.com", "ambiguous", "ambiguous"],
    ["münchen.example", "ambiguous", "ambiguous"],
    ["ordinarysoftware.com", "neutral", "internal"],
    ["northwindcloud.com", "neutral", "internal"],
    ["acme-industries.com", "neutral", "internal"],
    ["corporation.com", "neutral", "internal"],
    ["metropolitan.com", "neutral", "internal"],
    ["carpool.com", "neutral", "internal"],
    ["northwindsoftware.com", "neutral", "internal"],
    ["recruiting-tools.jobs.northwindsoftware.com", "neutral", "internal"],
  ] as const)(
    "applies registrable-domain tri-state policy to %s",
    (primaryDomain, expectedDomain, expectedRecruiter) => {
      const mapped = mapApolloProviderEvidence(
        person({
          title: "Technical Recruiter",
          organization: {
            id: "org-domain-case",
            name: "Northwind Talent Software",
            primary_domain: primaryDomain,
            industry: "Technology",
          },
        }),
        { observedAt },
      );
      expect(mapped.recruiterDomainEvidence).toBe(expectedDomain);
      expect(mapped.recruiterEmployerStatus).toBe(expectedRecruiter);
      const internal = mapped.evidence.find(
        (item) => item.kind === "internal-recruiting",
      );
      expect(internal).toMatchObject({
        value: expectedRecruiter,
        verified: expectedRecruiter === "internal",
      });
      if (expectedDomain !== "neutral")
        expect(internal?.sourceReferences).toContain(
          "apollo.person.organization.primary_domain",
        );
      if (expectedDomain === "ambiguous")
        expect(
          classifyRecipientBucket({
            title: "Technical Recruiter",
            outreachTrack: "recruiter",
            recruiterAccepted: true,
            evidence: mapped.evidence,
          }),
        ).toMatchObject({
          bucket: "recruiters",
          reviewState: "review-required",
          confidence: "low",
        });
    },
  );

  it.each([
    "staffington.com",
    "staffingdale.com",
    "recruitingdale.com",
    "recruiterly.com",
    "replacement.com",
    "displacement.com",
    "misplacement.com",
    "rponorthwind.com",
    "northwindrpo.com",
  ])("does not overmatch generated lexical neighbor %s", (primaryDomain) => {
    const mapped = mapApolloProviderEvidence(
      person({
        title: "Technical Recruiter",
        organization: {
          id: "org-negative-control",
          name: "Northwind Technology",
          primary_domain: primaryDomain,
          industry: "Technology",
        },
      }),
      { observedAt },
    );
    expect(mapped.recruiterDomainEvidence).toBe("ambiguous");
    expect(mapped.recruiterEmployerStatus).toBe("ambiguous");
    expect(
      mapped.evidence.find((item) => item.kind === "internal-recruiting"),
    ).toMatchObject({ verified: false });
  });

  it.each([
    "northwindstaffing.com",
    "northwindstaffinggroup.com",
    "northwind-recruiting.com",
    "northwindrecruitinggroup.com",
    "northwind-recruiters.com",
    "northwindexecutivesearchgroup.com",
    "northwind-headhunting.com",
    "northwindheadhunting.com",
    "northwind-headhunters.com",
    "northwindrposolutions.com",
    "northwind-rpo-solutions.com",
    "northwindrpogroup.com",
    "northwindrpopartners.com",
    "northwindrpofirm.com",
    "northwindrpoagency.com",
    "northwindrposearch.com",
    "northwindrpooutsourcing.com",
    "northwindrpoproviders.com",
    "northwindrpoexperts.com",
    "northwindplacementgroup.com",
    "northwindtalentsolutionsgroup.com",
    "northwindemploymentagencygroup.com",
    "northwindemploymentagencies.com",
    "northwindsearchfirm.com",
    "searchfirmnorthwind.com",
    "staffingnorthwind.com",
    "recruitingnorthwind.com",
    "rponorthwind.com",
    "northwindrpo.com",
    "northwindstaffers.com",
    "northwindrecruit.com",
    "northwindtalentsolution.com",
    "stafford.com",
    "staffordsoftware.com",
    "staffordshire.co.uk",
    "staffwise.com",
    "researchfirm.com",
    "researchfirmware.com",
    "staffington.com",
    "recruitingdale.com",
    "replacement.com",
    "displacement.com",
    "misplacement.com",
    "replacementservices.com",
    "displacementgroup.com",
    "misplacementpartners.com",
    "unemploymentagency.com",
    "nonhumanresources.com",
    "understaffing.com",
    "nonrecruiter.com",
    "northwindѕtaffing.com",
    "xn--northwindtaffing-0vn.com",
    "münchen.example",
  ])(
    "blocks automatic verified-internal qualification for domain signal %s",
    (primaryDomain) => {
      const mapped = mapApolloProviderEvidence(
        person({
          title: "Technical Recruiter",
          organization: {
            id: "org-domain-invariant",
            name: "Northwind Technology",
            primary_domain: primaryDomain,
            industry: "Software",
          },
        }),
        { observedAt },
      );
      expect(mapped.recruiterDomainEvidence).not.toBe("neutral");
      expect(mapped.recruiterEmployerStatus).not.toBe("internal");
      expect(
        mapped.evidence.find((item) => item.kind === "internal-recruiting"),
      ).toMatchObject({ verified: false });
      expect(
        classifyRecipientBucket({
          title: "Technical Recruiter",
          outreachTrack: "recruiter",
          recruiterAccepted: true,
          evidence: mapped.evidence,
        }),
      ).toMatchObject({
        bucket: "recruiters",
        reviewState: "review-required",
      });
    },
  );

  it.each([
    ["agency-contradiction", "northwindstaffing.com"],
    ["ambiguous", "northwindrecruit.com"],
  ] as const)(
    "makes automatic qualification impossible for %s domain evidence",
    (expectedDomainEvidence, primaryDomain) => {
      const mapped = mapApolloProviderEvidence(
        person({
          title: "Technical Recruiter",
          organization: {
            id: "org-maximally-favorable",
            name: "Northwind Technology",
            primary_domain: primaryDomain,
            industry: "Software",
          },
        }),
        { observedAt },
      );
      expect(mapped.recruiterDomainEvidence).toBe(expectedDomainEvidence);
      expect(mapped.recruiterEmployerStatus).not.toBe("internal");
      expect(
        classifyRecipientBucket({
          title: "Technical Recruiter",
          outreachTrack: "recruiter",
          recruiterAccepted: true,
          evidence: mapped.evidence,
        }),
      ).toMatchObject({
        bucket: "recruiters",
        reviewState: "review-required",
      });
    },
  );

  it("lets a staffing-domain contradiction override an operating industry", () => {
    const mapped = mapApolloProviderEvidence(
      person({
        title: "Technical Recruiter",
        organization: {
          id: "org-domain-conflict",
          name: "Northwind Partners",
          primary_domain: "northwindstaffing.com",
          industry: "Technology",
        },
      }),
      { observedAt },
    );
    expect(mapped.recruiterEmployerStatus).toBe("agency");
    expect(
      classifyRecipientBucket({
        title: "Technical Recruiter",
        outreachTrack: "recruiter",
        recruiterAccepted: true,
        evidence: mapped.evidence,
      }),
    ).toMatchObject({
      bucket: "recruiters",
      reviewState: "review-required",
      confidence: "low",
    });
  });

  it("lets a staffing-industry contradiction override an ordinary domain", () => {
    const mapped = mapApolloProviderEvidence(
      person({
        title: "Technical Recruiter",
        organization: {
          id: "org-industry-conflict",
          name: "Northwind Partners",
          primary_domain: "northwindsoftware.com",
          industry: "Staffing and Recruiting",
        },
      }),
      { observedAt },
    );
    expect(mapped.recruiterEmployerStatus).toBe("agency");
  });

  it("does not require a domain with employer ID and operating industry", () => {
    const mapped = mapApolloProviderEvidence(
      person({
        title: "Technical Recruiter",
        organization: {
          id: "org-no-domain",
          name: "Northwind Software",
          industry: "Software",
        },
      }),
      { observedAt },
    );
    expect(mapped.recruiterEmployerStatus).toBe("internal");
    expect(mapped.recruiterDomainEvidence).toBe("no-domain-evidence");
    expect(mapped.sourceFields.employerDomain).toBeNull();
  });

  it.each([
    "northwind_staffing.com",
    "not a valid staffing domain",
    "garbage",
    "https://northwindstaffing.com:99999",
  ])(
    "fails supplied malformed domain %s closed without using it as identity",
    (primaryDomain) => {
      const mapped = mapApolloProviderEvidence(
        person({
          title: "Technical Recruiter",
          organization: {
            name: "Northwind Software",
            primary_domain: primaryDomain,
            industry: "Software",
          },
        }),
        { observedAt },
      );
      expect(mapped.recruiterEmployerStatus).toBe("ambiguous");
      expect(mapped.recruiterDomainEvidence).toBe("ambiguous");
      expect(mapped.sourceFields.employerDomain).toBeNull();
      expect(
        mapped.evidence.some((item) => item.kind === "company-identity"),
      ).toBe(false);
    },
  );

  it.each([
    ["Executive Recruiter", "Technology"],
    ["Technical Recruiter", undefined],
  ])(
    "keeps %s ambiguous when positive employer-type evidence is insufficient",
    (title, industry) => {
      const mapped = mapApolloProviderEvidence(
        person({
          title,
          organization: {
            id: "org-ambiguous",
            name: "Northwind Partners",
            primary_domain: "northwind.example",
            ...(industry ? { industry } : {}),
          },
        }),
        { observedAt },
      );
      expect(mapped.recruiterEmployerStatus).toBe("ambiguous");
      expect(
        mapped.evidence.find((item) => item.kind === "internal-recruiting"),
      ).toMatchObject({ value: "ambiguous", verified: false });
      expect(
        classifyRecipientBucket({
          title,
          outreachTrack: "recruiter",
          recruiterAccepted: true,
          evidence: mapped.evidence,
        }),
      ).toMatchObject({ bucket: "recruiters", reviewState: "review-required" });
    },
  );

  it("lets an exact industries-array agency contradiction override a positive primary industry", () => {
    const mapped = mapApolloProviderEvidence(
      person({
        title: "Technical Recruiter",
        organization: {
          id: "org-conflict",
          name: "Northwind Partners",
          primary_domain: "northwind.example",
          industry: "Technology",
          industries: ["Staffing and Recruiting"],
        },
      }),
      { observedAt },
    );
    expect(mapped.recruiterEmployerStatus).toBe("agency");
    expect(
      mapped.evidence.find((item) => item.kind === "internal-recruiting"),
    ).toMatchObject({
      sourceReference: "apollo.person.organization.industries",
      sourceReferences: ["apollo.person.organization.industries"],
      verified: false,
    });
  });

  it("retains exact fallback employer-name provenance", () => {
    const value = person({
      organization_name: "Fallback Software",
      organization: {
        id: "org-fallback",
        primary_domain: "fallback.example",
        industry: "Software",
      },
    });
    const mapped = mapApolloProviderEvidence(value, { observedAt });
    expect(
      mapped.evidence.find((item) => item.kind === "current-employment"),
    ).toMatchObject({
      sourceReferences: [
        "apollo.person.title",
        "apollo.person.organization_name",
      ],
    });
    expect(mapped.sourceFields.employment).toEqual([
      "apollo.person.title",
      "apollo.person.organization_name",
    ]);
    expect(
      mapApolloPerson(value, {
        stage: "enrichment",
        retrievedAt: observedAt,
        datasetClassification: "provider-shaped-fixture",
      }).fieldProvenance.currentOrganization,
    ).toMatchObject({ sourceField: "apollo.person.organization_name" });
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

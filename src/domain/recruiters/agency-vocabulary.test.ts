import { describe, expect, it } from "vitest";
import { classifyRecruiter } from "./classify";
import {
  AGENCY_CONCEPT_INVENTORY,
  agencyConceptIdsInText,
  classifyRecruiterEmployerDomain,
  modeledAgencyDomainOutcomes,
  normalizeRecruiterEmployerDomain,
} from "./agency-vocabulary";

describe("canonical recruiter agency vocabulary", () => {
  it.each(AGENCY_CONCEPT_INVENTORY)(
    "keeps name and domain policy coverage intentional for $id",
    (concept) => {
      if (concept.namePolicy === "domain-only") {
        expect(concept.namePhrases).toEqual([]);
        expect(concept.namePolicyReason?.trim()).not.toBe("");
      } else {
        expect(concept.namePhrases.length).toBeGreaterThan(0);
      }
      for (const phrase of concept.namePhrases) {
        expect(agencyConceptIdsInText(`Northwind ${phrase}`)).toContain(
          concept.id,
        );
        expect(
          classifyRecruiter({
            title: "Technical Recruiter",
            employerName: `Northwind ${phrase}`,
            internalCompanyMatch: true,
            minimumExperience: 3,
            maximumExperience: 8,
          }),
        ).toMatchObject({
          internalStatus: "agency",
          accepted: false,
        });
      }

      if (concept.domainPolicy.support === "intentionally-unsupported") {
        expect(concept.domainPolicy.reason.trim()).not.toBe("");
        return;
      }
      expect(modeledAgencyDomainOutcomes(concept).length).toBeGreaterThan(0);
    },
  );
});

describe("recruiter employer-domain safety", () => {
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
    "northwindplacementgroup.com",
    "northwindtalentsolutionsgroup.com",
    "northwindemploymentagencygroup.com",
  ])("keeps prior modeled agency case %s non-neutral", (domain) => {
    expect(classifyRecruiterEmployerDomain(domain)).not.toBe("neutral");
  });

  it.each([
    "northwindrpogroup.com",
    "northwindrpopartners.com",
    "northwindrpofirm.com",
    "northwindrpoagency.com",
    "northwindemploymentagencies.com",
    "northwindstaffers.com",
    "northwindrecruit.com",
  ])("closes newly discovered fail-open case %s", (domain) => {
    expect(classifyRecruiterEmployerDomain(domain)).not.toBe("neutral");
  });

  it.each([
    "staffington.com",
    "recruitingdale.com",
    "replacement.com",
    "displacement.com",
    "misplacement.com",
    "unemploymentagency.com",
    "nonhumanresources.com",
    "understaffing.com",
    "nonrecruiter.com",
  ])("keeps unresolved lexical neighbor %s ambiguous", (domain) => {
    expect(classifyRecruiterEmployerDomain(domain)).toBe("ambiguous");
  });

  it.each([
    "corporation.com",
    "metropolitan.com",
    "carpool.com",
    "ordinarysoftware.com",
    "northwindcloud.com",
    "acme-industries.com",
  ])("preserves neutral control %s", (domain) => {
    expect(classifyRecruiterEmployerDomain(domain)).toBe("neutral");
  });

  it.each([
    ["http://northwindstaffing.com", "northwindstaffing.com"],
    ["https://northwindstaffing.com", "northwindstaffing.com"],
    ["WWW.NORTHWINDSTAFFING.COM", "northwindstaffing.com"],
    ["careers.northwindstaffing.com", "careers.northwindstaffing.com"],
    [
      "https://www.northwindstaffing.com/jobs?team=engineering",
      "northwindstaffing.com",
    ],
  ])("normalizes analyzable provider shape %s", (value, hostname) => {
    expect(normalizeRecruiterEmployerDomain(value)).toBe(hostname);
    expect(classifyRecruiterEmployerDomain(value)).toBe(
      "agency-contradiction",
    );
  });

  it.each([
    "northwind_staffing.com",
    "not a valid domain",
    "garbage",
    "ftp://northwindstaffing.com",
  ])("fails supplied malformed value %s closed", (value) => {
    expect(normalizeRecruiterEmployerDomain(value)).toBeUndefined();
    expect(classifyRecruiterEmployerDomain(value)).toBe("ambiguous");
  });

  it.each([undefined, null, "", "   "])(
    "keeps truly absent domain %s distinct",
    (value) => {
      expect(classifyRecruiterEmployerDomain(value)).toBe(
        "no-domain-evidence",
      );
    },
  );

  it("keeps bounded generated long-root cases from becoming neutral", () => {
    const roots = AGENCY_CONCEPT_INVENTORY.flatMap((concept) =>
      concept.domainPolicy.support === "modeled"
        ? (concept.domainPolicy.ambiguousFragments ?? [])
        : [],
    );
    const generated = roots.flatMap((root) => [
      `${root}company.com`,
      `company${root}.com`,
      `company${root}group.com`,
      `non${root}.com`,
      `re${root}.com`,
      `un${root}.com`,
    ]);
    expect(generated.length).toBeGreaterThan(0);
    for (const domain of generated)
      expect(classifyRecruiterEmployerDomain(domain), domain).not.toBe(
        "neutral",
      );
  });

  it.each([
    "rpo.com",
    "rponorthwind.com",
    "northwindrpo.com",
    "northwindrpogroup.com",
    "northwind-rpo-solutions.com",
  ])("uses bounded structural RPO rules for %s", (domain) => {
    expect(classifyRecruiterEmployerDomain(domain)).not.toBe("neutral");
  });
});

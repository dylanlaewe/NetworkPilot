import { describe, expect, it } from "vitest";
import { classifyRecruiter } from "./classify";
import {
  AGENCY_CONCEPT_INVENTORY,
  agencyConceptIdsInText,
  modeledAgencyDomainOutcomes,
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

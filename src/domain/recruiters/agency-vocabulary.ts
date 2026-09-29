export type AgencyDomainOutcome = "agency-contradiction" | "ambiguous";

export type AgencyDomainPolicy =
  | {
      support: "modeled";
      separatedTokens?: readonly string[];
      separatedPhrases?: readonly (readonly string[])[];
      approvedCompoundEndings?: readonly string[];
      ambiguousFragments?: readonly string[];
      ambiguousBoundaryTerms?: readonly string[];
    }
  | {
      support: "intentionally-unsupported";
      reason: string;
    };

export interface AgencyConcept {
  id: string;
  namePolicy: "modeled" | "domain-only";
  namePolicyReason?: string;
  namePhrases: readonly string[];
  domainPolicy: AgencyDomainPolicy;
}

/**
 * Canonical external-recruiting vocabulary. Name/industry checks consume the
 * phrases while domain interpretation consumes each concept's explicit,
 * deliberately narrower structural policy.
 */
export const AGENCY_CONCEPT_INVENTORY: readonly AgencyConcept[] = [
  {
    id: "staffing",
    namePolicy: "modeled",
    namePhrases: ["staffing", "staffing and recruiting", "staffing solutions"],
    domainPolicy: {
      support: "modeled",
      separatedTokens: ["staffing"],
      approvedCompoundEndings: [
        "staffing",
        "staffinggroup",
        "staffingservices",
        "staffingsolutions",
        "staffingagency",
        "staffingfirm",
        "staffingsearch",
        "staffingpartners",
      ],
      ambiguousFragments: ["staffing"],
    },
  },
  {
    id: "recruiting",
    namePolicy: "modeled",
    namePhrases: ["recruiting", "recruiting services", "recruiting agency", "recruiting solutions"],
    domainPolicy: {
      support: "modeled",
      separatedTokens: ["recruiting"],
      approvedCompoundEndings: [
        "recruiting",
        "recruitinggroup",
        "recruitingservices",
        "recruitingsolutions",
        "recruitingagency",
        "recruitingfirm",
        "recruitingsearch",
        "recruitingpartners",
      ],
      ambiguousFragments: ["recruiting"],
    },
  },
  {
    id: "recruitment",
    namePolicy: "modeled",
    namePhrases: ["recruitment", "recruitment services", "recruitment agency"],
    domainPolicy: {
      support: "modeled",
      separatedTokens: ["recruitment"],
      approvedCompoundEndings: [
        "recruitment",
        "recruitmentgroup",
        "recruitmentservices",
        "recruitmentsolutions",
        "recruitmentagency",
        "recruitmentfirm",
        "recruitmentsearch",
        "recruitmentpartners",
      ],
      ambiguousFragments: ["recruitment"],
    },
  },
  {
    id: "recruiter",
    namePolicy: "domain-only",
    namePolicyReason:
      "Recruiter terminology in an operating employer name is not agency proof.",
    // A recruiter title appearing in an operating employer's name is not by
    // itself agency proof; these are domain-only concepts.
    namePhrases: [],
    domainPolicy: {
      support: "modeled",
      separatedTokens: ["recruiter", "recruiters"],
      approvedCompoundEndings: [
        "recruiter",
        "recruiters",
        "recruitergroup",
        "recruitersgroup",
        "recruiterservices",
        "recruiterssolutions",
      ],
      ambiguousFragments: ["recruiter", "recruiters"],
    },
  },
  {
    id: "headhunting",
    namePolicy: "modeled",
    namePhrases: ["headhunt", "headhunting", "headhunter", "headhunters"],
    domainPolicy: {
      support: "modeled",
      separatedTokens: ["headhunt", "headhunting", "headhunter", "headhunters"],
      approvedCompoundEndings: [
        "headhunt",
        "headhunting",
        "headhunter",
        "headhunters",
        "headhuntinggroup",
        "headhuntingservices",
        "headhuntergroup",
        "headhuntersgroup",
      ],
      ambiguousFragments: ["headhunt", "headhunting", "headhunter", "headhunters"],
    },
  },
  {
    id: "executive-search",
    namePolicy: "modeled",
    namePhrases: ["executive search"],
    domainPolicy: {
      support: "modeled",
      separatedPhrases: [["executive", "search"]],
      approvedCompoundEndings: [
        "executivesearch",
        "executivesearchgroup",
        "executivesearchservices",
        "executivesearchfirm",
        "executivesearchpartners",
      ],
      ambiguousFragments: ["executivesearch"],
    },
  },
  {
    id: "search-firm",
    namePolicy: "modeled",
    namePhrases: ["search firm"],
    domainPolicy: {
      support: "modeled",
      separatedPhrases: [["search", "firm"]],
      ambiguousFragments: ["searchfirm"],
    },
  },
  {
    id: "placement",
    namePolicy: "modeled",
    namePhrases: ["placement", "placement services"],
    domainPolicy: {
      support: "modeled",
      separatedTokens: ["placement"],
      approvedCompoundEndings: [
        "placementgroup",
        "placementservices",
        "placementsolutions",
        "placementagency",
        "placementfirm",
        "placementsearch",
        "placementpartners",
      ],
      ambiguousFragments: ["placement"],
    },
  },
  {
    id: "rpo",
    namePolicy: "modeled",
    namePhrases: ["rpo", "recruiting process outsourcing"],
    domainPolicy: {
      support: "modeled",
      separatedTokens: ["rpo"],
      approvedCompoundEndings: ["rposolutions", "rposervices"],
      ambiguousBoundaryTerms: ["rpo"],
    },
  },
  {
    id: "talent-solutions",
    namePolicy: "modeled",
    namePhrases: ["talent solutions"],
    domainPolicy: {
      support: "modeled",
      separatedPhrases: [["talent", "solutions"]],
      approvedCompoundEndings: [
        "talentsolutions",
        "talentsolutionsgroup",
        "talentsolutionsagency",
        "talentsolutionsfirm",
        "talentsolutionspartners",
      ],
      ambiguousFragments: ["talentsolutions"],
    },
  },
  {
    id: "employment-agency",
    namePolicy: "modeled",
    namePhrases: ["employment agency"],
    domainPolicy: {
      support: "modeled",
      separatedPhrases: [["employment", "agency"]],
      approvedCompoundEndings: [
        "employmentagency",
        "employmentagencygroup",
        "employmentagencyservices",
        "employmentagencypartners",
      ],
      ambiguousFragments: ["employmentagency"],
    },
  },
  {
    id: "human-resources-services",
    namePolicy: "modeled",
    namePhrases: ["human resources", "human resources services"],
    domainPolicy: {
      support: "modeled",
      separatedPhrases: [["human", "resources"]],
      approvedCompoundEndings: [
        "humanresources",
        "humanresourcesservices",
        "humanresourcesgroup",
      ],
      ambiguousFragments: ["humanresources"],
    },
  },
];

const normalizedWords = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export function agencyConceptIdsInText(value: string): string[] {
  const normalized = ` ${normalizedWords(value).join(" ")} `;
  return AGENCY_CONCEPT_INVENTORY.filter((concept) =>
    concept.namePhrases.some((phrase) =>
      normalized.includes(` ${normalizedWords(phrase).join(" ")} `),
    ),
  ).map((concept) => concept.id);
}

export const hasAgencyConcept = (value: string): boolean =>
  agencyConceptIdsInText(value).length > 0;

export function modeledAgencyDomainOutcomes(
  concept: AgencyConcept,
): AgencyDomainOutcome[] {
  if (concept.domainPolicy.support === "intentionally-unsupported") return [];
  const outcomes: AgencyDomainOutcome[] = [];
  if (
    concept.domainPolicy.separatedTokens?.length ||
    concept.domainPolicy.separatedPhrases?.length ||
    concept.domainPolicy.approvedCompoundEndings?.length
  )
    outcomes.push("agency-contradiction");
  if (
    concept.domainPolicy.ambiguousFragments?.length ||
    concept.domainPolicy.ambiguousBoundaryTerms?.length
  )
    outcomes.push("ambiguous");
  return outcomes;
}

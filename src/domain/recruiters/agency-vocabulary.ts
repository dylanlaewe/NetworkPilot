export type AgencyDomainOutcome = "agency-contradiction" | "ambiguous";

export type RecruiterEmployerDomainEvidence =
  | AgencyDomainOutcome
  | "neutral"
  | "no-domain-evidence";

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
    namePhrases: [
      "staffing",
      "staffing and recruiting",
      "staffing solutions",
      "staffer",
      "staffers",
    ],
    domainPolicy: {
      support: "modeled",
      separatedTokens: ["staffing", "staffer", "staffers"],
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
      ambiguousFragments: ["staff"],
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
      ambiguousFragments: ["recruit"],
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
      approvedCompoundEndings: [
        "searchfirm",
        "searchfirmgroup",
        "searchfirmservices",
        "searchfirmpartners",
      ],
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
      approvedCompoundEndings: [
        "rposolutions",
        "rposervices",
        "rpogroup",
        "rpopartners",
        "rpofirm",
        "rpoagency",
        "rposearch",
        "rpooutsourcing",
        "rpoproviders",
        "rpoexperts",
      ],
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
      ambiguousFragments: ["talentsolution", "talentsolutions"],
    },
  },
  {
    id: "employment-agency",
    namePolicy: "modeled",
    namePhrases: ["employment agency", "employment agencies"],
    domainPolicy: {
      support: "modeled",
      separatedPhrases: [["employment", "agency"]],
      approvedCompoundEndings: [
        "employmentagency",
        "employmentagencygroup",
        "employmentagencyservices",
        "employmentagencypartners",
        "employmentagencies",
        "employmentagenciesgroup",
        "employmentagenciesservices",
        "employmentagenciespartners",
      ],
      ambiguousFragments: ["employmentagenc"],
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

const COMMON_SECOND_LEVEL_DOMAINS = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "gov",
  "net",
  "org",
]);

const optionalDomainString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Accepts a bare hostname or an ordinary HTTP(S) URL. A supplied value is
 * returned only when its hostname is safe to interpret as a DNS-like domain;
 * callers retain absence versus parse failure through the classifier below.
 */
export function normalizeRecruiterEmployerDomain(
  value: unknown,
): string | undefined {
  const raw = optionalDomainString(value)?.toLowerCase();
  if (!raw || raw.length > 2_048 || /\s/.test(raw)) return undefined;
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const url = new URL(hasScheme ? raw : `https://${raw}`);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    )
      return undefined;
    const hostname = url.hostname.replace(/^www\./, "").replace(/\.$/, "");
    if (hostname.length > 253) return undefined;
    const labels = hostname.split(".");
    if (
      labels.length < 2 ||
      labels.some(
        (label) =>
          !label ||
          label.length > 63 ||
          !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
      ) ||
      labels.every((label) => /^\d+$/.test(label))
    )
      return undefined;
    return hostname;
  } catch {
    return undefined;
  }
}

function registrableDomainLabel(hostname: string): string {
  const labels = hostname.split(".");
  const final = labels.at(-1)!;
  const second = labels.at(-2)!;
  const usesCountrySecondLevel =
    final.length === 2 &&
    COMMON_SECOND_LEVEL_DOMAINS.has(second) &&
    labels.length >= 3;
  return labels.at(usesCountrySecondLevel ? -3 : -2)!;
}

/**
 * Domain evidence is asymmetric: explicit service structures contradict an
 * internal-employer claim, unresolved agency-like material is ambiguous, and
 * neutral is reserved for safely parsed labels with neither signal. A missing
 * value is absence of evidence; a supplied malformed value fails closed.
 */
export function classifyRecruiterEmployerDomain(
  value: unknown,
): RecruiterEmployerDomainEvidence {
  if (!optionalDomainString(value)) return "no-domain-evidence";
  const hostname = normalizeRecruiterEmployerDomain(value);
  if (!hostname) return "ambiguous";
  const label = registrableDomainLabel(hostname);
  const tokens = label.split("-").filter(Boolean);
  const compact = tokens.join("");
  const requiresIdnInterpretation = hostname
    .split(".")
    .some((domainLabel) => domainLabel.startsWith("xn--"));
  const lexicalTerms = AGENCY_CONCEPT_INVENTORY.flatMap((concept) => {
    const policy = concept.domainPolicy;
    if (policy.support === "intentionally-unsupported") return [];
    return [
      ...(policy.separatedTokens ?? []),
      ...(policy.separatedPhrases?.map((phrase) => phrase.join("")) ?? []),
      ...(policy.approvedCompoundEndings ?? []),
      ...(policy.ambiguousFragments ?? []),
      ...(policy.ambiguousBoundaryTerms ?? []),
    ];
  });
  const isPrefixedLexicalNeighbor = [
    "non",
    "re",
    "un",
    "under",
    "dis",
    "mis",
  ].some((prefix) =>
    lexicalTerms.some((term) => compact === `${prefix}${term}`),
  );

  if (!isPrefixedLexicalNeighbor) {
    for (const concept of AGENCY_CONCEPT_INVENTORY) {
      const policy = concept.domainPolicy;
      if (policy.support === "intentionally-unsupported") continue;
      if (
        policy.separatedTokens?.some((term) => tokens.includes(term)) ||
        policy.separatedPhrases?.some((phrase) =>
          tokens.some((token, index) =>
            phrase.every((term, offset) => tokens[index + offset] === term),
          ),
        ) ||
        policy.approvedCompoundEndings?.some((ending) =>
          compact.endsWith(ending),
        )
      )
        return "agency-contradiction";
    }
  }

  if (requiresIdnInterpretation) return "ambiguous";

  for (const concept of AGENCY_CONCEPT_INVENTORY) {
    const policy = concept.domainPolicy;
    if (policy.support === "intentionally-unsupported") continue;
    if (
      policy.ambiguousFragments?.some((fragment) =>
        compact.includes(fragment),
      ) ||
      policy.ambiguousBoundaryTerms?.some(
        (term) => compact.startsWith(term) || compact.endsWith(term),
      )
    )
      return "ambiguous";
  }
  return "neutral";
}

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

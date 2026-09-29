import { classifyRecipientFunction } from "@/domain/candidates";
import type {
  BucketEvidenceKind,
  RecipientBucketEvidence,
} from "@/domain/recipient-buckets";

type JsonRecord = Record<string, unknown>;

const AGENCY_SIGNALS =
  /\b(staffing(?: and recruiting)?|recruit(?:ment|ing)(?: services| agency)?|executive[- ]search|search firm|headhunt(?:er|ing)?|placement(?: services)?|talent[- ]solutions|rpo|employment agency|human resources(?: services)?)\b/i;
const OPERATING_COMPANY_INDUSTRY =
  /\b(technology|software|internet|computer|information technology|financial services|banking|insurance|healthcare|hospital|pharmaceutical|biotech|manufacturing|retail|consumer goods|telecommunications|energy|utilities|aerospace|defense|automotive|transportation|logistics|government|education|higher education|real estate|media|semiconductor)\b/i;
const RECRUITING_FUNCTION =
  /\b(recruiter|recruiting|talent acquisition|talent partner|talent scout)\b/i;
const AMBIGUOUS_RECRUITER_TITLE =
  /\b(consultant|agency|staffing|executive (?:search|recruiter)|headhunter)\b/i;
const LEADERSHIP_TITLE =
  /\b(manager|management|director|head|lead|chief|president|vp|vice president|supervisor)\b/i;
const COMMON_SECOND_LEVEL_DOMAINS = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "gov",
  "net",
  "org",
]);
const AGENCY_DOMAIN_TERMS = [
  "staffing",
  "recruiting",
  "recruitment",
  "recruiter",
  "placement",
] as const;
const AGENCY_DOMAIN_COMPOUNDS = [
  "executivesearch",
  "talentsolutions",
  "employmentagency",
] as const;

const optionalRecord = (value: unknown): JsonRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === "string" && Boolean(item.trim()),
        )
        .map((item) => item.trim())
    : [];

export function normalizeApolloEmployerDomain(
  value: unknown,
): string | undefined {
  const raw = optionalString(value)?.toLowerCase();
  if (!raw || raw.length > 253 || /\s/.test(raw)) return undefined;
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port
    )
      return undefined;
    const hostname = url.hostname.replace(/^www\./, "").replace(/\.$/, "");
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

function agencyDomainContradiction(hostname: string | undefined): boolean {
  if (!hostname) return false;
  const label = registrableDomainLabel(hostname);
  const tokens = label.split("-").filter(Boolean);
  if (
    tokens.some(
      (token) =>
        AGENCY_DOMAIN_TERMS.includes(
          token as (typeof AGENCY_DOMAIN_TERMS)[number],
        ) || token === "rpo",
    )
  )
    return true;
  const compact = tokens.join("");
  const distinctive = [
    ...AGENCY_DOMAIN_TERMS,
    ...AGENCY_DOMAIN_COMPOUNDS,
  ];
  if (
    distinctive.some(
      (term) =>
        compact === term ||
        (compact.length >= term.length + 3 &&
          (compact.startsWith(term) || compact.endsWith(term))),
    )
  )
    return true;
  return compact === "rpo" || (compact.length >= 6 && compact.endsWith("rpo"));
}

export interface ApolloEvidenceMapping {
  evidence: RecipientBucketEvidence[];
  sourceFields: {
    rawTitle: "apollo.person.title" | null;
    employment:
      | readonly [
          "apollo.person.title",
          | "apollo.person.organization.name"
          | "apollo.person.organization_name",
        ]
      | null;
    providerPersonId: "apollo.person.id" | null;
    providerEmployerId: "apollo.person.organization.id" | null;
    employerDomain: "apollo.person.organization.primary_domain" | null;
    industries: Array<
      | "apollo.person.organization.industry"
      | "apollo.person.organization.industries"
    >;
    function: "apollo.person.title" | null;
    seniority: "apollo.person.seniority" | null;
    responsibility: "apollo.person.seniority" | null;
  };
  recruiterEmployerStatus: "internal" | "agency" | "ambiguous" | "not-recruiter";
}

/**
 * Maps only fields already present in NetworkPilot's observed Apollo person
 * fixtures. In particular, Apollo title/seniority signals never manufacture
 * management, functional, divisional, or company-leadership responsibility.
 */
export function mapApolloProviderEvidence(
  value: unknown,
  input: { observedAt: string },
): ApolloEvidenceMapping {
  const person = optionalRecord(value) ?? {};
  const organization = optionalRecord(person.organization) ?? {};
  const providerPersonId = optionalString(person.id);
  const firstName = optionalString(person.first_name);
  const lastName = optionalString(person.last_name);
  const title = optionalString(person.title) ?? "";
  const seniority = optionalString(person.seniority)?.toLowerCase();
  const organizationName = optionalString(organization.name);
  const fallbackOrganizationName = optionalString(person.organization_name);
  const employerName = organizationName ?? fallbackOrganizationName;
  const employerNameSource = organizationName
    ? "apollo.person.organization.name"
    : fallbackOrganizationName
      ? "apollo.person.organization_name"
      : null;
  const employerId = optionalString(organization.id);
  const validEmployerDomain = normalizeApolloEmployerDomain(
    organization.primary_domain,
  );
  const primaryIndustry = optionalString(organization.industry);
  const industryEntries = [
    ...(primaryIndustry
      ? [
          {
            value: primaryIndustry,
            sourceReference: "apollo.person.organization.industry" as const,
          },
        ]
      : []),
    ...stringArray(organization.industries).map((value) => ({
      value,
      sourceReference: "apollo.person.organization.industries" as const,
    })),
  ];
  const industries = industryEntries.map((entry) => entry.value);
  const evidence: RecipientBucketEvidence[] = [];
  const add = (
    kind: BucketEvidenceKind,
    evidenceValue: string,
    sourceReference: string,
    verified = true,
    sourceReferences?: string[],
  ) =>
    evidence.push({
      id: `apollo:${providerPersonId ?? "unknown"}:${kind}:${evidence.length + 1}`,
      kind,
      value: evidenceValue,
      sourceReference,
      ...(sourceReferences ? { sourceReferences } : {}),
      observedAt: input.observedAt,
      verified,
    });

  if (providerPersonId && firstName && lastName)
    add("professional-identity", providerPersonId, "apollo.person.id", true, [
      "apollo.person.id",
      "apollo.person.first_name",
      "apollo.person.last_name",
    ]);
  if (title && employerName && employerNameSource)
    add(
      "current-employment",
      `${title} at ${employerName}`,
      "apollo.person.title",
      true,
      ["apollo.person.title", employerNameSource],
    );
  if (employerName && (employerId || validEmployerDomain))
    add(
      "company-identity",
      employerId ?? validEmployerDomain!,
      employerId
        ? "apollo.person.organization.id"
        : "apollo.person.organization.primary_domain",
    );

  const recruiting = RECRUITING_FUNCTION.test(title);
  const functionClassification = classifyRecipientFunction(
    title,
    industries[0],
  );
  if (recruiting) {
    add("relevant-function", "recruiting", "apollo.person.title");
    add("recruiting-function", title, "apollo.person.title");
  } else if (
    functionClassification.reviewState === "accepted" &&
    functionClassification.primaryFunction !== "unrelated"
  ) {
    add(
      "relevant-function",
      functionClassification.primaryFunction,
      "apollo.person.title",
    );
  }

  let recruiterEmployerStatus: ApolloEvidenceMapping["recruiterEmployerStatus"] =
    "not-recruiter";
  if (recruiting) {
    const agencyEmployer = AGENCY_SIGNALS.test(employerName ?? "");
    const agencyIndustries = industryEntries.filter((entry) =>
      AGENCY_SIGNALS.test(entry.value),
    );
    const operatingIndustries = industryEntries.filter((entry) =>
      OPERATING_COMPANY_INDUSTRY.test(entry.value),
    );
    const agencyDomain = agencyDomainContradiction(validEmployerDomain);
    const agency =
      agencyEmployer || agencyIndustries.length > 0 || agencyDomain;
    const employerIdentitySource = employerId
      ? "apollo.person.organization.id"
      : validEmployerDomain
        ? "apollo.person.organization.primary_domain"
        : null;
    const ambiguous =
      !employerName ||
      !employerIdentitySource ||
      AMBIGUOUS_RECRUITER_TITLE.test(title) ||
      operatingIndustries.length === 0;
    recruiterEmployerStatus = agency
      ? "agency"
      : ambiguous
        ? "ambiguous"
        : "internal";
    const agencyReferences = [
      ...agencyIndustries.map((entry) => entry.sourceReference),
      ...(agencyEmployer && employerNameSource ? [employerNameSource] : []),
      ...(agencyDomain
        ? ["apollo.person.organization.primary_domain" as const]
        : []),
    ];
    const internalReferences = [
      ...operatingIndustries.map((entry) => entry.sourceReference),
      ...(employerIdentitySource ? [employerIdentitySource] : []),
    ];
    const statusReferences =
      recruiterEmployerStatus === "agency"
        ? agencyReferences
        : recruiterEmployerStatus === "internal"
          ? internalReferences
          : [
              ...(employerIdentitySource ? [employerIdentitySource] : []),
              ...industryEntries.map((entry) => entry.sourceReference),
            ];
    add(
      "internal-recruiting",
      recruiterEmployerStatus,
      statusReferences[0] ?? "apollo.person.title",
      recruiterEmployerStatus === "internal",
      [
        ...new Set(
          statusReferences.length ? statusReferences : ["apollo.person.title"],
        ),
      ],
    );
    const domain = /\b(technical|engineering|data|ai|machine learning)\b/i.test(
      title,
    )
      ? "technical-data-ai"
      : /\b(campus|university|early career|graduate)\b/i.test(title)
        ? "early-career"
        : "general";
    add("recruiting-domain", domain, "apollo.person.title");
  }

  // Apollo's provider-native seniority is independent from the raw title and
  // can support an IC signal only for non-leadership titles. It does not prove
  // that somebody is early-career, manages people, or owns broader scope.
  let responsibility: ApolloEvidenceMapping["sourceFields"]["responsibility"] =
    null;
  if (
    (seniority === "entry" || seniority === "senior") &&
    !LEADERSHIP_TITLE.test(title)
  ) {
    add(
      "individual-contributor",
      `provider-seniority:${seniority}`,
      "apollo.person.seniority",
    );
    responsibility = "apollo.person.seniority";
  }

  return {
    evidence,
    sourceFields: {
      rawTitle: title ? "apollo.person.title" : null,
      employment:
        title && employerNameSource
          ? ["apollo.person.title", employerNameSource]
          : null,
      providerPersonId: providerPersonId ? "apollo.person.id" : null,
      providerEmployerId: employerId
        ? "apollo.person.organization.id"
        : null,
      employerDomain: validEmployerDomain
        ? "apollo.person.organization.primary_domain"
        : null,
      industries: [
        ...new Set(industryEntries.map((entry) => entry.sourceReference)),
      ],
      function: title ? "apollo.person.title" : null,
      seniority: seniority ? "apollo.person.seniority" : null,
      responsibility,
    },
    recruiterEmployerStatus,
  };
}

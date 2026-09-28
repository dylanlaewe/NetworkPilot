import { classifyRecipientFunction } from "@/domain/candidates";
import type {
  BucketEvidenceKind,
  RecipientBucketEvidence,
} from "@/domain/recipient-buckets";

type JsonRecord = Record<string, unknown>;

const AGENCY_SIGNALS =
  /\b(staffing|recruitment agency|recruiting agency|executive search|search firm|headhunt|placement|talent solutions|rpo)\b/i;
const RECRUITING_FUNCTION =
  /\b(recruiter|recruiting|talent acquisition|talent partner|talent scout)\b/i;
const AMBIGUOUS_RECRUITER_TITLE =
  /\b(consultant|agency|staffing|executive search|headhunter)\b/i;
const LEADERSHIP_TITLE =
  /\b(manager|management|director|head|lead|chief|president|vp|vice president|supervisor)\b/i;

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

export interface ApolloEvidenceMapping {
  evidence: RecipientBucketEvidence[];
  sourceFields: {
    rawTitle: "apollo.person.title";
    employment: "apollo.person.organization";
    providerPersonId: "apollo.person.id";
    providerEmployerId: "apollo.person.organization.id";
    employerDomain: "apollo.person.organization.primary_domain";
    function: "apollo.person.title";
    seniority: "apollo.person.seniority";
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
  const employerName =
    optionalString(organization.name) ?? optionalString(person.organization_name);
  const employerId = optionalString(organization.id);
  const employerDomain = optionalString(organization.primary_domain);
  const validEmployerDomain =
    employerDomain && employerDomain.includes(".") ? employerDomain : undefined;
  const industries = [
    optionalString(organization.industry),
    ...stringArray(organization.industries),
  ].filter((item): item is string => Boolean(item));
  const evidence: RecipientBucketEvidence[] = [];
  const add = (
    kind: BucketEvidenceKind,
    evidenceValue: string,
    sourceReference: string,
    verified = true,
  ) =>
    evidence.push({
      id: `apollo:${providerPersonId ?? "unknown"}:${kind}:${evidence.length + 1}`,
      kind,
      value: evidenceValue,
      sourceReference,
      observedAt: input.observedAt,
      verified,
    });

  if (providerPersonId && firstName && lastName)
    add("professional-identity", providerPersonId, "apollo.person.id");
  if (title && employerName)
    add(
      "current-employment",
      `${title} at ${employerName}`,
      "apollo.person.organization",
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
    const agencyIndustry = AGENCY_SIGNALS.test(industries.join(" "));
    const agency = agencyEmployer || agencyIndustry;
    const ambiguous =
      !employerName ||
      (!employerId && !validEmployerDomain) ||
      AMBIGUOUS_RECRUITER_TITLE.test(title);
    recruiterEmployerStatus = agency
      ? "agency"
      : ambiguous
        ? "ambiguous"
        : "internal";
    add(
      "internal-recruiting",
      recruiterEmployerStatus,
      agency
        ? agencyIndustry
          ? "apollo.person.organization.industry"
          : "apollo.person.organization.name"
        : employerId
          ? "apollo.person.organization.id"
          : "apollo.person.organization.primary_domain",
      recruiterEmployerStatus === "internal",
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
      rawTitle: "apollo.person.title",
      employment: "apollo.person.organization",
      providerPersonId: "apollo.person.id",
      providerEmployerId: "apollo.person.organization.id",
      employerDomain: "apollo.person.organization.primary_domain",
      function: "apollo.person.title",
      seniority: "apollo.person.seniority",
      responsibility,
    },
    recruiterEmployerStatus,
  };
}

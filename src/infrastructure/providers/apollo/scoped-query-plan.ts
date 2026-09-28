import type { BucketScope, RecipientBucket } from "@/domain/recipient-buckets";
import type { ApolloSearchOptions } from "./types";

const UNITED_STATES_LOCATIONS = [
  "Boston, Massachusetts",
  "New York, New York",
  "New Jersey",
  "Remote, United States",
  "United States",
] as const;

const TITLES = {
  recruiters: {
    technical: [
      "Technical Recruiter",
      "Engineering Recruiter",
      "Data Recruiter",
      "AI Recruiter",
      "Talent Acquisition Partner",
    ],
    earlyCareer: [
      "University Recruiter",
      "Campus Recruiter",
      "Early Career Recruiter",
      "Recruiter",
    ],
  },
  peers: {
    practitioners: [
      "Data Analyst",
      "Business Intelligence Analyst",
      "Analytics Engineer",
      "Data Engineer",
      "Data Scientist",
      "Software Engineer",
      "Machine Learning Engineer",
      "Product Analyst",
      "Product Manager",
      "Technical Program Manager",
    ],
    earlyCareer: [
      "Junior Data Analyst",
      "Associate Data Analyst",
      "Junior Data Engineer",
      "Associate Product Manager",
      "Junior Software Engineer",
    ],
  },
  managers: {
    management: [
      "Data Analytics Manager",
      "Data Engineering Manager",
      "Software Engineering Manager",
      "Product Manager",
      "Technical Program Manager",
      "Business Intelligence Manager",
    ],
    teamLead: [
      "Data Team Lead",
      "Analytics Team Lead",
      "Engineering Team Lead",
      "Machine Learning Team Lead",
    ],
  },
  executives: {
    functional: [
      "Director of Data",
      "Director of Analytics",
      "Director of Engineering",
      "Director of Product",
      "Head of Data",
      "Head of Analytics",
      "Head of Engineering",
      "Head of Product",
    ],
    senior: [
      "VP of Data",
      "VP of Analytics",
      "VP of Engineering",
      "VP of Product",
      "Chief Data Officer",
      "Chief Technology Officer",
    ],
  },
  ceos: {
    companyLeadership: [
      "Chief Executive Officer",
      "CEO",
      "President",
      "President and CEO",
    ],
  },
} as const;

export interface ScopedApolloQuery {
  bucket: RecipientBucket;
  purpose: string;
  request: ApolloSearchOptions;
}

function resultLimit(maximum: number): number {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 20)
    throw new Error("scoped-apollo-maximum-invalid");
  return Math.min(25, Math.max(10, maximum * 4));
}

function request(
  batchId: string,
  titles: readonly string[],
  perPage: number,
): ApolloSearchOptions {
  return {
    batchId,
    specificTitles: [...titles],
    seniorities: [],
    includeSimilarTitles: false,
    personLocations: [...UNITED_STATES_LOCATIONS],
    emailStatuses: ["verified"],
    page: 1,
    perPage,
  };
}

function allQueries(scope: BucketScope, perPage: number): ScopedApolloQuery[] {
  switch (scope.bucket) {
    case "recruiters":
      return [
        {
          bucket: scope.bucket,
          purpose: "technical-and-functional-recruiting",
          request: request(
            "scoped-recruiters-technical",
            TITLES.recruiters.technical,
            perPage,
          ),
        },
        {
          bucket: scope.bucket,
          purpose: "early-career-and-general-recruiting",
          request: request(
            "scoped-recruiters-general",
            TITLES.recruiters.earlyCareer,
            perPage,
          ),
        },
      ];
    case "peers":
      if (scope.earlyCareerOnly)
        return [
          {
            bucket: scope.bucket,
            purpose: "early-career-practitioners",
            request: request(
              "scoped-peers-early-career",
              TITLES.peers.earlyCareer,
              perPage,
            ),
          },
        ];
      return [
        {
          bucket: scope.bucket,
          purpose: "experienced-and-broad-practitioners",
          request: request(
            "scoped-peers-practitioners",
            TITLES.peers.practitioners,
            perPage,
          ),
        },
        {
          bucket: scope.bucket,
          purpose: "early-career-practitioners",
          request: request(
            "scoped-peers-early-career",
            TITLES.peers.earlyCareer,
            perPage,
          ),
        },
      ];
    case "managers":
      return [
        {
          bucket: scope.bucket,
          purpose: "functional-management",
          request: request(
            "scoped-managers-functional",
            TITLES.managers.management,
            perPage,
          ),
        },
        {
          bucket: scope.bucket,
          purpose: "team-leadership",
          request: request(
            "scoped-managers-team-lead",
            TITLES.managers.teamLead,
            perPage,
          ),
        },
      ];
    case "executives":
      return [
        {
          bucket: scope.bucket,
          purpose: "functional-leadership",
          request: request(
            "scoped-executives-functional",
            TITLES.executives.functional,
            perPage,
          ),
        },
        {
          bucket: scope.bucket,
          purpose: "senior-functional-leadership",
          request: request(
            "scoped-executives-senior",
            TITLES.executives.senior,
            perPage,
          ),
        },
      ];
    case "ceos":
      return [
        {
          bucket: scope.bucket,
          purpose: "company-leadership",
          request: request(
            "scoped-ceos-company-leadership",
            TITLES.ceos.companyLeadership,
            perPage,
          ),
        },
      ];
    default:
      throw new Error("scoped-apollo-bucket-unsupported");
  }
}

/** A bucket never falls through to another bucket's search strategy. */
export function planScopedApolloQueries(input: {
  scope: BucketScope;
  maximum: number;
  maximumSearchCalls: number;
}): ScopedApolloQuery[] {
  if (!Number.isInteger(input.maximumSearchCalls) || input.maximumSearchCalls < 1)
    throw new Error("scoped-apollo-search-cap-invalid");
  return allQueries(input.scope, resultLimit(input.maximum)).slice(
    0,
    input.maximumSearchCalls,
  );
}

export { TITLES as SCOPED_APOLLO_TITLES };

# Scoped Apollo provider

`ScopedDiscoveryProvider` is the production boundary for bucket-scoped candidate discovery. Its `preflight()` method performs configuration-only checks. Its `discover()` input carries the exact `BucketScope`, the already-authorized enrichment maximum, the canonical operation ID, and the search-call cap. Its output contains provider-neutral candidate records plus searched, rejected, enrichment-attempt, search-call, and optional provider-observed credit counts.

The application order is intentionally fixed:

1. Validate the five-bucket flag, request identity, scope, count, and explicit confirmation.
2. Run role-aware local datastore, downstream reserve, and shared Apollo budget preflight.
3. Run the provider's configuration-only preflight.
4. Atomically claim one canonical `provider_operations` authorization.
5. Search and enrich through `ScopedApolloProvider`.
6. Normalize, classify, and import into the canonical operational database.
7. Complete or fail the claimed operation with truthful logical-attempt and observed-consumption evidence.

The scoped adapter does not use `ApolloDailyReplenisher`. That legacy service consumes persisted unscoped search caches and owns separate enrichment operations. Reusing it here would lose the request bucket and double-authorize provider exposure. The scoped adapter instead composes the existing Apollo endpoint adapter and transport behind a non-persisting per-call guard; the outer scoped operation remains the only persisted authorization and is shared across every bucket.

## Query strategy

Every query is exact-title, US-scoped, `include_similar_titles: false`, and limited to 10–25 results according to the authorized enrichment maximum. Search may request provider-verified-email availability, but a search record always remains unknown-email evidence until People Match returns an accepted business email/status. No company-domain or preferred-registry filter is applied.

| Bucket | Search signals | Deliberate limitation |
| --- | --- | --- |
| Recruiters | Technical, engineering, data/AI, talent-acquisition, campus, university, early-career, and general recruiter titles | Known agency/executive-search records are rejected before spend; search-ambiguous employers may be enriched but cannot qualify unless enrichment establishes internal identity |
| Peers & practitioners | Data, analytics, software, ML, product, and technical-program IC titles; a separate explicit junior/associate query | No age, graduation year, first-job status, or early-career review is inferred |
| Managers & team leaders | Relevant manager and team-lead titles | Search eligibility and title do not create team-responsibility evidence |
| Executives | Director, head, VP, and functional chief titles in relevant lanes | Seniority/title do not create functional or divisional scope evidence |
| CEOs & presidents | CEO, chief executive officer, president, and president/CEO titles | Title does not prove company-level rather than regional/divisional scope |

An unknown bucket throws; it never falls back to another strategy. Search calls are sliced to the application-provided cap. Enrichment is sequential, exact-provider-ID, capped by the single claimed maximum, and does not retry an uncertain scoped request because a retry could exceed the one-credit logical hold. Personal email, phone, phone waterfall, email waterfall, browser scraping, and LinkedIn scraping remain absent or explicitly disabled.

## Evidence and provenance contract

The mapper uses only fields already represented by the repository's Apollo fixtures and response handling:

| Neutral evidence | Apollo source |
| --- | --- |
| Provider person identity | `person.id`, `first_name`, `last_name` |
| Raw title and relevant-function signal | `person.title` |
| Current employment | `person.title` plus `person.organization` |
| Employer identity | `person.organization.id` or `person.organization.primary_domain`, with name retained separately |
| Industry/agency signal | `person.organization.industry` or `industries` |
| Provider seniority | `person.seniority` |
| Experience | `person.employment_history` |
| Professional email | enrichment-only `person.email` plus `person.email_status` |
| Provider freshness | `updated_at` or `last_refreshed_at` |

Each `RecipientBucketEvidence` item retains an `apollo.person.*` source reference, observation time, value, and verification state. Raw title, employer name/domain/native ID, provider-native person ID, employment history, seniority, response shape, and exact-ID match lineage also remain in their existing neutral candidate fields.

Recruiting-function and recruiting-domain evidence may come from the raw recruiter title. Internal-recruiter evidence additionally requires a provider-native employer ID or domain and no staffing, agency, placement, RPO, headhunting, executive-search, or ambiguous-consultant signal. A contrary agency signal is retained as unverified `internal-recruiting` evidence with its original employer field reference; it is not discarded.

Provider-native `entry` or `senior` seniority can support `individual-contributor` only when the title contains no leadership signal. It does not establish age or early-career status. Apollo's observed fixture fields do not provide concrete reports, people-management, hiring-ownership, executive-committee, functional-scope, divisional-scope, regional/company distinction, or company-wide responsibility data. Consequently:

- manager titles produce no `team-leadership` evidence;
- director, head, VP, and chief titles produce no `functional-leadership` or `division-leadership` evidence;
- CEO and president titles produce no `company-leadership` evidence;
- regional/divisional president ambiguity is preserved;
- title-only leadership proceeds to conservative review-needed classification rather than being promoted.

This is a structural limitation, not a yield bug. The classifier gates are unchanged.

## Runtime and validation boundary

Normal scoped Candidate refresh now constructs the concrete server provider only when Apollo is enabled, an API key is present, hard-stop accounting is enabled, and positive configured batch/day caps exist. Readiness recognizes that configuration without constructing a request. Missing or invalid configuration reports `provider-not-configured`. The five-bucket feature flag remains off by default, and Add Drafts/Replace do not reference this provider.

Offline tests use injected transports, isolated canonical schema `0021`, and a read-only recruiter evidence database at legitimate schema `0011`. They cover deterministic request payloads, disabled phone/personal/waterfall behavior, internal and agency recruiters, experienced ICs, title-only leadership review, exact IDs, duplicates, malformed records, search/enrichment/partial failures, idempotency, shared allowance exhaustion, datastore failure, and truthful accounting. They do not establish live Apollo supply, classification yield, leadership evidence quality, recruiter relevance, or downstream message quality. Those remain questions for one separately authorized bounded live validation.

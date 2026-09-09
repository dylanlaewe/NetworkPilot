# Apollo read-only adapter foundation

## Controlled real candidate batch (Milestone 6.3)

`npm run apollo:controlled-batch` is a one-shot, server-only operator command. It searches eight Headquarters-approved company domains, selects a diversified shortlist, performs at most 20 exact-native-ID enrichments, runs production targeting/planning, and prints draft-only previews without professional email addresses. Local databases are ignored by Git, and a persisted started marker prevents accidental reruns.

The command permits only People Search, People Match, and Credit Usage. Its transport hard-caps those endpoints at 16, 20, and 2 HTTP calls respectively. It uses the versioned `disabled-phone-v1` cost policy (one authorized lead credit per logical enrichment) while keeping personal email, phone, and both waterfall options false. Credit telemetry is provider-observed metadata and remains distinct from NetworkPilot preauthorization accounting. A scoped-key 403 is reported without requesting or switching to a Master key.

Pre-enrichment selection first excludes irrelevant or prohibited records, then ranks substantive relevance, applies a three-per-company cap and five-per-primary-function soft cap, and only afterward uses deterministic identity ordering. The function cap relaxes with recorded reasons only when the remaining relevant pool cannot fill the bounded shortlist. Company, industry, and function representation shortfalls are reported rather than treated as request failures.

People Search maps each returned person independently before the atomic import boundary. A malformed person produces only a safe index/reason diagnostic; valid siblings remain importable, and malformed raw provider data is never persisted. Request failures, individual record rejections, import failures, and enrichment failures remain distinct operational metrics.

Planning reports desired volume, qualified people, unique qualified companies, one-person-per-company capacity, qualification shortfall, and company-capacity shortfall separately. Routine weekday volume of 15–20 therefore requires at least 15–20 qualified distinct companies in that day's candidate universe; future sourcing must cover a broader reviewed registry rather than weakening the uniqueness policy.

Draft routing uses the most specific immutable evidence available: reviewed industry and concrete title/function signals precede role-family fallbacks, while the career-path leadership lane is used only when no stronger specific lane exists. Manager or director persona does not itself force leadership messaging. Every local preview records the lane reason and adds a restrained title-and-company connection; leadership facts remain confined to the leadership templates.

Apollo is the first provider selected by Headquarters after its API capabilities, cost model, limits, and terms were reviewed. Controlled diagnostics have validated the approved endpoint paths, scoped API-key authentication, relevant search filters, provider payload mapping, and lead-credit telemetry. Apollo remains disabled by default and is available only through explicit, bounded server-side operator commands.

## Documented API contract

The versioned adapter uses `POST /api/v1/mixed_people/api_search` for People Search and `POST /api/v1/people/match` for deliberate single-person enrichment on the fixed `https://api.apollo.io` origin. Normal single-user access authenticates with the server-only `x-api-key` header; OAuth and a Master API key are not required when endpoint-scoped API-key permissions suffice. Apollo-specific objects never cross the infrastructure adapter.

People Search is documented as costing zero credits and returning neither email addresses nor phone numbers; enrichment is treated conservatively as credit-consuming. Search filters use `person_titles`, `include_similar_titles`, `person_locations`, `person_seniorities`, `organization_locations`, `q_organization_domains_list`, `contact_email_status`, `organization_ids`, `page`, and `per_page` in the JSON request body (the documentation displays repeatable parameters with `[]`). The adapter accepts approved company domains or organization IDs, exact requested titles, person/employer geography, email status, and only the typed manager/director/senior defaults. `include_similar_titles` defaults false and requires an explicit controlled-milestone authorization when enabled. A `contact_email_status=verified` search filter narrows discovery only: search records remain `unknown` and cannot satisfy NetworkPilot's verified-email gate before controlled enrichment returns acceptable evidence.

Enrichment requests hard-code `reveal_personal_emails`, `reveal_phone_number`, `run_waterfall_email`, and `run_waterfall_phone` to false. Phone, personal-email, waterfall, and organization-enrichment workflows do not exist. NetworkPilot’s curated company registry—not Apollo—is authoritative for company strategy.

## Security, budget, and retry boundaries

`NETWORKPILOT_APOLLO_ENABLED` defaults disabled. `APOLLO_API_KEY` is read only by server code, sent only through the fixed `x-api-key` transport header, never logged or persisted, and redacted from errors. The HTTP transport rejects non-HTTPS/non-Apollo destinations and redirects, applies a timeout, bounds response bytes, and maps malformed payloads and HTTP errors into controlled categories.

Before enrichment, SQLite atomically reserves the conservative maximum exposure under both per-batch and local-day caps. Missing budget state, a disabled hard stop, or an exceeded cap fails before transport. Attempt count, estimated exposure, optional provider-observed consumption, completion, and failure category are stored separately; unknown consumption remains null. HTTP 429 honors numeric `Retry-After`; 429, 5xx, and transport failures use bounded injected retries. Retries never create another credit authorization.

Apollo's `POST /api/v1/usage_stats/credit_usage_stats` is available through a typed, read-only method for cycle limits, consumed credits, and remaining credits. Local preauthorization remains a separate safety ceiling and must never be presented as provider-observed consumption.

## Provider-to-neutral mapping

Apollo person ID becomes the provider-native ID. Names, current title, source-reported organization/domain, location, industry signals, business email/status, update timestamp, and employment-history evidence retain field-level `apollo.*` provenance. The raw-safe fingerprint hashes the versioned mapped provider response; the API key and request headers are excluded. Missing fields remain unknown or fail required-field validation.

Only an explicitly returned enrichment status of `verified` maps to NetworkPilot `verified`. Search results, unavailable addresses, unknown states, and merely present addresses do not. Employment periods are sent to domain-owned `experience-v1`; overlapping periods are merged, missing or contradictory dates fail closed, and provider seniority never becomes years of experience. Apollo employer identity remains source evidence and must independently match a reviewed NetworkPilot strategy company. Apollo never supplies desirability, eligibility, persona, score, suppression, campaign, draft, cooldown, or delivery decisions.

## Future controlled enablement

After Headquarters approves live validation, an operator would set the server-only feature flag and credential plus conservative enrichment limits shown in `.env.example`, restart the server, and run a separately approved tiny workflow. The current UI exposes status only and cannot initiate provider activity. No real Apollo request was made while building the original Milestone 6 foundation.

The local-only `npm run apollo:validate-search` command exists solely for Headquarters-authorized controlled validation. Milestone 6.1A history remains in its dedicated database. The separately bounded Milestone 6.1B diagnostic uses up to four predetermined, sequential Microsoft-only searches and stops when a stage is empty. The command records attempts before transport, permits only the People Search endpoint, limits each page to ten, disables retries, never paginates, and has no enrichment capability or browser UI. Its `data/apollo-live-validation.sqlite` database and `.env.local` credential remain Git-ignored and must never be committed.

The separately authorized `npm run apollo:validate-enrichment` operator is local-only and one-shot. Its correction session resolves only the same two approved persisted search records, permits at most four HTTP attempts, uses only People Match with exact Apollo-native-ID lineage, and preauthorizes at most nine credits per person. Personal-email, phone, and waterfall switches are hard-coded off. Real enriched records remain in the ignored `data/apollo-live-enrichment.sqlite` database and never enter fixtures or source control.

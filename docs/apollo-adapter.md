# Apollo read-only adapter foundation

Apollo is the first provider candidate selected by Headquarters after its API capabilities, cost model, limits, and terms were reviewed. This repository implements a production-shaped boundary only. Headquarters independently verified the documented endpoints, API-key authentication, relevant search filters, zero-credit People Search behavior, and basic rate-limit behavior. Live account permissions, actual payload and response compatibility, and observed credit reporting have **not** been validated against an Apollo account.

## Documented API contract

The versioned adapter uses `POST /api/v1/mixed_people/api_search` for People Search and `POST /api/v1/people/match` for deliberate single-person enrichment on the fixed `https://api.apollo.io` origin. Normal single-user access authenticates with the server-only `x-api-key` header; OAuth and a Master API key are not required when endpoint-scoped API-key permissions suffice. Apollo-specific objects never cross the infrastructure adapter.

People Search is documented as costing zero credits and returning neither email addresses nor phone numbers; enrichment is treated conservatively as credit-consuming. Search filters use `person_titles`, `include_similar_titles`, `person_locations`, `person_seniorities`, `organization_locations`, `q_organization_domains_list`, `contact_email_status`, `organization_ids`, `page`, and `per_page` in the JSON request body (the documentation displays repeatable parameters with `[]`). The adapter accepts approved company domains or organization IDs, exact requested titles, person/employer geography, email status, and only the typed manager/director/senior defaults. `include_similar_titles` is always false. A `contact_email_status=verified` search filter narrows discovery only: search records remain `unknown` and cannot satisfy NetworkPilot's verified-email gate before controlled enrichment returns acceptable evidence.

Enrichment requests hard-code `reveal_personal_emails`, `reveal_phone_number`, `run_waterfall_email`, and `run_waterfall_phone` to false. Phone, personal-email, waterfall, and organization-enrichment workflows do not exist. NetworkPilot’s curated company registry—not Apollo—is authoritative for company strategy.

## Security, budget, and retry boundaries

`NETWORKPILOT_APOLLO_ENABLED` defaults disabled. `APOLLO_API_KEY` is read only by server code, sent only through the fixed `x-api-key` transport header, never logged or persisted, and redacted from errors. The HTTP transport rejects non-HTTPS/non-Apollo destinations and redirects, applies a timeout, bounds response bytes, and maps malformed payloads and HTTP errors into controlled categories.

Before enrichment, SQLite atomically reserves the conservative maximum exposure under both per-batch and local-day caps. Missing budget state, a disabled hard stop, or an exceeded cap fails before transport. Attempt count, estimated exposure, optional provider-observed consumption, completion, and failure category are stored separately; unknown consumption remains null. HTTP 429 honors numeric `Retry-After`; 429, 5xx, and transport failures use bounded injected retries. Retries never create another credit authorization.

## Provider-to-neutral mapping

Apollo person ID becomes the provider-native ID. Names, current title, source-reported organization/domain, location, industry signals, business email/status, update timestamp, and employment-history evidence retain field-level `apollo.*` provenance. The raw-safe fingerprint hashes the versioned mapped provider response; the API key and request headers are excluded. Missing fields remain unknown or fail required-field validation.

Only an explicitly returned enrichment status of `verified` maps to NetworkPilot `verified`. Search results, unavailable addresses, unknown states, and merely present addresses do not. Employment periods are sent to domain-owned `experience-v1`; overlapping periods are merged, missing or contradictory dates fail closed, and provider seniority never becomes years of experience. Apollo employer identity remains source evidence and must independently match a reviewed NetworkPilot strategy company. Apollo never supplies desirability, eligibility, persona, score, suppression, campaign, draft, cooldown, or delivery decisions.

## Future controlled enablement

After Headquarters approves live validation, an operator would set the server-only feature flag and credential plus conservative enrichment limits shown in `.env.example`, restart the server, and run a separately approved tiny workflow. The current UI exposes status only and cannot initiate provider activity. No real Apollo request was made for this milestone.

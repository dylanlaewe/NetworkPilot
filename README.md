# NetworkPilot

NetworkPilot is a private, local, single-user dashboard for operating Dylan's human-reviewed professional-networking workflow. Authorized provider access is isolated and explicitly gated. NetworkPilot can create Gmail drafts after approval, but it cannot send email.

## Requirements and setup

Node.js 22 or newer is required. The persistence driver is `better-sqlite3`, which supports Node 22 and is automatically treated as an external server package by Next.js.

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000/today](http://localhost:3000/today). The default campaign timezone is `America/New_York`.

### Local production workflow

Keep provider configuration in the gitignored `.env.local` file and OAuth tokens in macOS Keychain; never place secrets in source files. After pulling an update:

```bash
npm install
npm run db:migrate
npm run build
npm run app:start
```

Open [http://localhost:3000/today](http://localhost:3000/today). Stop the local server with `Ctrl+C`. On ordinary days, Dylan only needs to start the app and use Today; daily pipeline refresh, draft approval, Gmail draft creation, manual-send confirmation, and outcome reporting are available in the UI.

The simulation-only [Candidate Review](http://localhost:3000/candidate-review) and [Draft Studio](http://localhost:3000/draft-studio) workspaces are local. Run `npm run db:migrate` and `npm run db:seed` after upgrading so import, review, strategy-registry, fictional-evidence, and draft schema are present.

## Local database

The default SQLite file is `data/networkpilot.sqlite`. Set `NETWORKPILOT_DATABASE_PATH` to another local file when needed. Database files, SQLite journals, environment files, and build output are ignored by Git.

The Gmail integration foundation is draft-only and disabled by default. It contains no send or inbox capability and has not been live-authorized. See [`docs/gmail-draft-only.md`](docs/gmail-draft-only.md) for its OAuth, Keychain, MIME, idempotency, and uncertain-outcome boundaries. Run `npm run check:no-email-send` with the normal validation suite.

The command center supports distinct Professional and Recruiter outreach tracks. Recruiter classification, qualification, bounded planning, and 60–110 word draft previews are local and deterministic.

`Refresh Today’s Pipeline` persists a deterministic campaign-day plan with a target of 10 Professional and 5 Recruiter contacts. It consumes safe Candidate Reserve supply first, applies prior-contact, suppression, opt-out, cooldown, verification, qualification, and one-company-across-tracks gates, and reports any shortfall rather than weakening them. If reserve is insufficient, an explicitly confirmed refresh may selectively enrich already persisted search candidates through Apollo, subject to a hard 20-enrichment daily-refresh cap and credit telemetry. A normal second request reuses the existing plan; `Refresh Again` is deliberately labeled as a potentially paid advanced rerun. Weekend refreshes prepare the next eligible weekday without recommending weekend sending.

- `npm run db:migrate` — apply pending versioned SQL migrations
- `npm run db:seed` — idempotently insert 180 original fabricated prospects, two eligible provider-shaped fixtures, review fixtures, and campaign settings
- `NODE_ENV=development npm run db:reset` — development-only reset and reseed of the exact configured database

The reset command refuses to run unless `NODE_ENV` is `development` or `test`, prints its resolved target, and requires that target to remain inside this project’s real `data` directory without symlink escapes. An existing database containing data must carry the exact `datasetType=fictional` marker. Migration source files are never removed.

## Simulation workflow

Two deterministic adapters demonstrate flat and nested provider-shaped inputs without connecting to a provider. Both emit the same neutral source contract with provider/native identity, source-reported organization, timestamps, field provenance, consent evidence, dataset classification, and conservative experience evidence. Import batches are atomic, fingerprint-idempotent, conflict-closed, and retain safe immutable snapshots. Exact `role-classification-v2` mappings never default to the first role in a family; experience gates use the supported lower bound.

The Candidate Review queue distinguishes exact target-job analogues from versioned recipient professional functions. New imports use `recipient-function-v2`, `function-role-relevance-v2`, and `recipient-relevance-v2`; historical v1 snapshots remain readable. New imports retain primary and secondary functions, phrase evidence, confidence/review state, target-role affinities, recipient persona, and progression reasons. Audited corrections remain limited to approved roles and cannot override suppression, opt-out, unverified email, insufficient/unknown experience, prohibited seniority, or an unreviewed company. No review action contacts anyone.

The dashboard action creates one atomic targeting-first campaign plan for the campaign-local calendar date. Before creating a new plan, the application layer requires the exact fictional-dataset marker and a non-empty prospect dataset; otherwise the action stays disabled and no randomness or database write occurs. SQLite emits provider-neutral fictional source records; the application validates fingerprints and provenance, deduplicates, normalizes titles and experience, derives and verifies classifications, matches the public strategy registry, derives data quality, applies hard gates, scores, diversifies, and snapshots every decision. Only then is the 15–20 weekday target consumed and persisted. Repeating the action returns the existing plan unchanged. Weekend attempts create a stored no-send result.

New plans rank by versioned `targeting-v2`, which consumes persisted `recipient-relevance-v2` function evidence while retaining independently supported precise-role evidence. Primary functions anchor target-role affinity; secondary functions contribute a bounded bonus and normally cannot displace the primary interpretation. Historical v1 function/relevance and `targeting-v1` snapshots remain readable; the deprecated generic `relevanceScore` is retained only for migration compatibility and never controls planning. The engine limits a plan to one person per company, applies a configurable seven-day company cooldown, and filters prior reservations/contact, suppressions, opt-outs, unverified addresses, insufficient experience, ambiguous classification, and unreviewed companies. Planning creates no outreach or delivery event.

## Scripts

- `npm run dev` — start local development
- `npm run build` / `npm run app:start` — build and serve the supported local production application
- `npm test` / `npm run test:watch` — run the isolated Vitest suite
- `npm run typecheck` — strict TypeScript validation
- `npm run lint` — ESLint with zero warnings allowed
- `npm run check:no-remote-fonts` — fail if application source references Google-hosted fonts
- `npm run check:no-email-send` — fail if application source introduces a known delivery path
- `npm run manual-send:list` — list confirmable pilot drafts with privacy-safe operation-derived IDs
- `npm run manual-send:confirm` — after sending independently in Gmail, record an explicit operator confirmation by listed ID
- `npm run manual-send:bounce` — atomically record a manual attempt and human-reported address-not-found hard bounce
- `npm run manual-outreach:outcome` — record an audited human-reported pilot outcome locally
- `npm run db:migrate`, `db:seed`, `db:reset` — local fictional persistence operations

## Safety boundary

There is no LinkedIn or CareerShift automation, scraping, browser automation, personal-email or phone discovery, AI API, inbox/Sent-folder access, SMTP, scheduling, or email delivery. Apollo access is server-only, explicit, bounded, and used solely for approved professional contact sourcing/enrichment. Gmail access is limited to the compose scope and immutable draft creation after human approval. The UI contains no Send action. Simulation fixtures remain plainly fictional and isolated from ignored operational databases.

Interface typography uses repository-independent operating-system sans-serif and monospace stacks. Builds and runtime never fetch remote fonts. Run `npm run check:no-remote-fonts` with the normal validation suite to protect this boundary.

See [docs/architecture.md](docs/architecture.md) and [docs/schema.md](docs/schema.md).

## Apollo adapter foundation

The server-only Apollo read-only adapter is disabled by default. It provides fixed-host People Search and deliberate enrichment boundaries, strict response mapping, secret redaction, persisted credit caps, and bounded retry handling. Tests use injected fictional responses. See [docs/apollo-adapter.md](docs/apollo-adapter.md).

## Targeting and deterministic drafts

Desired early-career job roles are modeled separately from senior networking-recipient personas. Targeting combines configurable company, current-role, function, experience, industry, geography, shared-signal, and derived data-quality components in the explainable `targeting-v2` score for new plans. Public target-company metadata is authoritative for matched tier, enabled state, industry, and company score inputs while fictional employer identity stays separate. Deterministic soft caps improve industry and role-family representation, relax only when needed to fill the qualified target, and persist every relaxation.

Drafts are generated only from selected persisted plan snapshots—without rescoring mutable profiles—and without AI from 24 versioned variants across eight outreach lanes. Dylan graduated in May 2026 with a B.S. in Computer Science; templates vary truthful recent-graduate phrasing instead of describing graduation as future. Every biographical sentence is composed from registered fragments whose complete, ordered fact IDs are persisted. Optional personalization uses only verified fictional evidence and retains its evidence ID; missing or unverified evidence produces a clean fallback. Approval changes simulation review state only and cannot deliver email.

Gmail draft creation and manual outreach are separate durable states. A confirmed Gmail draft remains unsent in NetworkPilot until the operator deliberately records `operator-confirmed-manual-send` after sending outside the app. The confirmation represents the real-world contact event even if Dylan copied the approved content into an equivalent Gmail message instead of using the exact created draft object. NetworkPilot does not inspect Gmail Sent. That local record starts prior-person prevention and the seven-day company cooldown at the operator-supplied effective-send time. Outcomes are human-reported only; opt-outs feed the suppression system. See [docs/gmail-draft-only.md](docs/gmail-draft-only.md).

Variant rotation uses a documented FNV-1a 32-bit hash of the template catalog version, simulation run ID, fictional prospect ID, and outreach lane. It uses no wall clock or randomness, so identical context regenerates the same version while recipients distribute across variants.

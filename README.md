# NetworkPilot

NetworkPilot is a private, local dashboard for simulating thoughtful professional-networking campaigns. It uses only deterministic, plainly fictional contacts and cannot source real people or send email.

## Requirements and setup

Node.js 22 or newer is required. The persistence driver is `better-sqlite3`, which supports Node 22 and is automatically treated as an external server package by Next.js.

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The default campaign timezone is `America/New_York`.

The simulation-only [Candidate Review](http://localhost:3000/candidate-review) and [Draft Studio](http://localhost:3000/draft-studio) workspaces are local. Run `npm run db:migrate` and `npm run db:seed` after upgrading so import, review, strategy-registry, fictional-evidence, and draft schema are present.

## Local database

The default SQLite file is `data/networkpilot.sqlite`. Set `NETWORKPILOT_DATABASE_PATH` to another local file when needed. Database files, SQLite journals, environment files, and build output are ignored by Git.

- `npm run db:migrate` — apply pending versioned SQL migrations
- `npm run db:seed` — idempotently insert 180 original fabricated prospects, two eligible provider-shaped fixtures, review fixtures, and campaign settings
- `NODE_ENV=development npm run db:reset` — development-only reset and reseed of the exact configured database

The reset command refuses to run unless `NODE_ENV` is `development` or `test`, prints its resolved target, and requires that target to remain inside this project’s real `data` directory without symlink escapes. An existing database containing data must carry the exact `datasetType=fictional` marker. Migration source files are never removed.

## Simulation workflow

Two deterministic adapters demonstrate flat and nested provider-shaped inputs without connecting to a provider. Both emit the same neutral source contract with provider/native identity, source-reported organization, timestamps, field provenance, consent evidence, dataset classification, and conservative experience evidence. Import batches are atomic, fingerprint-idempotent, conflict-closed, and retain safe immutable snapshots. Exact `role-classification-v2` mappings never default to the first role in a family; experience gates use the supported lower bound.

The Candidate Review queue distinguishes exact target-job analogues from versioned recipient professional functions. New imports retain primary and secondary functions, phrase evidence, confidence/review state, target-role affinities, recipient persona, and progression reasons. Audited corrections remain limited to approved roles and cannot override suppression, opt-out, unverified email, insufficient/unknown experience, prohibited seniority, or an unreviewed company. No review action contacts anyone.

The dashboard action creates one atomic targeting-first campaign plan for the campaign-local calendar date. Before creating a new plan, the application layer requires the exact fictional-dataset marker and a non-empty prospect dataset; otherwise the action stays disabled and no randomness or database write occurs. SQLite emits provider-neutral fictional source records; the application validates fingerprints and provenance, deduplicates, normalizes titles and experience, derives and verifies classifications, matches the public strategy registry, derives data quality, applies hard gates, scores, diversifies, and snapshots every decision. Only then is the 15–20 weekday target consumed and persisted. Repeating the action returns the existing plan unchanged. Weekend attempts create a stored no-send result.

The engine ranks by versioned `targeting-v1`; the deprecated generic `relevanceScore` is retained only for migration compatibility and never controls planning. It limits a plan to one person per company, applies a configurable seven-day company cooldown, and filters prior reservations/contact, suppressions, opt-outs, unverified addresses, insufficient experience, ambiguous classification, and unreviewed companies. Planning creates no outreach or delivery event.

## Scripts

- `npm run dev` — start local development
- `npm run build` / `npm start` — build and serve production output
- `npm test` / `npm run test:watch` — run the isolated Vitest suite
- `npm run typecheck` — strict TypeScript validation
- `npm run lint` — ESLint with zero warnings allowed
- `npm run check:no-remote-fonts` — fail if application source references Google-hosted fonts
- `npm run db:migrate`, `db:seed`, `db:reset` — local fictional persistence operations

## Safety boundary

There are no integrations with LinkedIn, CareerShift, Apollo, Gmail, Microsoft, AI APIs, inboxes, or any other provider. There is no scraping, browser automation, contact sourcing, external drafting, credential handling, or email delivery. The UI contains no Send action. All people and employers produced by the seed are explicitly fabricated. Registry references are labeled simulation aliases and never claim that a fictional person works at a real company.

Interface typography uses repository-independent operating-system sans-serif and monospace stacks. Builds and runtime never fetch remote fonts. Run `npm run check:no-remote-fonts` with the normal validation suite to protect this boundary.

See [docs/architecture.md](docs/architecture.md) and [docs/schema.md](docs/schema.md).

## Apollo adapter foundation

The server-only Apollo read-only adapter is disabled by default and has not been validated with a live account. It provides fixed-host People Search and deliberate enrichment boundaries, strict response mapping, secret redaction, persisted credit caps, and bounded retry handling. All tests use injected fictional responses; no real Apollo request is made. See [docs/apollo-adapter.md](docs/apollo-adapter.md).

## Targeting and deterministic drafts

Desired early-career job roles are modeled separately from senior networking-recipient personas. Targeting combines configurable company, current-role, function, experience, industry, geography, shared-signal, and derived data-quality components in the explainable `targeting-v1` score. Public target-company metadata is authoritative for matched tier, enabled state, industry, and company score inputs while fictional employer identity stays separate. Deterministic soft caps improve industry and role-family representation, relax only when needed to fill the qualified target, and persist every relaxation.

Drafts are generated only from selected persisted plan snapshots—without rescoring mutable profiles—and without AI from 24 versioned variants across eight outreach lanes. Dylan graduated in May 2026 with a B.S. in Computer Science; templates vary truthful recent-graduate phrasing instead of describing graduation as future. Every biographical sentence is composed from registered fragments whose complete, ordered fact IDs are persisted. Optional personalization uses only verified fictional evidence and retains its evidence ID; missing or unverified evidence produces a clean fallback. Approval changes simulation review state only and cannot deliver email.

Variant rotation uses a documented FNV-1a 32-bit hash of the template catalog version, simulation run ID, fictional prospect ID, and outreach lane. It uses no wall clock or randomness, so identical context regenerates the same version while recipients distribute across variants.

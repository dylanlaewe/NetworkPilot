# NetworkPilot architecture

## Boundaries

NetworkPilot follows three inward-facing layers:

- **Domain (`src/domain`)** owns provider-independent prospect, event, decision, timezone, qualification, cooldown, and selection policy. It imports neither Next.js nor SQLite.
- **Application (`src/application`)** coordinates the daily simulation and dashboard read model through a `SimulationRepository` interface. It owns idempotency checks and the transaction use case, without SQL.
- **Infrastructure (`src/infrastructure`)** implements that interface with local SQLite, maps database rows to domain values, runs migrations, and supplies the Next.js server runtime instance.

Replacing SQLite with PostgreSQL requires a new repository implementation, not a rewrite of campaign policy.

## Persistence model

Versioned SQL migrations create companies, fictional prospects, simulation runs, reason-coded decision snapshots, outreach events, suppression entries, and key/value campaign settings. Precise instants are stored as UTC ISO timestamps. Runs also store their campaign-local date and the IANA timezone used to derive it. See [schema.md](schema.md).

Qualification decisions copy the evaluated name, company, industry, email, experience, and relevance values. They are immutable audit snapshots rather than joins that change retroactively when a prospect is edited.

## Idempotency and transaction boundary

`simulation_runs.campaign_date` has a unique constraint. The use case checks for an existing completed date both before and inside an SQLite `IMMEDIATE` transaction. The run, all decisions, and all simulated-send events are committed together. Any thrown failure rolls the transaction back; a database uniqueness violation prevents concurrent duplicate dates.

Before any new run or random target is created, an application-layer readiness guard requires `datasetType` to equal exactly `fictional` and the prospect count to be non-zero. The repository exposes dataset status without leaking SQLite into the use case. Previously stored same-day runs remain readable even if readiness is later lost.

The randomly chosen daily target is stored on first creation and never rerolled for repeated requests. Weekend requests use the same idempotent path and persist an auditable `weekend-no-send` run with a zero target.

## Campaign time

An injected UTC instant is formatted with `Intl.DateTimeFormat` using the configured IANA campaign timezone (default `America/New_York`). The resulting local date and weekday drive scheduling. The application never changes the machine timezone. Invalid timezone identifiers fail validation. This approach handles UTC date differences and daylight-saving transitions through the platform timezone database.

## Event semantics

The model distinguishes `qualified`, `rejected`, `selected`, `drafted`, `simulated-sent`, future-reserved `actually-sent`, `replied`, `suppressed`, and `cancelled` events. Only `simulated-sent` and `actually-sent` are contact-impacting: they prevent repeat outreach and activate company cooldowns. Selection, drafting, cancellation, and abandoned reservations do not consume a prospect.

Stable decision codes are: `suppressed`, `opted-out`, `email-unverified`, `insufficient-experience`, `previously-contacted`, `company-in-cooldown`, `duplicate-company-in-run`, `eligible-below-cutoff`, and `selected`.

## Simulation-to-live isolation

The only implemented write action is named and displayed as a fictional simulation. It creates local `simulated-sent` rows; no transport adapter exists. `actually-sent` is a reserved domain vocabulary value and is unused by every application path. There are no provider SDKs, secrets, external data adapters, browser automation, inbox processors, or delivery controls.

A future live system would require separate authorization, source, research/drafting, scheduler, delivery, and reply adapters plus explicit mode gating and threat review. Those components are architectural placeholders only and are not connected in this milestone.

## Targeting and draft studio

Current desired roles are early-career opportunities Dylan could pursue; recipient personas are experienced people who may provide useful perspective. The two are distinct domain types, so targeting a director never implies applying for a director role. Long-term leadership, ownership, and delivery responsibility are recorded as direction rather than current-role eligibility.

The editable public-company strategy registry is isolated from the fictional `companies` and `prospects` tables. Tier 1 and Tier 2 companies receive preference, Tier 3 requires exceptional role upside, and excluded, unreviewed, disabled, or unknown companies fail a hard gate. Company recognition is only one score component; sector-specific technical and mission interest remain first-class.

`targeting-v1` produces eight named weighted components, stable explanations, a total, and hard-gate results. Role fit and recipient seniority are separately scored. Industry and geography are preferences rather than absolute filters. Weights must be finite, non-negative, and total 100; ranking ties resolve by stable candidate ID.

The sender fact registry contains only approved atomic statements about Dylan’s education, May 2026 graduation, internship, skills, integration work, interests, geography, and long-term direction. Dylan is a recent graduate, not currently completing his degree. Templates reference registered sentence fragments; each fragment declares its required fact IDs, and catalog construction derives the template’s unique ordered fact list. Rendering fails closed if metadata differs or a fact is unknown, disabled, or unapproved. Personalization sentences can use only verified fictional evidence and preserve evidence IDs; unverified or absent evidence falls back without inference.

Each of eight template lanes has direct/practical, career-curiosity, and technical/operational-common-ground variants with different structure, facts, reasoning, requests, rhythm, and subjects. Rotation applies a specified FNV-1a 32-bit hash to `catalogVersion|runId|prospectId|lane`, then takes the unsigned result modulo the sorted eligible variants. The catalog and template versions are persisted, so rotation is deterministic and version behavior is explicit.

Draft rows snapshot rendered content, template/catalog versions, fact IDs, evidence IDs, targeting score/version/components/explanations, and the complete fictional recipient/company targeting context. Their idempotency key combines prospect, run context, template, and template version. Historical display reads that JSON snapshot rather than mutable prospect, company, or profile rows. Generated, needs-review, approved-for-simulation, rejected, and superseded states contain no delivery state. Draft approval has no relationship to the separate future delivery boundary.

Fictional targeting profiles persist a fabricated title, function/role family, persona, desired-role reference, industry, geography, experience context, role and functional alignment, shared signal, data quality, and role-specific upside. Separate fictional-company profiles hold scenario tier and three desirability inputs. These are transparent simulation fixtures—not real-world claims or final black-box scores—and cannot reference public target-company IDs.

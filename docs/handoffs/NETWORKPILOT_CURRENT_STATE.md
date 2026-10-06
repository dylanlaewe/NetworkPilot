# NetworkPilot current engineering state

Updated 2026-10-06 after controlled production activation completed. This document is the canonical starting point for a fresh engineering conversation; verify current Git and runtime state before acting.

## Product

NetworkPilot is Dylan Laewe's private, local-first professional-networking command center. Dylan is currently its only user. It helps source and qualify candidates, prepare reviewed outreach, optionally attach a resume, create or explicitly send an approved Gmail message, and retain relationship history. Human review is mandatory before externalization.

The five relationship buckets are Recruiters, Peers & practitioners, Managers & team leaders, Executives, and CEOs & presidents. The daily workflow is: understand work on Today; review, edit, attach, approve, create, and explicitly send from Drafts; track outcomes in Sent; manage qualified supply in Candidates; manage immutable local PDFs in Resumes; and inspect provider/data safety in System.

## Current Git and runtime state

- Activated runtime build: `fbee75501c32d1b9c3b4bd203ce043e7b655e78c` (`fix: require explicit migration target`). The handoff itself is a later documentation-only commit.
- `v1.2.0` remains at `01586350c87bb49dc2b056d8fd7e55831a4f4663`; do not move existing tags.
- Five-bucket production integration, explicit migration boundary, datastore/capability preflight, production scoped Apollo adapter, audited company trust, and bounded security exception are merged.
- `NETWORKPILOT_FIVE_BUCKET_ENABLED` still defaults fail-closed but is deliberately configured `true` in the local production environment.
- The validated Next.js 16.3.6 production build is listening on port 3000 as PID 61698, started 2026-10-06 at 14:14:30 America/New_York.

## Datastore topology

See [the authoritative topology](../datastore-topology.md).

| Role | Default path or configuration | Authority and schema contract |
| --- | --- | --- |
| Canonical operational | `NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH`, default `data/apollo-operational-scale-enrichment.sqlite` | Sole owner of real imported candidate/outreach state and all mutable five-bucket/trust state; schema `0022` is required when five-bucket mode is enabled |
| Application/system | `NETWORKPILOT_DATABASE_PATH`, default `data/networkpilot.sqlite` | Simulation and system state; role contract through `0020` |
| Recruiter evidence | `NETWORKPILOT_RECRUITER_DATABASE_PATH`, default `data/apollo-recruiter-enrichment.sqlite` | Read-only source evidence; legitimate schema contract `0011` |
| Professional search cache | `data/apollo-operational-scale-search.sqlite` | Scratch/source cache with its own validated lineage |
| Recruiter search cache | `data/apollo-recruiter-search.sqlite` | Scratch/source cache with its own validated lineage |
| Tests and QA | Injected temporary path or `:memory:` | Isolated, non-production authority |

Source evidence stores never own corrections, refresh operations, defaults, snapshots, or other mutable bucket state. The canonical operational database exclusively owns five-bucket application state. Heterogeneous migration versions are intentional.

Repository construction and runtime schema checks never migrate. Only the explicit `npm run db:migrate` path may apply migrations, after the operator verifies the exact configured target. Never migrate the recruiter evidence store merely to satisfy canonical application logic.

## Five-bucket behavior

The classifier and evidence contracts live in `src/domain/recipient-buckets/index.ts` and use `recipient-bucket-v1`.

- Every automatic classification requires verified professional identity, current employment, company identity, and relevant-function evidence.
- Recruiter function takes precedence over title seniority. Recruiters require the recruiter track, accepted recruiter qualification, recruiting-function, internal-recruiting, and recruiting-domain evidence. Agency or ambiguous recruiters fail closed.
- Non-recruiters require exactly one responsibility scope: individual contributor → Peers; team leadership → Managers; functional/division leadership → Executives; company leadership → CEOs/presidents.
- CEO/president classification additionally requires a matching company-chief title and rejects division/regional scope conflicts.
- Missing, conflicting, unverifiable, or insufficient responsibility evidence becomes review-needed rather than guessed.
- The early-career exception is limited to reviewed Peers evidence. It may remove only the reviewed experience/seniority exception; unrelated-function and all other safety gates remain authoritative.
- Leadership is fail-closed: a title alone never proves team, function, division, or company-wide responsibility.
- Human corrections are audited and require reviewed evidence. Historical records with no stored classification remain `Legacy / unclassified`.
- Approved and sent snapshots are immutable; later classification changes do not rewrite history.

Classification alone never makes a candidate actionable. The canonical reserve also requires eligible state with no unresolved gates, verified professional email, reviewed/provider-backed company identity, no suppression or opt-out, no prior planning/contact/draft operation, and no dismissal. It enforces one active candidate per company, the normal seven-day company cooldown (same-day only after a hard bounce), and reports actionable capacity as unique eligible companies rather than raw people.

## Canonical messaging

The versioned five-bucket fixture source is `src/domain/drafting/bucket-templates.ts`, currently `approved-2026-09-22.v1`. Rendering and evidence-slot enforcement live in `src/application/command-center-drafts/bucket-copy.ts`. General voice validation is `dylan-outreach-method-v5`.

Non-negotiable copy rules:

- Preserve the approved manager wording and require a verified specific outreach topic.
- Executives use the approved 10–15 minute calendar language.
- Executives and CEOs/presidents include the approved "I promise I'll pay your time forward." sentence.
- Recruiter copy stays short, direct, early-career oriented, and truthful about the selected attachment.
- There is no universal question-mark rule and no universal word-count minimum; semantic ask validation applies to the canonical bucket fixtures.
- Never add unsupported personalization or infer responsibility from title alone.
- Generated outreach may not contain an em dash.

Do not duplicate or casually edit the fixture bodies in documentation. Change the versioned fixture and its focused tests through an explicitly reviewed copy milestone.

## Resume behavior

- One optional active resume ID may be configured as the recruiter default in canonical state.
- The default applies only when creating a new recruiter draft; it is not retroactive and never sends automatically.
- Peers, Managers, Executives, and CEOs/presidents default to no attachment.
- Approval freezes the exact resume ID/version and immutable message snapshot.
- Missing/inactive versions never silently substitute another resume.
- Attachment/body disagreement blocks approval or requires an explicit reviewed correction. Historical approved and sent snapshots are never rewritten.

## Provider safety

Apollo uses server-side search and controlled enrichment adapters with a shared persisted account budget across all buckets. Search does not establish verified-email evidence; only accepted enrichment evidence may pass that hard gate. Phone, personal-email, waterfall, scraping, and browser-automation paths are outside the approved architecture.

Bucket-scoped sourcing must complete the role-aware local preflight before provider readiness, budget authorization, or any provider request. It validates canonical `0022`, each source store against its own legitimate schema, repository/capability ownership, downstream reserve projection, bucket support, and shared budget. The atomic claim rechecks the budget with a fresh timestamp. Source databases may legitimately remain on older schema versions.

The failed September 27 isolated validation consumed 20 real Apollo credits while moving provider usage from 220 to 240, but produced no completed canonical imports. Those credits are represented as external validation spend for that provider day, not fabricated candidate success.

The separately authorized October 4 staged validation then moved account usage from 240 to 245 through exactly five sequential enrichment attempts, one per bucket. Each provider response omitted `credits_consumed`; canonical operations therefore retained their authorized exposure and persisted observed consumption as unknown. Account usage increased by exactly one around each attempt, but account-wide observations were not invented as attributable per-operation consumption. Five candidates were imported into an isolated schema-0022 copy, with zero qualified, zero actionable, and zero drafts. Provider-only employers stayed unverified. Title-only leadership records stayed review-required. See [the sanitized evidence package](../live-apollo-validation-2026-10-04.md). No additional Apollo request is authorized.

## Dependency security

- `npm audit --omit=dev` reports zero production vulnerabilities.
- The raw full audit reports five propagated high-severity findings from one development-only advisory: `GHSA-vfj7-8cjw-p6xm` / `CVE-2026-93687` in `braces@3.0.3`.
- `npm run check:security-audit` accepts only the exact reviewed dev-only dependency path, advisory graph, breaking remediation, registry version, ESLint configuration, and review window. Any drift fails closed.
- The exception expires on 2026-11-03 and must be re-reviewed then or earlier if a compatible fix appears. Do not force npm's breaking Next 14 downgrade.

## Gmail safety

- A human must review and approve the exact immutable subject, body, recipient, and optional resume before Gmail externalization.
- Sending is an explicit foreground action against that approved snapshot.
- There is no bulk, background, or scheduled send path and no SMTP path.
- An uncertain provider result becomes reconciliation-required; it must not appear successful or be blindly retried.
- Confirmed sent evidence, approved/sent snapshots, and existing audit events are immutable and idempotent. Current human-reported outcome state may transition only through explicit operator actions that append new audit evidence.
- Never make a real Gmail call or send without task-specific authorization.

## Proven work

- Five-bucket isolated interactive prototype and acceptance package: complete.
- Production five-bucket integration behind a default-OFF flag: complete.
- Reduced-motion desktop/mobile browser validation: PASS.
- Explicit migration boundary and no-implicit-migrations guard: PASS.
- Datastore role/capability/preflight hotfix: PASS and independently reviewed.
- Offline mocked production orchestration across all five buckets, including heterogeneous canonical `0022` and recruiter-source `0011`: PASS.
- Production scoped Apollo adapter and shared accounting/reconciliation path: PASS offline and independently reviewed.
- Audited company-trust boundary with exact stable identity and fail-closed recruiter qualification: PASS offline and independently reviewed.
- Exact development-only security exception and enforcement gate: PASS and independently reviewed.
- Staged live Apollo accounting, normalization, trust, classification, persistence, and fail-closed behavior across all five buckets: PASS in an isolated operational copy; final independent review recorded in the sanitized evidence package.
- Existing-live-record positive path from audited employer review through actionable Recruiters reserve, one local draft, and configured `General Resume` selection: PASS in the isolated copy; independent copy review passed.

## Current blocker

There is no activation blocker. Controlled production activation completed without provider or Gmail work. Another Apollo call, Gmail call/draft, or real email still requires separate task-specific authorization.

## Production state

- Five-bucket flag: ON by deliberate local production configuration.
- Canonical operational schema: `0022_company_trust.sql`. Final activated database SHA-256 after migration and recruiter-default configuration: `0ff7fb8905e2a739ead4c0366a4d88467869782f9278dee115128bbc3ed6489c`.
- Verified pre-0022 backup: `/Users/dylanlaewe/Backups/NetworkPilot/networkpilot-operational-pre-0022-20261006T175824Z.sqlite`, SHA-256 `6bd534bd25d4bd5db1ef73d166c0fd3c5df61687b347048ef5658e05b0f69b1d`.
- Exact active `General Resume` (`resume-25b41a9d-f581-4e1a-bd35-a9bafdf54bb3`) is the recruiter default. Professional buckets still default to no attachment.
- `company_trust_audit` and `company_trust_current` remain empty. No existing or provider-discovered company was silently trusted.
- Protected candidate, draft, outreach, Gmail, provider-accounting, resume, and trust fingerprints were unchanged by migration except for the authorized schema ledger and recruiter-default preference.
- `data/networkpilot.sqlite` remains the application/system datastore. Its accepted additive 0021/0022 schema drift does not change role ownership or capabilities. Do not restore or down-migrate it.
- The operator-targeting incident and guard are documented in `docs/explicit-migration-boundary.md`; `db:migrate` now requires and prints an explicit absolute target and rejects missing, nonexistent, or conflicting configuration.
- Production dependency audit is zero after patching `sharp@0.35.5` and `source-map-js@1.2.2`; the exact accepted dev-only `braces` exception remains enforced.
- Activation made zero Apollo calls, Gmail calls, Gmail drafts, or emails.

## Engineering invariants

- No implicit migrations; schema changes use only the explicit migration command and exact reviewed target.
- No provider spend before every required local dependency passes preflight.
- Canonical mutable state has exactly one owner; source databases are evidence only.
- Never let two agents edit the same worktree concurrently. Use isolated worktrees and isolated database copies for mutable parallel work.
- Git commits and repository documentation are shared memory; never rely on unstated context from another conversation.
- Preserve historical approved/sent snapshots, audits, and outreach state.
- No real send without explicit authorization.
- No production mutation, provider call, deployment, or restart unless the current task explicitly authorizes it.

## Next recommended task

Open NetworkPilot and use it yourself before any further engineering work. Do not call Apollo or Gmail, create Gmail drafts, or send email without new task-specific authorization.

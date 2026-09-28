# NetworkPilot current engineering state

Updated 2026-09-28 after merging the datastore-topology hotfix. This document is the canonical starting point for a fresh engineering conversation; verify current Git and runtime state before acting.

## Product

NetworkPilot is Dylan Laewe's private, local-first professional-networking command center. Dylan is currently its only user. It helps source and qualify candidates, prepare reviewed outreach, optionally attach a resume, create or explicitly send an approved Gmail message, and retain relationship history. Human review is mandatory before externalization.

The five relationship buckets are Recruiters, Peers & practitioners, Managers & team leaders, Executives, and CEOs & presidents. The daily workflow is: understand work on Today; review, edit, attach, approve, create, and explicitly send from Drafts; track outcomes in Sent; manage qualified supply in Candidates; manage immutable local PDFs in Resumes; and inspect provider/data safety in System.

## Current Git and runtime state

- Exact merged product/code baseline on `main`: `ce5e7d5e59af6ce929658dfc8a8fdc881e402eff` (`fix: preflight five-bucket datastore topology`). The handoff itself is a later documentation-only commit.
- `v1.2.0` remains at `01586350c87bb49dc2b056d8fd7e55831a4f4663`; do not move existing tags.
- Five-bucket production integration, explicit migration boundary, and datastore/capability preflight are merged.
- `NETWORKPILOT_FIVE_BUCKET_ENABLED` defaults to `false` and remains OFF unless its value is exactly `true`.
- No running Next.js production PID or listener was observable when this handoff was written. The previously observed PID `86905` had exited. Its exact loaded Git SHA was not independently encoded in observable process metadata. No restart or deployment was performed during this merge sequence.

## Datastore topology

See [the authoritative topology](../datastore-topology.md).

| Role | Default path or configuration | Authority and schema contract |
| --- | --- | --- |
| Canonical operational | `NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH`, default `data/apollo-operational-scale-enrichment.sqlite` | Sole owner of real imported candidate/outreach state and all mutable five-bucket state; schema `0021` for five-bucket use |
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

Bucket-scoped sourcing must complete the role-aware local preflight before provider readiness, budget authorization, or any provider request. It validates canonical `0021`, each source store against its own legitimate schema, repository/capability ownership, downstream reserve projection, bucket support, and shared budget. The atomic claim rechecks the budget with a fresh timestamp. Source databases may legitimately remain on older schema versions.

The failed September 27 isolated validation consumed 20 real Apollo credits while moving provider usage from 220 to 240, but produced no completed canonical imports. Those credits are represented as external validation spend for that provider day, not fabricated candidate success. Another live run requires separate authorization, a fresh account-usage baseline, and exactly one bounded attempt. Never start an automatic second run.

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
- Offline mocked production orchestration across all five buckets, including heterogeneous canonical `0021` and recruiter-source `0011`: PASS.

Mocked orchestration is not live provider validation.

## Current blocker

Five-bucket production activation remains blocked until:

1. the scoped production Apollo adapter/wiring is validated; and
2. a separately authorized bounded live run proves real classification and downstream draft quality.

Concrete offline entry points for that task:

- `src/application/candidate-refresh/scoped.ts` defines the provider/preflight orchestration contract.
- `src/infrastructure/sqlite/candidate-refresh.ts` currently accepts only an injected `scopedProvider`; normal runtime supplies none, and readiness intentionally reports `provider-not-configured`.
- `src/infrastructure/providers/apollo/adapter.ts` is the existing legacy search/enrichment adapter. Its mapper currently emits identity, employment, organization, experience, email, and seniority evidence, but no `responsibilityEvidence`.
- `src/domain/recipient-buckets/index.ts` requires exactly one verified responsibility scope for non-recruiters and verified internal/domain evidence plus accepted recruiter qualification for recruiters. Simply wiring the legacy Apollo adapter cannot prove leadership buckets. Missing responsibility evidence must remain review-required; do not infer scope from title.
- Primary regressions are `src/infrastructure/sqlite/datastore-preflight.integration.test.ts`, `src/infrastructure/sqlite/scoped-discovery.test.ts`, `src/infrastructure/providers/apollo/adapter.test.ts`, `src/infrastructure/sqlite/buckets.integration.test.ts`, and `src/application/command-center-drafts/bucket-copy.test.ts`.

## Production state

- Five-bucket flag: OFF.
- Additive migration `0021_recipient_buckets.sql` already exists in the production operational database because of the documented pre-activation incident. Do not down-migrate it and do not restore an older database over later legitimate history.
- Historical comparison found no unexplained candidate, outreach, Gmail-operation, suppression, or snapshot changes.
- The datastore hotfix merge and validation made zero production database writes and performed no production restart.
- Before any future production action, re-establish the actual runtime/process state and take a verified backup when the task authorizes mutation.

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

Do not implement this from the handoff task:

> Validate and, if needed, implement the production scoped Apollo adapter offline before requesting another live provider run.

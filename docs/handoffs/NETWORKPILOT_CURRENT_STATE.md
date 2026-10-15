# NetworkPilot current engineering state

Updated 2026-10-15 after targeting-breadth and component-craft corrections were deployed. This document is the canonical starting point for a fresh engineering conversation; verify current Git and runtime state before acting.

## Product

NetworkPilot is Dylan Laewe's private, local-first professional-networking command center. Dylan is currently its only user. It helps source and qualify candidates, prepare reviewed outreach, optionally attach a resume, create or explicitly send an approved Gmail message, and retain relationship history. Human review is mandatory before externalization.

The five relationship buckets are Recruiters, Peers & practitioners, Managers & team leaders, Executives, and CEOs & presidents. The daily workflow is: understand work on Today; review, edit, attach, approve, create, and explicitly send from Drafts; track outcomes in Sent; manage qualified supply in Candidates; manage immutable local PDFs in Resumes; and inspect provider/data safety in System.

## Current Git and runtime state

- Activated runtime build: `5b16ae8758b1077757aeb56445c1f28ccbb61f4f` (`Align send confirmation contract test`). The handoff update is a later documentation-only commit.
- `v1.2.0` remains at `01586350c87bb49dc2b056d8fd7e55831a4f4663`; do not move existing tags.
- Five-bucket production integration, explicit migration boundary, datastore/capability preflight, production scoped Apollo adapter, audited company trust, and bounded security exception are merged.
- `NETWORKPILOT_FIVE_BUCKET_ENABLED` still defaults fail-closed but is deliberately configured `true` in the local production environment.
- The validated Next.js 16.3.8 production build is listening on port 3000 as PID 17617 (parent `npm run app:start` PID 17601), started 2026-10-15 at 17:49:08 America/New_York.

## Targeting-breadth and component-craft deployment

- Main fast-forwarded cleanly from `269daca10d3a65582770f55fdf2eb6571313370a` through the reviewed feature history to deployed build `5b16ae8758b1077757aeb56445c1f28ccbb61f4f`. The prior runtime build `80e6d248d331c94b506282335b3ccf54e3b1b9f5` remains the code/build rollback boundary.
- The actual Drafts application component was browser-tested against isolated synthetic state and a mocked send action at desktop and narrow/mobile widths. Recipient, subject, body, attachment, long owned scrolling, focus trap/return, Escape, Cancel, pending, error, uncertainty, changed-selection safety, and duplicate suppression all passed. Cancel/Escape produced zero mocked work; explicit final confirmation produced exactly one mocked send. Follow-up SHA `5b16ae8758b1077757aeb56445c1f28ccbb61f4f` received independent PASS review.
- Integrated validation passed 107 test files and 1,267 tests, strict typecheck, zero-warning lint, two production builds, the security gate with only exact approved dev-only advisory `GHSA-vfj7-8cjw-p6xm`, zero production audit findings, remote-font guard, Gmail-send guard, implicit-migration guard, and `git diff --check`.
- Production acceptance passed at 1440x900, 1280x800, 390x844, and 360x800 with no horizontal overflow, internal overlap, clipped primary action, or browser warning/error. Candidates preserves retained `Junior Data Analyst` title evidence, selected Peers/filter state, a readable desktop filter panel, and clear Find people/Open draft states. Drafts preserves 11 current plus 3 Legacy drafts, visible General Resume attachment/default context, editable message dominance, and accessible action rows. Settings, Resume Library, and 56 existing relationship-history records remain intact.
- The running build includes diversified peer selection across analysis, product, engineering, and implementation/business families; CEO-only, President-only, and combined CEO/President query terms remain distinct, with regional/divisional and vice-president collisions rejected locally before enrichment. `candidatePresentationTitle` shows retained provider evidence and falls back to `Title unavailable`; no live sourcing/yield claim was made.
- This was a code/UI-only deployment. No migration ran. Schema remains `0022_company_trust.sql`; limits remain 50 credits per local day and 5 per run; five-bucket mode remains enabled; and active `General Resume` `resume-25b41a9d-f581-4e1a-bd35-a9bafdf54bb3` remains the recruiter default.
- Pre/post canonical database SHA-256 remained `f351b084a02e851b4225de571601efdfd151cb1a7435ccdbb403a30f9d911aa5`; WAL remained empty at `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; SHM remained `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb`; and logical SHA3 remained `990f7c904727927256ba9b5e530ab6de9a0d7c8c28741678943c356a`. Integrity is `ok`; all recorded provider, refresh, Gmail, outreach, trust, candidate, and configuration counters were unchanged.
- The two confirmed Gmail-send operations at 2026-10-15 19:50:46Z and 19:50:56Z remain intact and are excluded from the active candidate pool. A pre-existing history gap remains: neither operation has a corresponding `manual_outreach_records` row, so the Sent relationship workspace still shows 56 records and does not surface those two confirmations. This deployment did not backfill or rewrite production history.
- Deployment and acceptance made zero Apollo calls, zero Apollo usage checks, zero Gmail calls or drafts, and zero email sends. The Impeccable surface sidecar remains intentionally unrefreshed relative to the final send-action test seam; do not start a tooling/design task solely to refresh it.

## Product-experience deployment

- The approved product-experience overhaul became live at 2026-10-12 14:40:40 EDT from exact code revision `6d14998ebb855f40b17bdfe5dcf8d54d28158bc7`.
- This was a code/UI-only deployment. No migration command ran, the migration ledger remained at `0022_company_trust.sql`, and the five-bucket flag and recruiter resume preference were unchanged.
- Deployment and read-only acceptance made zero Apollo calls, zero Gmail calls or drafts, and zero email sends. Canonical provider/Gmail/outreach counters and the logical database fingerprint were unchanged.
- Today, Candidates, Sent, Resumes, System, and the zero-draft production state passed read-only browser acceptance at 1440×900, 1280×800, 390×844, and 360×800. The exact deployed UI was additionally exercised against an isolated populated fixture to verify draft selection, evidence disclosure, and candidate Create Draft behavior without production mutation.
- At that deployment, mobile Draft action density and the Resumes Back affordance were recorded as non-blocking polish. The later experience-reset notes below supersede that status.

## Experience-reset deployment

- The approved ChatGPT-inspired experience reset became live at 2026-10-12 18:22:58 EDT from exact code revision `9198d15086d0d82dca27724a999eba4a576f2caf`.
- This was a code/UI-only deployment. No migration command ran, the migration ledger remained at `0022_company_trust.sql`, and the five-bucket flag and exact recruiter `General Resume` preference were unchanged.
- Deployment and read-only acceptance made zero Apollo calls, zero Gmail calls or drafts, and zero email sends. Canonical provider, Gmail, outreach, trust, and logical database fingerprints remained unchanged.
- Today, Drafts, Candidates, Sent, Resumes, and Settings passed read-only browser acceptance at 1440×900, 1280×800, 390×844, and 360×800 with no horizontal overflow, action overlap, or browser console warnings/errors. Production has zero active drafts, so populated two-pane draft behavior remains covered by the reviewed candidate tests and pre-deployment isolated acceptance rather than manufactured production data.
- Candidate bucket switching and candidate selection visibly completed client-locally in approximately 155 ms and 104 ms respectively in the acceptance browser. Five warm local production fetches measured median end-to-end times of approximately 117 ms for Drafts and 98 ms for Candidates; no obvious deployment regression was observed.
- Zero-capacity Add Drafts now gives a truthful no-actionable-reserve explanation and keeps the separately labeled, potentially Apollo-backed Find More path distinct. Find More was not executed.
- No new blocking polish was found. The mobile Resumes view now exposes an explicit Back to resumes affordance. Populated mobile Draft action density remains a non-blocking follow-up only if normal use reveals friction; do not start another UI task automatically.

## Empty-candidate first-run deployment

- The empty-pool and zero-actionable recovery workflow became live at 2026-10-12 18:55:31 EDT from exact code revision `6da384f2406df8a55b12c00a4c5fd4545cfccabe`.
- Production read-only diagnosis confirmed zero current five-bucket candidates and zero actionable capacity in every bucket, with 127 explicitly separated Legacy records. No Legacy record was reclassified or moved.
- A zero pool now presents `No candidates yet`, makes provider-backed `Find people` the primary next step, discloses that Apollo credits may be used, and keeps `View Legacy` secondary. A populated but non-actionable pool instead summarizes authoritative blocker counts and points to review or sourcing. `Add drafts` appears only when truthful actionable capacity exists.
- Browser acceptance passed at 1440×900, 1280×800, 390×844, and 360×800. The first click opens the scoped confirmation without provider activity; the confirmation shows its maximum credit exposure and has one unambiguous submit. The mobile panel participates in normal layout flow and remains clear of fixed navigation.
- This was a code/UI-only deployment. No migration ran. The initial restart exposed a missing local `better-sqlite3` native binding; rebuilding the already-installed dependency and restarting the same validated revision resolved it without code, schema, or data changes.
- Deployment and read-only acceptance made zero Apollo calls, zero Gmail calls or drafts, and zero email sends. Canonical provider, refresh, Gmail, outreach, trust, and logical database fingerprints remained unchanged.

## Preferred CRM workflow deployment

- The reviewed preferred CRM workflow became live at 2026-10-13 13:29:46 EDT from exact code revision `32405a0b0ff1b207a94fb862add6300067713ec7`. Main was fast-forwarded from `ade1fd320c57e3b26c8c071ec800a6cf649c062e`; the approved feature history and all prior security work were preserved.
- Validation passed the reviewed baseline of 104 test files and 1,211 tests, strict typecheck, zero-warning lint, production build, security gate, zero production audit findings, remote-font guard, Gmail-send guard, implicit-migration guard, and `git diff --check`. The mocked real-service journey retained one provider send, one authoritative Sent record, duplicate-send idempotency, and reconciliation for genuinely uncertain results.
- The previously recorded production process was no longer listening when preflight began. No database rollback was needed: the exact validated build started cleanly on port 3000, and the prior runtime build `6da384f2406df8a55b12c00a4c5fd4545cfccabe` remains the code rollback boundary.
- Production read-only acceptance passed on desktop and at 390x844 and 360x800 with no horizontal overflow, clipped interactive controls, or browser console warnings/errors. Candidates exposes `Find people`; Drafts exposes `Create drafts`; zero-count buckets provide a useful provider-disclosed sourcing path; and the three existing Legacy drafts retain the familiar editable message and final-confirmation workspace.
- Production currently projects 5 current Recruiter candidates, 127 Legacy candidates, 0 current five-bucket drafts, and 3 Legacy drafts. The current candidates can create drafts without a mandatory company-trust ceremony; no candidate, draft, company, trust, or history record was changed during acceptance.
- Sent retains 47 historical relationships. The exact active `General Resume` remains the recruiter default. Deployment and acceptance made zero Apollo calls, zero Gmail calls or drafts, and zero email sends.

## Working drafts and sourcing-limits deployment

- The reviewed working-drafts and sourcing-limits revision became live at 2026-10-13 17:32:32 EDT from exact code revision `167227b9f16449fd4321a20b598f126641d60526`. Main was fast-forwarded from `f738714f5ab0439a1c82cf6f230839d7aed352ab`; the approved feature history and all prior security work were preserved.
- Validation passed 105 test files and 1,224 tests, strict typecheck, zero-warning lint, production build, security gate, zero production audit findings, remote-font guard, Gmail-send guard, implicit-migration guard, and `git diff --check`.
- The rendered Drafts control was exercised against an isolated schema-0022 synthetic fixture with Apollo and Gmail disabled: 5 drafts, then 10 more for 15 total; 2-of-5 partial and zero-capacity outcomes; exact candidate-specific Open Draft; idempotency; and provider-independent creation all passed. Settings persisted raised and lowered limits while preserving existing usage and holds.
- Production read-only acceptance shows 7 current five-bucket candidates (5 Recruiters and 2 CEOs/presidents), 127 Legacy candidates, 1 current draft, 3 Legacy drafts, and 47 historical relationships. The active `General Resume` remains the recruiter default.
- Production retained its existing default sourcing limits of 10 credits per America/New_York day and 5 per Find people run; no override rows were written. The two completed 2026-10-13 CEO runs retain immutable authorization of 5 + 5, with 2 attempted enrichments of unknown consumption in the first and 0 attempts/exactly 0 in the second. The corrected read model holds 2 conservatively and releases only the unused 8, leaving 8 local credits in the current window without rewriting history.
- Deployment ran no migration and made zero Apollo calls, Gmail calls, Gmail drafts, or email sends. Pre/post logical table fingerprint remained `bc49d5aaebf698f168b8f575562be379975d066cdb83d23f393b05f4c5fac56f`; database/WAL/SHM hashes and all recorded application counters were unchanged.

## Candidate supply and CRM corrections deployment

- The reviewed candidate-supply, contact-lifecycle, and CRM-quality revision became live at 2026-10-15 15:01:18 EDT from exact code revision `80e6d248d331c94b506282335b3ccf54e3b1b9f5`. Main fast-forwarded cleanly from documentation-only head `f41c5da93eaf7dbcc089f25390aa95c51a166abb`, preserving the approved feature history and security patches.
- Validation passed 106 test files and 1,240 tests, strict typecheck, zero-warning lint, production build, security gate with only the exact approved dev-only exception, remote-font guard, Gmail-send guard, implicit-migration guard, and `git diff --check`.
- Production read-only acceptance projects 8 current candidates: 0 Recruiters, 5 Peers & practitioners, 1 Manager & team leader, 0 Executives, and 2 CEOs & presidents, plus 80 Legacy records. All five retained Junior Data Analyst peers are currently Available; obsolete seniority, company-industry, and company-review gates no longer block ordinary personal outreach.
- Drafts projects 1 current draft and 3 Legacy drafts. Expanding Create drafts and selecting Peers shows truthful capacity of 5; no production draft was created during acceptance. Sent preserves 56 relationships while confirmed contacts remain absent from active candidate buckets and underlying candidate/outreach/audit records remain intact.
- Candidates and Drafts passed browser acceptance at 1440x900, 1280x800, 390x844, and 360x800 with no horizontal overflow, clipped primary action, or browser console warning/error. The mobile Drafts action dock remains vertically dense but usable, scroll-safe, and nonblocking.
- This was a code/UI-only deployment. No migration ran. Pre/post canonical database SHA-256 remained `3427300987bfe9b69656f882a3febe4673d14e14a263ea7b890d345f83c9a850`; WAL remained empty at `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; SHM remained `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb`; and logical SHA3 remained `455fcfa57a5e9065690bf61dfc9149fd562c07bd1dbc8de04738a752`.
- Schema remained `0022_company_trust.sql`; imported candidates remained 135; provider operations 155 with 166 recorded attempts; candidate refresh events 12; daily refresh runs 12; Gmail draft operations 62; Gmail send audit rows 80; manual outreach records 56; and company-trust audit rows 0. Limits remain 50 per day and 5 per run, five-bucket mode remains enabled, and active General Resume `resume-25b41a9d-f581-4e1a-bd35-a9bafdf54bb3` remains the recruiter default.
- Deployment and acceptance made zero Apollo calls, zero Apollo usage queries, zero Gmail calls or drafts, and zero email sends. Post-fix live CEO yield remains deliberately untested pending separate sourcing authorization.

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

There is no deployment blocker. Dylan should use the restored production CRM workflow normally. Another Apollo call, Gmail call/draft, or real email still requires separate task-specific authorization.

## Production state

- Five-bucket flag: ON by deliberate local production configuration.
- Canonical operational schema: `0022_company_trust.sql`. The historical post-activation SHA-256 after migration and recruiter-default configuration was `0ff7fb8905e2a739ead4c0366a4d88467869782f9278dee115128bbc3ed6489c`. The 2026-10-12 pre/post-deployment application-data fingerprint was `fc2003ab29fcf71ca578948a5fec647d98bb8de35dbc76305cb326bdaee2db24`; WAL was empty (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) and SHM was `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb`.
- Verified pre-0022 backup: `/Users/dylanlaewe/Backups/NetworkPilot/networkpilot-operational-pre-0022-20261006T175824Z.sqlite`, SHA-256 `6bd534bd25d4bd5db1ef73d166c0fd3c5df61687b347048ef5658e05b0f69b1d`.
- Exact active `General Resume` (`resume-25b41a9d-f581-4e1a-bd35-a9bafdf54bb3`) is the recruiter default. Professional buckets still default to no attachment.
- `company_trust_audit` and `company_trust_current` remain empty. No existing or provider-discovered company was silently trusted.
- Protected candidate, draft, outreach, Gmail, provider-accounting, resume, and trust fingerprints were unchanged by migration except for the authorized schema ledger and recruiter-default preference.
- `data/networkpilot.sqlite` remains the application/system datastore. Its accepted additive 0021/0022 schema drift does not change role ownership or capabilities. Do not restore or down-migrate it.
- The operator-targeting incident and guard are documented in `docs/explicit-migration-boundary.md`; `db:migrate` now requires and prints an explicit absolute target and rejects missing, nonexistent, or conflicting configuration.
- Production dependency audit is zero after patching `sharp@0.35.5` and `source-map-js@1.2.2`; the exact accepted dev-only `braces` exception remains enforced.
- The 2026-10-12 experience-reset deployment made zero Apollo calls, Gmail calls, Gmail drafts, or emails and did not change the canonical logical database fingerprint.
- The 2026-10-12 first-run workflow deployment likewise made zero Apollo calls, Gmail calls, Gmail drafts, or emails. The canonical logical database fingerprint remained `0ebcbb9f03b32019184451fee6909c569f09c9d2382a4cfd4ba48db1ab3d356f`; provider operations remained 130 with 130 total attempts, candidate refresh events remained 5, and daily refresh runs remained 8.
- The 2026-10-13 preferred-workflow deployment ran no migration. Pre/post application table hashes matched exactly; the stable table-set fingerprint was `7f9e1442cc8cd3d1ab662ba2b2f08f1de883bfa7e6bfccaf2d97bf6c5cc3d71d`. The canonical database remained `d8b5309b022db85299a6c2e309be294494ad93b6a55c5c4f0e520e114482bd42`, WAL remained empty at `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, and SHM remained `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb`. Schema remained `0022_company_trust.sql`; provider operations remained 136, candidate refresh events 6, Gmail draft operations 52, Gmail send audit rows 60, manual outreach records 47, and company-trust audit rows 0.
- The 2026-10-13 working-drafts deployment ran no migration. The canonical database remained `88939c260e73ed31055630b35cc4b277c1acb56111842f51f02f949d6e10837b`, WAL remained empty at `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, SHM remained `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb`, and the pre/post logical table fingerprint remained `bc49d5aaebf698f168b8f575562be379975d066cdb83d23f393b05f4c5fac56f`. Schema remained `0022_company_trust.sql`; provider operations remained 140 with 144 total recorded attempts, candidate refresh events 8, daily refresh runs 9, Gmail draft operations 52, Gmail send audit rows 60, manual outreach records 47, and company-trust audit rows 0.

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

Dylan should use the restored production CRM workflow normally and report only concrete friction. Do not start another redesign or call Apollo or Gmail, create Gmail drafts, or send email without new task-specific authorization.

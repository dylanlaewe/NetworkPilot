# Agent experiment log

This file records only facts recoverable from accepted handoffs and Git history. Metrics that were not captured at execution time are intentionally omitted.

## Controlled production activation

| Field | Recorded outcome |
| --- | --- |
| Runtime build | `fbee75501c32d1b9c3b4bd203ce043e7b655e78c` |
| Dependency remediation | `sharp@0.35.5` and `source-map-js@1.2.2`; production audit zero; accepted dev-only `braces` exception unchanged |
| Independent security review | PASS; compatible patch-only lockfile change, resolved tree verified, no unrelated churn |
| Backup | Read-only verified pre-0022 backup `networkpilot-operational-pre-0022-20261006T175824Z.sqlite`, SHA-256 `6bd534bd25d4bd5db1ef73d166c0fd3c5df61687b347048ef5658e05b0f69b1d` |
| Operator incident | The first migration command supplied `NETWORKPILOT_MANUAL_OUTREACH_DATABASE_PATH`, but `db:migrate` read `NETWORKPILOT_DATABASE_PATH`; additive 0021/0022 drift on the empty application/system database was accepted without rollback and the CLI was hardened in `fbee75501c32d1b9c3b4bd203ce043e7b655e78c` |
| Canonical migration | Exact operational target matched its recorded SHA and ledger at 0021; only `0022_company_trust.sql` applied; second invocation no-op; integrity, foreign keys, protected history, and empty trust state verified |
| Configuration | Exact active `General Resume` configured as recruiter default; other buckets retain no default attachment |
| Activation | Five-bucket mode deliberately enabled; production PID 61698 started 2026-10-06 14:14:30 America/New_York |
| Browser review | Desktop and mobile Today, Drafts, Sent, Candidates, Resumes, and System checks passed; historical records remained `Legacy / unclassified`; System reported Operational |
| External effects | Zero Apollo calls, Gmail calls, Gmail drafts, or emails; no provider, Gmail, candidate, draft, outreach, or trust records changed during health/browser checks |

## Provider and company-trust milestone

### Company Trust Specialist

| Field | Recorded outcome |
| --- | --- |
| Context | Fresh context |
| Implementation | Audited company-trust boundary implemented in `9b5aabc12e8b112d7aecaf9f4ea5b581142f5487` |
| Independent review | Accepted at `31cb3c2a0cff93cffffc493dd287b1ebd6738b97`; Headquarters reported no remaining P1, P2, or P3 findings and judged the chain structurally ready for a tiny staged live Apollo validation |
| Corrections after implementation | 1 accepted correction commit: `31cb3c2a0cff93cffffc493dd287b1ebd6738b97` |
| Elapsed time | Not recorded |
| Model/runtime | Not recorded |
| Token/cost | Not recorded |

No earlier Provider Specialist / Reviewer experiment record existed in the repository when this log was created. The accepted Git history shows the scoped provider implementation in `3552e51c50f39f41f9f1c5fdedc4720b094ecaea`, followed by provider accounting/classification/reconciliation corrections through `a3a1dd27c9e616d1f5ce2737a7115c2393be3fb6`, then recruiter evidence/domain corrections through `fb8b4a41780e932c2b66922397ef295f509db6d2`. No agent metrics were recoverable for that earlier sequence.

## Staged Apollo validation milestone

| Field | Recorded outcome |
| --- | --- |
| Scope | Five sequential buckets in an isolated migrated operational copy; one enrichment attempt per bucket |
| Account evidence | 240 → 245 consumed; exactly one account-level credit increase around each attempt |
| Canonical accounting | Five attempts and five authorized exposure; per-operation observed consumption unknown because every live response omitted `credits_consumed` |
| Pipeline result | Five imported, zero qualified, zero actionable, zero drafts; provider-only employers remained unverified and title-only leadership failed closed |
| Correction during continuation | Harness-only scope-mismatch false positive corrected and regression-tested in `089ec74a2e4612c00cbce73065f6bf03029f0dfc` before provider work resumed |
| Independent review | PASS with no critical, high, or medium findings; informational limitation that no candidate legitimately reached renderable outreach |
| External effects | Five explicitly authorized Apollo enrichments; zero Gmail calls, drafts, or emails; zero production mutations, migrations, restarts, or feature activations |
| Elapsed time | Not recorded |
| Model/runtime | Not recorded |
| Token/cost | Not recorded |

### Existing-record positive-path follow-up

| Field | Recorded outcome |
| --- | --- |
| Scope | Existing isolated recruiter only; zero new search or enrichment |
| Human decision | Exact reviewed operating-employer identity approved `trusted-operating` for the isolated copy |
| Dynamic transition | Audit/current trust version 1; candidate became eligible with zero gates; actionable Recruiters capacity 0 → 1 |
| Draft and resume | One canonical local recruiter draft; active `General Resume` selected as configured default; attachment metadata/claim validated without reading PDF bytes or creating Gmail MIME |
| Independent review | PASS; truthful, concise, relevant, correctly substituted, no unsupported hiring or requisition claim |
| Regression validation | Typecheck, lint, 52 focused tests, and 1,152 full-suite tests passed |
| External effects | Zero Apollo calls, Gmail calls/drafts, emails, or production mutations; production activation remained off |

## Development-only security exception integration

| Field | Recorded outcome |
| --- | --- |
| Task | Integrate a bounded exception for `GHSA-vfj7-8cjw-p6xm` without downgrading Next.js |
| Implementer | Lead Engineer, continued repository context |
| Initial artifact | `4844342ef7963750d1ef15cf69481b006aec8183` |
| Independent review | Initial FAIL because reachability drift and standard invocation were not enforced; second FAIL because compatible npm remediation drift was not enforced; final PASS at `7dabece0b63a012817c90e49a202224dc14cfeb4` |
| Corrections after initial artifact | 2 accepted correction commits: `2f6d032ecce16543d56516e701c4ccf5d12744ac`, `7dabece0b63a012817c90e49a202224dc14cfeb4` |
| Final outcome | Production audit empty; exact dev-only advisory, dependency path, remediation, registry version, ESLint configuration, and expiry enforced by `npm run check:security-audit` |
| Elapsed time | Not recorded |
| Model/runtime | Not recorded |
| Token/cost | Not recorded |

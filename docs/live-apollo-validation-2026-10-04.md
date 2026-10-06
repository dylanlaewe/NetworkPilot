# Staged Apollo validation evidence — 2026-10-04

This record contains only sanitized operational evidence. It contains no raw provider payload, contact identity, email address, account secret, or copied database.

## Bounded result

- Fresh account baseline: 240 of 2,530 lead credits consumed.
- Recruiter bucket only: two search calls, 20 people examined, one enrichment attempt.
- Account usage after the attempt: 241 consumed, an increase of exactly one within the authorization.
- Provider response: successful person match with exact provider-native identity and high match confidence; the top-level response omitted `credits_consumed`.
- Canonical result: one candidate imported, zero qualified, no draft. No other bucket was attempted.
- Gmail and production data were untouched.

The live response establishes that `credits_consumed` is optional. When it is present and valid, NetworkPilot persists the exact value. When it is absent, NetworkPilot persists unknown consumption and retains the authorized maximum exposure. Account-wide usage can corroborate that the staged account remained within authorization, but it is not written back as attributable per-operation consumption because concurrent account activity would make that inference unsafe.

Missing optional consumption alone is not a staged-validation stop condition when the request otherwise succeeded, canonical accounting safely records unknown, account usage remains within authorization, and every other invariant passes.

## Recruiter classification diagnosis

- Sanitized current title: `Recruiter`.
- Employment-history periods at the 2026-10-04 reference date:
  - 2026-05-01 to current
  - 1998-06-01 to 2026-05-01
  - 1998-06-01 to 2005-06-01
  - 2005-05-01 to 2006-02-01
- `experience-v1` correctly merged the overlapping periods into one continuous 1998-06-01 through 2026-10-04 interval and calculated approximately 28.34–28.35 total career years with accepted evidence.
- The failed gate was the legacy recruiter classifier condition requiring total career experience to overlap 2–20 years (`minimumExperience <= 20` and `maximumExperience >= 2`).
- Evidence was present. The failure was caused by the calculated total career length being outside that stale range, not by missing evidence.
- That implementation was not the intended current relationship-bucket policy. Total career history is not recruiter tenure. Current recruiter eligibility is based on the present recruiting title, internal-versus-agency employer evidence, recruiting domain, and applicable seniority exclusions.

The correction removes total career length from recruiter relationship acceptance without weakening title, employer, agency, recruiting-domain, consent, email, trust, or drafting gates.

## Employer trust outcome

The provider-only employer remained `unverified`, which is the designed default rather than a validation anomaly:

`provider-only recruiter → employer unverified → review-required → not actionable → no draft`

An audited company-trust decision is required before the candidate can become actionable. A same-bucket recruiter that is blocked only on employer trust is no longer mislabeled as a discovery scope mismatch.

## Reusable harness boundary

The reusable staged harness remains limited to the five named buckets, sequential execution, one enrichment attempt per bucket, five attempts total, protected-state fingerprints, isolated migrated datastores, and an account-usage check around each authorized attempt. It does not contain live payloads or identities. Provider phases require a new explicit approval; offline inspection and tests make no provider or Gmail calls.

## Authorized continuation

Headquarters separately authorized the four remaining buckets after the recruiter correction was integrated and independently reviewed. Before resuming, the operator confirmed:

- local and remote `main` at `df62d3d6b9c68018cb75a7fd3d027222766d424a`;
- a fresh Apollo baseline of 241 consumed, reconciled to the recruiter attempt's validated ending usage;
- a healthy isolated operational copy at schema `0022_company_trust.sql` with no integrity or foreign-key errors;
- a clean, resumable session whose next bucket was `peers`;
- isolated and production database files had distinct filesystem identities.

The continuation used one attempt per remaining bucket, sequentially. Every provider request was followed by canonical accounting, persistence, trust, classification, qualification, duplicate, protected-state, and account-usage checks before another request was allowed.

| Bucket | Searches / examined | Enriched | Account usage | System result | Sanitized evidence result |
| --- | ---: | ---: | ---: | --- | --- |
| Peers & practitioners | 2 / 20 | 1 | 241 → 242 | Peer bucket accepted; lifecycle rejected; zero actionable; no draft | `Junior Data Analyst`; provider seniority supported individual-contributor status, while employment history supported about 17.35 years. The old five-year global gate would not have rejected this particular person. Unsupported industry, prohibited seniority, and unreviewed employer remained hard gates. |
| Managers & team leaders | 2 / 20 | 1 | 242 → 243 | Bucket unresolved; review-required; zero actionable; no draft | `Machine Learning Team Lead`; title and AI/ML function were present, but Apollo supplied no verified team-leadership or responsibility evidence beyond the title. |
| Executives | 2 / 20 | 1 | 243 → 244 | Bucket unresolved; review-required; zero actionable; no draft | `Head of Analytics`; title and data-analytics function were present, but Apollo supplied no verified functional or divisional leadership evidence beyond the title. Unsupported industry and unreviewed employer also remained hard gates. |
| CEOs & presidents | 1 / 10 | 1 | 244 → 245 | Bucket unresolved; review-required; zero actionable; no draft | `CEO, President & CEO`; current employment supported the title, but Apollo supplied no evidence that distinguished company-wide authority from regional or divisional scope. Recipient function was also unresolved. |

Each enrichment succeeded with an exact provider-native person identity and a verified business-email status. Each real response again omitted `credits_consumed`. The canonical parent and child operations therefore persisted observed consumption as unknown while retaining one credit of authorized exposure. Account usage increased by exactly one after each attempt, staying within the authorized session ceiling. The account observations corroborate the bounded run but were not attributed as per-operation provider consumption.

All four imported employers remained `unverified`; none became trusted from provider data. The peer and executive records were `identity-unverified`, while the manager and CEO records used `provider-discovery-default`. Review-required or rejected candidates remained non-actionable, and no draft preview was generated.

### Candidate and draft quality

- Recruiter: potentially useful on recruiting-function evidence, but not actionable until the operating employer receives an audited trust decision.
- Peer: limited fit for the current networking goal despite a relevant analytics function; the junior title, unsupported industry, and unreviewed employer independently justified rejection.
- Manager: potentially relevant AI/ML leadership contact, but actual team responsibility was not established. Usefulness remains uncertain pending evidence and company review.
- Executive: limited-to-uncertain fit because the analytics title was relevant while the employer industry was unsupported and leadership scope was unverified.
- CEO/president: usefulness could not be established because the function was unknown and the provider title did not prove company-wide scope.

There was no generated-message artifact to score. Withholding drafts was the correct truthful outcome for all five candidates; consequently live message quality remains untested rather than failed.

The manager step initially surfaced a harness-only stop label for the expected fail-closed scope mismatch. Inspection established that the mismatch had not been bypassed: the candidate was review-required, noneligible, persisted with `discovery-scope-mismatch`, unqualified, and undrafted. Commit `089ec74a2e4612c00cbce73065f6bf03029f0dfc` narrowed the anomaly to an actual mismatch bypass and added regression coverage for unsafe variants. An independent review passed that correction before the session was reassessed with zero provider calls and resumed.

## Final reconciliation

- Continuation baseline: 241 of 2,530 lead credits consumed.
- Final account observation: 245 consumed.
- Additional account-level consumption: four credits, matching the four authorized attempts.
- Whole staged session: search-call counts were not used as a credit proxy; five enrichments were attempted, one per bucket, and account usage moved 240 → 245.
- Canonical outcomes: five imported candidates, zero qualified, zero actionable, zero drafts.
- Per-operation observed consumption: unknown for all five attempts; conservative authorized exposure: five.
- Offline reassessment: zero Apollo calls, zero Gmail calls, all five outcome anomaly counts zero, session complete with no next bucket.
- Production operational and recruiter database hashes were unchanged from the pre-continuation snapshots.
- No production migration, restart, feature activation, database write, Gmail draft, or email occurred.

The live evidence supports the existing fail-closed design. It does not support production activation by itself: activation still requires a separate explicit decision, controlled production migration/configuration, and deployment safeguards.

## Independent read-only review

Verdict: **PASS with no critical, high, or medium findings.**

The reviewer made no provider, Gmail, database-write, or repository-edit action. Read-only inspection independently confirmed both datastore integrity checks, operational schema `0022`, recruiter schema `0011`, five ordered one-attempt outcomes, distinct provider identities, exact parent/child reconciliation, unknown observed consumption at every canonical layer, account-ending checkpoints 241/242/243/244/245, zero anomalies, zero qualified/actionable candidates, zero drafts, and unchanged protected communication/trust fingerprints. Production database hashes matched the pre-run values exactly.

The reviewer specifically confirmed that the manager result was a safe fail-closed scope mismatch rather than a bypass. The only informational limitation was that no live candidate legitimately reached renderable outreach, so the run validated live provider/accounting/persistence/trust/scope safety but did not exercise live message quality.

## Isolated positive-path follow-up — 2026-10-06

Headquarters explicitly approved the exact reviewed operating-employer identity for the existing recruiter record after reviewing official company terms, nationwide operating materials, and careers evidence. No evidence indicated a staffing, recruiting-service, or executive-search business.

The normal audited company-trust command ran only against the isolated validation copy. It used the stable provider-scoped company identity, exact reviewed domain, expected version zero, a deterministic command identity, local-operator actor, explicit reason, and public-evidence source reference. The resulting audit and current view reconciled exactly at version one:

`unverified → trusted-operating`

Without reimport or provider activity, current projection changed the recruiter from rejected/review-required to `eligible`, accepted the Recruiters bucket, accepted the recruiter classification, and removed every gate failure. The stored imported snapshot remained byte-for-byte unchanged; only current trust projection changed.

The Recruiters reserve changed from zero to one actionable company. The normal scoped Add Drafts path then selected that recruiter, persisted exactly one local review draft, and consumed the available reserve into the active queue. Its deterministic request replay returned the same result. Replacement supply was unavailable afterward because there was no second eligible recruiter; no candidate was promoted to manufacture a replacement path.

The isolated copy had one active resume record labeled `General Resume`. It was explicitly configured as the recruiter default before generation. The draft selected that exact active metadata record, and the pure local approval projection validated that its attachment metadata matched the message's resume claim. PDF bytes were not read, Gmail MIME was not created, and no Gmail operation was persisted. The UI retains the existing ability to choose another active resume or None, with attachment-copy consistency enforced before approval; historical Gmail snapshots were unchanged.

The generated draft used the canonical Recruiters template, was 58 words, and made no open-requisition or personal hiring-ownership claim. A fresh independent reviewer returned **PASS** after confirming the user-supplied biographical facts and selected attachment evidence. The reviewer found the copy truthful, concise, natural, relevant to a general internal recruiter, correctly substituted, and free of em dashes, corporate/AI clichés, or unsupported claims.

The other four live records remained fail-closed and non-renderable: the Peer remained rejected by independent gates; the Manager, Executive, and CEO/president still lacked responsibility evidence and remained review-required or rejected. No manual promotion was attempted.

Validation passed typecheck, lint, 52 focused company-trust/bucket/draft/UI tests, and the complete 1,152-test suite. This follow-up made zero Apollo calls, zero Gmail calls or drafts, zero emails, and zero production mutations, migrations, restarts, or feature activations.

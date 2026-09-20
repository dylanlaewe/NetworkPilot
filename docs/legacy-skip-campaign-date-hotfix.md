# Legacy Skip campaign-date hotfix

Base: `9977364ec864171866f7eaaa191ff2093bc34ca9`.
Branch: `hotfix/legacy-skip-campaign-date`. No UI changes or migration.

## Root cause and authoritative rule

The legacy queue keyed approved drafts to the UTC date of the immutable approval snapshot, while disposition persistence fell back to `localCampaignDate(now)`. That scheduling helper uses New York time and advances weekends to Monday. A Sunday UTC approval could therefore project under `2026-09-20`, but Skip would persist under `2026-09-21`. Exact-date dismissal could not match. Using the current date also made retries on later dates inconsistent.

Both paths now use `draftCampaignDate`:

1. A matching persisted generation is authoritative, including a carried draft. Preserve its campaign date exactly. Use the same generation ordering as queue projection.
2. Without a matching generation, an approved draft uses `approvedAt.slice(0,10)` from its immutable snapshot. This retains the existing UTC approval-date convention, including Saturdays/Sundays, and does not advance it to Monday.
3. An unapproved legacy recommendation retains its existing current UTC date fallback.

The existing `localCampaignDate` scheduling helper is deliberately unchanged. Scheduling the next weekday is not the same operation as dismissing an already-approved historical draft. No scheduling, generation, sourcing, provider, company, recruiter, qualification or UI behavior was redesigned.

Queue and disposition persistence also share the operation read ordering, so retries resolve the same approval even after it is no longer visible. No historical disposition/audit is rewritten. A subsequent explicit Skip can add the correct key while retaining a previously misdated record. Permanent exclusion remains date-independent in dismissal matching; temporary Skip creates no suppression or contact event.

## Regression coverage

Ten isolated SQLite tests cover Saturday, Sunday, weekday, the UTC/New York boundary from the reported case, repeated Skip on a later weekday, stored generated dates, carried generated dates, an unrelated generation, permanent exclusion, historical misdated records/audits, unknown IDs and no contact/cooldown/sent/suppression side effects from Skip. Provider networking is prohibited by a throwing `fetch` stub and verified unused.

## Historical integrity verification

Read-only backups of the configured default operational store and secondary recruiter store were inspected in an isolated temporary workspace. Neither production store was opened through a writable repository.

Before/after hotfix comparisons at a fixed time matched exactly:

- All 37 operational tables, comparing row contents via SHA-256 digests.
- Full queue projections: 17 records, with 12 active drafts.
- All 26 outreach operator entries and their historical state.
- All three stored generations and their immutable draft content.
- Sent, audit, suppression and outreach records were unchanged.

No production data, identifiers, emails or private database copies are committed. All 18 production database/WAL file hashes matched the pre-task baseline. Production runtime/build was not restarted or changed.

## Validation

- `npm test`: 606 passing tests across 66 files (10 new regressions).
- Typecheck and lint: passed, zero lint warnings.
- No-remote-font and Gmail-send safety guards: passed.
- `npm run build`: passed using the same source in an isolated workspace so the running production build remained untouched.
- Production and full dependency audits: zero vulnerabilities.
- `git diff --check`: passed.
- Apollo calls, Gmail calls, real sends and production database mutations: zero.

## Preserved frontend checkpoint

The entire tracked/untracked UI work remains in Git stash commit `f9e8065fe5f29163eaef8d3c63695e9f4c62d111`, labeled `NetworkPilot UI overhaul checkpoint before legacy skip hotfix`, created on `feat/ui-overhaul-night-pass`. It was not applied to this branch. Frontend work remains paused pending Headquarters direction.

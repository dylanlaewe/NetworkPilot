# UI overhaul night pass

Base: `9c37cba8f3685c9e64befec7e8a314ec24956f60`. Presentation-only work on `feat/ui-overhaul-night-pass`; no provider, lifecycle, selection, migration or production-data changes. The preserved UI stash `f9e8065fe5f29163eaef8d3c63695e9f4c62d111` applied without conflicts after fast-forwarding the branch to corrected main. The stash is retained.

## Pre-change hierarchy audit

Recorded before changing product code, from the four route implementations, shared styles and the deployed visual baseline:

- Global shell: successive CSS override layers mix 34–44px headings, large section spacing and competing breakpoints. Content stretches across wide screens; navigation and content use different gutters. Native controls have inconsistent density.
- Today: large header plus full-width action and supply sections create unused vertical space. No compact outreach-outcome summary. Supply and exhausted-budget explanation compete with useful work; generic connection guidance can suggest reconnecting for unrelated readiness failures.
- Drafts: 74px minimum rows grow beyond 100px with secondary actions. Add is as visually strong as row Review. Count/actions scroll away. On medium widths role placement is controlled by conflicting rules. Secondary controls compete with the primary workflow; the person is not a detail link.
- Review: a metadata sidebar competes with the message. Nested heading, kicker and form labels make the email look like an administrative form. Subject and body have equal box treatment; approval lacks a dedicated footer.
- Sent: dense title/company strings are hard to scan. An absolute detail panel can clip inside the scrolling table. Narrow styles hide elapsed time. A filtered empty result incorrectly says nothing has ever been sent.
- Candidates: five equally weighted filters consume width and long location values stretch controls. Narrow styles hide track and location. Company/title hierarchy is weak and availability has little visual separation. There is no clear filter reset affordance.
- Feedback/loading: large full-width success strips and centered loading-page typography interrupt continuity. Browser redirects can reset queue position. Empty-state copy is inconsistent.
- Accessibility: focus is present but muted; small disclosure targets and unlabeled mobile table values impede keyboard/visual scanning. No main-content skip link.

## Scope decisions

Preserve every existing server action, action argument, qualification result, cap and lifecycle decision. Queue continuity may store only scroll/focus hints in browser session storage. No backend workaround will be added. QA uses synthetic records in a separate temporary application copy with Gmail/Apollo disabled. Production port 3000 and its databases stay untouched.

## Completed implementation and isolated production-build QA

Implemented a compact scoped shell, Today action/outreach/supply layout, sticky dense Drafts queue, email-like review editor, expandable Sent records, responsive Candidates filters/metadata, quiet feedback, keyboard skip/focus affordances and transient browser-only queue-position restoration. Existing server actions and arguments remain unchanged. System and diagnostics remain available in the secondary navigation; their screens are not restyled.

Browser QA used a synthetic database and isolated production build on port 3110, with both providers disabled and no secret configuration copied. All four pages and review were captured at 1440×900, 1280×800, 1024×768 and 680×900. Draft counts 1, 5, 15 and 30 were exercised across all four sizes (16 combinations), with no document-level horizontal overflow. Desktop ready rows are 72px; narrow ready rows are approximately 93px. Actual screenshot inspection covered Today, 15+ Drafts, review, Sent, Candidates, Add Drafts, expanded Sent, exhausted Apollo budget, and narrow layouts. Evidence is in ignored `artifacts/ui-overhaul-night-pass/`.

Product filtering and reset worked; narrow Candidates retained role, company, track, location and availability. Sent's Replied filter showed the one matching fictional record; Declined showed the correct filtered-empty message. Expansion remained inline and unclipped. Subject editing and approval worked; an em dash was rejected with a human-readable explanation before a valid edit was approved. Add custom increased the fictional queue from 29 to 30 without replacement or provider use, even with the daily Apollo budget exhausted. Generated Skip removed the row and focused the next action; replacement added one row. Browser reading position is retained, not pixel-perfect: sticky layout/feedback changes can shift the next row slightly, and normal end-of-document clamping applies. No live send was used to test continuity; removal geometry and existing mocked send regressions cover that path.

Keyboard focus has a visible 3px outline, skip-to-content focuses the workspace heading, edit/filter/outcome controls have labels, and disabled Gmail draft creation retains its explicit reason. Browser console inspection returned no warnings or errors. Gmail-ready and uncertain-send states remain covered by existing mocked component/application tests; the QA browser intentionally never had live provider readiness.

Visual corrections during QA: removed inherited dark review footer and bold body text; aligned footer helper ordering; kept the narrow More menu within the viewport; reduced narrow queue row height; preserved metadata previously hidden on narrow Candidates; restored top-of-page navigation into review. Screenshot artifacts are local, ignored, fictional-only evidence, not production data.

### Prior backend finding — now resolved on main and revalidated

The empty-queue fixture reset removed `daily_refresh_runs` while retaining an approved operation, exercising the legacy/no-generation path. Clicking Skip reported success but that approved row remained visible.

- Fictional approved snapshot: `approvedAt = 2026-09-20T00:49:52.181Z`.
- Persisted fictional skip: `campaign_date = 2026-09-21`.
- Generation count: zero.
- `loadQueueReviews` in `src/infrastructure/sqlite/draft-queue.ts` assigns an operation without a generation the date `snapshot.approvedAt.slice(0,10)` (2026-09-20).
- `recordDraftDisposition` in `src/infrastructure/sqlite/daily-refresh.ts` falls back to `localCampaignDate(at)` when no matching generation exists. That helper uses New York time and advances weekends to the next weekday (2026-09-21).
- `draftIsDismissed` compares these dates exactly for temporary skips, so the successful write does not dismiss this row.

The separately approved legacy campaign-date hotfix is now part of the base. This UI branch does not modify those backend files or add a frontend hiding workaround. Repeating Skip in the same isolated no-generation approved-operation fixture reported success and removed the row. SHA-256 snapshots of Gmail operations, manual outreach records/audits, outreach events, both suppression tables and imported candidates were identical before and after. Legacy Saturday/Sunday/weekday, stored generated-date precedence, repeat idempotency, durable exclusion and historical misdated-audit preservation all passed the merged integration tests. Browser permanent exclusion also removed its fictional row and created only the intended candidate suppression.

### Final validation

- 624 tests passed across 68 files (18 additional UI tests, including browser-position validation and rendered Sent behavior).
- Typecheck and lint passed; zero lint warnings.
- No-remote-font and Gmail-send safety guards passed.
- Production and full dependency audits: zero vulnerabilities.
- `git diff --check` passed.
- Production build passed in an isolated full-dependency workspace. An initial attempt with a dependency symlink outside the temporary Turbopack root failed before compilation; copying dependencies locally resolved the harness issue without product/configuration changes.
- All 18 baseline SQLite/database-WAL file hashes matched exactly. Production server/build were not restarted or changed.
- Zero live Apollo calls, Gmail calls or emails sent. Only fictional QA data was changed.
- Only frontend files, frontend tests and this QA report are included. No migration, provider, server-action, selection, qualification, cap or lifecycle implementation changed. No production restart, automatic merge or release tag.

## Remaining limitations

No blocking visual defects remain in the required four viewport sizes. Queue restoration is a short-lived browser convenience, not persisted workflow state; browsers that deny session storage use normal navigation. Screenshots contain synthetic people only. Live Gmail/Apollo workflows were deliberately not exercised. Recommend merge after Headquarters review.

# Additive Drafts and intent-aware outreach correction

Starting point: `63a14e562cd79f91b847f57e4583c02287fa45c0` on `hotfix/draft-control-and-real-reserve`. Offline correction only; not merged.

## Diagnosis: actual action and persistence path

The form submitted a new-batch count; neither the planner nor its caller subtracted the active count to create a target queue size. The defect was queue projection, not subtraction arithmetic:

1. Before the first persisted generation, historical pilot recommendations supplied the visible queue.
2. The first Add persisted only the newly selected people.
3. Once a generation existed, the renderer stopped using fallback recommendations. Unapproved fallback drafts disappeared instead of being carried forward.
4. Existing approved Gmail operations had a separate hydration path, making the result look inconsistent depending on the prior queue's composition.

The same fallback-to-generation boundary remained in `63a14e5`, despite the earlier offline tests passing. Those tests started with a persisted first batch, so they never exercised the missing boundary. The new regression starts with five implicit pilot recommendations and proves Add 10 preserves them and produces fifteen.

Production was inspected read-only. The configured default datastore was `data/apollo-operational-scale-enrichment.sqlite`. Its three persisted generations for campaign date 2026-09-21 requested/selected 5/5, 1/1 and 10/6. All reported 18 reserve candidates; none stored draft-review snapshots. The Add 10 really selected six, not ten. A raw reserve count was not the post-exclusion, unique-company capacity available to this Add operation.

The older `0023a5d` server action explicitly caught `draft-reserve-empty` and redirected to `/candidates`. Its projection replaced fallback IDs once refresh IDs existed. The production Next process started at 18:38:29 EDT, before `63a14e5` was committed at 19:33:49. This is evidence of a runtime/version discrepancy, not proof of an exact in-memory build SHA or of the historical browser's precise before/after count. Production was not restarted or repaired during diagnosis.

## Corrected path

`AddDraftsControl` submits `additionalDraftCount` → `generateMoreDrafts` → `runNextDraftBatchFromReserve` → active queue plus filtered reserve → transactional persistence → revalidate Today/Drafts/Sent/Candidates → return to `/drafts` with explicit addition feedback.

- Add always requests NEW drafts. Existing active candidates, occupied companies, prior operations, used/skipped candidates, suppression and existing qualification gates remain excluded.
- The first persisted generation carries the visible legacy reviews, preserving their content, IDs and order.
- New generations retain their immutable review snapshots. Historical approved operation content and legacy catalog metadata are not regenerated or relabeled with a new intent.
- Results report requested, actually added, active-before, active-after and remaining unique-company capacity.
- Zero new drafts creates no empty generation and retains the queue.
- Partial/zero results stay on Drafts. Refresh Candidates is an explicit link, never an automatic redirect.
- No search, enrichment, credit consumption or provider call occurs in Add Drafts.

## Actual browser QA

Isolated source copy and fictional 90-person reserve; no environment secret files or operational database copied. Gmail/Apollo disabled. Chrome used the real form, Next server action, SQLite persistence and re-render on localhost:3106. External browser requests were blocked; zero were attempted. Production localhost:3000 was not interacted with.

| Active before | Browser control | Actually added | Active after | Result |
|---:|---|---:|---:|---|
| 5 | Add 10 | 10 | 15 | Stayed on Drafts |
| 15 | Add 5 | 5 | 20 | Stayed on Drafts |
| 20 | Custom 7 | 7 | 27 | Stayed on Drafts |
| 27 | Add 10; only 3 eligible remain | 3 | 30 | Stayed on Drafts; partial message and Refresh Candidates |
| 30 | Stale-page Add 10; zero eligible | 0 | 30 | Stayed on Drafts; zero-result message and Refresh Candidates |

Exact partial message: `3 drafts added. Your available candidate reserve is exhausted.`

Exact zero message: `No eligible candidates are available right now.`

No browser page errors. Desktop 1440px and narrow 390px screenshots were visually inspected: count, feedback and explicit Refresh link remain visible and readable. Temporary screenshots are outside the repository.

SQLite regressions separately cover 5+5=10, 5+10=15, 10+5=15, 10+10=20, 10+1=11, 10+20=30, 8+5=13, 12+7=19, and 5+request10/available6=11, followed by a zero-result retry. They assert existing snapshot retention, not just total counts.

## Intent architecture and copy

`outreach-intent-v1` is a deterministic domain-level copy decision, separate from qualification, sourcing and scoring. It records an intent, explanation and any structured reviewed evidence references. Selection informs template context/reason/CTA; it does not change who qualifies.

- **Experience-forward:** related BI/data/analytics/data engineering, or adjacent automation/integration/software work. A data function in consulting or finance does not automatically imply an industry career transition. Technical adjacency does not claim specialist ML expertise.
- **Career-transition:** Product, project/program, financial/investment and commodities/energy work outside the existing background. Reviewed hands-on data/systems evidence can make a program contact adjacent; unreviewed evidence cannot. No recipient career history is fabricated.
- **Recruiter-opportunity:** concise factual background and one opportunity-focused question. Product recruiters receive a short positive transition plus a Product-specific subject.
- **Product:** new technology, deciding what to build, people, priorities and cross-functional work. Three controlled stories/questions; no claimed PM employment or negative engineering language.
- **Project/program:** technical coordination and operational problem solving toward broader ownership, not claimed formal management employment.
- **Finance/energy:** transferable technical/data background and concrete first-role or break-in questions, not claimed investment/trading experience.

Versions: `dylan-outreach-method-v4`, `catalog-v9-dylan-outreach-method-v4` (template 9.0.0), `recruiter-catalog-v6-dylan-outreach-method-v4` and `recruiter-subject-v6`. Optional intent metadata persists with new reviews/approvals; legacy snapshots remain valid without it. No migration rewrites old messages.

## Forty-message review

Run `npm run copy:review:offline`. The command is pure: no database, provider, tokens or real recipients. The [complete review](outreach-intent-v1-review.md) contains every role, company type, intent and reason, subject, body, CTA and word count.

Distribution: 8 Data/Analytics, 5 Data Engineering, 5 Software/AI, 8 Product, 4 Project/Program, 4 Finance/Investment, 3 Commodities/Energy, 3 recruiters. All forty were inspected; all are 77–96 words, contain exactly one CTA, and pass voice validation. Forty distinct full bodies and twenty CTA strings. Repeated phrasing across controlled variants is deliberate; this is not a claim of forty bespoke biographies.

Concrete review corrections:

- Data Engineer titles originally fell through generic `engineer` wording into software framing. Data function now takes priority in copy selection; sourcing/classification is unchanged.
- Product's abstract systems framing was replaced with the user's positive, specific motivation. Repeated “drawn/drawing” language was removed.
- Product recruiter subjects now refer to Product roles rather than generic technical hiring.
- Energy wording no longer repeats “market decisions” in adjacent reason/CTA paragraphs.
- An adjacent-work reason was changed from an assumed recipient career progression to an open question about how they approach data projects.
- Consulting analytics retains practical experience-forward framing, with a dedicated regression for the user's preferred style.

Sample sections in the full review: Product 19–26; project/program 27–30; finance 31–34; commodities/energy 35–37; experience-forward 1–18; recruiters 38–40. No apologetic transition claims, invented formal PM roles, generic praise, em dashes, or false familiarity were found in the final batch. Skill context remains one compact paragraph rather than a full resume.

## Validation and integrity

- `npm test`: 596 tests passed, 65 files, including the actual Add server action for full, partial and zero additions.
- `npm run typecheck`: passed.
- `npm run lint`: passed, zero warnings.
- `npm run check:no-remote-fonts`: passed.
- `npm run check:no-email-send`: passed; only existing explicit approved Gmail draft-send capability, no generic/bulk/background/SMTP paths.
- `npm run build`: passed with identical source in an isolated directory, both providers disabled. The initial isolated build rejected an out-of-root node_modules symlink; copying the existing installed dependencies into the isolated directory resolved the test-harness issue without code or configuration changes.
- `npm audit --omit=dev` and full `npm audit`: zero vulnerabilities.
- `git diff --check`: passed.
- All ten repository-local SQLite base files and their existing WAL contents match the pre-task SHA-256 baseline. The production server/build were left running and unchanged. No real approvals, dispositions, outreach outcomes, drafts or sends were recorded.
- Apollo calls: **0**. Gmail calls: **0**. Real emails: **0**.

## Before the next live refresh

Recommend Headquarters review/approval of this correction before deployment. After approval, deliberately rebuild/restart the production process so it serves the reviewed version, then check the visible active queue and new Add feedback. Existing approved/sent messages retain their original text; the new catalog applies to new generation, not retrospective rewriting. Do not infer a need for a live refresh from a generic raw reserve count. No live refresh or merge was performed in this task.

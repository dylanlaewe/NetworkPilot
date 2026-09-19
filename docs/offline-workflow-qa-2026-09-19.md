# Offline workflow QA and refresh readiness

## Scope and isolation

Starting branch: `hotfix/draft-control-and-real-reserve`, starting commit
`0023a5db8758dffdb53b1440b0d9118af31311b2`. No merge or production refresh.

All mutations used temporary fictional SQLite databases or in-memory stores.
The browser used a separate source copy, separate Next server on port 3105,
90 synthetic people, reserved `.example.invalid` addresses, and both provider
flags set to false. Browser requests outside localhost were blocked. Provider
contract tests injected mock transports. No real account was connected.

The fixture intentionally exercises the authorized-provider normalization path;
its records are synthetic, not actual authorized-provider responses. Do not
import this QA fixture into an operational datastore.

## Demonstrated defects and corrections

- Draft projection used only the newest generation and could replace earlier
  unsent work, regenerate copy, or fall back to unrelated recommendations after
  the entire selected batch was skipped. Projection now accumulates generations
  in stable order. New batches store generated reviews in the existing result
  JSON, and approved operations hydrate their immutable persisted content.
- Primary-store recruiters and the separate recruiter reserve were not handled
  consistently across selection and display. They now share a read-only loader;
  refreshed primary records take precedence. An explicit
  `NETWORKPILOT_RECRUITER_DATABASE_PATH` override isolates tests without scanning
  other databases. The existing operational default is unchanged.
- Repeated one-person replacements skewed toward professionals. Selection now
  targets approximately 60/40 over the active queue, not just the next request.
  Candidate and company uniqueness and qualification remain mandatory. Preferred
  employers retain score priority within a 40% soft concentration limit; the
  preference relaxes only when qualified discovered supply cannot fill a request.
- Add buttons and the custom input shared `count`, causing ambiguous submitted
  values. Quick buttons and custom input now use separate forms.
- Already queued people were counted as unused reserve, including on the next
  day. Reserve counts now exclude active generations and existing operations.
  Rejected recruiters cannot appear available merely because their title matches.
- Three precise Product role IDs were classified but absent from the planning
  registry. Their explicit mappings now reach planning, drafting, and UI filters.
- Skip now validates persisted queue membership, is idempotent, and cannot hide
  an uncertain send. Permanent exclusion cannot be downgraded by a later Skip.
  Replacing an empty reserve stays on Drafts with an explanation.
- Narrow Drafts layouts hid job titles. Titles now remain visible. Skip feedback
  remains visible while scrolling so replacement does not require returning to
  the top of a long queue. System is a secondary gear menu.
- Exhausted sourcing now says candidate refresh is available tomorrow, without
  implying that existing drafts or Gmail outreach are disabled. The displayed
  maximum credits reflects remaining daily exposure, using the New York date.
- A preferred-only legacy search cache could satisfy the shortlist count and
  bypass the existing bounded broad search. A cache missing the existing
  discovered/recruiter allocations no longer suppresses those four search queries.
- Raw employer totals were lost after rejected search rows were discarded. New
  aggregate diagnostics retain them before normalization, including partial runs.

## Stress and browser evidence

The SQLite regression starts with 60 professionals and 30 recruiters, including
20 preferred and 70 discovered employers. It covers Data, Analytics, Data
Engineering, Software, AI/ML, Product, Project/Program, Finance and Strategy.

Generate 5; skip/replace one; skip/replace two; permanently exclude one; add
5, 10, 1 and 20. Result: 40 active drafts, 24 professional/16 recruiter, no duplicate
people or companies, no immediate skipped-person return, permanent exclusion
retained the following day, and unchanged retained message content and order.
Invalid custom counts fail without writing a generation.

Requested counts 1/5/10/20 produce professional/recruiter counts 1/0, 3/2, 6/4,
and 12/8 when supply permits. Insufficient-track fallback does not relax gates.
Qualified preferred employers can still rank above discovered employers.

Actual Chromium QA covered all nine combinations of 1, 5 and 15 drafts at
1440x900, 1280x800 and 680x900. No horizontal overflow. Actual server-action
interactions covered custom 4, Add 10, Skip, Replace, subject editing, approval,
and Add 5/10/custom 1/custom 20, reaching 50 active fictional drafts. Removal
retained the other rows' order and scroll position. Replacement stayed on Drafts.
The narrow-screen replacement prompt was within the viewport after a deep skip.
Today, Candidates and Sent were also inspected; no external browser requests.
With only five unused candidates and an exhausted budget, Today showed both
Add Drafts and the next-day refresh notice. A runtime smooth-scroll warning was
resolved with the matching root HTML attribute. Screenshot captures wait for
hydration and retain the caret to avoid Playwright's temporary caret style being
mistaken for a product hydration mismatch.

Apollo exposure was 20 during review, edit, approval, skip, replacement and
addition. Mocked Gmail creation and send-readiness tests remain independent of
that budget. The real browser deliberately kept Gmail disabled; no live Gmail
action was performed. Sent/CRM remained navigable.

## Product and copy review

All eight titles have deterministic end-to-end coverage: Product Manager,
Associate Product Manager, Technical Product Manager, Product Analyst, Product
Operations, AI Product Manager, Data Product Manager and Platform Product Manager.
Product Recruiter also qualifies in the mock refresh. Copy describes a technical
background and interest in Product, never prior PM employment.

All 27 professional template variants plus Technical, Product and Campus
recruiter examples were generated and individually read. Revised samples were
75–98 words, with exactly one CTA and no em dashes.

Concrete phrases replaced included repeated “caught my attention” openings,
“without overstating experience they haven’t built yet”, “sound product judgment”,
and “intersection of systems, coordination, and dependable execution”. New copy
asks about choosing what to build, keeping changing projects moving, or taking
on larger technical projects. Missing articles in “your work as [title]” were
removed by using “your [title] role”. Simple factual context is retained.

New versions: `catalog-v8-dylan-outreach-method-v3` (templates 8.0.0) and
`recruiter-catalog-v5-dylan-outreach-method-v3` (subjects v5). Existing approved
Gmail snapshots and historical draft rows are never rewritten. Persisted queue
reviews also stay stable across later batch additions. Legacy unsaved previews
use the current renderer until approved; they are not historical approvals.

## One-run refresh observability

Migration `0019_refresh_observability.sql` adds optional aggregate JSON to the
existing refresh event and a progress journal for failed/interrupted runs.
No production migration was applied in this pass.

Stored fields include logical search calls and completed query/page counts;
raw, normalized and unique candidates; raw unique/preferred/discovered employer
counts; unknown-employer rows; shortlist size; enrichment attempts by track and
company kind; verified emails; qualified people by track/kind; total imported
and qualified additions; unique qualified companies; Product additions; observed
credits (nullable), conservative estimated exposure, and rejection frequencies.

Raw unique people use hashed native IDs, including identifiable rejected people.
Raw employer counts deduplicate case-normalized supplied employer names before
normalization; preferred means an exact configured preferred-name match. These
are raw response aggregates, not a company-legitimacy claim. Missing names have
a separate count. Raw hashes, emails, names and native IDs are not persisted in
the aggregate report. Observed usage remains null if it cannot be established;
an estimate is never described as measured provider billing.

Mock validation: four pages returned 36 raw rows, 32 normalized people, 33 unique
native IDs, and 33 raw employers (1 preferred, 32 discovered). The malformed
preferred-company row was retained in aggregates on all four pages. Twenty
mock enrichments produced 15 qualified professionals and 5 recruiters, with
Product candidates included. A failure after two successful enrichments retained
the raw totals, two imports, and the third attempted enrichment in the journal.
An exhausted budget made zero transport requests and wrote no observation.

For the separately authorized refresh, inspect the newest `diagnostics_json`
in `candidate_refresh_events`, and the corresponding status/JSON in
`candidate_refresh_observations` even if the refresh fails. Group rejection
frequencies by count when reporting. These queries can be run read-only.

## Safety and tomorrow recommendation

Final validation: 566 tests in 63 files passed; typecheck and zero-warning lint
passed; local-font and Gmail-send safety checks passed; production build passed;
both npm audits reported zero vulnerabilities; `git diff --check` passed.
The build was run with provider flags off and explicit isolated database paths.
No database artifacts were found in build output.

Production operational, recruiter, search-cache, default-app database and default
WAL SHA-256 values matched their pre-pass values. No production approvals,
suppression changes, outcomes, drafts, migrations or refreshes were performed.
No database, credential, private environment file or real-contact fixture is
included in the commit. Gmail provider implementation is unchanged.

Recommendation: submit this correction for Headquarters review. Only after
approval, deployment/migration and a separately authorized New York budget reset
should one bounded production refresh occur. Capture the new aggregate report
including any failure journal. Do not automatically retry. Offline qualification
does not predict live provider yield. This pass itself authorizes no live run.

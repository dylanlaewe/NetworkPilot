# Product experience overhaul — before baseline

Date: 2026-10-12

Commit: `d05914cdc50c66dc292a4a9265f4e76ff869cdbb`

Environment: isolated integrity-checked copies of the application, operational, and recruiter datastores; Apollo and Gmail disabled.

## Evidence set

The six daily product areas were captured at 1440×900, 1280×800, 390×844, and 360×800. The 24 local screenshots are stored under `artifacts/ux-baseline/` and are intentionally git-ignored because the isolated copy contains production-shaped private data.

Two independent read-only assessments were performed before implementation:

- Assessment A: human-centered design, hierarchy, workflow, and information-density critique.
- Assessment B: browser measurements, accessibility behavior, responsive geometry, and Impeccable detector evidence.

Neither assessor changed files or data or contacted Apollo or Gmail. Assessment A completed before detector findings entered the synthesis.

## Server-render baseline

Seven warmed requests per route were measured against the isolated Next 16 development server. Values below are median time-to-first-byte; payload size is uncompressed HTML/RSC response bytes.

| Route | Median TTFB | Payload |
| --- | ---: | ---: |
| Today | 108 ms | 26.9 KB |
| Drafts | 327 ms | 22.4 KB |
| Candidates | 100 ms | 222.7 KB |
| Sent | 52 ms | 141.1 KB |
| Resumes | 54 ms | 33.7 KB |
| System | 96 ms | 30.8 KB |

Next development logs attribute almost all warmed Drafts latency to application code (typically 293–367 ms, with one 739 ms outlier). Candidates typically spends 82–160 ms in application code. Candidates and Sent also serialize every visible record into the initial page, producing the two largest responses.

Observed client navigation from Today to Drafts took 457 ms. Independent mobile measurement of Candidates to Drafts took 419 ms. Bucket and filter selects use `window.location.assign`, while all main routes force dynamic rendering; there is no pending feedback during these refetches.

A fully synthetic, offline populated queue was then exercised in a separate fixture datastore. Median candidate selection was 100 ms, median draft selection was 216 ms, and median local textarea response was 44 ms through the browser harness. A reserve-only Add Drafts transition took 534 ms end to end (the server action itself ranged from 96–304 ms across measured runs). Local approval took 396 ms end to end while its server action took 33 ms. These fixture operations used no provider and made no network call.

## Release-blocking experience findings

1. **Candidates has no candidate-to-draft action.** An eligible selected person ends at “Eligible for a future plan.” Mobile becomes a full-screen dead end with only Close.
2. **Today overlaps at both required mobile sizes.** The absolute ACTIVE label and index collide with the task title, while the reason truncates.
3. **Drafts clips at 1280×800.** Its 228 px rail plus minimum workspace widths extend the context bar to x=1300 inside a 1280 px viewport; `overflow: hidden` conceals the defect.
4. **Mobile candidate detail breaks keyboard focus.** Focus remains in the obscured list because the fixed detail view has no dialog semantics, focus transfer, inert background, or containment. Close measures about 36×17 px.
5. **Today repeats one candidate-supply state three times.** The page does not reduce to one clear next action, and healthy infrastructure remains permanently prominent.
6. **Drafts contradicts the other pages when empty.** It says both queue and qualified reserve are empty while Today and Candidates report twelve actionable people; the real requirement is to choose a recipient bucket.
7. **Recipient-bucket navigation dominates daily work.** Desktop gives it a 228 px nested rail; mobile spends roughly 105 px on stacked workspace and bucket selectors. Zero-value buckets and legacy migration context receive daily-work prominence.
8. **Candidate information density harms readability.** At 1280 px, 8 px track/bucket labels spill into the title column; long titles and reasons truncate. Mobile hides the decision-critical “Why now” cue entirely.
9. **Small text and touch targets are systemic.** Measured normal-text contrast ranges from 2.97:1 to 3.54:1 in several Drafts/Candidates labels; mobile controls are commonly 17–34 px tall rather than the 44 px product commitment.
10. **Sent is a long storage view, not a prioritized relationship workspace.** Forty-seven relationships create pages over 4,490 px tall, and old “Awaiting reply” records do not become an actionable Today state.
11. **Shell implementation is split.** Drafts owns a parallel shell and CSS system while the other primary pages use `NetworkCommandShell`, contributing to inconsistent sizing and the Drafts-only clipping defect.
12. **Candidate selection automation exposed an interaction dead zone.** Browser-level activation visibly focused candidate options but did not change the selected detail or `aria-selected` state. This must be verified and corrected as part of keyboard/pointer acceptance rather than treated only as a timing number.

## Impeccable detector result

The project-local pinned Impeccable detector returned nine `side-tab` warnings. Several are contextual false positives because a side border communicates safety or error state; repeated decorative stripes and the persistent Drafts dock treatment still contribute to administrative visual sameness. The detector did not identify the higher-impact workflow, focus, latency, and geometry failures above, so its output is advisory rather than the design authority.

## What the incumbent gets right

- Draft state progression and explicit final-send confirmation are conceptually sound.
- Gmail uncertainty reconciliation remains visible and fail-closed.
- The message has more prominence than older operational views.
- No document-level horizontal overflow appeared outside Drafts at the required viewports.
- Visible focus outlines are strong where focus reaches the intended control.

## Implementation acceptance contract

- One candidate-specific **Create draft** action, with the same placement showing a precise blocker when unavailable.
- Drafts becomes a calm two-pane workspace with recipient and writing dominant; evidence and diagnostics move behind Details.
- Local approval and Gmail-draft creation become one explicit reviewed action when safe, while send remains separate and confirmed.
- Page-local bucket filters replace the nested workflow-dominating navigation.
- Today shows one primary recommendation and one primary action; healthy infrastructure recedes.
- Sent prioritizes relationship state and the next relevant action without inventing unsupported follow-up automation.
- No overlap, clipping, or horizontal page overflow at required sizes, 125% zoom, or long-content fixtures.
- Mobile detail views use intentional focus, escape/back behavior, and ≥44 px primary controls.
- Navigation, selection, editing, and mutations provide immediate truthful pending/success/error feedback.
- Provider spend, company trust, contact policy, human approval, send confirmation, uncertainty handling, history, and migrations remain unchanged.

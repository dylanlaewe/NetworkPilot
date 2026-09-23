# Prototype Acceptance Results

## Result

The isolated five-bucket experience passes the fictional prototype walkthrough after independent QA found and verified fixes for four defects. It runs at `http://localhost:3105/design-lab/five-bucket` from the separate `design/five-bucket-experience` worktree.

## Walkthrough evidence

1. Drafts exposes expandable All plus five bucket views with accurate unique-person counts.
2. Recruiters began with two active drafts. Add 5 appended five same-bucket drafts while preserving prior IDs, order, content, edits, and attachments.
3. New recruiter drafts selected `General Resume · v2 · synthetic` by default.
4. An edited message survived switching to another bucket and back.
5. Removing the attachment displayed a copy mismatch and blocked approval until the operator explicitly accepted removal of the attachment claim.
6. Skip removed active work without contact, cooldown, or suppression. Replace used same-bucket reserve at the same position and explained a later shortage. Permanent exclusion required confirmation and did not claim contact.
7. Simulated approval froze the reviewed message/attachment, simulated draft creation remained a separate step, and simulated send moved exactly one record from Drafts to Sent.
8. Manager copy retained the approved canonical wording and was approvable with zero question marks. Executive and CEO/president copy remained distinct and retained the pay-time-forward sentence.
9. Recruiter Find More produced deterministic partial results of 2/5 and 1/5 while consuming one shared 10-unit allowance. Exhaustion disabled further discovery across buckets without disabling queue work.
10. A reviewed ambiguous VP fixture moved to Peers & practitioners without duplication, lost history, bypassed restriction, or rewritten historical Sent bucket/message evidence.
11. Mobile used dedicated section/bucket pickers. Review open/back and dialog dismissal restored keyboard focus after QA correction.

## Responsive and accessibility result

Browser checks covered 1440×900, 1280×800, 390×844, and 360×800. Tested states had no horizontal document overflow or clipped interactive controls. Long bucket labels remained readable. Disclosure controls expose `aria-expanded` and `aria-controls`; keyboard Enter/Space toggles were verified. Dialogs supported Escape, Cancel, focus containment, and post-close focus restoration. Reduced-motion rules are present in source; the available browser harness did not expose media emulation, so effective reduced-motion rendering remains source-verified only.

## Corrected QA findings

- A historical ambiguity fixture initially contained the wrong recipient name and an unsupported leadership claim. Fixture construction and regression coverage now preserve a truthful historical alternative.
- Mobile queue/review and dialog dismissal initially lost keyboard focus. Stable row/trigger restoration now passes browser retest.
- Early-career filtering initially allowed Add Drafts to create hidden experienced-peer drafts. Add, Replace, Find More, capacity, and shortage reporting now honor the active early-career scope.
- Pending discovery initially showed allowance as both reserved and fully available. It now reports available-after-reservation plus reserved units.

## Screenshot index

- `screenshots/desktop-bucket-navigation.png`
- `screenshots/desktop-recruiter-review.png`
- `screenshots/desktop-manager-review.png`
- `screenshots/desktop-executive-review.png`
- `screenshots/desktop-ceo-president-review.png`
- `screenshots/desktop-candidates-find-more.png`
- `screenshots/desktop-sent-relationship.png`
- `screenshots/desktop-shortage-budget-exhausted.png`
- `screenshots/desktop-1280-workspace.png`
- `screenshots/mobile-bucket-navigation.png`
- `screenshots/mobile-recruiter-review.png`
- `screenshots/mobile-small-review.png`

The captures contain only fictional people/companies, `.invalid` addresses, and synthetic resume metadata.

## Recording

No supported local QA recording/export capability was available in the browser harness. The screenshot set and independent findings provide the review evidence; nothing was uploaded externally.

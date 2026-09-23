# Bucket and Interaction Specification

## Classification semantics

| Bucket | Positive evidence | Fail-closed / review-needed examples |
| --- | --- | --- |
| Recruiters | Recruiting is the relevant function, regardless of seniority | Generic HR, unclear agency relationship, unsupported requisition ownership |
| Peers & practitioners | Early-career employees or experienced individual contributors | Unsupported claim that the person recently found a first role |
| Managers & team leaders | Verified team or people leadership relevant to Dylan's target field | Manager title alone does not prove hiring authority |
| Executives | Verified executive responsibility and function | VP title alone; executive recruiter remains Recruiters |
| CEOs & presidents | Verified company-wide CEO/president context | Division president without explicit division context |

An operator-reviewed correction updates the current classification once. It preserves record identity, exclusions, cooldown/contact history, and historical sent message/bucket snapshots.

## Navigation and context

Drafts, Sent, and Candidates each retain their own selected bucket. All means a unique union, not concatenated duplicates. Desktop uses accessible disclosure controls with `aria-expanded`; mobile uses a section/bucket picker. Counts are calculated from the records currently represented by that section.

## Add Drafts

1. Scope the request to the selected bucket.
2. Display total reserve and actionable capacity separately.
3. Accept preset 5, preset 10, or custom 1–20 additional drafts.
4. Exclude active people, contacted people, excluded/suppressed people, and company-conflicting records.
5. Preserve existing record IDs, edits, attachments, order, and selection.
6. Append as many eligible records as available and report any shortfall.
7. Never invoke the simulated provider path.

## Find More

1. Scope provider simulation to the selected bucket.
2. Preview the maximum shared-budget usage before confirmation.
3. Prevent duplicate concurrent work and repeated charge for one logical request.
4. Add deterministic mock candidates and report actual additions, rejections, shortfall, and remaining shared budget.
5. Keep the selected bucket visible even when zero qualify.

## Queue controls

- **Skip for now:** remove the draft from active work, add it to a session-level skipped set, and avoid immediate resurfacing. No contact, suppression, or cooldown.
- **Replace:** remove the current draft and fill its queue position from an eligible reserve record in the same bucket. Explain an empty same-bucket reserve.
- **Don't show again:** show an explicit confirmation, remove active work, and exclude the person globally. No contact claim.

## Draft and lifecycle controls

Edits live with the record, not the current view. Navigation cannot discard them. A draft may be approved only with resolved placeholders, supported claims, safe subject/recipient handling, one primary ask, and consistent attachment language. Approval freezes message and attachment metadata. Mock Gmail draft creation follows approval. Mock send follows mock draft creation and moves exactly one immutable record from Drafts to Sent. Pending, confirmed, blocked, and uncertain remain visually distinct.

## Shared constraints

Every bucket consumes one shared mock budget. Bucket switching does not reset it. Person uniqueness and company-contact policy are global. Historical sent records retain their original bucket and message even if the current candidate classification is corrected later.

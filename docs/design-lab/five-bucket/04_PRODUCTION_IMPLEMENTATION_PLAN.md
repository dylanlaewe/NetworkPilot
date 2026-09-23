# Production Implementation Plan (Post-Prototype Only)

This plan is intentionally non-executable. It identifies the deliberate production decisions required before any five-bucket migration.

## Domain and compatibility gates

1. Add a provider-independent recipient-bucket value that is separate from existing Professional/Recruiter track, role family, title, function, persona, and lifecycle.
2. Define versioned classification evidence and review-needed states. Preserve current hard consent, verification, prior-contact, suppression, and company constraints.
3. Resolve the current five-year Professional experience gate for early-career peer contacts without weakening recruiter or professional eligibility globally.
4. Revisit executive exclusions through a separate reviewed classifier; do not infer executive responsibility from title tokens alone.
5. Specify track-to-bucket compatibility, including recruiter titles at executive seniority and professional contacts with recruiting-adjacent work.
6. Snapshot bucket version/evidence in new plans, drafts, approvals, and outreach. Historical rows retain their stored track/message interpretation and receive no retroactive bucket rewrite.

## Application and persistence

1. Extend provider-neutral read models and repository interfaces before altering SQLite.
2. Add a migration only after compatibility fixtures prove old records remain readable and immutable.
3. Make queue actions and bucket correction transactional and auditable. Correction must preserve candidate identity, outreach history, suppression, cooldown, and immutable message snapshots.
4. Keep provider budgets account-wide and shared across buckets. A scoped request reserves from the same persisted authorization and idempotency model.
5. Evolve Add Drafts to accept an optional bucket constraint while preserving global person/company policies and reserve-only behavior.

## Copy and resume policy

1. Store canonical prose as versioned catalog fixtures with explicit personalization slots.
2. Change CTA validation so one primary invitation is valid independently of question-mark count; retain placeholder, unsupported-claim, subject, attachment, and identity checks.
3. Introduce a recruiter default-resume preference only after defining missing/inactive behavior. New recruiter drafts may inherit it; existing drafts and approved snapshots may not.
4. Freeze attachment metadata at approval and preserve historical bytes/version evidence under the existing Resume Library rules.

## UI rollout

1. Introduce bucket selection in read models, then Drafts, Candidates, and Sent behind a local feature boundary.
2. Validate desktop/mobile navigation, edit continuity, queue position, focus, and count accuracy against real-shaped synthetic fixtures.
3. Keep provider simulation and production provider construction separate. Production Find More must retain existing explicit exposure confirmation and bounded accounting.
4. Roll out only after migration rehearsal, historical snapshot checks, accessibility review, and controlled operational-state verification.

## Decisions still requiring product approval

- Exact evidence threshold for Managers versus Executives.
- Whether early-career peer outreach changes eligibility or uses a separate reviewed lane.
- Company cooldown behavior for non-contacting queue actions remains unchanged; any bucket-specific variance would need explicit approval.
- Whether recruiter defaults are global or lane-specific when multiple active resumes exist.
- Whether ambiguous classification blocks drafting or permits a clearly labeled review-only draft.

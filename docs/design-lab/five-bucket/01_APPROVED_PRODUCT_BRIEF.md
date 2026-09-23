# Five-Bucket Experience: Approved Prototype Brief

## Status and boundary

This package explores a five-bucket relationship workflow without changing NetworkPilot production behavior. It uses deterministic fictional people, `.invalid` addresses, synthetic resume metadata, and in-memory mock operations. It must not load operational databases, resume bytes, provider credentials, OAuth, Keychain, Gmail, Apollo, or production server actions.

The five recipient buckets are:

1. Recruiters
2. Peers & practitioners
3. Managers & team leaders
4. Executives
5. CEOs & presidents

The buckets describe outreach intent, not human value or prestige. Recipient bucket, title, function, experience evidence, company context, target field, outreach intent, and lifecycle remain separate facts. Insufficient classification evidence is review-needed rather than a confident guess.

## Experience goals

The prototype must make six questions easy to answer:

- Who is the intended recipient?
- Why does this relationship strategy fit?
- What should Dylan say?
- Which synthetic resume, if any, is selected?
- What happens next?
- How can Dylan request more people of this bucket?

Drafts, Sent, and Candidates share one record model and expose expandable bucket navigation with accurate per-view counts. Today remains accessible; Resumes and Settings remain secondary. Mobile uses an intentional bucket picker instead of compressing the desktop rail.

## Interaction contract

- Add Drafts is bucket-specific, reserve-only, additive, and supports 5, 10, or a custom 1–20 request.
- Find More is bucket-specific, visibly simulated, previews shared-budget exposure, reports actual results and shortfalls, and never switches buckets to disguise a shortage.
- Skip removes active work without contact, cooldown, or immediate resurfacing.
- Replace prefers the same bucket, consumes reserve only, preserves queue position, and explains shortage.
- Don't show again requires confirmation and excludes the person globally without marking contact.
- Person uniqueness, active-outreach uniqueness, company policy, prior contact, opt-out, and bounce suppression apply across every bucket.
- Draft editing remains possible before approval. Bucket/contact navigation must not lose edits.
- Approval freezes message and synthetic attachment evidence. Simulated draft creation and sending are explicit later actions.

## Resume policy explored

Synthetic metadata represents an active General Resume, an inactive historical General Resume, and an optional active Product Resume. New recruiter drafts select the configured active default visibly. Other buckets default to no attachment. Removing a recruiter attachment exposes the copy mismatch and requires a deliberate copy correction or attachment restoration. Changing the default affects future drafts only.

## Design direction

The prototype extends Network Command: calm light surfaces, restrained green identity, people first, writing central, mechanics quiet. It avoids prestige scores, five competing bucket colors, KPI mosaics, decorative gradients, raw provider jargon, and misleading success animation. State-specific primary actions, accessible disclosure controls, responsive composition, preserved focus/scroll, and reduced-motion support are required.

## Production decisions deliberately deferred

The prototype does not change production classification, the five-year professional gate, executive exclusions, track compatibility, historical interpretation, recruiter resume policy, CTA validation, provider budgets, migrations, or targeting. Those items require a separate production review after prototype acceptance.

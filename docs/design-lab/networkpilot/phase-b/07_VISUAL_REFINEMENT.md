# Phase B.1 Visual Refinement

This pass refines the isolated Network Command prototype without changing its approved interaction architecture. It does not describe production behavior.

## Final type scale

| Content | Scale | Treatment |
| --- | --- | --- |
| Product brand | 15 px | Sans, 720 weight, tight tracking |
| Page title | 30–42 px | Sans, 720 weight, compact line height |
| Selected person | 17–26 px | Sans, 740 weight, tight tracking |
| Queue person | 13 px | Sans, 720 weight |
| Company | 9–11 px | Sans, 500 weight, muted |
| Role | 9–12 px | Sans, 650 weight, contextual emphasis |
| Message subject | 20–25 px | Sans, 720 weight, compact line height |
| Message body | 15–16.5 px | Sans, 420 weight, 1.78 line height |
| Operational metadata | 8–10 px | Mono or sans, quiet color and tracking |
| Counts | 10–21 px | Mono, tabular numerals where supported |
| Keyboard shortcuts | 9 px | Mono, utility contrast |
| State labels | 7–9 px | Sans/mono plus a non-color glyph |

Names, subjects, and correspondence now occupy distinct levels. Provider and operational metadata deliberately recede.

## Surface refinements

### Today

- A two-plane command composition integrates Now and Live State without dashboard cards.
- The primary task receives the strongest type, rule, and spatial treatment.
- Secondary tasks remain ordered but subordinate.
- The selected-work preview now carries person, role, and company identity.

### Drafts

- Queue, message, and inspector share edges and read as one continuous working surface.
- Pane proportions protect the message measure at desktop and medium widths.
- The selected queue row visually continues into the message plane.
- The inspector is narrower, quieter, and progressively condensed at medium widths.

### Message plane

- Recipient identity is ordered as name, role, then company.
- Subject size and weight establish correspondence hierarchy.
- Body width, leading, and paragraph rhythm support sustained reading.
- Editable and sealed states use different surfaces without imitating stationery.
- Approved and later states expose an explicit immutable-snapshot line.

### Candidates

- The list now leads with a person and their current work rather than inventory fields.
- A concise “why now” cue replaces low-value repeated metadata.
- Availability is demoted to a quiet status with a non-color glyph.
- The inspector strengthens selected identity while keeping evidence secondary.

### Lifecycle controls

- The action dock keeps a stable footprint across needs-review, approved, Gmail-created, and uncertain states.
- A lifecycle rail combines glyph, state label, and queue position.
- The primary action owns the right edge; Skip and Replace remain available but visually quiet.
- Send confirmation names the recipient, company, subject, attachment, approved version, and external consequence.

### Command palette and mobile

- Palette groups, current-workspace markers, selected rows, shortcuts, and disabled explanations use product-specific hierarchy.
- Mobile Today strengthens the active task rather than compressing the desktop layout.
- Mobile Draft Review preserves the correspondence hierarchy and a tactile sticky action dock.
- Mobile Candidates increases identity contrast without adding desktop-only metadata or row height.

## State system

Needs review, approved, Gmail-created, and uncertain states use a stable combination of glyph, label, placement, and accent rule. Suppressed and unavailable candidate states use textual meaning plus non-color symbols. Sent remains a destination state outside the active Drafts queue.

## Motion

The four approved motion concepts remain the only motion vocabulary: selected-row transition, lifecycle progression, queue removal/replacement, and send transfer. This pass adds no animation category.

## Visual self-critique

- The joined workspace, correspondence hierarchy, lifecycle rail, and identity-led candidate rows reduce the “Linear with green” resemblance.
- Candidates no longer presents as a conventional admin table, though its compact mode intentionally retains high scan density.
- The message is clearly the dominant Drafts surface at 1024, 1280, and wide desktop widths.
- Today has more authorship through spatial hierarchy rather than decorative modules.
- Controls avoid generic pill, shadow, gradient, and default-input treatments.
- The restrained system should age well, but the light palette still depends on precise typography and spacing to avoid feeling clinical.

## Remaining weaknesses

- At 1024 px, the inspector is necessarily terse; deeper evidence requires progressive disclosure in a production interpretation.
- Compact Candidates remains closer to an operational list than an exploratory surface by design.
- The system’s distinctiveness is quiet rather than expressive and should be judged against real production content before wider implementation.
- The prototype demonstrates one authored visual voice, but production accessibility testing may require minor contrast adjustments.

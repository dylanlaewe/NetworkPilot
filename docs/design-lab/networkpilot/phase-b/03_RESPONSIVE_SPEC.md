# Phase B Responsive Specification

## Tested viewports

The production build was visually reviewed at:

- 1440 × 900
- 1280 × 800
- 1024 × 768
- 768 × 1024
- 390 × 844

The main composition changes at 860 px. This is an intentional interaction change rather than a mechanical stack of desktop panes.

## Desktop and wide tablet

Drafts uses one joined surface: queue, message, and inspector share separators and a common action dock. At 1120 px the queue and inspector narrow while the message keeps a usable minimum. At 1024 px long subjects, employers, and roles truncate rather than forcing horizontal overflow.

Today keeps work dominant and Live State secondary. Candidates retains the six-column identity-first list and docked inspector. The 5/15/30 draft variants share row anatomy and scroll behavior.

## Narrow tablet and mobile navigation

The left rail becomes a bottom navigation with Today, Drafts, Sent, and Candidates. Sent is visibly disabled because it is outside Phase B. Global command/search chrome collapses to the brand and Lab controls.

## Mobile Drafts

The initial surface is the queue. It preserves state grouping, counts, long-title truncation, selection, and Add Drafts. Selecting a row opens a full-screen review with:

- retained `n of total` position;
- queue return control;
- recipient identity and role;
- attachment picker;
- subject and readable message body;
- collapsible context and evidence;
- sticky Skip, Replace, and one primary lifecycle action.

Returning to the queue preserves the selected item and scroll relationship. Message content never becomes a miniature three-pane desktop.

## Mobile Today

Now remains first. The ordered work list begins in the first viewport, followed by the selected-work response and compressed Live State. Provider health is readable without becoming a dashboard-card stack.

## Mobile Candidates

Search and Filter remain visible together. Candidate rows prioritize person, role, company, availability, and lane. Long lanes truncate at the right edge. Selecting a row opens dedicated detail. Filter becomes a full-width bottom sheet above navigation, with a visible Done action and immediate Clear.

## Overflow and safe areas

The 390 px review uses a true device viewport and reports no document-level horizontal overflow. Subject truncation is deliberate; message body wraps. Sticky actions remain above the bottom navigation. The prototype applies the navigation safe-area inset and keeps modal widths within `100vw - 32px`.

## Phase C responsive cautions

- Preserve actual queue scroll position across route/history changes, not only component state.
- Use a roving-tabindex or `aria-activedescendant` list pattern for production keyboard semantics.
- Test browser zoom at 200% and dynamic text sizing before release.
- Validate iOS keyboard/visual-viewport behavior around the message editor and sticky action dock.
- Decide whether 768 px portrait should use the mobile review transition or an overlay inspector after user testing.

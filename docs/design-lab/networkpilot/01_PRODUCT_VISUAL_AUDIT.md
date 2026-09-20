# NetworkPilot Product Visual Audit

Phase A design artifact. This document evaluates the current rendered product as evidence, not as a layout to preserve. The proposed concepts start from a blank visual canvas.

## Executive diagnosis

NetworkPilot is functionally credible but visually under-authored. Its safest and most important distinctions—human approval, immutable drafts, recruiter/professional tracks, candidate supply, Gmail readiness, Apollo limits, and relationship outcomes—are present as text and state. They are not yet composed into a memorable operating environment.

The operational pages feel like a lightly styled internal tool. The System page feels like a separate editorial microsite. Neither visual language fully owns the product. The result is usable, but not cohesive, tactile, or emotionally specific.

The central design problem is not insufficient decoration. It is that the interface has no strong answer to three questions:

1. What is the one thing Dylan should do next?
2. What changed because of his last action?
3. Where is he in the daily outreach loop?

## Cross-product findings

### Visual hierarchy

Page titles are consistently clear, but the hierarchy beneath them is shallow. Headings, filters, rows, explanatory copy, and actions often sit within a narrow band of weight and contrast. This makes scanning slower because the eye must read rather than recognize.

Premium productivity software establishes a dominant working plane, a secondary context plane, and a quiet system plane. NetworkPilot currently places most content on one flat plane. A primary action can therefore feel no more consequential than a filter or status label.

### Navigation

The operational navigation is understandable and compact, but it is a generic horizontal website bar. It does not show queue context, active-work state, or the daily loop. Secondary destinations are hidden behind an unlabeled gear, while the System page exposes an entirely different navigation model and uppercase vocabulary.

Moving between pages is technically fluid but perceptually discontinuous: there is no shared selection model, preserved work context, or transition that says “the same candidate moved from review to sent.”

### Density and whitespace

The interface alternates between excess whitespace and crowded row actions. Today leaves a large unused lower viewport while Drafts and Candidates compress important state into wide rows. This is not calmness; it is uneven information pressure.

Whitespace feels premium when it clarifies sequence, grouping, or priority. Here it frequently separates content without strengthening meaning. Conversely, dense action cells wrap explanations and buttons into inconsistent row heights, making a repetitive workflow feel unstable.

### Typography

The current system stacks are robust and network-independent, but the application uses size, weight, and monospace labels somewhat mechanically. The operational product is almost entirely sans-serif; the older System experience introduces large Georgia headlines and aggressive uppercase monospace labels. These feel like two brands.

The product needs a typographic grammar: one voice for people and correspondence, one for operational metadata, and strict rules for when each appears.

### Color

Warm white, charcoal, and restrained green are appropriate for a private professional tool. The issue is not the palette itself, but its limited semantic range. Green currently carries brand, navigation, success, availability, and primary action. Caution, uncertainty, suppression, and provider limits appear inconsistently or too quietly.

A premium system would preserve restraint while making state differences unmistakable without relying on pills or saturated color blocks.

### Surfaces

The current product uses borders, pale bands, and occasional white cards, but without a clear elevation contract. Popovers, sheets, cards, forms, and inline details can look interchangeable. The older System page adds oversized decorative composition and dark notice bars that do not recur elsewhere.

This reduces tactility: an object does not visually promise how it will behave when clicked.

### Motion and tactile feedback

The experience is largely static. Hover colors and focus outlines exist, but actions do not create a strong sense of continuity. A completed draft disappears without a designed handoff; a replacement does not feel newly inserted; a successful send does not visibly move into relationship memory.

Without restrained state-change motion, the user must repeatedly re-read the page to verify what happened. Tactility should reduce cognitive verification, not add spectacle.

### Consistency and personality

NetworkPilot’s personality should come from thoughtful professional outreach: observant, selective, human, and composed. Today it is mostly expressed through copy. Visually, the product could be a generic recruiting admin tool. The simulation System surface has more personality, but its campaign-poster composition is inappropriate as the main operating model.

## Surface audit

### Today

Today is a collection of sections rather than a command center. “Next actions,” outreach counts, candidate supply, and provider readiness are all present, but they do not form a single decision surface.

Why it feels less premium:

- The largest signal is the greeting, not the next consequential task.
- Status is distributed across separate text blocks rather than composed around the daily loop.
- There is no visible active item, queue progress, or temporal rhythm.
- Gmail and Apollo states feel appended instead of integrated as operational constraints.
- The first viewport does not answer whether the day is healthy, blocked, or complete in one glance.

### Drafts

Drafts is currently a table with actions, not an inbox-plus-review queue. At 20 or more drafts, the eye crosses five columns for every decision. Rows change height when an action needs explanatory text, so scanning rhythm breaks precisely where attention is most valuable.

Why it feels less premium:

- Candidate identity, message state, and next action compete horizontally.
- There is no persistent selection or preview, so every review is a route change.
- Primary and secondary actions appear as row furniture instead of a repeatable processing loop.
- Queue position is informational rather than spatial.
- Keyboard behavior is not visible or learnable from the surface.

### Draft Review

The review page has good ingredients—recipient context, editable subject/body, intent, resume choice, and an immutable approval boundary—but it feels like editing a web form. The large white editor card and detached metadata rail do not create the intimacy of writing a considered letter.

Why it feels less premium:

- The subject and body are styled as inputs rather than correspondence.
- Candidate research is adjacent, not meaningfully connected to specific message choices.
- The approval action is below the first viewport on common screens.
- Skip and Replace are not part of a coherent review decision bar.
- Queue context disappears, making repeated review feel episodic.

### Sent / CRM

Sent is a legible expandable list with useful outcome filters. It still behaves more like a transaction ledger than relationship memory.

Why it feels less premium:

- “Who, when, outcome” is visible, but narrative continuity is hidden.
- Awaiting-response rows dominate without showing what requires attention now.
- Expansion reveals details but does not feel like entering a relationship record.
- The same table rhythm is used for a hard bounce and a promising conversation despite different urgency.

### Candidates

Candidates exposes real supply, useful filters, track, role family, industry, geography, and availability. Yet it communicates database inventory rather than possibility.

Why it feels less premium:

- Five simultaneous selects create a filter form before the user sees the people.
- Identity is visually weak; company and role read as cells rather than a professional profile.
- Abundance is represented only by a count.
- Candidate rows provide no obvious “why this person” signal or discovery rhythm.
- Responsive transformation rearranges cells but does not recompose the discovery task.

### Resume Library

Resume storage and role-lane metadata are thoughtfully bounded. The surface feels like an upload utility bolted onto the product.

Why it feels less premium:

- Upload controls occupy a generic bordered form.
- Saved documents are editable records rather than recognizable working assets.
- Version evidence, role-lane fit, active state, and attachment usage have no visual relationship.
- There is no document preview, selection memory, or connection to Draft Review.

### System / Diagnostics

System is visually ambitious but disconnected. It uses large serif campaign language, decorative geometry, uppercase navigation, and a simulation narrative that belong to an earlier product chapter.

Why it feels less premium:

- A secondary operational surface has more visual drama than the daily product.
- Its navigation and typography create a second brand.
- Provider details and simulation controls compete with the real product model.
- Diagnostics are presented as a destination rather than progressive disclosure for exceptional situations.

## State audit

### Empty states

Current empty states are clear but generic. They describe absence instead of orienting the user within the operating loop. A useful empty state should distinguish “successfully complete,” “waiting on an external condition,” and “supply depleted.”

### Loading states

Generic lines and a spinner indicate work but do not preserve page structure. For repetitive workflows, layout-preserving skeletons and localized pending states would reduce perceived interruption.

### Success states

Success messages are mostly banners or disappearance. They confirm completion but do not show destination. The product needs spatial continuity: approved moves toward Gmail creation; sent moves into CRM; replacement enters the queue where the old item left.

### Error and disabled states

Recent work has improved truthful disabled reasons. Visually, however, provider unavailability, mutable safety blocks, exhausted budgets, and recoverable errors can still resemble one another. The system needs distinct patterns for blocked, retryable, unavailable-until, and permanently excluded.

### Filters

Filters are explicit but form-heavy. Their design makes changing a view feel like configuring a report. High-frequency filters should be reversible, keyboard-addressable, and visibly summarize the active query.

## Responsive and mobile audit

The current CSS contains thoughtful breakpoints and converts tables into grids, but most mobile behavior is a structural collapse of desktop. Navigation wraps or becomes a small grid; action cells move below rows; filters stack; detail popovers become fixed overlays.

This remains usable, but it does not define a mobile job. A deliberate mobile experience should prioritize:

- checking today’s status;
- reviewing one draft at a time;
- making a bounded decision;
- finding a sent relationship;
- viewing, not administering, candidate supply.

Upload management, deep diagnostics, and multi-column comparison can remain desktop-first.

## Design criteria derived from the audit

Any successful direction must:

1. Make Drafts a persistent queue with a focused item, not a table of buttons.
2. Compose Today around attention and progression, not KPI cards.
3. Make draft writing feel like correspondence while retaining explicit safety gates.
4. Turn Sent into relationship memory with outcome-based attention.
5. Present Candidates as abundant people, not merely records.
6. Integrate resumes into the act of sending, not just file administration.
7. Relegate System to a quiet, coherent utility layer.
8. Give state changes spatial continuity and immediate feedback.
9. Reward keyboard fluency without hiding mouse and touch paths.
10. Establish one visual identity across live operations, simulation, and diagnostics.

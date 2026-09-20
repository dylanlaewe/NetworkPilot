# Phase B Prototype Notes

## Status and boundary

Phase B implements the approved **Network Command** direction as an isolated visual prototype at `/design-lab/network-command`. It is not a production frontend change.

The route imports only its local prototype component, local CSS module, and deterministic fictional fixtures. It does not import a repository, server action, database client, Apollo adapter, Gmail adapter, production route component, or production CSS selector. All interaction state lives in React memory and disappears on reload.

## Visual thesis

Network Command is a light, compact operating surface built around continuity. The selected person, message, evidence, and one truthful next action remain spatially connected. Identity comes from exact alignment, joined work planes, restrained selection color, and lifecycle feedback rather than dark mode, gradients, cards, or AI decoration.

The route uses the approved local/system typography and Concept B palette. Monospace is limited to operational metadata, counts, state labels, and shortcut hints. Message content uses a deliberately wider line height and narrower measure than surrounding interface text.

## Fixture realism

- 30 fictional draft records, with queue-size controls for 5, 15, and 30.
- 44 fictional candidate records.
- Professional and recruiter tracks.
- Data, Product, AI/ML, Software, Finance, Energy/commodities, Program Management, Technical Recruiting, Product Recruiting, and University Recruiting lanes.
- Long role and employer strings to force honest truncation behavior.
- Needs review, approved, Gmail-created, and uncertain lifecycle states.
- Fictional resume labels and versions.
- Suppressed candidate, provider blockage, exhausted supply, and empty-state scenarios.

## Prototype controls

The **Lab controls** menu changes queue size and deterministic scenario. URL query parameters initialize exact states for visual QA; they do not persist or invoke backend behavior.

Supported scenarios are:

- Standard
- Gmail reconnect required
- Apollo budget exhausted
- No reserve
- No drafts
- All caught up
- No candidates

## Deliberate non-production behavior

Approve, Skip, Replace, Add Drafts, Gmail draft creation, and Send are simulations. “Create Gmail draft” changes only the in-memory fixture state. “Send” opens an explicit simulation dialog, increments the fictional Sent count, removes the row, and advances selection. Copy in the dialog explicitly states that no Gmail provider can be constructed.

No attempt was made to reproduce production domain logic. Phase C should integrate the approved interaction model through production selectors and use cases rather than copying this prototype state machine.

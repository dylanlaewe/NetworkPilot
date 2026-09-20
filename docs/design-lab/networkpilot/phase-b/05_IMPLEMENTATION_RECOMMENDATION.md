# Phase B Implementation Recommendation

## Recommendation

Proceed to a separately authorized Phase C production implementation of Network Command, beginning with Drafts / Review. Do not replace all production surfaces in one release.

## Why Drafts first

Drafts contains the interaction grammar that the rest of NetworkPilot can reuse: persistent selection, identity-first rows, focused detail, truthful state groups, one lifecycle action, contextual safety evidence, immediate feedback, and keyboard navigation. Implementing this surface first will reveal whether the visual model survives real domain state before Today and Candidates depend on it.

## Suggested Phase C sequence

1. **Shared shell and tokens.** Introduce scoped visual tokens, command bar, responsive navigation, focus treatment, and density primitives without changing domain behavior.
2. **Draft list selector.** Build a read-only projection that groups existing production drafts into the four visible lifecycle states while preserving immutable snapshots and human-readable blocked reasons.
3. **Draft workspace.** Add persistent queue selection, message editor, attachment picker, evidence inspector, and one primary action dock using existing server actions.
4. **Safety adapter.** Centralize the UI projection of mutable gates so click, shortcut, and command-palette invocation all call the same guarded action path.
5. **Lifecycle continuity.** Add state-group movement, next-item focus, uncertain-send retention, and route/history restoration. Do not add optimistic provider success.
6. **Today.** Replace summary/dashboard composition with the Now / Live State model using existing production counts and actions.
7. **Candidates.** Introduce identity-first list, filter sheet, density, and inspector without changing qualification, targeting, refresh, or supply behavior.
8. **Accessibility and responsive hardening.** Complete screen-reader, zoom, reduced-motion, keyboard, focus-restoration, iOS visual-viewport, and long-content testing.

## Production architecture guidance

- Keep domain/application use cases provider-independent and unchanged.
- Create explicit presentation selectors for queue groups, next valid action, disabled reason, and provider health.
- Keep server actions authoritative. The command palette and keyboard handlers must call the same client transition that the visible button calls.
- Recheck mutable gates at action time; never treat a previously rendered enabled button as authorization.
- Preserve immutable approved message snapshots and historical interpretations.
- Retain Gmail draft-only and explicit-send boundaries exactly as implemented today.
- Treat uncertain sends as unresolved operations, never as retryable errors by default.
- Store density preference locally, but store no private candidate or message content in browser persistence.

## Components worth carrying forward

The prototype code itself should not be copied wholesale, but these component boundaries are sound:

- Command shell
- Roving queue list and state groups
- Message header/editor
- Evidence inspector
- Lifecycle action dock
- Command palette registry
- Compact filter sheet
- Candidate result list and detail inspector
- Mobile review transition
- Human-facing provider health projection

## Explicit non-goals for Phase C

- No sourcing, scoring, qualification, drafting-methodology, or company-diversity changes.
- No new Gmail or Apollo scopes.
- No bulk actions, background sending, scheduled sending, or generic Gmail send path.
- No database redesign solely to support animation.
- No dark theme or decorative motion expansion.
- No simultaneous redesign of Sent, Resumes, or System until the defining surfaces are proven.

## Acceptance gates

Phase C should not ship until it demonstrates:

- safe processing of 5, 15, and 30 real draft projections with stable focus;
- identical business outcomes between click, keyboard, and command-palette invocation;
- zero action shortcuts while typing;
- truthful Gmail reconnect, Apollo exhausted, uncertain-send, suppression, cooldown, and no-reserve behavior;
- no provider invocation from visual-only navigation;
- no regression to immutable drafts, attachments, explicit send confirmation, or idempotency;
- functional layouts at all five Phase B viewports;
- complete accessibility checks and reduced-motion behavior;
- production tests covering projection, gate recheck, focus advancement, and provider-call counts.

## Final Phase C position

The visual direction is ready for incremental production implementation. The highest-value move is not a broad reskin; it is a carefully bounded Drafts workflow replacement that proves Network Command against real lifecycle data while all existing safety and provider boundaries remain authoritative.

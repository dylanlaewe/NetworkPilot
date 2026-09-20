# Phase B Interaction Specification

## Draft queue

Selection updates the accent edge, background, message, inspector, position count, and action dock as one event. `J` and `K` move through the visible queue. Clicking a row produces the same result. `Enter` opens the selected item in the mobile review mode or focuses the desktop message plane.

Queue sections are grouped by truthful state: Needs review, Approved, Gmail draft created, and Send uncertain. Counts in the local bar update with lifecycle changes.

### Lifecycle actions

| Current state | Primary action | Prototype response |
| --- | --- | --- |
| Needs review | Approve draft | State changes in place, then selection advances |
| Approved | Create Gmail draft | In-memory state becomes Gmail draft created |
| Gmail draft created | Send approved email | Explicit confirmation, simulated transfer, Sent count increments |
| Send uncertain | Resolve send status | Uncertain state remains visible; no success is implied |

Skip removes the selected row, performs a 170 ms queue reflow, and selects the next logical row. Replace preserves the queue position and swaps in a fictional reserve person. Add Drafts inserts three fictional reserve items only when reserve is available.

Gmail reconnect disables only the externalization action, explains the reason beside it, and exposes a repair control. Apollo exhaustion leaves existing Drafts and outreach actions enabled. No-reserve disables adding rather than the review loop.

## Editing and attachments

`E` focuses the subject field. Subject and body fields intentionally read as a composition surface rather than boxed form controls. Attachment selection updates the local fixture immediately and produces transient confirmation.

Shortcuts are ignored while focus is inside `input`, `textarea`, `select`, or editable content. This prevents typed message content from triggering lifecycle operations.

## Keyboard map

| Key | Action |
| --- | --- |
| `J` / `K` | Next / previous queue selection |
| `Enter` | Focus or open review |
| `E` | Edit subject |
| `A` | Approve a needs-review draft |
| `R` | Replace selected person in place |
| `X` | Skip selected draft |
| `N` | Open Add Drafts |
| `Cmd/Ctrl K` | Open command palette |
| `Esc` | Close the current modal, sheet, or mobile review |

## Command palette

The command palette is an operational surface, not decorative search. It includes Today, Drafts, Sent, and Candidates plus context-valid Approve, Skip, Replace, Add Drafts, Filter, and Search commands. Out-of-scope Sent navigation stays visible but disabled with an explanation. Contextually invalid lifecycle commands remain disabled rather than becoming unsafe shortcuts.

## Candidate interactions

Search operates over fictional person, company, role, and lane text. The compact Filter control opens a structured popover on desktop and a bottom sheet on mobile. Track, lane, and Northeast controls update a readable summary. Clear removes all filters immediately.

Comfortable and Compact density change row rhythm without changing information hierarchy. Selecting a person updates the inspector. On mobile it opens a dedicated full-screen detail surface rather than squeezing desktop detail below the row.

## Four motion concepts

Exactly four functional motion concepts are present:

1. **Selection tracking:** 100 ms color and accent-edge response.
2. **Queue reflow:** 170 ms row collapse and neighbor settlement.
3. **Command response:** 110 ms command/dialog opacity and scale response.
4. **Lifecycle transfer:** 210 ms state confirmation/toast trace.

`prefers-reduced-motion: reduce` collapses animation and transition durations to effectively immediate state changes. Button press uses a 1 px physical compression but introduces no fifth animation sequence.

## Feedback contract

Every interaction answers whether it was received through at least one of: state change, focus movement, in-place count update, pending label, modal confirmation, disabled reason, row reflow, or transient event line. Uncertain send never uses success treatment.

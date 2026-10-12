<!-- impeccable:product-schema 1 -->

# NetworkPilot product context

## Product

NetworkPilot is Dylan's private, local-first professional networking command center. It helps him find relevant people, qualify them conservatively, write thoughtful outreach, review every message, and preserve relationship history without surrendering control to automation.

## Primary user

- Dylan is the sole operator and reviewer.
- He uses the product repeatedly as a personal productivity tool, not as a multi-tenant sales dashboard.
- He needs the next useful decision to be obvious without remembering the underlying data or provider architecture.

## Core purpose

Turn a safely qualified person into a truthful, personal message with the least possible friction while keeping provider spend, company trust, contact policy, human approval, Gmail uncertainty, and historical evidence intact.

## Product principles

1. People first.
2. Writing at the center.
3. Mechanics in the background.
4. One obvious next action at each important state.
5. Evidence appears when it is needed; healthy infrastructure recedes.
6. Human review and explicit send confirmation are permanent safety boundaries.
7. Trust is earned explicitly and fails closed.
8. Fast feedback must be truthful; animation must never disguise latency.
9. Relationship history is durable and understandable.

## Primary workflow

1. **Today** answers what Dylan should do now.
2. **Candidates** explains why a person is eligible or blocked and makes the path to a local draft unmistakable.
3. **Drafts** centers the recipient and the writing, with operational evidence behind progressive disclosure.
4. A reviewed local draft may become a Gmail draft through one explicit action; this never sends.
5. Sending remains a separate, explicit, confirmed action.
6. **Sent** is relationship history and the next relevant relationship action.

## Supporting areas

- **Resumes** manages the active resume and bucket defaults.
- **System** contains infrastructure health, operational diagnostics, and configuration that should not crowd the daily workflow.
- Five targeting buckets remain authoritative: recruiters; peers and practitioners; managers and team leaders; executives; CEOs and presidents.

## Safety and domain constraints

- No automatic sending.
- No hidden Gmail side effects.
- No provider spend outside explicit authorization and accounting controls.
- No actionability while required company or responsibility review is unresolved.
- Preserve suppression, cooldown, duplicate protection, reconciliation semantics, immutable historical snapshots, and migration boundaries.
- Provider-discovered company data cannot silently create company trust.
- UI simplification may combine safe application operations, but may not bypass or weaken their domain boundaries.

## Experience commitments

- The product should feel calm, direct, and premium: a focused personal productivity application rather than generated admin software.
- Preserve the established light, restrained visual direction while improving hierarchy, spacing, typography, density, and control quality.
- Permanent screen space is reserved for information needed to make the current decision.
- Long names, companies, titles, explanations, attachment names, and messages must wrap or disclose safely with no overlap or horizontal page overflow.
- Desktop and mobile are composed for their contexts; mobile is not a shrunken desktop.
- Every interactive control exposes clear hover, selected, pressed, focus, pending, disabled, success, and error feedback as applicable.
- Accessibility, keyboard operation, visible focus, reduced motion, and appropriate touch targets are release requirements.

## Current product evidence

- First real production use confirmed that the functionality works, but the experience feels slow, clunky, visually unpolished, overly complicated, and difficult to navigate.
- Drafts is the highest-priority surface: the permanent inspector overwhelms the message and makes the approval-to-Gmail-to-send path painful.
- Candidates failed a basic discoverability test: Dylan could not determine how to create a draft for a selected person.
- Real use established company review as a necessary daily workflow, but the application—not the operator—must carry audit, version, and idempotency complexity.
- Existing architecture, targeting policy, safety controls, and data history remain authoritative unless measured UX or performance evidence proves a narrow change is required.

## Success criteria

- Dylan can understand the next action on every major page without product-architecture knowledge.
- Candidate-to-draft and local-draft-to-Gmail-draft workflows are obvious, safe, and visibly responsive.
- Draft review gives the person and message overwhelming visual priority.
- Company review is understandable without exposing implementation metadata.
- Major navigation and selection interactions are measurably faster or provide immediate truthful feedback.
- All major pages work at 1440×900, 1280×800, 390×844, and 360×800, including long-content and 125% zoom stress.
- The full offline test and browser-acceptance suite passes with zero Apollo calls and zero real Gmail calls.

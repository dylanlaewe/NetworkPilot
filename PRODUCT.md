<!-- impeccable:product-schema 1 -->

# NetworkPilot product context

## Product

NetworkPilot is Dylan's private, local-first professional networking workspace. It helps him find relevant people, qualify them conservatively, write thoughtful outreach, review every message, and preserve relationship history without surrendering control to automation.

## Primary user

- Dylan is the sole operator and reviewer.
- He uses the product repeatedly as a personal productivity tool, not as a multi-tenant sales dashboard.
- He needs the next useful decision to be obvious without remembering the underlying data or provider architecture.

## Core purpose

Turn a relevant person into a truthful, personal message with the least possible friction while keeping provider spend, contact policy, human approval, Gmail uncertainty, and historical evidence intact.

## Product principles

1. People first.
2. Writing at the center.
3. Mechanics in the background.
4. One obvious next action at each important state.
5. Evidence appears when it is needed; healthy infrastructure recedes.
6. Human review and explicit send confirmation are permanent safety boundaries.
7. Sourcing confidence and permission to send a truthful introduction are separate decisions; uncertainty is disclosed, not promoted into an administrative prerequisite.
8. Fast feedback must be truthful; animation must never disguise latency.
9. Relationship history is durable and understandable.
10. The daily product speaks in people, messages, and next actions—not pipeline machinery.

## Primary workflow

1. **Candidates → Find people** uses the bounded sourcing flow and populates the familiar candidate list.
2. **Drafts → Create drafts** turns selected or bucket-scoped existing candidates into additive local drafts without provider use.
3. **Drafts → Send** keeps editing in the comfortable message workspace, then asks for one explicit recipient, message, and attachment confirmation before any external send sequence begins.
4. **Sent** is relationship history and the next relevant relationship action.
5. **Today** may point to this workflow, but it does not replace Candidates, Drafts, or Sent with a separate review model.

## Supporting areas

- **Resumes** manages the active resume and bucket defaults.
- **System** contains infrastructure health, operational diagnostics, and configuration that should not crowd the daily workflow.
- Five targeting buckets remain authoritative: recruiters; peers and practitioners; managers and team leaders; executives; CEOs and presidents.

## Safety and domain constraints

- No automatic sending.
- No hidden Gmail side effects.
- No provider spend outside explicit authorization and accounting controls.
- An unverified employer alone does not block ordinary personal-networking drafting or sending.
- Missing detailed leadership-responsibility evidence alone does not block a truthful title-based networking introduction.
- Known recruiting/staffing services, unsupported identity, unsupported copy claims, and contradictory scope remain blocked.
- Preserve suppression, cooldown, duplicate protection, reconciliation semantics, immutable historical snapshots, and migration boundaries.
- Provider-discovered company data cannot silently create company trust; existing trust and audit history remains unchanged.
- UI simplification may combine safe application operations, but may not bypass or weaken their domain boundaries.

## Experience commitments

- The product should feel calm, direct, and premium: a focused personal productivity application rather than generated admin software.
- The interaction model is a conversational workbench: a quiet shell, one dominant work surface, and one obvious next action.
- Familiarity comes from standard controls and restrained navigation, not from copying another product's assets or visual identity.
- Permanent screen space is reserved for information needed to make the current decision.
- Buckets are page-local scope, never a permanently expanded navigation tree.
- **Create drafts** is the only batch-drafting term. It supports 5, 10, or custom 1–20 from existing candidates and always returns visible full, partial, or zero-result feedback.
- **Create draft** may remain as an optional selected-person action. **Find people** is provider-backed sourcing and must remain visually and verbally distinct from drafting.
- A selected candidate's primary-action region stays in one place across ready, drafted, contacted, skipped, suppressed, and cooldown states.
- Draft review is one continuous edit → Send → explicit confirmation → Sent experience. Approval snapshots and Gmail-draft creation remain internal safety steps.
- The normal workflow remains a CRM list-and-editor experience. It does not use a unified Review destination, swipe cards, forced person-by-person progression, or automatic draft creation after sourcing.
- Long names, companies, titles, explanations, attachment names, and messages must wrap or disclose safely with no overlap or horizontal page overflow.
- Desktop and mobile are composed for their contexts; mobile is not a shrunken desktop.
- Every interactive control exposes clear hover, selected, pressed, focus, pending, disabled, success, and error feedback as applicable.
- Accessibility, keyboard operation, visible focus, reduced motion, and appropriate touch targets are release requirements.
- Candidate titles always come from retained source evidence and remain visually distinct from recipient-bucket labels. A CEO, a President, and a combined CEO/President title are three truthful display cases, not one normalized label.
- Peers & practitioners should reflect the approved target lanes when suitable supply exists: product and product operations, data/business/BI analysis, software/data engineering, and implementation or adjacent technical-business work. Breadth is considered before paid enrichment without imposing unsuitable-person quotas or increasing provider limits.
- Small transactional surfaces—Find people, Create drafts, final Send confirmation, and compact menus—share one readable type hierarchy, control rhythm, focus treatment, and constrained responsive behavior.
- Each list/editor pane owns its scrolling. Sticky context and subtle scrolled boundaries may preserve orientation, but content, focus, and final actions must remain reachable without scroll hijacking.

## Current product evidence

- Two rounds of real production use confirmed that the functionality works, but the current direction still feels clunky, confusing, mechanical, visually weak, and over-engineered.
- Multiple drafting labels and reserve terminology currently expose internal workflow mechanics that should collapse into Create drafts.
- Drafts is the highest-priority surface: the permanent inspector overwhelms the message and makes the approval-to-Gmail-to-send path painful.
- Candidates failed a basic discoverability test: Dylan could not determine how to create a draft for a selected person.
- Company trust remains useful evidence and durable audit history, but ordinary personal networking must not require Dylan to certify every unfamiliar employer.
- Existing architecture, targeting policy, safety controls, and data history remain authoritative unless measured UX or performance evidence proves a narrow change is required.
- Current production evidence contains ten visible Junior Data Analysts in Peers & practitioners: five previously recovered records and five newly sourced records. This is a retained-supply fact to diagnose, not a license to hardcode or visually normalize future peers to that title.
- Current production feedback reports repetitive CEO/president presentation and unfinished small panels, menus, typography, overlap handling, and scroll response. The correction must preserve actual provider titles, the accepted CRM workflow, and the existing visual direction.

## Success criteria

- Dylan can understand the next action on every major page without product-architecture knowledge.
- Candidate sourcing, additive draft creation, and confirmed sending are obvious, safe, and visibly responsive.
- Draft review gives the person and message overwhelming visual priority.
- Employer and scope uncertainty is honest in optional details without becoming research homework.
- Major navigation and selection interactions are measurably faster or provide immediate truthful feedback.
- A first-time daily user can distinguish Find people, Create drafts, and Send without a tooltip.
- All major pages work at 1440×900, 1280×800, 390×844, and 360×800, including long-content and 125% zoom stress.
- The full offline test and browser-acceptance suite passes with zero Apollo calls and zero real Gmail calls.
- Mixed eligible peer fixtures do not collapse to the first title family, Product remains represented, explicit user filters stay authoritative, and CEO-only, President-only, and combined-title evidence display distinctly.
- Transactional panels remain usable at narrow internal widths, 320 CSS pixels, enlarged text, and top/middle/bottom scroll positions; focus enters and returns correctly, Escape is safe, and headers or footers never obscure content.

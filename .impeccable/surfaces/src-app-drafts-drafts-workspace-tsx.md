---
version: 1
slug: "src-app-drafts-drafts-workspace-tsx"
primary_target: "src/app/drafts/drafts-workspace.tsx"
related_targets:
  - "src/app/candidates/candidates-workspace.tsx"
  - "src/app/sent/relationship-workspace.tsx"
---

# Preferred CRM workflow

## Direction contract

**THESIS:** NetworkPilot is a calm personal CRM. Its normal path is Candidates → Find people, Drafts → Create drafts → Send, and Sent → relationship history. Administrative pipeline transitions stay behind the interface.

**OWN-WORLD:** Preserve the accepted quiet sidebar, soft neutral canvas, white list/editor surfaces, graphite actions, restrained teal selection, comfortable message measure, progressive Details disclosure, and clear selected states. This is refinement of the existing CRM, not a new visual concept.

**STORY:** Dylan sources people into a familiar Candidates list, optionally skips people, creates an additive batch of drafts from existing candidates, edits one in the Drafts list/editor, presses Send, confirms the exact recipient/message/attachment once, and finds the relationship exactly once in Sent.

**FIRST VIEWPORT:** Candidates leads with one Find people action and normal list browsing. Drafts keeps its two-pane queue/editor on desktop and deliberate list/detail composition on mobile. Sent remains relationship history. Five-bucket scope is page-local; Resumes and Settings remain secondary.

**POLICY:** Unverified employer trust alone and missing detailed leadership-responsibility evidence alone do not block a truthful personal-networking introduction. Show uncertainty in optional Details. Do not manufacture trust, responsibility, scope, or hiring-authority claims. Known recruiting services and real email/contact-policy blockers still fail closed.

**LANGUAGE:** Use Find people, Create draft for one selected person, Create drafts for an additive batch, Send for the visible external workflow, and Sent for history. Do not expose Add Drafts, Generate Drafts, reserve activation, review-item preparation, or separate approval/Gmail-draft buttons in the normal journey.

**SAFETY:** Find people discloses possible Apollo spend and requires explicit confirmation. Create drafts never calls Apollo. Only the final send confirmation may begin the external sequence. Freeze exact displayed content and attachment, recheck server-side gates, reuse idempotent Gmail operations, and stop on failed or uncertain external activity without automatic resend.

**TITLE TRUTH:** Candidate rows and message context show retained source titles independently from bucket labels. CEO-only, President-only, and combined CEO/President titles remain distinct. Missing source titles are disclosed rather than replaced by a bucket name.

**COMPONENT CRAFT:** Find people, Create drafts, final Send confirmation, and compact bucket/filter/overflow menus share readable type roles, 44px controls, predictable primary/secondary action placement, visible focus, safe Escape behavior, and container-width stacking. Long content wraps; local headers/action regions may become sticky with a restrained scrolled boundary; each surface owns its scroll and returns focus to its trigger.

**REJECTED:** Unified Review navigation, swipe cards, forced person-by-person progression, automatic drafts immediately after sourcing, mandatory employer certification, mandatory leadership-scope research, permanent diagnostic rails, and any new architecture initiative.

## Finish criteria

- Full, partial, zero, empty-pool, duplicate-click, changed-selection, Gmail-failure, and uncertain-send states are immediately legible.
- Candidate and bucket selection remain client-local and responsive.
- Hover, pressed, selected, pending, focus, disabled, success, and error states are visible.
- Desktop 1440×900 and 1280×800, plus mobile 390×844 and 360×800, have no overlap, clipping, hidden primary action, or horizontal overflow.
- The exact application-service journey passes against an isolated database and mocked providers, with zero live Apollo or Gmail activity.
- Mixed peer fixtures preserve suitable product, analysis, engineering, and implementation breadth before enrichment without overriding explicit filters or creating rigid quotas.
- Transactional panels pass long-content, 320-CSS-pixel, enlarged-text, reduced-motion, focus-entry/return, Escape, and top/middle/bottom scroll checks without overlap or obscured actions.

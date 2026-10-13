---
name: NetworkPilot
description: A calm conversational workbench for thoughtful professional networking.
colors:
  ink: "#20211f"
  muted: "#6f706c"
  canvas: "#f7f7f5"
  paper: "#ffffff"
  sidebar: "#efefec"
  soft: "#e8e8e4"
  accent: "#315c52"
  accentHover: "#284b43"
  accentSoft: "#e1ece8"
  line: "#dfdfda"
  warning: "#9a641d"
  warningSoft: "#fbf1df"
  danger: "#9d4037"
  success: "#2f6b50"
typography:
  pageTitle:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 620
    lineHeight: 1.14
    letterSpacing: "-0.035em"
  person:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 620
    lineHeight: 1.25
  body:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.62
  metadata:
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  control: "10px"
  surface: "14px"
  overlay: "18px"
  pill: "999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  buttonPrimary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  buttonSecondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
    height: "44px"
---

# Design System: NetworkPilot

## North star: The Familiar CRM Workbench

NetworkPilot is a quiet personal CRM: Candidates is the people list, Drafts is the writing workspace, and Sent is relationship history. The shell recedes; the selected person or message occupies the center. The product borrows ChatGPT's calm hierarchy, progressive disclosure, and immediate acknowledgement without replacing familiar list-and-editor navigation.

The distinguishing move is the **next-move thread**: every CRM surface ends its active context with one plain-language state and one stable next action. Success, partial completion, and blockers replace that action in place rather than appearing as distant status machinery.

## Shell

- Desktop uses one 224px quiet left sidebar and one flexible content surface. No permanent third column.
- Primary navigation is exactly Today, Drafts, Candidates, and Sent. Resumes and Settings sit below a divider.
- Recipient buckets are compact page-local tabs or a single mobile select; they never expand in global navigation.
- The active work surface is centered at a maximum width of 1120px. Reading and message copy stop near 68ch.
- At 760px and below, the sidebar becomes a 56px top bar plus a four-item bottom navigation. The content remains a single focused column.

## Typography

- Page title: 32px / 1.14 / 620, tracking -0.035em. Mobile: 27px.
- Person or recipient name: 20px / 1.25 / 620.
- Message subject: 17px / 1.35 / 600.
- Body and editable message: 15px / 1.62 / 400, maximum 68ch.
- Metadata: 12px / 1.4 / 500. It never carries decision-critical content.
- Use the system sans stack. Monospace is reserved for System diagnostics and never appears in normal daily work.

## Spacing

Use one rhythm: 4, 8, 12, 16, 24, 32, 48px. Daily surfaces use 24–32px section gaps; related controls use 8–12px. Do not invent intermediate gaps to patch composition.

## Color and depth

- The canvas is soft neutral `#f7f7f5`; the sidebar is `#efefec`; writing surfaces are white.
- Primary text is graphite `#20211f`. The deep teal accent `#315c52` is reserved for selected context, links, and recoverable progress—not every button.
- The primary button is graphite, so the work remains human and editorial rather than status-green.
- Amber and red are semantic only. Unverified employer uses amber; destructive or failed states use red.
- Borders organize fixed regions. Shadows appear only on drawers, dialogs, and transient feedback.

## Controls and states

- Primary button: graphite fill, white text, 44px minimum height, 10px radius. Hover lightens by one tonal step; pressed translates 1px; pending keeps width and replaces its label with an inline progress mark.
- Secondary button: paper background, graphite text, one-pixel neutral border. It may never compete with the primary action.
- Text action: no container; underline appears on hover. Use for Details, Back, and low-risk navigation.
- Selected navigation: tinted surface plus an inset accent marker; never color alone.
- Focus: 3px `#8eb5aa` outline with 2px offset on every interactive control.
- Success: update the action region immediately, announce through `role=status`, and keep the next action adjacent.
- Blocked: keep the action region and replace the action with a clear label, one-sentence reason, and best recovery control.
- Disabled controls are used only when the reason is visible beside them. Otherwise render explanatory text instead.

## Density and progressive disclosure

Permanent visibility is limited to identity, role/company, lifecycle state when it changes the action, the message, the selected resume, and the current next action.

Why-this-person evidence, employer trust evidence, classification detail, provider provenance, and diagnostics live behind Details or in System. Internal IDs, hashes, algorithms, catalog versions, evidence paths, and repetitive safe-state badges never appear in the normal work surface.

## Surface rules

### Today

Today answers only “What should I do next?” It leads with a greeting, one sentence describing the highest-value task, one primary Continue action, and a short task list. No dashboard cards, charts, or healthy infrastructure content.

### Drafts

Desktop is two regions: a 280px people queue and a flexible message workspace. The message, subject, resume, and lifecycle action dominate. Details opens on demand as an overlay or inline disclosure. Mobile shows the active draft first with the queue behind a single People control.

The visible lifecycle is edit message → Send → confirm recipient, exact message, and attachment → Sent. Immutable approval snapshots and Gmail-draft creation remain internal safety steps. Only the final explicit confirmation may begin the external sequence; failed or uncertain provider activity stops safely without automatic resend.

### Candidates

Candidate rows show name, role/company, and one useful state. The page has one obvious sourcing action: Find people, with its possible Apollo-credit consequence stated before confirmation. The selected candidate may offer the optional Create draft action, plus Open draft, Skip, Don't show again, Already contacted, or Available in N days as appropriate.

Find people populates the Candidates list; it never creates drafts automatically. Unverified employer trust or missing detailed responsibility evidence is advisory in optional Details when the identity and title support a truthful introduction. Known recruiting/staffing services and real contact-policy blockers remain explicit.

### Sent

Sent reads as relationship history: person, company, date, message, and outcome. Sourcing and provider mechanics stay hidden.

## Create drafts feedback contract

Create drafts uses existing candidates only, supports 5, 10, or custom 1–20, respects the selected bucket or explicitly selected people, and adds work without replacing edits, attachments, or ordering. Every invocation updates within the existing action region:

- Success: “3 drafts created” and the queue updates immediately.
- Partial: “2 of 5 drafts created” plus the highest-value reason supply stopped.
- Zero: “No drafts could be created” plus grouped reasons and one best CTA. When no candidates exist: “No candidates yet. Find people first.” with a direct Candidates link.

The feedback is announced and persists until Dylan acts or dismisses it. Navigation may follow only after the result is visible and understandable.

## Motion

- State transitions run 140–180ms with standard easing.
- The next-move thread may cross-fade and move up 2px when state changes; no entrance choreography.
- Press feedback appears within one frame when safe.
- Respect `prefers-reduced-motion`; state remains fully legible without animation.

## Responsive behavior

- Test 1440×900, 1280×800, 390×844, and 360×800.
- At 920px, queue widths contract and secondary copy hides before controls wrap.
- At 760px, the shell becomes mobile; two-pane surfaces become one active pane with a deliberate back/people control.
- Touch targets are at least 44px. Bottom actions include safe-area inset. No workflow relies on hover.

## Explicitly rejected patterns

- Cards around every statistic or sentence.
- Giant page headers, permanent inspectors, dense filter bars, and expanded bucket trees.
- Gradients, AI sparkles, decorative charts, glass effects, and neon accents.
- Tiny uppercase metadata, operator-console language, or badges for healthy default state.
- Hiding blocked actions or silently returning zero results.
- A unified Review destination, swipe cards, automatic review carousel, forced person-by-person progression, or automatic draft creation after sourcing.
- Requiring employer certification or responsibility research before a truthful title-based personal introduction.

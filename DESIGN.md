---
name: NetworkPilot
description: A calm private desk for thoughtful professional outreach.
colors:
  ink: "#17211d"
  muted: "#69736e"
  canvas: "#f3f5f1"
  paper: "#fbfcfa"
  sage: "#dce9df"
  green: "#205f48"
  lime: "#c8f16a"
  line: "#d6dcd7"
  warning: "#a36f2e"
  danger: "#93463b"
  white: "#ffffff"
typography:
  display:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 3vw, 2.625rem)"
    fontWeight: 770
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 750
    lineHeight: 1.15
  body:
    fontFamily: "Arial, Helvetica, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace"
    fontSize: "0.625rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.green}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: NetworkPilot

## Overview

**Creative North Star: "The Private Editorial Desk"**

NetworkPilot should feel like a quiet, well-made writing and relationship workspace: private, evidence-aware, and purposeful. The interface uses a restrained editorial hierarchy, warm neutral surfaces, and deep green actions so people and messages dominate while provider mechanics recede.

Density is useful only when it shortens daily work. The system favors two-pane review, one visible next action, progressive disclosure for methodology, and clear recovery states. It rejects generic AI command-center theater, decorative dashboards, and any visual treatment that makes an irreversible action feel casual.

**Key Characteristics:**

- Calm warm-neutral surfaces with a rare deep-green action color.
- People, message copy, and relationship state precede implementation metadata.
- Compact desktop workspaces recompose into focused mobile review flows.
- Safety and uncertainty remain explicit without overwhelming normal work.

## Colors

The palette is quiet and botanical: dark ink, warm paper, soft sage, and one confident operating green.

### Primary

- **Private Green:** The primary action, selected-state, and recoverable-navigation color.
- **Signal Lime:** A rare accent reserved for the small NetworkPilot mark and high-confidence positive signal.

### Neutral

- **Deep Ink:** Primary text and the dark navigation rail.
- **Quiet Muted:** Secondary copy and supporting metadata.
- **Work Canvas:** The continuous application background.
- **Writing Paper:** Review panes, messages, and focused editing surfaces.
- **Soft Sage:** Selected filters and gentle supporting emphasis.
- **Hairline:** Dividers that organize dense work without boxing every region.

### Named Rules

**The One Action Rule.** Deep green identifies the current safe next action; do not scatter equally weighted green controls across a workspace.

**The Meaningful Warning Rule.** Amber and red communicate review, uncertainty, suppression, or danger only. They are not decorative accents.

## Typography

**Display Font:** Arial / Helvetica / system sans-serif
**Body Font:** Arial / Helvetica / system sans-serif
**Label/Mono Font:** SFMono-Regular / Consolas / Liberation Mono / Menlo

**Character:** The sans-serif hierarchy is direct and contemporary. Monospace is limited to compact state or evidence labels; it must never make the product feel like an operator console.

### Hierarchy

- **Display** (770, fluid 30–42px, 0.98): Page and selected-person names.
- **Title** (750, 21px, 1.15): Workspace sections and message subjects.
- **Body** (400, 14px, 1.55): Message copy, explanations, and evidence summaries; keep long prose near 72 characters per line.
- **Label** (650, 10px, 0.05em): Short state and evidence labels only.

### Named Rules

**The Read Before Density Rule.** Decision-critical text is normal body size; tiny uppercase or monospace labels are strictly tertiary.

## Layout

Desktop uses a fixed 52px command bar and 68px primary rail, with page-local recipient filters beneath the shell. Drafts, Candidates, Sent, and Resumes use list/detail or queue/message compositions so the active person stays contextualized. Main panes may scroll independently, but the identity and current action remain visible.

At 860px and below, the rail becomes a 58px bottom navigation, page-local filters collapse to one select, and detail views become focused overlays or review routes. Primary controls are at least 44px high, safe-area insets are honored, and no workflow may rely on hover. Layouts must remain readable at 360×800, 390×844, 1280×800, 1440×900, and 125% effective scale.

**The One Context Control Rule.** Mobile exposes at most one compact page-context control above daily work.

## Elevation & Depth

The system is flat by default. Tonal layering and hairline dividers establish structure; small ambient shadows appear only on overlays, focused message cards, and temporary menus.

### Shadow Vocabulary

- **Ambient Card** (`0 10px 28px #17211d0c`): A focused message or review surface above its canvas.
- **Floating Panel** (`0 18px 44px #10171420`): Temporary filters and anchored menus.

**The Flat-By-Default Rule.** A permanent panel does not need a shadow merely to announce its boundary.

## Shapes

Controls use gently curved 8px corners, message cards use 12px corners, and compact status treatments may use a pill. Dividers and tonal shifts carry most grouping; repeated bordered cards are avoided. The circular brand mark and relationship avatars are the intentional exceptions.

## Components

### Buttons

- **Shape:** Gently curved (8px), with a 44–48px minimum height.
- **Primary:** Private Green on white, reserved for the current safe next action.
- **Hover / Focus:** A modest tonal darkening and a visible 3px sage focus outline; active state may move by one pixel.
- **Secondary:** Paper or transparent surface, green or ink text, and a quiet border.

### Chips

- **Style:** Soft Sage background with deep green text for selected page-local filters.
- **State:** Keep counts secondary; the label must remain readable without the count.

### Cards / Containers

- **Corner Style:** 12px for focused cards; broad workspace panes stay mostly square.
- **Background:** Writing Paper over Work Canvas.
- **Shadow Strategy:** Flat at rest; ambient shadow only for focused or floating layers.
- **Border:** Hairline dividers rather than full borders wherever possible.
- **Internal Padding:** Usually 16–32px, responsive to the pane.

### Inputs / Fields

- **Style:** White or paper surface, 8px radius, quiet hairline stroke, 44px minimum control height.
- **Focus:** 3px sage-green outline with a 2px offset.
- **Error / Disabled:** Plain-language reason near the action; disabled state remains legible and never appears actionable.

### Navigation

Primary navigation stays stable across Today, Drafts, Sent, and Candidates. Recipient buckets are page-local filters, not nested application navigation. Desktop uses a compact dark rail; mobile uses a persistent four-item bottom bar.

### Message Review

The recipient, attachment, subject, message, and current lifecycle action form one focused composition. Evidence and methodology live under a clearly named disclosure. Approval and Gmail-draft creation may share a button; sending remains a separate explicitly confirmed action.

## Do's and Don'ts

### Do:

- **Do** keep the selected person and exact next action visible while evidence scrolls.
- **Do** write blocked and uncertain states in plain language beside the blocked action.
- **Do** preserve keyboard focus when opening or closing mobile detail and review views.
- **Do** use progressive disclosure for evidence, methodology, and infrastructure health.

### Don't:

- **Don't** infer trust, qualification, responsibility, or actionability through visual optimism.
- **Don't** make bucket taxonomy, provider credits, or lifecycle mechanics dominate daily work.
- **Don't** truncate a message subject, attachment identity, or blocker without a full-text affordance.
- **Don't** make Send look like the natural continuation of approval; it is a distinct external consequence.

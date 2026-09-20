# Concept B — Network Command

## Visual thesis

A compact, high-velocity operating console where queue, context, and action stay continuously present and every input produces immediate, precise feedback.

## Emotional goal

Opening NetworkPilot should feel fast, responsive, precise, tactile, and powerful. The product is ready at the same instant Dylan is. It should never feel like a terminal, game, or generic dark SaaS product.

## Typography

- **Interface:** Arial, Helvetica, system-ui, sans-serif.
- **Codes, counts, time, shortcuts:** `SFMono-Regular`, Consolas, `Liberation Mono`, Menlo, monospace.

The system uses weight, tracking, tabular numerals, and alignment rather than a display face. No remote font dependency.

## Color system

```css
--background: #F6F7F5;
--foreground: #121917;
--muted: #68726E;
--border: #DDE1DE;
--accent: #146B4B;
--positive: #1F7A50;
--caution: #9A641C;
--destructive: #A13F38;
--surface: #FFFFFF;
--surface-raised: #FBFCFB;
--selection: #E3F0E9;
--focus: #2B7FFF;
--command: #101714;
```

The base is light and neutral. The near-black command surface is reserved for the command menu and explicit confirmation, preventing “dark mode” from becoming the concept.

## Surface system

- **Plain layout:** page background and work lanes.
- **Panel:** docked queue, preview, and context inspector; panels share edges and do not float.
- **Popover:** compact filters and reversible secondary actions.
- **Sheet:** narrow-screen filters, evidence, and relationship detail.
- **Dialog:** only send confirmation, uncertain-send resolution, and destructive actions.
- **Table/list:** primary interaction model; rows have a fixed anatomy and roving focus.
- **Elevated surface:** command menu, confirmation, and transient toast only.

Every elevation corresponds to modality. Decorative elevation is prohibited.

## Density system

- **Compact:** 34–38 px queue rows, optimized for 30+ items and keyboard use.
- **Comfortable:** 44–48 px rows, default for Drafts, Sent, and Candidates.
- **Expanded/detail:** 64 px selected summary plus inspector/editor.

Users can switch list density globally. Action zones never wrap; blocked reasons belong in the inspector. Tabular numerals align counts and time.

## Navigation

- **Desktop:** a 52 px command bar across the top with NetworkPilot, global jump/search, and provider health. A 56 px left icon rail contains the primary destinations. The current page’s local views and counts occupy a second 40 px bar.
- **Narrow desktop/tablet:** the icon rail remains; the context inspector overlays rather than compresses the work plane.
- **Mobile:** four-tab bottom bar plus a top command/search button. Queue state is a segmented local header. Review is a full-screen stack with a sticky action dock.

## Today composition

Today is an action stack. The left 65% is “Now,” a prioritized list of executable work with one selected action and inline preview. The right 35% is a live rail: Queue, Relationships, Supply, and Connections. Each condition shows state and consequence, not a KPI card. When healthy, Gmail and Apollo compress to one quiet line; when actionable, the relevant condition rises into Now.

The selected task can be completed from the first viewport. Today is not a portal to work; it is the start of work.

## Drafts composition

- **5 drafts:** all rows visible in a 320 px queue; selected message and context share the remaining width.
- **15 drafts:** grouped inbox with sticky headers and progress. `J/K` selection updates preview instantly without routing.
- **30 drafts:** compact mode, state tabs with counts, virtualized queue, and a “processed today” marker. Search and filter live in the local bar.

The default layout is queue / message / inspector. The bottom action dock belongs to the selected item and shows the one primary lifecycle action. Skip and Replace are command actions, never a repeating column of buttons.

## Draft Review

Review is an integrated mode, not a separate-looking page. The left queue remains visible. The message plane has an email-client header—recipient, subject, attachment—and a focused body editor. The inspector displays intent, evidence, safety checks, and immutable version.

The primary action evolves through the lifecycle: **Approve** → **Create Gmail Draft** → **Send approved email**. The label never generalizes to “Continue.” Send requires the existing explicit confirmation. If mutable gates change, the dock is replaced by a human-readable block with the relevant repair action. Skip and Replace remain available without competing with the lifecycle action.

## Sent / CRM

Sent uses an inbox-like list with “Needs attention” as the default smart view. The inspector contains a compact event timeline and outcome controls. Search spans person, company, role, and subject without exposing private identifiers. Follow-up timing is emphasized only when policy supports it; awaiting response is not treated as failure.

## Candidates

Candidates behaves like a supply browser. A query bar accepts structured filters and a regular search. The list leads with identity and company; relevance, track, role family, location, and availability align to the right. The inspector exposes qualification evidence, history, suppression, and planning eligibility. Bulk actions do not exist.

Supply feels abundant because navigation is instant, the list retains place, and the selected person can be evaluated without losing the result set.

## Resume Library

Resume Library is a compact asset manager. Rows show label, lane, active version, size, and attachment usage. The inspector provides preview and metadata; “Add resume” opens a side sheet. In Draft Review, `Cmd/Ctrl Shift A` opens the same searchable resume picker with None first.

## System / Diagnostics

System is a secondary console using structured sections and copyable evidence, but not terminal aesthetics. Health summary is first; provider configuration, budget accounting, migrations, and simulation are collapsed below. Read-only status and mutating actions are visibly distinct. Raw enum names are translated at the UI boundary.

## Empty states

Empty states preserve the command model:

- **Queue complete:** selection area reads “All clear” and offers Sent or Candidates.
- **No reserve:** primary command becomes Refresh Candidates with its bounded consequence.
- **No result:** command bar retains the query and offers clear filters.
- **No resumes:** searchable picker explains None and links to Add resume.

## Loading states

Lists render stable row skeletons at the current density. Selecting a row updates the inspector optimistically only for local state; provider operations show an explicit in-place pending phase and lock duplicate invocation. Route-level spinners are avoided.

## Success feedback

State labels update in place, then the row moves to its new group. Focus advances to the next actionable row. A compact event line confirms what occurred and where the item now lives. Send success shows Sent time and the Sent destination; no confetti.

## Error feedback

Errors attach to the command that failed and retain the selected record. Retryable, uncertain, blocked, and permanent states have distinct copy and icons. An uncertain send never animates as success and stays in Drafts with “Resolve send state” as its primary action.

## Mobile experience

Today becomes an ordered action feed plus a collapsible health strip. Drafts opens as a queue; tapping a row pushes a full-screen review while retaining the queue position. The body editor uses a distraction-free mode and the lifecycle action stays above the safe-area inset. Sent and Candidates are identity-first lists with filter/search sheets. System favors read-only health; deep tables require desktop.

## Motion thesis

Exactly four motions define the concept:

1. **Selection tracking:** the active-row highlight and inspector content transition together in 90–120 ms, making `J/K` navigation feel continuous.
2. **Queue reflow:** completed, skipped, or replaced rows compress out while neighboring rows translate into place, 150–180 ms; focus follows the next item.
3. **Command response:** the command menu scales from 0.985 to 1 while fading in over 110 ms; matching actions update without layout jump.
4. **Lifecycle transfer:** on approval or send, a thin state trace travels from the action dock to the destination tab/count, 180–220 ms; reduced motion uses a color/state update only.

## Microinteractions

- **Button press:** inset shadow and 1 px compression; pending state appears immediately.
- **Hover:** action target gains a crisp background; row metadata remains still.
- **Row selection:** roving focus, accent edge, and inspector update operate as one event.
- **Skip:** reason command appears under the selected row; confirmation reflows the queue.
- **Replacement:** selected slot shows “finding replacement,” then swaps identity without scroll loss.
- **Send success:** row state changes to Sent, destination count increments, then focus advances.
- **Add Drafts:** command reveals available reserve and bounded quantity; new rows are marked “New” until first navigation.
- **Filters:** `F` focuses the filter bar; active query is editable as tokens with plain-language labels.
- **Attachment selection:** searchable picker previews label, lane, and version; selection updates the message header.
- **Command menus:** `Cmd/Ctrl K` searches navigation and context-valid actions; unsafe unavailable actions explain why instead of disappearing.

## Keyboard experience

`J/K` select, `Enter` focuses review, `E` edits, `A` approves, `R` replaces, `X` skips, `G` creates the eligible Gmail draft, `S` begins explicit send confirmation, `F` filters, `/` searches, `N` opens Add Drafts, and `Esc` moves one level back. `Cmd/Ctrl K` exposes all actions and shortcut hints. Destructive or external actions always retain confirmation and mutable gate checks.

## What makes this distinctly NetworkPilot

The command model maps directly to NetworkPilot’s safe lifecycle. It is not a general CRM: every view is oriented around one thoughtful outreach decision, immutable message evidence, candidate supply, and relationship outcome. Provider conditions are live constraints in the same command grammar.

## Risks

- High density can feel clinical if person identity is underweighted.
- Keyboard ambition can create hidden behavior unless every shortcut is taught.
- Three-pane responsiveness and focus management demand careful engineering.
- Speed must never visually encourage bulk sending or shortcut safety confirmation.

## Textual wireframes

### Today — desktop

```text
┌ NP │ Today │ Jump / Search… ⌘K ─────────────────── Gmail ready · Apollo 10/20 ┐
├────┼─ NOW ────────────────────────────────────┬─ LIVE STATE ──────────────────┤
│ ◎  │ ▌Review prepared drafts          5   ↵   │ Queue        15 active       │
│ ✎  │  Follow-up decisions             2       │ Relationships 2 attention    │
│ ✓  │  Candidate supply               42       │ Supply       healthy         │
│ ◇  │                                          │ Connections  all ready        │
│ ⚙  ├─ SELECTED PREVIEW ───────────────────────┤                              │
│    │ A••• P. · Northstar · Senior AI Engineer │ [Open review]                │
└────┴───────────────────────────────────────────┴──────────────────────────────┘
```

### Today — mobile

```text
Today                          ⌘
NOW
▌ Review prepared drafts            5  →
  Follow-up decisions               2  →
  Candidate supply                 42
────────────────────────────────────────
Ready: Gmail · Supply     Apollo 10/20
[Today] [Drafts] [Sent] [Candidates]
```

### Drafts — desktop

```text
┌ NP │ Drafts 15 │ Review 5  Approved 4  Gmail 3  Uncertain 3 │ Filter / ┐
├────┼─ QUEUE ─────────────┬─ MESSAGE ─────────────────┬─ INSPECTOR ─────┤
│    │ ▌A••• P. Northstar │ To / Subject / Attachment │ Intent           │
│    │  J••• M. Helix     │                           │ Evidence         │
│    │  R••• C. Meridian  │ [focused email body]      │ Safety checks   │
│    │  ...               │                           │ Version          │
├────┴─────────────────────┴───────────────────────────┴──────────────────┤
│ X Skip   R Replace      4/15 processed        [A Approve]        J Next │
└─────────────────────────────────────────────────────────────────────────┘
```

### Drafts — mobile

```text
Drafts 15        [Review 5 ▾]       Search
▌A••• P.  Northstar
 Senior AI Engineer         Needs review
 J••• M.  Helix
 Product Manager            Needs review
──────────────────────────────────────────
Tap row → full-screen review; queue place retained
```

### Draft Review — desktop

```text
QUEUE 4/15          MESSAGE                                INSPECTOR
previous            To: A••• P. · Northstar               Eligible
▌current            Subject: A question about...          Intent
next                Attachment: None                      Evidence
                    ─────────────────────────────          Company
                    [editable body]                       History
────────────────────────────────────────────────────────────────────
X Skip   R Replace      Esc Queue                  [A Approve draft]
```

### Draft Review — mobile

```text
‹ Drafts             4/15              Evidence
A••• P. · Northstar
To / Subject / Attachment
[editable body fills viewport]
────────────────────────────────────────────
Skip       Replace                       Approve
```

### Sent — desktop

```text
Sent │ Needs attention 2 │ Awaiting 12 │ Replied 3 │ Closed 5 │ Search
──────────────────────────────────────┬────────────────────────────────
▌A••• P. Northstar  Awaiting · 7d     │ TIMELINE
 J••• M. Helix      Replied · today   │ Draft approved      Sep 14
 R••• C. Meridian   Meeting           │ Sent                Sep 14
 E••• K. Atlas      Bounced            │ Awaiting response   Current
                                      │ [Record outcome]
```

### Sent — mobile

```text
Sent                          Search
[Attention 2] [Awaiting] [Replied] [All]
A••• P. · Northstar       Awaiting · 7d →
J••• M. · Helix           Replied today →
Selected record opens timeline sheet.
```

### Candidates — desktop

```text
Candidates 42 │ Search people/companies… │ Track + Role + Location │ Clear
──────────────────────────────────────────────┬────────────────────────
▌A••• P.  Northstar  AI Product Mgr  Available│ WHY THIS PERSON
 J••• M.  Helix      Data Program Mgr Available│ evidence / history
 R••• C.  Meridian   Tech Recruiter   Available│ safety / company
 ...                                          │ [Add to next drafts]
```

### Candidates — mobile

```text
Candidates 42             Search   Filter
A••• P. / Northstar
AI Product Manager         Product · Available →
J••• M. / Helix
Data Program Manager       Data · Available    →
```

### Resumes — desktop

```text
Resumes │ Search…                                      [Add resume]
──────────────────────────────────┬──────────────────────────────────
▌General Resume  General  Active │ PDF PREVIEW
 Product Resume  Product  Active │ Label / lane / version / usage
 Data Resume     Data     Inactive│ [Edit metadata] [Deactivate]
```

### Resumes — mobile

```text
Resumes                   Search   Add
General Resume         General · Active →
Product Resume         Product · Active →
Data Resume            Inactive · history →
Tap → preview and metadata sheet
```

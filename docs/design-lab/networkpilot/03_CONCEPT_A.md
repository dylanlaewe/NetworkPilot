# Concept A — Executive Search Desk

## Visual thesis

A warm, editorial operating desk where every person reads like a considered brief and every action feels precise, discreet, and consequential.

## Emotional goal

Opening NetworkPilot should feel like sitting down at a prepared executive-search desk: focused, confident, calm, high-trust, and serious. The system has already organized the day; Dylan supplies judgment.

## Typography

- **Editorial and correspondence:** Georgia, `Times New Roman`, serif.
- **Interface and metadata:** Arial, Helvetica, system-ui, sans-serif.

Georgia is used selectively for page anchors, person names, message subject, and correspondence—not for controls or dense tabular data. No remote font dependency.

## Color system

```css
--background: #F3F0E8;   /* warm paper */
--foreground: #19251F;   /* ink */
--muted: #667068;        /* graphite */
--border: #D4D0C6;       /* rule */
--accent: #245E49;       /* library green */
--positive: #2E7654;     /* completed / ready */
--caution: #A36A24;      /* needs attention */
--destructive: #9A4338;  /* suppressed / hard failure */
--surface: #FAF8F2;      /* writing sheet */
--elevated: #FFFFFF;     /* popover / dialog only */
--selection: #E3E9DF;    /* selected row */
```

Color never labels prestige. Track and role family rely on words and restrained typographic cues.

## Surface system

- **Plain layout:** default for Today, Candidates, Sent, and System. Sections are organized by columns, rules, and whitespace.
- **Panel:** a persistent detail or research rail attached to a selected record.
- **Popover:** small reversible choices—filters, resume selection, queue options.
- **Sheet:** mobile record detail and desktop secondary work that must preserve the list beneath.
- **Dialog:** only confirmation of consequential, interruptive actions such as final send or destructive deactivation.
- **Table/list:** editorial ledger with strong identity column and minimal vertical rules.
- **Elevated surface:** correspondence sheet, command menu, and active dialog only.

Cards are not a layout primitive. A bordered block must represent a discrete object or a changed interaction mode.

## Density system

- **Compact (40–44 px rows):** 15–30 drafts, candidate supply, Sent history.
- **Comfortable (52–60 px rows):** default queue, resume documents, Today actions.
- **Expanded/detail:** selected person brief, relationship timeline, and draft correspondence.

Density is a view preference at the list level, not an arbitrary mix within a list. Wrapped action explanations never increase one row’s height; the reason appears in the detail rail.

## Navigation

- **Desktop:** a 208 px left rail with NetworkPilot wordmark, Today, Drafts, Sent, Candidates, and a quiet bottom cluster for Resumes and System. Drafts shows a modest count, not a pill cloud. The rail uses the background color and a thin right rule.
- **Narrow desktop/tablet:** rail collapses to a 56 px icon spine; hovering or focusing reveals labels. Current page and queue count remain visible.
- **Mobile:** bottom navigation for Today, Drafts, Sent, and Candidates; a top-right utility menu contains Resumes and System. Review replaces bottom navigation with a decision bar.

## Today composition

Today is a briefing, not a dashboard. A left date rail anchors the day. The central column begins immediately with “Your desk” and a prioritized editorial docket: Review 5 drafts, Resolve one Gmail issue, Follow up on two relationships. The right column is a compact “Operating conditions” ledger for candidate supply, Gmail, and Apollo. Below, a horizontal relationship pulse shows awaiting, replied, meeting, and bounced as text with counts—no stat cards.

The first viewport answers: what deserves judgment, what is healthy, and what happens next.

## Drafts composition

- **5 drafts:** queue occupies the left third; the first item is selected and its full letter is visible in the central sheet. Research/intent appears in a right brief. All five queue positions are visible.
- **15 drafts:** the queue is scrollable with section breaks: Needs review, Approved, Ready in Gmail, Uncertain. Selection remains pinned. Progress reads “4 of 15 processed today.”
- **30 drafts:** compact rows, virtualized if needed, with a sticky state index and saved scroll/selection. No action buttons in every row. The selected draft owns the decision bar.

Queue row anatomy: redacted identity and company on line one; role and intent on line two; state at right. The selected row receives a full-width tinted rule, not a floating card.

## Draft Review

The center is a typographic letter sheet. Recipient and company are a letterhead-like line; subject is prominent serif text; body is a borderless, comfortable editor. Edits show a quiet “Edited” mark. The right brief explains intent, relevance evidence, track, and mutable safety state.

Resume attachment is a named document strip beneath the letter, defaulting to None. The footer is persistent and ordered: **Approve** (primary), **Replace** (secondary), **Skip** (quiet/destructive), then queue navigation. After approval, the same footer changes to **Create Gmail Draft**; after creation it changes to **Send approved email** with explicit confirmation. The immutable approved snapshot is shown as a sealed state; editing requires creating a new draft version, never mutating the approved one.

## Sent / CRM

Sent is a relationship ledger. Rows group by attention: Follow-up due, Awaiting response, Conversations, Closed. Selecting a person opens a right-hand chronology with draft approved, Gmail draft created, sent, response/outcome, attachment, and operator evidence. The current outcome and next human action lead; transport metadata stays behind “Evidence.”

## Candidates

Candidates begins with an always-visible search and a sentence of supply: “42 people available across 31 companies.” Filter categories open in a compact popover; active filters appear as a readable query sentence, not a row of pills. The list gives each person a two-line identity block, company evidence, relevant lane, and availability. Selecting a row opens “Why this person” and outreach history in the right rail.

Abundance is communicated by continuous, well-grouped supply—not a gallery of profile cards. Company repetitions are visually grouped but never imply prestige.

## Resume Library

Resumes appear as document folios: label, role lane, version, size, status, and last attached context. Selecting a row opens a safe local PDF preview and usage history. Upload is a compact “Add document” action that opens a sheet with drop target, label, and lane. Active/inactive is presented as library availability, not a generic toggle.

## System / Diagnostics

System uses the same shell but a colder, more technical density. A single status ledger groups Data, Gmail, Apollo, Safety, and Build. Healthy groups are collapsed; actionable exceptions expand automatically. Simulation lives here as an explicitly separated local workspace. No large campaign hero, decorative geometry, or competing brand language.

## Empty states

- **Day complete:** “Your desk is clear” with the next scheduled condition and a link to Sent.
- **No draft supply:** explains whether reserve exists and offers the correct next action.
- **No candidate result:** restates the active query and offers one reversible relaxation.
- **No resumes:** shows a paper outline, privacy promise, and “Add first document.”

## Loading states

Preserve the ledger and three-column geometry. Rows use low-contrast text lines; the selected letter sheet uses a static paper skeleton. Only the region being updated enters pending state. Controls remain stable in position.

## Success feedback

Success is quiet and directional: an approved draft gains a seal mark and advances to the Approved section; a sent item leaves the queue and its name appears momentarily in the Sent destination indicator. A small undo appears only where the domain permits reversal.

## Error feedback

Errors appear beside the affected decision bar or operating condition. Copy states the human consequence and next safe action. Permanent suppression is red and explicit; retryable provider failure is amber; configuration unavailability is gray with a settings route.

## Mobile experience

Mobile opens to a “Today” docket of three or fewer prioritized items. Draft review is single-item and full-screen: identity header, message canvas, evidence drawer, sticky decision bar. Swipe is not assigned to destructive actions. Sent is a searchable relationship list with a chronological sheet. Candidates are a compact feed with filters in a full-screen sheet. Resume upload and diagnostics are supported, but document preview and deep evidence defer to desktop when appropriate.

## Motion thesis

Exactly four motions define the concept:

1. **Desk continuity:** route changes crossfade the work plane while the navigation rail and selected identity remain fixed, 140–180 ms.
2. **Ledger transfer:** Approve, Replace, and Send move the selected row along a short horizontal path into its destination section, then settle the next row into focus, 180–220 ms.
3. **Letter reveal:** opening review expands the selected row’s center edge into the paper sheet, preserving identity as a shared element, 200 ms.
4. **Evidence disclosure:** context rails and mobile sheets slide 12 px while fading, 140 ms; reduced-motion mode uses opacity only.

## Microinteractions

- **Button press:** 1 px downward translation, darker fill, immediate pending label without width change.
- **Hover:** ledger row receives a faint ink wash; the actionable region underlines, not the whole row.
- **Row selection:** a 3 px accent rule grows from the center and the row background warms.
- **Skip:** opens an anchored reason menu; completion removes the row and focuses the next.
- **Replacement:** old and new identities briefly align in place so causality is obvious.
- **Send success:** letter receives “Sent” with time, then transfers to relationship memory.
- **Add Drafts:** count selector appears inline; inserted rows arrive at the relevant queue section.
- **Filters:** result count updates in the menu before Apply; clearing restores prior scroll.
- **Attachment selection:** selected resume appears as a paperclip strip with version evidence; None remains explicit.
- **Command menus:** searchable actions show shortcut and consequence; dangerous actions are never the initial selection.

## Keyboard experience

`J/K` moves queue selection, `Enter` opens/focuses review, `E` edits, `A` begins approval, `R` begins replacement, `X` begins skip, `G` creates a Gmail draft only when eligible, and `Esc` returns to the queue without losing position. `Cmd/Ctrl K` opens a scoped command menu; it teaches these shortcuts and never bypasses confirmation. `Shift J/K` moves between queue sections. Shortcuts are disabled while typing.

## What makes this distinctly NetworkPilot

The visual metaphor is not “recruiting software”; it is Dylan’s prepared search desk. Candidate evidence reads like a brief, the draft like a letter, the approved snapshot like a sealed record, and Sent like a relationship ledger. Provider limits are operating conditions, never the protagonist.

## Risks

- Editorial type can become ornamental or reduce density if overused.
- Warm neutrals can feel conservative unless selection and motion are crisp.
- The three-pane Drafts model needs careful responsive and accessibility work.
- “Executive search” cues must not imply prestige scoring or exclusivity.

## Textual wireframes

### Today — desktop

```text
┌─ rail ─────┬─ SUN 20 SEP ─────────────────────────────┬─ OPERATING CONDITIONS ─┐
│ NetworkPilot│ Your desk                                │ Gmail        Ready      │
│ Today       │                                         │ Candidates   42         │
│ Drafts  15  │ 01  Review 5 prepared messages     →    │ Apollo       Resets 9am │
│ Sent        │ 02  Follow up with 2 relationships →    │                         │
│ Candidates  │ 03  Candidate reserve is healthy        │ Next constraint         │
│             │                                         │ Company cooldown: clear │
│ Resumes     ├─ RELATIONSHIP PULSE ────────────────────┴─────────────────────────┤
│ System      │ Awaiting 12     Replied 2     Meetings 1     Bounced 1             │
└─────────────┴─────────────────────────────────────────────────────────────────────┘
```

### Today — mobile

```text
NetworkPilot                         Sun 20 Sep
YOUR DESK
1  Review 5 prepared messages                  →
2  Follow up with 2 relationships              →
3  Reserve healthy · 42 available
────────────────────────────────────────────────
Gmail Ready        Apollo Resets 9am
[Today] [Drafts 15] [Sent] [Candidates]
```

### Drafts — desktop

```text
┌─ QUEUE 15 ───────┬─ LETTER  4 OF 15 ──────────────────┬─ PERSON BRIEF ─────────┐
│ Needs review  5  │ To: A••• P. · Northstar            │ Senior AI Engineer     │
│ ▌A••• P.         │ Subject: A question about...       │ Professional · AI/ML   │
│  J••• M.         │                                    │ Why this person         │
│  R••• C.         │ Hi Alex,                           │ • role evidence         │
│ Approved      4  │ [borderless editable letter]       │ • company evidence      │
│ Gmail ready   3  │                                    │ Safety: eligible        │
│ Uncertain     3  │ Attachment: None                   │                         │
├──────────────────┴────────────────────────────────────┴─────────────────────────┤
│ Skip     Replace                         Previous  [Approve]  Next               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Drafts — mobile

```text
Drafts · 4 of 15                         Queue ▾
A••• P. · Northstar
Senior AI Engineer · Professional
────────────────────────────────────────────
Subject: A question about...

Hi Alex,
[editable letter body]

Attachment  None ▾      Why this person ▴
────────────────────────────────────────────
Skip       Replace                    Approve
```

### Draft Review — desktop

```text
┌─ queue context ─┬──────────────── LETTER ────────────────┬─ rationale ─────────┐
│ 03 previous     │ A••• P. / Northstar                    │ INTENT               │
│ 04 current      │ Subject [serif editable subject]       │ Learn about AI work  │
│ 05 next         │                                        │ EVIDENCE             │
│                 │ [correspondence body, generous measure]│ Role · Company · Lane│
│                 │                                        │ SAFETY  Eligible     │
│                 │ Resume: None ▾                          │ VERSION  Draft 3     │
├─────────────────┴────────────────────────────────────────┴─────────────────────┤
│ Esc Queue     Skip     Replace                              [Approve snapshot]   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Draft Review — mobile

```text
‹ Queue                    4 of 15        • Eligible
A••• P. · Northstar
[Subject]
[Letter body]
────────────────────────────────────────────
Resume: None ▾       Evidence / intent ▾
Skip      Replace                         Approve
```

### Sent — desktop

```text
┌─ RELATIONSHIPS ──────────────────────────────┬─ A••• P. / NORTHSTAR ───────────┐
│ Follow-up due 2                              │ Sep 14  Approved                 │
│ ▌A••• P.  Northstar  Awaiting · 7d           │ Sep 14  Gmail draft created      │
│  J••• M.  Helix      Replied · today         │ Sep 14  Sent with Product Resume │
│ Awaiting 12                                 │ Today   Awaiting response        │
│ Conversations 3                            │                                 │
│ Closed 5                                   │ [Record outcome]                │
└──────────────────────────────────────────────┴─────────────────────────────────┘
```

### Sent — mobile

```text
Sent / Relationships           Search
[Needs attention 2] [All 22]
A••• P.   Northstar        Awaiting · 7d  →
J••• M.   Helix            Replied today  →
R••• C.   Meridian         Meeting        →
Tap → chronological relationship sheet
```

### Candidates — desktop

```text
Candidates     42 available across 31 companies       [Search] [Filter]
Showing Professional + Product/Data in Northeast               Clear query
────────────────────────────────────────────────────────────────────────────
▌A••• P.     Northstar      AI Product Manager        Product      Available
 why: product + applied AI evidence                                      →
 J••• M.     Helix          Data Program Manager      Data         Available
 R••• C.     Meridian       Technical Recruiter       Recruiter    Available
────────────────────────────────────────────────────────────────────────────
Selected brief appears in right rail without leaving supply.
```

### Candidates — mobile

```text
Candidates · 42                      Filter (2)
Professional + Product/Data              Clear
A••• P.
AI Product Manager · Northstar
Product · Available                         →
────────────────────────────────────────────
J••• M.
Data Program Manager · Helix                →
```

### Resumes — desktop

```text
Resume Library                                      [Add document]
────────────────────────────────────────────────────────────────────────────
▌General Resume       General     Active     v. 6235...      Last used Sep 19
 Product Resume       Product     Active     v. 81ab...      Never attached
 Data Resume          Data        Inactive   v. 19c2...      Historical
──────────────────────────────────────┬─────────────────────────────────────
Document preview                      │ Label / lane / status / usage       │
```

### Resumes — mobile

```text
Resume Library                    Add
General Resume
General · Active · 73 KB                    →
Product Resume
Product · Active · Never attached           →
Data Resume
Inactive · Historical                       →
```

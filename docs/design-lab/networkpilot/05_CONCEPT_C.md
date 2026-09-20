# Concept C — Career Editorial

## Visual thesis

A personal career journal that curates people, correspondence, and relationship history into a beautiful daily narrative without sacrificing operational speed.

## Emotional goal

Opening NetworkPilot should feel personal, ambitious, human, considered, and beautiful. The interface reminds Dylan that the work is relationship-building, not throughput—while still making 20-message days practical.

## Typography

- **Narrative and correspondence:** Charter, Georgia, `Times New Roman`, serif (Charter only where locally available; Georgia is the guaranteed fallback).
- **Interface and data:** Arial, Helvetica, system-ui, sans-serif.

Serif is reserved for daily briefing, names, narrative context, and email content. Controls, filters, state, and dense lists remain sans-serif. No remote font dependency.

## Color system

```css
--background: #F7F3EA;    /* journal paper */
--foreground: #20231F;    /* soft black */
--muted: #6F7068;         /* editorial gray */
--border: #D9D2C4;        /* hairline */
--accent: #2D604F;        /* forest */
--positive: #39765B;
--caution: #B0712A;
--destructive: #A2453E;
--surface: #FFFDF8;
--editorial-blue: #365E73; /* relationship / recruiter cue */
--selection: #EBE2D2;
--ink-faint: #97968E;
```

Role families may use tiny rules or initial glyphs in a limited secondary palette, never prestige labels or saturated badges.

## Surface system

- **Plain layout:** primary editorial canvas with asymmetric columns.
- **Panel:** person profile, daily margin notes, and contextual evidence.
- **Popover:** concise filters and metadata choices.
- **Sheet:** mobile profile, full relationship chronology, and resume preview.
- **Dialog:** external send confirmation and destructive actions only.
- **Table/list:** index or directory treatment with strong names and light rules.
- **Elevated surface:** the active letter and focused preview only.

The system favors spreads, margins, and indexes over dashboards and card grids.

## Density system

- **Compact index:** 38–42 px rows for 30 candidates or sent relationships.
- **Comfortable story list:** 54–64 px for Drafts and Today.
- **Expanded portrait:** person story, message, and relationship timeline.

Editorial breathing room is concentrated in the selected content, not repeated around every row. At 30 items, the index remains truly compact.

## Navigation

- **Desktop:** a slim top masthead. Primary destinations read as an index: Today, Drafts, Sent, Candidates. The active section is marked by a moving baseline. Resumes and System live under “Library.”
- **Narrow desktop/tablet:** masthead remains, while page-local navigation becomes a horizontally scrollable index.
- **Mobile:** title masthead plus bottom tabs. A “Library” drawer holds Resumes and System. Draft Review uses a chapter-like progress header and persistent actions.

## Today composition

Today is a curated briefing. A large but controlled date and a one-sentence editorial summary occupy the upper left: “Five letters are ready for your judgment; two relationships need attention.” Beside it, a narrow margin column lists Gmail, Apollo, and candidate supply as factual annotations. The main canvas contains three sequenced stories: Write, Send, Remember. Each shows a small number of real people and one action that starts work immediately.

This is not a marketing hero: the briefing and first draft are actionable within the first viewport.

## Drafts composition

- **5 drafts:** displayed as a short edition—five named entries on the left, selected letter open on the right.
- **15 drafts:** divided into “To shape,” “Approved,” and “Ready to send,” with a running progress marker in the margin.
- **30 drafts:** switches to an index view automatically: compact identity rows, state abbreviations with readable labels, and a persistent letter preview. Decorative spacing disappears.

The key interaction model is an editorial index paired with a reading/writing canvas. No actions are repeated across every entry.

## Draft Review

Review feels like writing a personal letter. The message begins with the recipient’s name and a short “why now” annotation. Subject and body are direct-edit text, not boxed fields until focused. A margin rail connects evidence to the message: company context, role relevance, shared educational or geographic context where truthful, outreach intent, and safety state.

Resume choice appears as an endnote: “Attached: None” or a named version. The bottom folio contains **Approve letter**, **Replace person**, and **Skip**. After approval, the letter is visually frozen and the lifecycle action becomes Gmail draft creation, then explicit send confirmation. Historical snapshots retain their own methodology and attachment evidence.

## Sent / CRM

Sent is “Correspondence,” a chronological relationship journal. The index emphasizes who and what happened; the detail view tells the story from draft through outcome. Follow-up attention appears as margin marks. Replies and meetings receive space for human notes; bounces and opt-outs remain explicit operational facts, not dramatic visual moments.

## Candidates

Candidates is “People to know.” Results are arranged as a dense editorial directory with name, role, company, lane, and one-line relevance. Company or lane sectioning creates rhythm without prestige ranking. A selected profile opens a portrait-style text view: professional context, relevance, source evidence, eligibility, and history. Filters read like editorial facets across the top.

## Resume Library

Resumes form a portfolio library. Each document has a title, lane, version, availability, and “used with” history. A local preview resembles a typeset page. Upload is “Add a version,” making version evidence central. The interface never exposes a filesystem path.

## System / Diagnostics

System is an appendix. It uses a compact factual index—Connections, Data, Safety, Providers, Simulation—with timestamps and status. Details open as technical notes. Visual drama is deliberately absent. Actionable conditions can link into Today, but routine telemetry never enters the editorial narrative.

## Empty states

- **Day complete:** a closing note, “Today’s correspondence is complete,” plus the next meaningful date.
- **No drafts:** shows the source of the next edition—reserve available or candidate refresh required.
- **No candidates:** preserves active facets and explains why the edition is empty.
- **No resumes:** introduces the private library and starts “Add a version.”

Empty states use plain language and one action. No illustrations are necessary.

## Loading states

The masthead, columns, and folio remain. Text blocks appear as quiet gray lines, and only the changing story shows progress. Long provider operations use a factual margin note with elapsed state; they never turn the whole page into a spinner.

## Success feedback

An approved letter gains a small dated folio mark. A sent letter closes into the Correspondence index and the next letter opens. A new draft enters the current edition with a temporary margin mark. Success is legible, calm, and specific.

## Error feedback

Errors appear as editor’s notes beside the affected fact or action. A provider problem explains what remains safe to do. Suppression and hard bounce use a red rule and exact language. An uncertain send remains an unresolved chapter with one clear reconciliation action.

## Mobile experience

Mobile is a daily digest plus one-letter review. Today presents the briefing, then Write/Send/Remember sections. Drafts is a compact edition index; selecting a letter opens full-screen correspondence with collapsible context notes and a sticky folio action bar. Sent becomes a chronological feed. Candidates become a reading list with a full-screen profile sheet. Resumes are a document list with metadata and preview. System becomes a read-only appendix-first view.

## Motion thesis

Exactly four motions define the concept:

1. **Edition change:** route transitions move the active baseline and crossfade the central editorial canvas over 160–200 ms while the masthead stays fixed.
2. **Letter opening:** a selected index entry expands from its name line into the correspondence plane using a shared origin, 200–240 ms.
3. **Folio completion:** approval or send stamps the dated state at 95% scale to full scale, then turns the next item into view, 180–220 ms.
4. **Margin annotation:** evidence and status notes reveal with a short vertical mask, 130–160 ms; reduced-motion mode reveals instantly.

## Microinteractions

- **Button press:** label and baseline move down 1 px; fill deepens without growing.
- **Hover:** names receive an underline that travels only across the text measure.
- **Row selection:** the margin mark moves to the chosen entry and its name shifts to serif.
- **Skip:** an editor’s-note menu asks for reason; the entry is struck through only during transition, never permanently styled as failure.
- **Replacement:** the index line retains its position while identity and rationale are replaced.
- **Send success:** a dated “Sent” folio appears, then the letter joins Correspondence.
- **Add Drafts:** a small edition drawer shows reserve and quantity; additions arrive under “New in this edition.”
- **Filters:** facets open as a typographic menu and update the result sentence live.
- **Attachment selection:** a resume endnote changes with a brief highlight and version detail.
- **Command menus:** a discreet `Cmd/Ctrl K` index offers navigation and current-page actions with shortcuts.

## Keyboard experience

`J/K` moves through the edition index, `Enter` opens a letter or person, `E` edits, `A` approves, `R` replaces, `X` skips, `G` creates an eligible Gmail draft, `/` searches the current index, `N` adds drafts, and `Esc` returns to the exact index position. `Cmd/Ctrl K` opens the global index. Send remains an explicit, separately confirmed action.

## What makes this distinctly NetworkPilot

NetworkPilot becomes a record of intentional professional relationships. Daily work is an edition, drafts are letters, candidates are people to know, resumes are a private portfolio, and Sent is correspondence history. The language is human without concealing operational evidence.

## Risks

- Editorial framing can romanticize routine work or reduce speed if too spacious.
- Serif use requires disciplined sizes and rendering tests across platforms.
- The metaphor could obscure lifecycle states unless operational labels stay explicit.
- At high density, the concept must switch decisively to index mode rather than preserve decorative composition.

## Textual wireframes

### Today — desktop

```text
NETWORKPILOT                  Today   Drafts   Correspondence   People   Library
───────────────────────────────────────────────────────────────────────────────
SUNDAY, SEPTEMBER 20                       OPERATING NOTES
Five letters are ready for your judgment;  Gmail · Ready
two relationships need attention.          Supply · 42 available
                                            Apollo · resets tomorrow
WRITE                                       REMEMBER
A••• P. / Northstar       Review letter →  J••• M. replied today        Open →
R••• C. / Meridian        Review letter →  Two follow-ups due           View →
SEND
Three approved letters     Continue →
```

### Today — mobile

```text
NetworkPilot                   20 Sep
Five letters are ready for your judgment;
two relationships need attention.
WRITE
A••• P. / Northstar             Review →
R••• C. / Meridian              Review →
SEND   3 approved               Continue →
REMEMBER   2 need attention        View →
[Today] [Drafts] [Sent] [People]
```

### Drafts — desktop

```text
DRAFTS / TODAY'S EDITION  ·  5 TO SHAPE  ·  4 APPROVED  ·  3 READY
──────────────────────┬───────────────────────────────┬────────────────────
TO SHAPE              │ A LETTER TO A••• P.           │ MARGIN NOTES
▌A••• P. Northstar    │ Subject: A question about…    │ Why now
 R••• C. Meridian     │                               │ Intent
 J••• M. Helix        │ Hi Alex,                      │ Evidence
                      │ [editable correspondence]      │ Eligible
APPROVED              │                               │
 ...                  │ Attached: None                 │
──────────────────────┴───────────────────────────────┴────────────────────
Skip · Replace                   Letter 4 of 15                   Approve letter
```

### Drafts — mobile

```text
Drafts / Today's edition          5 to shape
▌A••• P. / Northstar
  Senior AI Engineer                         →
R••• C. / Meridian
  Product Recruiter                          →
──────────────────────────────────────────────
Approved 4 · Ready 3 · Uncertain 3
```

### Draft Review — desktop

```text
04 / 15        A LETTER TO A••• P.                     WHY NOW
               Northstar · Senior AI Engineer          Applied AI context
               ──────────────────────────────          ROLE EVIDENCE
               Subject [direct-edit text]              ...
               [letter body, 68-character measure]     SAFETY
                                                      Eligible
               Attached: None ▾                        METHOD v3
────────────────────────────────────────────────────────────────────────────
Back to edition     Skip     Replace person                    Approve letter
```

### Draft Review — mobile

```text
‹ Edition          Letter 4 of 15       Notes
A••• P. / Northstar
[Subject]
[letter body]
────────────────────────────────────────────
Attached: None ▾     Why now ▾
Skip       Replace                     Approve
```

### Sent — desktop

```text
CORRESPONDENCE        Attention 2   Awaiting 12   Replies 3   Closed 5
────────────────────────────────┬────────────────────────────────────────
SEP 20                          │ J••• M. / HELIX
J••• M. / Helix       Replied   │ Sep 15  Letter approved
SEP 19                          │ Sep 15  Sent with Product Resume
R••• C. / Meridian    Awaiting  │ Sep 20  Reply recorded
A••• P. / Northstar   Awaiting  │         [relationship note / outcome]
```

### Sent — mobile

```text
Correspondence            Attention 2
SEP 20
J••• M. / Helix            Replied today →
SEP 19
R••• C. / Meridian         Awaiting · 1d →
A••• P. / Northstar        Awaiting · 1d →
```

### Candidates — desktop

```text
PEOPLE TO KNOW          42 available across 31 companies       Find / Facets
Professional · Product + Data · Northeast                               Clear
────────────────────────────────────────────────────────────────────────────
▌A••• P.  AI Product Manager at Northstar
           Product · applied AI relevance · Available                     →
 J••• M.  Data Program Manager at Helix
           Data · program leadership · Available                          →
 R••• C.  Technical Recruiter at Meridian
           Recruiter · internal technical hiring · Available              →
```

### Candidates — mobile

```text
People to know · 42             Find   Facets
A••• P.
AI Product Manager at Northstar
Product · Available                         →
J••• M.
Data Program Manager at Helix               →
```

### Resumes — desktop

```text
PORTFOLIO LIBRARY                                      Add a version
──────────────────────────────────────┬───────────────────────────────────
▌General Resume                      │ [private page preview]
  General · Active · version 6235…   │ General Resume
 Product Resume                      │ Lane: General
  Product · Active · version 81ab…   │ Used with 3 letters
 Data Resume                         │ Edit details · Deactivate
  Historical                         │
```

### Resumes — mobile

```text
Portfolio Library               Add a version
General Resume
General · Active · used with 3 letters       →
Product Resume
Product · Active · never attached            →
Data Resume
Historical                                   →
```

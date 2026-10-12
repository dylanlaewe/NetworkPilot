---
version: 1
slug: "src-app-experience-reset-page-tsx"
primary_target: "src/app/experience-reset/page.tsx"
related_targets: []
---

# Experience reset prototype

## Direction contract

**THESIS:** NetworkPilot is a conversational workbench for one operator, not a recruiting dashboard. It refuses the category-default wall of cards, filters, status badges, and permanent inspectors. Each surface resolves to one person or task, one plain-language state, and one obvious next move.

**OWN-WORLD:** Soft neutral canvas, warmer quiet sidebar, white writing surface, graphite text and primary actions, deep teal only for selection and recoverable progress, amber only for genuine review. Standard controls use 10px corners, restrained borders, and no decorative shadows. The signature move is the next-move thread: state and action update together in one stable region.

**STORY:** Dylan lands on Today, understands the highest-value task, moves into a person or message, sees the reason for the current state only when needed, acts, and receives immediate truthful feedback without losing context.

**FIRST VIEWPORT:** At 1440×900 a 224px sidebar contains six quiet destinations. The remaining canvas centers an 1120px work surface. Drafts divides into a 280px queue and a dominant message editor; Candidates divides into a people list and a stable decision region. The primary action sits at the end of the active context, never in a distant toolbar. At 390×844 the sidebar becomes a top identity bar and bottom navigation, with one active pane and no horizontal overflow.

**FORM:** Brief-pinned ChatGPT-inspired operating shell translated into NetworkPilot's own conversational workbench. It is the fifth grounded form under Impeccable direction seed `edfabf09`; the brief's explicit North Star resolved the direction without a second human choice gate. Code-led Operate surface.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constitution critique

- The rules now bind hierarchy, density, control states, and responsive behavior instead of relying on premium/calm adjectives.
- The largest risk is generic monochrome product UI. The next-move thread, quiet teal selection language, and message-first composition must remain visible enough to give NetworkPilot a point of view.
- Add Drafts feedback must persist in context rather than appear only as a toast; otherwise the zero-result complaint remains unresolved.
- Mobile must expose only one page-context control above work and keep its action region clear of the bottom navigation.
- The prototype must demonstrate all three candidate actions—Create draft, Add drafts, Find more—and explicitly differentiate their side effects in plain language.

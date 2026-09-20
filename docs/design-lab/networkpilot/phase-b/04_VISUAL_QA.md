# Phase B Visual QA

## Review method

Screenshots were captured from an optimized local production build, not the Next.js development server. The route was rendered with deterministic query-initialized fixtures. No provider, database, or production action was used.

Twenty-five captures cover the required desktop/mobile inventory plus tablet and empty-state evidence. They live in `artifacts/design-lab/network-command/`.

## Findings and corrections

### Corrected during review

1. **Inherited heading character.** Global production CSS initially made prototype headings use Georgia. The prototype now explicitly scopes all `h1`, `h2`, and `h3` elements to the approved system sans stack.
2. **Long desktop subjects.** The subject scale could consume the message header at 1024 px. It now has a bounded responsive size and deterministic ellipsis.
3. **False mobile viewport results.** macOS headless Chrome enforces a 500 px window minimum. Final phone review used DevTools device-metric emulation at a true 390 × 844 CSS viewport.
4. **Mobile review overflow.** The message plane, subject, and body editor now explicitly constrain width and hide horizontal overflow while preserving body wrapping.
5. **Mobile action placement.** The primary lifecycle action now owns the second action-dock column explicitly, keeping Approve visible at 390 px.
6. **Mobile header competition.** Draft metadata can shrink and ellipsize so Add Drafts remains fully visible.
7. **Mobile candidate tools.** Search now has a shrinkable minimum and Filter remains visible beside it.
8. **Mobile lane collisions.** Lane text is bounded and ellipsized in its right-side slot rather than forcing document overflow.
9. **Candidate mobile detail.** The desktop inspector is hidden on small screens until a candidate is selected, then appears as a dedicated detail surface with a close control.

### What held up well

- The joined queue/message/inspector surface reads as one operating environment rather than three cards.
- Selection is strong without becoming saturated.
- Queue rhythm remains calm from 5 through 30 drafts.
- Message body measure and line-height support real reading.
- Inspector hierarchy is visibly secondary.
- Today begins with work and avoids KPI-card conventions.
- Candidate Compact mode increases throughput without becoming a spreadsheet.
- Command palette feels materially different from the rest of the light interface while avoiding terminal styling.
- Gmail reconnect, Apollo exhaustion, uncertain send, suppression, and no-reserve states retain different visual and behavioral semantics.

## Remaining weaknesses

1. At 1024 px, the inspector is necessarily terse and long evidence lines wrap more than ideal. Phase C should test an overlay inspector alternative between roughly 900 and 1100 px.
2. The prototype uses native select controls for attachments. A production searchable attachment picker could better communicate resume metadata while retaining None as default.
3. Queue insertion and lifecycle transfer are visually represented, but screenshot artifacts cannot demonstrate causality as effectively as short interaction recordings or usability tests.
4. The fictional candidate generator repeats some first/last-name combinations. This is useful for density testing but should not become demo fixture strategy.
5. Browser zoom, screen-reader interaction, VoiceOver rotor order, and mobile soft-keyboard behavior require Phase C engineering validation.

## Screenshot inventory

| File | State |
| --- | --- |
| `01-today-desktop-1440x900.png` | Today |
| `02-drafts-5-desktop-1440x900.png` | Drafts 5 |
| `03-drafts-15-desktop-1280x800.png` | Drafts 15 |
| `04-drafts-30-desktop-1024x768.png` | Drafts 30 |
| `05-draft-approved-1440x900.png` | Approved lifecycle |
| `06-draft-uncertain-1440x900.png` | Uncertain lifecycle |
| `07-command-palette-1440x900.png` | Command palette |
| `08-candidates-comfortable-1440x900.png` | Comfortable candidates |
| `09-candidates-compact-1280x800.png` | Compact candidates |
| `10-mobile-today-390x844.png` | Mobile Today |
| `11-mobile-draft-queue-390x844.png` | Mobile queue |
| `12-mobile-draft-review-390x844.png` | Mobile review |
| `13-mobile-candidates-390x844.png` | Mobile candidates |
| `14-mobile-filter-sheet-390x844.png` | Mobile filter sheet |
| `15-draft-hover-1440x900.png` | Hover state |
| `16-draft-selected-1440x900.png` | Selected row |
| `17-send-confirmation-1440x900.png` | Send simulation confirmation |
| `18-send-success-1440x900.png` | Send simulation success |
| `19-apollo-exhausted-1440x900.png` | Apollo exhausted |
| `20-gmail-reconnect-1440x900.png` | Gmail reconnect required |
| `21-tablet-today-768x1024.png` | Portrait tablet |
| `22-empty-no-drafts-1280x800.png` | No drafts |
| `23-empty-no-candidates-1280x800.png` | No candidates |
| `24-empty-all-caught-up-1280x800.png` | All caught up |
| `25-no-reserve-1280x800.png` | No reserve |

## QA conclusion

The prototype reads as a credible premium single-operator product rather than a generic card dashboard. The defining Drafts surface is sufficiently resolved to inform production architecture, subject to the accessibility and medium-width cautions above.

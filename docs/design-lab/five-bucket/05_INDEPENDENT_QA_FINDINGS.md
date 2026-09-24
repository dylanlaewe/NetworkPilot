# Independent QA — five-bucket prototype

Reviewed the isolated browser prototype at `http://localhost:3105/design-lab/five-bucket` against the approved brief. This review used only fictional in-memory records and synthetic resume metadata. No application code was changed by QA.

## Verdict

**Pass for the isolated prototype walkthrough.** The first browser pass found four defects. The implementer corrected them, and QA reran each failing browser path successfully. The findings below preserve the original repros and the verified dispositions. Reduced-motion rendering remains source-checked only.

## Browser evidence

| Area | Result and observed evidence |
| --- | --- |
| Viewports | At 1440×900, 1280×800, 390×844, and 360×800, `document.documentElement.scrollWidth` equaled viewport width in the tested queue/review states. The 360px Add dialog also fit within the viewport (328px dialog width). Long bucket labels remained available in desktop navigation and the mobile picker. |
| Navigation | Drafts/Sent/Candidates each had All and five bucket selections. Desktop disclosure buttons exposed `aria-expanded` and `aria-controls`; Enter collapsed Drafts (`false`, controlled region absent), and Space reopened it (`true`, region present). The mobile layout used Workspace and Bucket selects, with the sidebar hidden. |
| Add and counts | Initial Drafts had 11 people, including 2 recruiters. Add 5 recruiters produced 16 Drafts and 7 recruiter drafts, without replacing the existing two. Recruiter reserve moved from 12 total / 7 actionable to 7 total / 2 actionable. A later Add 5 with only one eligible recruiter added 1 and stated the 4-person shortfall. All and per-bucket counts updated once per person. |
| Edit and attachment | An edited recruiter subject survived switching to Managers and back. Removing the resume left the approved copy untouched, displayed the attachment mismatch, and disabled approval. Accepting the proposed copy adjustment removed only the attachment claim. The approval and send dialogs displayed the final subject, body, recipient, and attachment choice. |
| Queue actions | Skip removed a recruiter without creating contact history; Replace filled the same queue position with a recruiter. Once no qualified recruiter remained, Replace kept the draft and reported the shortage. Don't show again required explicit confirmation; cancel kept the person, and confirmation removed them without marking contact. |
| Lifecycle and history | Simulated approval froze the reviewed message; simulated draft creation preceded final simulated send confirmation. The sent recruiter left Drafts (16→15) and appeared once in Sent (3→4). The Sent message fields were read-only. The uncertain fixture offered verification rather than ordinary retry. |
| Templates | Browser text for Manager matched the approved wording after supported slot substitution and remained approvable without a question mark. Executive retained the 10–15 minute calendar wording and pay-time-forward sentence. CEO/president retained its distinct guidance wording and the same pay-time-forward sentence. |
| Find More | With 24+ practitioners in reserve, a recruiter-specific simulated search returned 2 of 5, then 1 of 5, and described each shortage. Shared allowance moved 10/10 remaining → 5/10 → 0/10; Find More then disabled. Pending state disabled the action against repeat clicks. |
| Resume preference | Choosing the inactive historical General Resume as future default did not alter an existing recruiter draft. A newly added recruiter draft had no attachment, showed an explicit missing/inactive-default decision, and blocked approval until resolved. |
| Empty state | Sent > Peers showed 0 people, a specific empty message, and no phantom selected record. |
| Isolation | The route imports its local prototype/model/templates/styles only; the root layout renders children without data access. Source search found no provider construction, server actions, fetch, credential, production database, or resume-byte access in the prototype route. UI recipients use `.invalid` addresses; browser script URLs observed were local `localhost:3105` Next assets. No browser warning/error log entries were returned. This is source and observed-browser evidence, not a packet-level network audit. |
| Reduced motion | Source contains `@media (prefers-reduced-motion: reduce)` disabling animation, transition, and smooth scroll inside the prototype. Browser media emulation was not available in this review, so effective rendering under the setting remains unverified. |

## Defects found in first pass

### QA-1 — Historical fixture claimed the wrong person and unsupported leadership (high; fixed and retested)

Repro: Candidates > Executives > Alexandra-Rose Montgomery-Wells > confirm reviewed correction to Peers & practitioners > Sent > Executives. The original immutable Sent message was addressed `Hi Jordan` and said `Your role leading data platforms…`, while the fixture's displayed evidence said Alexandra-Rose's leadership scope was absent and she was an individual contributor. The correction preserved the history as designed, but that history was already misleading. The original model created the message before overriding this person's name and evidence. **Retest passed:** after a fresh reload and reviewed correction, Sent > Executives still contained exactly one record for her, addressed `Hi Alexandra-Rose` and said `I saw your work in client analytics…`; it no longer asserted leadership. The prior Sent bucket remained Executives.

### QA-2 — Mobile review and dialog dismissal lost keyboard position (medium; fixed and retested)

At 390×844, activating a person in the queue originally opened review while `document.activeElement` became `BODY`. Back to drafts also left focus on `BODY`; the approval dialog trapped focus while open, but Escape and Cancel returned it to `BODY` rather than the invoking button. Repro: mobile Drafts > Recruiters > activate Avery row > inspect focus; then Review simulated approval > Escape or Cancel. **Retest passed:** opening review focuses Avery's H2, Back focuses Avery's queue button, and Escape and Cancel return focus to Review simulated approval.

### QA-3 — Early-career-only Add silently created hidden experienced drafts (medium; fixed and retested)

Repro from a fresh session: Drafts > Peers & practitioners > check Early-career only > Add peer drafts > Add 5. Originally, the visible queue went from 2 to 5, but total peer drafts went from 3 to 8: two experienced practitioner drafts were created and hidden by the active filter. The Add dialog counted all 24 peers as qualified without disclosing that the filter was ignored. **Retest passed:** the dialog now says `Scope: Early-career peers only` and reports 12 scoped reserve records. Add 5 increased the visible filtered queue from 2 to 7; all five added drafts were early-career, and scoped reserve fell from 12 to 7.

### QA-4 — Pending allowance display briefly contradicted reservation (low; fixed and retested)

During the 650ms simulated recruiter search, the status originally said `5 shared allowance units reserved` while the adjacent counter still read `10/10 remaining`. **Retest passed:** pending now shows `5/10 available · 5 reserved`, and the completed partial result shows `5/10 available · 0 reserved`. The action remained disabled during pending work.

## Test and scope notes

- `npm test -- src/app/design-lab/five-bucket/model.test.ts`: 16/16 passed in the first pass, then 19/19 after the fixes.
- `npm run typecheck`: passed after the fixes. A temporary failure occurred while the focus patch was in progress; it was resolved before the retest.
- `npx eslint src/app/design-lab/five-bucket --max-warnings=0`: passed after the fixes.
- No real contact or resume was opened, no production route at port 3000 was visited, and no real send/provider control was invoked.
- Model/configuration details were not observable through this QA workflow, so none are asserted.

## Acceptance-correction addendum — 2026-09-23

**Disposition: pass, with a live-browser evidence limitation.** I reviewed the uncommitted corrections independently, without changing application source or accessing providers or production data.

| Check | Disposition and evidence |
| --- | --- |
| Lifecycle actions and focus | Pass by source and refreshed visual evidence. The review card keeps its action footer outside the independently scrollable message content. The 1440×900 recruiter screenshot shows Skip, Replace, Don't show again, and Review simulated approval in view; the 390×844 screenshots show the same footer both before and after scrolling the message. Focus restoration and modal focus handling remain in the reviewed source. There is no new 1440×900 after-scroll screenshot; its behavior is source-checked. |
| Fictional Sent consistency | Pass. Jamie North's synthetic Sent fixture now freezes `General Resume · v2`, consistent with its attached-resume claim. Focused tests also cover a reviewed no-attachment copy correction and immutable attachment evidence after later library changes. The refreshed 1440×900 Sent screenshot shows the matching attachment. |
| Canonical copy | Pass. `templates.ts` is unchanged; Manager, Executive, and CEO/president subjects and bodies retain the approved exact wording, with existing equality tests for all three. |
| Production plan | Pass as an implementation plan, not a claim that production is already migrated. Its eight sections each identify affected modules, interfaces, migration, legacy compatibility, acceptance tests, and rollout/rollback. Referenced repository paths were checked. It explicitly covers the current `executive recruiter` exclusion, `c-suite-rejected`/selective-VP gates, and `classifySpecificRole`'s `prohibited-target-seniority` gate and planning consumer, while keeping target-role eligibility distinct from relationship-bucket classification. |
| Historical compatibility | Pass by source/tests and plan. Current Sent snapshots remain immutable after correction, attachment-library changes, or bucket changes; the plan specifies nullable additive storage, legacy reads without backfill, and rollback compatibility. |

Focused validation: `npm test -- src/app/design-lab/five-bucket/model.test.ts` **22/22 passed**; `npm run typecheck`, scoped ESLint, and `git diff --check` passed. This addendum did not repeat live browser interaction: the in-app browser surface was unavailable, and native-browser accessibility/screen-recording permission remained pending. The refreshed screenshots and source/tests therefore support, but do not replace, a fresh independent interactive scroll/focus retest. The coordinator-requested QA worker configuration recorded in `07_AGENT_AND_MODEL_USAGE.md` is `gpt-6-sol` with high reasoning; this worker interface exposed no independent runtime model identity, token usage, or cost data, so none is inferred.

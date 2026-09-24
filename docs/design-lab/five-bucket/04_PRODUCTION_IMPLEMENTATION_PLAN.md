# Production Implementation Plan (Post-Prototype Only)

This is the production contract for a future, separately authorized implementation. It is deliberately non-executable. The isolated prototype remains browser-memory-only and does not prove provider supply, production eligibility, persistence, or externalization.

## Fixed product policies

- Recipient bucket is a new, versioned relationship classification. It is separate from outreach track, recipient function, role family, precise title, experience evidence, outreach intent, lifecycle, qualification, and targeting score.
- Recruiter function takes precedence for a relevant recruiter contact, including a senior recruiter title. Bucket assignment never establishes recruiting-domain fit.
- Manager/team-leader, executive, and company CEO/president assignment requires supported responsibility evidence. Title tokens alone are insufficient.
- Relevant early-career employees have a bucket-specific reviewed eligibility path. Age, graduation timing, and first-job status are never inferred from appearance or a generic title. Experienced individual contributors remain valid practitioners.
- One explicitly configured active resume is the default for future recruiter drafts. There is no automatic lane-specific substitution in this implementation.
- Unresolved classification may appear only in a clearly marked local review preview. It is not actionable capacity and cannot be approved or externalized.
- New approvals and outreach snapshot bucket and classification evidence. Existing historical interpretation and immutable messages are never silently rewritten or backfilled.
- Person dedupe, contact history, suppression, company-contact policy, and provider accounting remain shared across all buckets. Switching buckets never grants new budget.
- Add Drafts remains reserve-only and additive. Find More is scoped to the selected bucket and active filters, but uses the existing shared production budget configuration. The prototype's ten units are only a fixture.

## 1. Bucket and track compatibility

**Affected modules**

- `src/domain/candidates/types.ts` and `src/domain/candidates/recipient-function.ts`
- `src/domain/recruiters/types.ts` and `src/domain/recruiters/classify.ts`
- `src/application/ingestion/types.ts` and `src/application/ingestion/import-candidates.ts`
- `src/infrastructure/sqlite/draft-queue.ts`
- `src/application/daily-refresh/index.ts`
- `src/application/command-center-drafts/index.ts`

**Interface changes**

- Add a provider-independent `RecipientBucket` union and a versioned `RecipientBucketClassification` containing bucket, evidence references, confidence, review state, explanation codes, and classifier version.
- Add the classification to `ImportedCandidateSnapshot`, `CommandCenterDraftReview`, and persisted daily-refresh result snapshots. Keep `outreachTrack`, recipient function, role family, title, experience, intent, and lifecycle as independent fields.
- Classification order is: relevant recruiter classification first; otherwise professional responsibility classification. A recruiter title with unsupported recruiting domain remains rejected or review-required rather than becoming actionable through its bucket.
- The recruiter classifier must distinguish an internal `Executive Recruiter` function from executive-search agencies. The current blanket title/seniority exclusions are not sufficient for this contract: supported internal recruiting function may reach Recruiters, while executive search and ambiguous external recruiting remain fail-closed.

**Migration need**

- Yes. Add nullable bucket snapshot and classification-evidence fields to the candidate/draft snapshot persistence used by imported candidates and daily refreshes. New fields must accept `NULL` for legacy rows. Do not rewrite `outreach_tracks` or infer a bucket from an old track.

**Legacy compatibility**

- Existing professional/recruiter tracks keep their meaning. Legacy candidates and operations without bucket evidence display `Legacy / unclassified` when bucket context is needed.
- `readQueueCandidates`, `readDraftGenerations`, and `loadQueueReviews` must deserialize both old and new payloads. Old Gmail operations remain readable because their immutable approved snapshots are not rewritten.

**Acceptance tests**

- Senior internal recruiter remains recruiter track and Recruiters bucket when recruiting-domain evidence passes.
- Supported internal Executive Recruiter evidence reaches Recruiters without allowing executive-search or agency candidates through.
- Recruiting-adjacent professional does not become a recruiter without recruiter classification evidence.
- The other four buckets remain compatible with professional track.
- A bucket change never changes track, contact history, suppression, cooldown, or provider accounting.
- Legacy payloads without a bucket remain readable and explicitly identifiable.

**Incremental rollout and rollback**

- Ship read compatibility first, then write bucket snapshots behind a local feature boundary, then enable bucket navigation.
- Rollback disables new bucket writes/UI while retaining nullable data. It never down-migrates or rewrites new or historical snapshots.

## 2. Responsibility evidence and reviewed correction

**Affected modules**

- `src/domain/candidates/normalize.ts`
- `src/domain/candidates/recipient-function.ts`
- `src/domain/candidates/provider-normalization.ts`
- `src/application/planning/normalize-candidate-sources.ts`
- `src/application/ingestion/types.ts`
- `src/infrastructure/sqlite/database.ts`
- Candidate review actions in `src/app/candidate-review/actions.ts` and `src/app/candidates/`

**Interface changes**

- Extend classification input with provider-backed team, function, business-unit, division, and company-scope evidence plus provenance.
- Manager/team-leader requires supported team or function responsibility. Executive requires supported functional/company leadership. VP alone is insufficient. Company CEO/president must be distinguished from a division president or business-unit leader.
- Run the reviewed responsibility classifier before applying the current blanket `c-suite-rejected`/selective-VP outcome. A company CEO/president with verified company-wide scope may enter the CEO/president review path; unsupported CEO/president/founder/owner titles and division-only scope remain review-required or rejected under the approved evidence rules.
- Keep `classifySpecificRole` fail-closed for ordinary target-role matching, but do not treat its current `prohibited-target-seniority` result as the final relationship-bucket decision. The dedicated responsibility classifier may route verified leadership evidence to an appropriate relationship bucket without making that person eligible for an unrelated target role.
- Missing or contradictory scope produces `review-required`, not a confident bucket.
- Extend the existing `IngestionRepository.reviewCandidate` workflow with a typed bucket correction and audit payload. A correction may resolve classification only; it cannot override verification, consent, suppression, prior contact, company policy, or other qualification gates.

**Migration need**

- Yes, for versioned bucket evidence and correction audit fields. Reuse the existing candidate review audit mechanism rather than creating a parallel unaudited correction path.

**Legacy compatibility**

- Previous review decisions and stored recipient-function fields remain valid inputs. No old VP, manager, president, or CEO is silently reclassified.
- Candidate reclassification affects future unapproved proposals only. Prior approvals and sent messages retain their stored evidence and wording.

**Acceptance tests**

- VP without scope routes to review.
- Verified team manager, functional executive, division president, and company CEO route distinctly.
- Verified company-wide CEO/president evidence can satisfy the dedicated bucket path without making title tokens alone sufficient; unsupported founder/owner/CEO claims still fail closed.
- Reviewed correction is audited and preserves candidate identity and every unrelated safety gate.
- Reclassification never rewrites a sent message or historical bucket snapshot.

**Incremental rollout and rollback**

- Run the classifier in shadow/read-only mode on safe fixtures first. Enable review UI before enabling actionable capacity.
- Rollback returns new classifications to review-only and hides bucket actions; stored audit history remains intact.

## 3. Early-career eligibility

**Affected modules**

- `src/domain/outreach/select-daily-prospects.ts` and `src/domain/outreach/types.ts`
- `src/domain/candidates/types.ts` and `src/domain/candidates/normalize.ts`
- `src/application/planning/normalize-candidate-sources.ts`
- `src/infrastructure/sqlite/draft-queue.ts`
- `src/application/daily-refresh/index.ts`

**Interface changes**

- Add an explicit bucket-aware eligibility result rather than weakening `minimumYearsExperience` globally.
- Peers & practitioners may accept a reviewed early-career path when professional identity, current employment, relevant function/field, company identity, email verification, and all shared safety gates pass.
- Unknown experience remains review-required where evidence is required. Experienced individual contributors continue through the existing professional path.

**Migration need**

- Bucket evidence persistence covers the new decision. No destructive change to `Prospect.yearsExperience` is required. If the normalized candidate snapshot stores the new eligibility explanation, it is added as an optional versioned field.

**Legacy compatibility**

- The legacy simulation selector retains its five-year configuration for records with no reviewed bucket evidence. Existing runs and decisions are unchanged.
- No age, graduation year, first-job status, or appearance inference is introduced.

**Acceptance tests**

- Relevant supported early-career employee can qualify only for the reviewed peer path.
- Unknown employment/function evidence fails closed.
- A generic junior title does not establish early-career status.
- Experienced individual contributor remains eligible as a practitioner.
- Suppression, prior contact, company policy, and verified-email gates remain identical.

**Incremental rollout and rollback**

- Start with review-only previews and measured fixture results. Enable actionable capacity only after false-positive review.
- Rollback disables the early-career exception and returns affected candidates to review, without deleting them or altering history.

## 4. Resume default and immutable attachment evidence

**Affected modules**

- `src/application/resumes/types.ts` and `src/application/resumes/index.ts`
- `src/infrastructure/sqlite/database.ts` and `migrations/0020_resume_library.sql` compatibility
- `src/application/command-center-drafts/index.ts`
- `src/infrastructure/sqlite/command-center-drafts.ts`
- Draft review UI under `src/app/drafts/` and `src/app/resumes/`
- `src/application/email-drafts/types.ts`

**Interface changes**

- Extend `ResumeRepository` with explicit get/set/clear operations for one recruiter default resume ID.
- Replace `suggestedResumeId` lane substitution for new recruiter drafts with the configured active default. Professional drafts continue to default to no attachment.
- Missing or inactive recruiter default requires an explicit active resume selection or explicit None decision before approval.
- Keep attachment choice visible before approval and final send confirmation. `ApprovedEmailDraftSnapshot.resumeAttachment` remains the immutable attachment authority.

**Migration need**

- Yes. Persist one nullable recruiter-default resume reference with a foreign-key or validated repository constraint. Existing resume rows remain unchanged. The migration must not auto-select a default from role lanes.

**Legacy compatibility**

- Existing draft choices, approvals, Gmail operations, and sent records do not change when the default changes or a library entry is deactivated.
- Historical attachment snapshots remain authoritative even if library label, lane, active state, or stored default changes later.

**Acceptance tests**

- New recruiter draft receives the configured active default.
- Missing/inactive default blocks implicit attachment and requires a deliberate choice.
- Explicit removal plus reviewed copy correction can approve without an attachment.
- Approval/send with and without attachment freeze coherent message and metadata.
- Deactivation/rename/default change never rewrites approved or sent attachment evidence.

**Incremental rollout and rollback**

- Add preference persistence and read-only display first, then gate new recruiter defaults behind local configuration.
- Rollback stops applying the default to new drafts. Existing selections and immutable snapshots remain untouched.

## 5. Ambiguous candidates

**Affected modules**

- `src/application/ingestion/types.ts`
- `src/application/planning/normalize-candidate-sources.ts`
- `src/infrastructure/sqlite/draft-queue.ts`
- `src/application/command-center-drafts/index.ts`
- `src/app/candidate-review/` and `src/app/candidates/`

**Interface changes**

- Add a typed local `review-only` projection for unresolved bucket/evidence. It is excluded from `capacity`, daily selection, `Add Drafts`, approval, Gmail draft creation, and sending.
- Preview copy may use only supported neutral facts. It must not prefill leadership scope, career history, recruiting domain, or attachment claims that the evidence does not support.

**Migration need**

- No separate table is required if the versioned classification review state is persisted with the candidate snapshot and existing review audit. A schema addition is already covered by the bucket/evidence migration.

**Legacy compatibility**

- Existing `review-required` candidates remain non-actionable. New UI terminology does not upgrade them.
- A correction to an unapproved draft offers a deliberate regenerate-or-keep-edits choice. It never silently replaces user edits or an immutable approval.

**Acceptance tests**

- Review-only person appears with a clear unresolved reason but contributes zero actionable capacity.
- Approval and provider externalization are blocked until required evidence is reviewed.
- No unsupported leadership or career claim is generated.
- Reclassification preserves edits until the operator deliberately chooses whether to regenerate affected copy/defaults.

**Incremental rollout and rollback**

- Release the read-only preview before correction actions. Enable correction only after audit persistence is verified.
- Rollback hides preview/correction UI; candidates remain safely review-required.

## 6. History, correction, and immutable snapshots

**Affected modules**

- `src/application/command-center-drafts/index.ts`
- `src/application/email-drafts/types.ts` and `src/application/email-drafts/create-approved-gmail-draft.ts`
- `src/infrastructure/sqlite/command-center-drafts.ts`
- `src/infrastructure/sqlite/relationship-workspace.ts`
- `src/application/manual-outreach/` and `src/infrastructure/sqlite/manual-outreach-operator.ts`

**Interface changes**

- New approvals snapshot bucket, classifier version, evidence references, and review provenance alongside copy and attachment evidence.
- Relationship projections read the stored snapshot when present. Missing bucket displays as legacy/unclassified rather than being inferred from current candidate state.
- Reclassification of a candidate never mutates `ApprovedEmailDraftSnapshot`, Gmail operations, manual-outreach records, relationship history, or sent message content.

**Migration need**

- Yes, as additive nullable JSON/scalar fields on new approval/outreach snapshots or their existing serialized payloads. No historical backfill.

**Legacy compatibility**

- Old approved/sent records remain byte-for-byte interpretable. Their missing bucket is explicit.
- If current candidate classification differs from historical classification, the UI may show both with dates; it must not present the new value as historical truth.

**Acceptance tests**

- Legacy operation without bucket loads and displays legacy/unclassified.
- New approval and sent record retain exact bucket/evidence after candidate reclassification.
- Reclassification cannot replace an immutable approval or alter copied-message semantics.
- Manual-send, hard-bounce, suppression, cooldown, and relationship projections remain unchanged.

**Incremental rollout and rollback**

- Dual-read optional fields first, then write new snapshots, then render them in Sent.
- Rollback stops new writes/display while preserving all additive data and old read behavior.

## 7. Shared constraints, Add Drafts, Find More, and accounting

**Affected modules**

- `src/domain/outreach/select-daily-prospects.ts`
- `src/application/daily-refresh/index.ts`
- `src/application/daily-refresh/next-draft-batch.test.ts`
- `src/application/candidate-refresh/index.ts`
- `src/application/providers/run-recruiter-discovery.ts` and existing Apollo orchestration
- `src/infrastructure/sqlite/daily-refresh.ts`, `candidate-refresh.ts`, and `draft-queue.ts`
- Draft/Candidate actions under `src/app/drafts/` and `src/app/candidates/`

**Interface changes**

- Add an optional bucket/filter constraint to reserve selection and replenishment inputs. Apply it after shared dedupe, contact history, suppression, company policy, and provider authorization.
- Add Drafts selects only existing qualified reserve and appends without changing existing IDs, order, edits, attachments, or approvals.
- Find More requests the selected bucket and active filters but charges the same persisted Apollo authorization/accounting path. Bucket changes do not reset or multiply budget.

**Migration need**

- Persist selected bucket/filter and classification version in refresh diagnostics/results for auditability. Existing provider budget tables remain authoritative; no new per-bucket budget table is allowed.

**Legacy compatibility**

- Existing refresh results without bucket scope remain valid global runs.
- Current production budget settings, idempotency, provider caps, person/company dedupe, contact history, suppression, cooldown, and one-company selection policies remain unchanged.

**Acceptance tests**

- Add Drafts is reserve-only, additive, same-bucket, and preserves existing draft state.
- Find More uses active bucket/filter, shared persisted accounting, bounded calls, and existing idempotency.
- Switching buckets cannot gain credits or bypass person/company restrictions.
- A provider shortfall remains truthful; no weak candidate is forced through.
- Professional and recruiter paths retain their current qualification behavior apart from the separately approved bucket rules.

**Incremental rollout and rollback**

- Add scoped reserve reads first. Enable scoped provider replenishment only after offline fixtures and a separately authorized bounded live validation.
- Rollback returns Find More to its current global behavior or disables the scoped control; accounting data and qualified reserve remain intact.

## 8. Canonical copy and validation contract

**Affected modules**

- Future production catalog entries in `src/domain/drafting/templates.ts` and recruiter templates
- `src/domain/drafting/voice.ts`
- `src/application/command-center-drafts/index.ts`

**Interface changes**

- Store the approved manager, executive, and CEO/president prose as versioned catalog fixtures with only supported personalization slots.
- Preserve exactly: the manager invitation without a question mark; `throw 10-15 mins on your calendar for a quick chat?`; and `I promise I'll pay your time forward.`
- Validate one primary ask semantically rather than equating ask count with question-mark count. Recruiter messages are not padded to satisfy a minimum word count.

**Migration need**

- None for historical copy. New catalog/version identifiers are written only to new draft/approval snapshots.

**Legacy compatibility**

- Historical approved and sent copy remains unchanged. Existing catalog versions remain readable.

**Acceptance tests**

- Exact canonical fixture equality.
- Manager copy with zero question marks and one invitation passes.
- Executive and CEO/president required wording remains exact.
- Placeholder, unsupported-claim, subject/header, attachment, identity, and safety validation remains active.

**Incremental rollout and rollback**

- Add catalog fixtures and validator tests before enabling classification-specific generation.
- Rollback stops selecting the new catalog; it never rewrites snapshots already approved with it.

## Architecture contradictions that implementation must resolve explicitly

1. `src/domain/outreach/select-daily-prospects.ts` currently applies a universal minimum-experience rule to legacy `Prospect` records, which do not carry track or bucket evidence. The early-career exception must be implemented in the normalized, reviewed candidate path or behind an explicit bucket-aware eligibility interface, not by globally lowering `SelectionConfig.minimumYearsExperience`.
2. `src/application/resumes/index.ts::suggestedResumeId` currently performs lane-specific recruiter substitution. That behavior conflicts with the approved single explicit recruiter default and must be replaced for new recruiter drafts only; existing attachment selections and snapshots remain immutable.
3. `src/domain/drafting/voice.ts` and `humanEditError` currently describe the CTA rule as exactly one question. That conflicts with the approved manager invitation, which intentionally has no question mark. Production must count primary asks semantically while retaining other voice/safety checks.
4. `src/domain/recruiters/classify.ts` currently lists `executive recruiter` as an excluded title and rejects executive recruiter seniority. The approved precedence rule requires a reviewed internal-recruiter exception while keeping executive search, agency, and ambiguous external recruiters excluded.
5. `src/domain/candidates/normalize.ts` currently returns `c-suite-rejected` for CEO, president, founder, owner, and related title tokens, with a separate selective-VP rejection. The new responsibility classifier must distinguish verified company-wide scope before applying a final bucket decision; merely deleting those gates would violate fail-closed behavior.
6. `src/domain/candidates/provider-normalization.ts::classifySpecificRole` independently returns `prohibited-target-seniority` for chief, president, head, founder, owner, VP, and related titles, and `src/application/planning/normalize-candidate-sources.ts` consumes it. That remains the correct fail-closed target-role result, but it cannot double as the final relationship-bucket result; the two decisions need separate typed outputs and tests.
7. Current production snapshots have outreach track, recipient-function, and attachment evidence but no recipient-bucket contract. A silent inference/backfill would violate historical semantics; additive nullable/versioned persistence is required.

These are implementation constraints, not permission to change production in this prototype branch.

## Release gates

- Migration rehearsal on a copied pre-change database and a fresh database.
- Legacy read compatibility and byte-stable historical approved/sent snapshots.
- Offline classifier review for all five buckets, including ambiguity and responsibility scope.
- Accessibility checks for keyboard, focus restoration, action reachability, mobile safe areas, and browser-emulated reduced motion.
- Controlled provider validation only under separate authorization.
- Full tests, typecheck, lint, no-remote-font guard, Gmail-send safety guard, production build, both audits, and `git diff --check`.
- Rollout remains locally feature-bounded with a rollback that disables new writes/UI without destructive down-migration.

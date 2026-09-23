# Five-bucket copy and semantics review

Status: read-only review of the approved brief and current production architecture. This is guidance for the isolated fictional prototype and later production planning; it does not authorize production classification or copy changes.

## Core semantic model

Each person has exactly one primary relationship bucket, answering why Dylan is approaching them. Keep that bucket separate from their actual title and function, experience evidence, company context, Dylan's target field, message intent, and outreach lifecycle. Buckets express different relationship strategies, not a ranking of people. Do not show tier scores or describe recruiters as low level.

| Bucket | Meaning and default intent | Keep distinct from |
| --- | --- | --- |
| Recruiters | People whose relevant function is recruiting; concise background, a narrow role cluster, and an invitation to discuss relevant opportunities. | Seniority does not turn a recruiter into an executive. Do not imply ownership of a requisition. |
| Peers & practitioners | Early-career employees and experienced individual contributors; ask about entering the field, relevant practice, or a career transition according to the contact's evidence. Include an Early-career preference/filter. | A senior IC is not automatically a manager. Do not assume a recent job move or request a referral by default. |
| Managers & team leaders | People with evidence of managing a team or leading a function/team. The relationship is learning about career and work in the field. | A manager title does not establish that they are a verified hiring manager, are hiring, or own a role. |
| Executives | Senior functional leaders with evidence of responsibility for a verified function; use the leadership-growth message. | A VP token alone is not evidence of executive responsibility. A divisional president is not automatically the company CEO/president. |
| CEOs & presidents | A company CEO/president or a specifically evidenced president of a division/organization; ask for early-career guidance with a genuine person-specific reason. | Do not collapse company and division presidents, infer CEO equivalence, or use generic praise / a "younger version of me" premise. |

### Ambiguity handling

- `Executive Recruiter` is Recruiters when recruiting is the relevant function, regardless of the word “Executive.”
- A VP title alone is insufficient for Executives. Require evidence of function/scope and responsibility; otherwise mark review needed.
- Manager is not a hiring-status signal. Keep verified hiring authority as separate evidence, and never imply it without evidence.
- A company president and a division president require distinct organization scope. Preserve which entity the title refers to and request review when unclear.
- A senior individual contributor belongs in Peers & practitioners when there is no supported people/function leadership responsibility.
- Recruiters remain Recruiters at all seniority levels when that is the relevant function. Agency or executive-search affiliation can be context, but does not change the prototype bucket rule by itself.
- Unknown, conflicting, or insufficient evidence yields a visibly review-needed classification, never a confident guess. A human correction changes one record's current bucket only; it does not clone the person, erase history, bypass suppression/cooldown, or rewrite sent-message evidence.

## Canonical wording and fidelity

These are approved starting templates from the brief. For manager, executive, and CEO/president copy, preserve all prose exactly and substitute only bracketed fields using supported evidence or explicit user input. Keep canonical prose separate from personalization slots and subsequent user edits. Do not silently regenerate or “improve” canonical text. For recruiter and peer templates, retain the approved wording and framing as the starting examples; any removal of a factual claim (such as an attachment) must be shown as an explicit proposed edit for review.

### Manager

```text
Subject: A question about your career in [field]

Hi [First name],

I'm Dylan, a recent computer science graduate from Marist University in Poughkeepsie, New York. I've been working in BI and data engineering, building automations and connecting business systems.

I saw your role at [Company] and wanted to introduce myself. I'm trying to learn as much as I can from people's experiences and success in [field], especially [specific topic].

I would love to connect about your career and how you've approached that part of your work.

Thank you in advance for your guidance,
Dylan
```

This has one primary invitation and intentionally no question mark. It is valid. Never append a question to satisfy a validator. Do not claim LinkedIn discovery, call Dylan a current student, replace “experiences and success,” or change the approved closing.

### Executive

```text
Subject: A question about building toward leadership

Hi [First name],

I'm Dylan, a recent computer science graduate from Marist University working in BI and data engineering.

Your role leading [verified function] at [Company] is the kind of responsibility I'd like to grow toward. I'm especially interested in staying close to new technology while taking on more responsibility for people and what gets built.

I'm sure you're extremely busy, but would it be possible to throw 10-15 mins on your calendar for a quick chat?

I promise I'll pay your time forward.

Best,
Dylan
```

Preserve “throw 10-15 mins on your calendar for a quick chat?” and “I promise I'll pay your time forward.” Populate `[verified function]` only from supported evidence; if missing, request input or offer a clearly identified truthful alternative, never invent it.

### CEO / president

```text
Subject: Guidance for someone starting out

Hi [First name],

I know this is a long shot, but [specific reason for contacting this person] made me want to ask for your guidance.

I'm a recent Marist University computer science graduate working in BI and data engineering. Eventually, I'd like to build useful products and lead a team, and I'm trying to understand what I should focus on now to get there.

I'm sure your calendar is packed, but would you be open to finding 15 minutes for a conversation?

I promise I'll pay your time forward.

Thanks,
Dylan
```

The reason must be genuine in real use; synthetic reasons are allowed only for clearly fictional prototype fixtures. Preserve the distinct leadership/guidance framing and pay-time-forward sentence. Do not imply the recipient sees Dylan as a younger version of themselves or replace the reason with generic praise.

### Recruiter

```text
Subject: Early-career data opportunities at [Company]

Hi [First name],

I graduated from Marist University in May 2026 with a computer science degree and have hands-on BI and data engineering experience.

I'm looking for my first full-time role in data or analytics and would love to connect about opportunities at [Company]. I've attached my resume.

Would you be open to a brief call?

Best,
Dylan
```

Keep recruiter copy short, relevant, and bounded to a narrow role cluster. The attached-resume sentence is conditional on an attachment actually being selected; never retain it after removing the attachment. Show the exact proposed copy adjustment for review, and do not silently change the approved starting copy. Attach the configured active default visibly in the prototype, while allowing removal/replacement before approval. If that default is missing/inactive, explain and ask for another choice or explicit no-attachment continuation; do not substitute silently. Approval freezes the synthetic resume version and later default changes do not rewrite approved history.

### Peer & practitioner

```text
Subject: Your path into [field]

Hi [First name],

I saw you're a [role] at [Company]. I graduated from Marist University in May 2026 and have been working in BI and data engineering while looking for my first full-time role.

I'd be curious how you approached your job search and what helped you get started in [field].

Would you have 15 minutes to talk me through your experience?

Thanks,
Dylan
```

Retain the break-in framing for early-career peers and experience-forward / career-transition framing for experienced practitioners. Do not say someone recently landed their first job without evidence. Do not ask for a referral by default. Product Management is a valid target alongside the fields enumerated in the brief; do not cram every target field into one message.

## Claim and personalization risks

Only fill personalization from supported evidence or explicit operator input. Prototype fixtures may make fictional person/company facts and the CEO's specific reason synthetic, but label the world and interactions clearly fictional. Never allow a fictional reason to read as a verified production fact. The following are high-risk claims to guard at render and approval:

- Dylan's degree, university, graduation date, work history, skills, and target must match approved sender facts. The prototype may use synthetic resume metadata, not actual resume bytes.
- Recipient title, role, function, leadership scope, company identity, hiring status, requisition ownership, recent job change, or a personal connection must not be invented. In particular, an executive's `[verified function]` and CEO/president contact reason need evidence or explicit user input.
- Do not say Dylan found the recipient on LinkedIn, is a current student, has prior Product Management employment, or has prior sector expertise unless evidence supports the precise claim.
- Do not claim Dylan attached a resume when the approval state has no attachment. Conversely, a visible selected attachment must be the one represented in approval/send confirmation; after approval, preserve its frozen synthetic version even if the library default changes.
- Do not phrase generated copy as a claim that the recipient is hiring or has a suitable opening unless there is authoritative evidence. Recruiter outreach asks about opportunities; it does not presume the recipient personally owns them.

## CTA versus question-mark validation

The current `inspectOutreachQuality` counts `?` characters as CTA count, and `assertDylanVoice` requires exactly one. This conflates punctuation with communicative intent and rejects the approved manager template, which has one invitation but zero question marks. Change future validation to identify one primary invitation/ask semantically or via explicit template metadata; question-mark count may remain a diagnostic only. Regression assertions must accept the manager canonical wording unmodified, including zero question marks, and reject a real second ask even if one or both asks are not questions. Do not append punctuation/copy to appease the old rule. Also remove any universal minimum word count that would pad otherwise valid concise recruiter copy; keep style observations advisory rather than hard gates.

## Production rules requiring deliberate later change

Current production behavior is intentionally not changed by this review. The following policy seams must be designed and versioned before adding bucket-based production classification:

1. **Five-year professional gate:** `import-candidates.ts` rejects professional candidates whose minimum supported experience is under five years or unknown; `docs/architecture.md` documents the same gate. This conflicts with the approved early-career peer cohort. Decide a bucket-aware early-career policy/filter and evidence threshold without weakening shared suppression, consent, verification, contact, and cooldown rules.
2. **Executive exclusions:** `classifyCandidate` rejects chief/CEO/CFO/CTO/COO/president/founder/owner title tokens; import also rejects provider seniority values such as `c_suite`, `vp`, and `head`. Recruiter classification excludes executive recruiter/search titles as well. These rules need a reasoned mapping to executive and CEO/president buckets, while retaining the explicit Executive Recruiter -> Recruiters case and review-needed handling for ambiguous scopes.
3. **Track versus bucket compatibility:** production has exclusive `professional` / `recruiter` tracks; bucket is a different axis. Decide a versioned mapping, if any, rather than treating track as bucket. A recruiter should stay a recruiter contact regardless of seniority; non-recruiter buckets must not inherit recruiter copy/experience rules simply because of title ambiguity. Candidate, draft, sent, and budget interfaces need the chosen relationship-bucket snapshot.
4. **Historical interpretation:** existing Gmail/manual/audit rows default to immutable `professional`; plan/draft snapshots preserve the old classification and message evidence. New bucket fields or classification versions must not relabel history, rewrite approved/sent content, or reinterpret prior suppressions/cooldowns. Historical views should show original evidence and, if needed, a separately labeled current correction.
5. **CTA, resume, and classification policy versions:** existing voice checks impose one question mark, current recruiter defaults are advisory and attachment selection is explicit, and classification corrections cannot override hard gates. Future behavior needs versioned policy snapshots and auditable explicit operator actions.

Shared uniqueness, suppression/opt-out/bounce, prior contact, company policy, cooldown, and approved provider-budget limits remain shared across buckets. A large reserve in one bucket must not mask another bucket's shortage, and changing buckets cannot refresh or multiply provider allowance.

## Concrete prototype acceptance assertions

Implementation review should be able to assert all of the following with fictional fixtures and visible state:

- Every person has exactly one primary bucket, while title/function, experience, company context, Dylan target, intent, and lifecycle remain separately displayed/stored.
- The seven ambiguity examples above classify or route to review as specified: executive recruiter; unsupported VP; manager without hiring evidence; company vs division president; senior IC; recruiter at any seniority; insufficient/conflicting evidence.
- Correcting an ambiguous fixture changes its current bucket in place, preserves its single identity and contact history, and leaves any historical sent bucket/message snapshot unchanged. Suppression/cooldown still blocks action after correction.
- Manager copy equals the approved template byte-for-byte after only supported bracket substitutions; it passes with one primary invitation and no question mark. Executive and CEO/president text remain distinct and preserve the exact calendar and pay-time-forward sentences. Missing leadership function or genuine-contact reason is surfaced for input rather than fabricated.
- Recruiter and peer copy retain their approved opening examples and appropriate role/experience framing. An early-career versus experienced practitioner selection changes framing without unsupported career claims or default referral request.
- The recruiter attachment claim is present if and only if the selected approval snapshot includes the same resume; removing it presents the copy change for review. Missing/inactive default never silently substitutes an attachment.
- Claim checks reject unresolved placeholders, unsupported personal/company facts, LinkedIn/current-student/prior-PM claims, and an attached-resume statement without an attachment. User-edited copy is preserved across bucket/contact navigation until the user explicitly changes it.
- CTA validation counts one primary ask, not punctuation: manager accepted at zero `?`; recruiter/peer/executive/CEO approved asks accepted; a second substantive ask rejected even if punctuation differs.
- Drafts, Sent, and Candidates show actual per-bucket record counts; All is a union without duplicate people. Changing the selected bucket cannot reset shared budgets or bypass shared contact/exclusion policy. Insufficient evidence or supply is shown as review/shortfall with a useful next action, not hidden by silently switching buckets.
- Prototype evidence uses fictional contacts, `.invalid` email addresses, synthetic resume metadata, deterministic mock operations, and no production database/provider-derived content.

## Architecture review references

- `docs/architecture.md`: two explicit outreach tracks, five-year minimum experience rule, default no-attachment production review, immutable history, review lifecycle, and current CTA/copy policy context.
- `docs/schema.md`: immutable targeting snapshots and immutable historical outreach-track defaults.
- `src/application/ingestion/import-candidates.ts`: professional five-year / provider seniority hard gates and track selection.
- `src/domain/candidates/normalize.ts`: title-token executive rejection and persona inference from title/years.
- `src/domain/recruiters/classify.ts`: recruiter titles, executive exclusions, and recruiter qualification.
- `src/domain/drafting/voice.ts`: question-mark-based CTA count and hard word-count rule.
- `src/domain/recruiters/draft.ts`: existing short recruiter copy and recruiter catalog identity.
- `src/application/resumes/index.ts`: production recruiter resume suggestion is role-lane advisory; selection/snapshot remains explicit.

## Review runtime disclosure

The task context identifies the assigned runtime as the GPT-6 family. The exact model ID and reasoning-effort configuration were not observable from this reviewer context, so they are not asserted here.

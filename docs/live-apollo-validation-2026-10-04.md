# Staged Apollo validation evidence — 2026-10-04

This record contains only sanitized operational evidence. It contains no raw provider payload, contact identity, email address, account secret, or copied database.

## Bounded result

- Fresh account baseline: 240 of 2,530 lead credits consumed.
- Recruiter bucket only: two search calls, 20 people examined, one enrichment attempt.
- Account usage after the attempt: 241 consumed, an increase of exactly one within the authorization.
- Provider response: successful person match with exact provider-native identity and high match confidence; the top-level response omitted `credits_consumed`.
- Canonical result: one candidate imported, zero qualified, no draft. No other bucket was attempted.
- Gmail and production data were untouched.

The live response establishes that `credits_consumed` is optional. When it is present and valid, NetworkPilot persists the exact value. When it is absent, NetworkPilot persists unknown consumption and retains the authorized maximum exposure. Account-wide usage can corroborate that the staged account remained within authorization, but it is not written back as attributable per-operation consumption because concurrent account activity would make that inference unsafe.

Missing optional consumption alone is not a staged-validation stop condition when the request otherwise succeeded, canonical accounting safely records unknown, account usage remains within authorization, and every other invariant passes.

## Recruiter classification diagnosis

- Sanitized current title: `Recruiter`.
- Employment-history periods at the 2026-10-04 reference date:
  - 2026-05-01 to current
  - 1998-06-01 to 2026-05-01
  - 1998-06-01 to 2005-06-01
  - 2005-05-01 to 2006-02-01
- `experience-v1` correctly merged the overlapping periods into one continuous 1998-06-01 through 2026-10-04 interval and calculated approximately 28.34–28.35 total career years with accepted evidence.
- The failed gate was the legacy recruiter classifier condition requiring total career experience to overlap 2–20 years (`minimumExperience <= 20` and `maximumExperience >= 2`).
- Evidence was present. The failure was caused by the calculated total career length being outside that stale range, not by missing evidence.
- That implementation was not the intended current relationship-bucket policy. Total career history is not recruiter tenure. Current recruiter eligibility is based on the present recruiting title, internal-versus-agency employer evidence, recruiting domain, and applicable seniority exclusions.

The correction removes total career length from recruiter relationship acceptance without weakening title, employer, agency, recruiting-domain, consent, email, trust, or drafting gates.

## Employer trust outcome

The provider-only employer remained `unverified`, which is the designed default rather than a validation anomaly:

`provider-only recruiter → employer unverified → review-required → not actionable → no draft`

An audited company-trust decision is required before the candidate can become actionable. A same-bucket recruiter that is blocked only on employer trust is no longer mislabeled as a discovery scope mismatch.

## Reusable harness boundary

The reusable staged harness remains limited to the five named buckets, sequential execution, one enrichment attempt per bucket, five attempts total, protected-state fingerprints, isolated migrated datastores, and an account-usage check around each authorized attempt. It does not contain live payloads or identities. Provider phases require a new explicit approval; offline inspection and tests make no provider or Gmail calls.

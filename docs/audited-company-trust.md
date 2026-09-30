# Audited company trust

Company trust is a separate safety boundary from provider discovery, target-company strategy membership, and person-level recruiter evidence. A recruiter can qualify automatically as internal only when the current employer resolves to `trusted-operating` and all existing person, email, employment, recruiting-function, domain, and contradiction gates also pass.

## Stable identity and states

The resolver uses the exact `strategyCompanyMatch.companyId` plus identity evidence from the candidate. Provider-discovered companies use the deterministic `discovered_companies.id`: normalized exact domain when present, otherwise the exact provider employer ID. Similar display names, fuzzy matches, candidate IDs, partial domains, and different provider employer IDs do not share trust.

Trust states are:

- `unverified`
- `trusted-operating`
- `disallowed-recruiting-service`

New provider discoveries create a version-zero `unverified` current row. Existing companies are not backfilled; absence of a current row also resolves to `unverified` unless the exact curated identity rule below succeeds.

## Authoritative curated source

`AUTHORITATIVE_OPERATING_COMPANIES` is the existing reviewed set of exact target-company IDs paired with the exact domains used by controlled company-specific workflows. Automatic curated trust requires both values to match. `target_companies` alone is not authoritative because provider discovery also creates rows there. Its provenance, review date, tier, enabled state, name, and absence of recruiting keywords never confer employer trust.

An exact display-name match without the approved domain stays unverified. Free-form provenance that resembles the curated provenance also stays unverified.

## Audited human review

`reviewCompanyTrust` is the explicit application command. It requires an exact company ID, intended state, non-empty reason, `local-operator`-style actor identity, source reference, command ID, expected current version, and timestamp. It runs in an immediate SQLite transaction, appends one `company_trust_audit` event, and advances `company_trust_current` by one version.

The command supports deliberate changes between all three states. Command replay with the same payload is idempotent. Reusing a command ID with a different payload fails. An incorrect expected version fails as stale. Database triggers reject audit updates and deletes.

## Recruiter projection and history

The authoritative resolver supplies state and provenance to recruiter qualification. Neutral or missed domain vocabulary is supporting evidence only and cannot promote an unverified company. A disallowed company fails closed. A trusted company with current agency or ambiguous-domain evidence still fails or routes to review under the existing contradiction policy.

Current trust is projected over mutable candidate supply when candidates are read. This lets one exact-company review apply to future and existing unsent recruiters without rewriting candidate import snapshots. Reserve and planner reads therefore stop treating historical provider-only recruiters as actionable internal supply. Gmail approvals, sent messages, outreach records, and other immutable snapshots are never rewritten.

## Migration boundary

Migration `0022_company_trust.sql` adds `company_trust_current` and append-only `company_trust_audit`. It performs no historical trust inference or data backfill. Five-bucket/trust-dependent runtime now requires `0022`; feature-off application/system runtime retains its `0020` contract. Only the explicit migration command may apply the migration.

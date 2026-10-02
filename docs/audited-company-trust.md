# Audited company trust

Company trust is a separate safety boundary from provider discovery, target-company strategy membership, and person-level recruiter evidence. A recruiter can qualify automatically as internal only when the current employer resolves to `trusted-operating` and all existing person, email, employment, recruiting-function, domain, and contradiction gates also pass.

## Stable identity and states

The resolver uses the exact `strategyCompanyMatch.companyId` plus identity evidence from the candidate. When provider-native employer identity exists, the deterministic identity is `provider:<normalized-provider-namespace>:<exact-employer-id>`; the normalized domain is retained as corroborating reviewed evidence and any later domain drift fails closed. Only when no provider employer ID exists may an exact normalized domain form the deterministic fallback identity. Similar display names, fuzzy matches, partial domains, different provider IDs, different provider namespaces, and parent/subsidiary-looking names do not share trust. An employer ID without its provider namespace, or evidence with neither employer ID nor usable domain, has no reusable identity.

Trust states are:

- `unverified`
- `trusted-operating`
- `disallowed-recruiting-service`

Provider discovery creates no trust row or audit event. A company without human audit history resolves as version-zero `unverified` unless the exact curated identity rule below succeeds.

## Authoritative curated source

`AUTHORITATIVE_OPERATING_COMPANIES` is the existing reviewed set of exact target-company IDs paired with the exact domains used by controlled company-specific workflows. Automatic curated trust requires both values to match. `target_companies` alone is not authoritative because provider discovery also creates rows there. Its provenance, review date, tier, enabled state, name, and absence of recruiting keywords never confer employer trust.

An exact display-name match without the approved domain stays unverified. Free-form provenance that resembles the curated provenance also stays unverified.

## Audited human review

`reviewCompanyTrust` is the explicit application command. It requires an exact company identity key and reviewed identity evidence, intended state, non-empty reason, `local-operator`-style actor identity, source reference, command ID, expected current version, and timestamp. Its canonical replay fingerprint includes every one of those fields, including the timestamp. It runs in an immediate SQLite transaction and appends one `company_trust_audit` event. `company_trust_current` advances only because its read-only view selects the new highest valid audit version.

The command supports deliberate changes between all three states. Command replay with the same complete payload is idempotent. Reusing a command ID with any different meaningful field fails. An incorrect expected version fails as stale. Database constraints and triggers enforce unique event and command IDs, unique identity/version pairs, positive contiguous versions, valid states, consistent previous state after version one, and append-only audit history. SQLite rejects direct writes to the current view.

## Recruiter projection and history

The authoritative resolver supplies state and provenance to recruiter qualification. Neutral or missed domain vocabulary is supporting evidence only and cannot promote an unverified company. A disallowed company fails closed. A trusted company with current agency or ambiguous-domain evidence still fails or routes to review under the existing contradiction policy.

Current trust is projected over mutable candidate supply through one repository projection when candidates or queue supply are read. Bucket reserve, capacity, Add Drafts, Replace, and current candidate views consume that same projection. This lets one exact-company review apply to future and existing unsent recruiters without reimport or provider activity, while a disallow correction removes future actionability immediately. Candidate imports, Gmail approvals, sent messages, outreach records, and other immutable snapshots are never rewritten.

## Migration boundary

Migration `0022_company_trust.sql` adds authoritative append-only `company_trust_audit` and the derived read-only `company_trust_current` view. It performs no historical trust inference or data backfill. Five-bucket/trust-dependent runtime now requires `0022`; feature-off application/system runtime retains its `0020` contract. Only the explicit migration command may apply the migration.

-- Provider-native identities are primary when present, so a corroborating
-- domain may legitimately appear on more than one distinct provider entity.
DROP INDEX discovered_companies_domain_unique;
CREATE INDEX discovered_companies_domain_lookup ON discovered_companies(domain) WHERE domain IS NOT NULL;

CREATE TABLE company_trust_audit (
  id TEXT PRIMARY KEY,
  company_identity_key TEXT NOT NULL,
  provider_namespace TEXT,
  provider_employer_id TEXT,
  reviewed_domain TEXT,
  previous_trust_state TEXT NOT NULL CHECK (previous_trust_state IN ('unverified', 'trusted-operating', 'disallowed-recruiting-service')),
  resulting_trust_state TEXT NOT NULL CHECK (resulting_trust_state IN ('unverified', 'trusted-operating', 'disallowed-recruiting-service')),
  reviewer_actor TEXT NOT NULL,
  occurred_at_utc TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind = 'human-review'),
  source_reference TEXT NOT NULL,
  command_id TEXT NOT NULL UNIQUE,
  command_fingerprint TEXT NOT NULL,
  resulting_version INTEGER NOT NULL CHECK (resulting_version > 0),
  UNIQUE (company_identity_key, resulting_version),
  CHECK (
    (provider_namespace IS NULL AND provider_employer_id IS NULL)
    OR (provider_namespace IS NOT NULL AND provider_employer_id IS NOT NULL)
  ),
  CHECK (provider_employer_id IS NOT NULL OR reviewed_domain IS NOT NULL)
);

CREATE INDEX company_trust_audit_company_history
  ON company_trust_audit(company_identity_key, resulting_version);

CREATE TRIGGER company_trust_audit_version_sequence
BEFORE INSERT ON company_trust_audit
WHEN NEW.resulting_version != COALESCE(
  (SELECT MAX(resulting_version)
   FROM company_trust_audit
   WHERE company_identity_key = NEW.company_identity_key),
  0
) + 1
BEGIN
  SELECT RAISE(ABORT, 'company-trust-audit-version-sequence');
END;

-- Version one may follow the unverified default or an exact curated-registry
-- baseline. Every later event must name the actual preceding audit state.
CREATE TRIGGER company_trust_audit_previous_state
BEFORE INSERT ON company_trust_audit
WHEN NEW.resulting_version > 1
 AND NEW.previous_trust_state != (
   SELECT resulting_trust_state
   FROM company_trust_audit
   WHERE company_identity_key = NEW.company_identity_key
   ORDER BY resulting_version DESC
   LIMIT 1
 )
BEGIN
  SELECT RAISE(ABORT, 'company-trust-audit-previous-state');
END;

CREATE TRIGGER company_trust_audit_append_only_update
BEFORE UPDATE ON company_trust_audit
BEGIN
  SELECT RAISE(ABORT, 'company-trust-audit-append-only');
END;

CREATE TRIGGER company_trust_audit_append_only_delete
BEFORE DELETE ON company_trust_audit
BEGIN
  SELECT RAISE(ABORT, 'company-trust-audit-append-only');
END;

CREATE VIEW company_trust_current AS
SELECT
  audit.company_identity_key,
  audit.resulting_trust_state AS trust_state,
  audit.id AS latest_audit_event_id,
  audit.resulting_version AS version,
  audit.occurred_at_utc AS updated_at_utc,
  audit.provider_namespace,
  audit.provider_employer_id,
  audit.reviewed_domain
FROM company_trust_audit AS audit
JOIN (
  SELECT company_identity_key, MAX(resulting_version) AS resulting_version
  FROM company_trust_audit
  GROUP BY company_identity_key
) AS latest
  ON latest.company_identity_key = audit.company_identity_key
 AND latest.resulting_version = audit.resulting_version;

-- Existing companies intentionally receive no inferred audit row. Without a
-- human audit, trust resolves to unverified/version 0 (except the separately
-- checked exact curated ID+domain registry rule). Discovery alone creates no
-- trust history, and current trust cannot be written independently of audit.

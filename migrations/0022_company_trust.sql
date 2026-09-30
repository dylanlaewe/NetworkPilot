CREATE TABLE company_trust_audit (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  previous_trust_state TEXT NOT NULL CHECK (previous_trust_state IN ('unverified', 'trusted-operating', 'disallowed-recruiting-service')),
  resulting_trust_state TEXT NOT NULL CHECK (resulting_trust_state IN ('unverified', 'trusted-operating', 'disallowed-recruiting-service')),
  reviewer_actor TEXT NOT NULL,
  occurred_at_utc TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  command_id TEXT NOT NULL UNIQUE,
  command_fingerprint TEXT NOT NULL,
  resulting_version INTEGER NOT NULL CHECK (resulting_version > 0)
);

CREATE INDEX company_trust_audit_company_history
  ON company_trust_audit(company_id, resulting_version);

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

CREATE TABLE company_trust_current (
  company_id TEXT PRIMARY KEY,
  trust_state TEXT NOT NULL CHECK (trust_state IN ('unverified', 'trusted-operating', 'disallowed-recruiting-service')),
  latest_audit_event_id TEXT REFERENCES company_trust_audit(id),
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at_utc TEXT NOT NULL
);

-- Existing companies intentionally receive no inferred row. Absence resolves to
-- unverified; target membership, provenance and historical review dates are not
-- authoritative employer-trust evidence.

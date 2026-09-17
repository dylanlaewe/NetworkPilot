CREATE TABLE gmail_send_reconciliations (
  operation_id TEXT PRIMARY KEY REFERENCES gmail_draft_operations(operation_id),
  outcome TEXT NOT NULL CHECK(outcome IN ('sent','not-sent')),
  effective_sent_at_utc TEXT,
  provenance TEXT NOT NULL CHECK(provenance IN ('operator-reconciled-sent','operator-reconciled-not-sent')),
  reconciled_at_utc TEXT NOT NULL,
  CHECK((outcome='sent' AND effective_sent_at_utc IS NOT NULL) OR (outcome='not-sent' AND effective_sent_at_utc IS NULL))
);
CREATE TABLE gmail_send_reconciliation_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL REFERENCES gmail_draft_operations(operation_id),
  outcome TEXT NOT NULL CHECK(outcome IN ('sent','not-sent')),
  effective_sent_at_utc TEXT,
  provenance TEXT NOT NULL CHECK(provenance IN ('operator-reconciled-sent','operator-reconciled-not-sent')),
  occurred_at_utc TEXT NOT NULL
);
CREATE INDEX gmail_send_reconciliation_audit_operation_idx ON gmail_send_reconciliation_audit(operation_id,occurred_at_utc);

CREATE TABLE gmail_connection_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK(event_type IN ('same-account-reauthorized')),
  account_hash TEXT NOT NULL,
  granted_scopes_json TEXT NOT NULL,
  occurred_at_utc TEXT NOT NULL
);

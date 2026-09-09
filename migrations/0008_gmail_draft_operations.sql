CREATE TABLE gmail_connection_metadata (
  provider TEXT PRIMARY KEY CHECK(provider = 'gmail'),
  account_email TEXT,
  granted_scopes_json TEXT NOT NULL,
  connection_state TEXT NOT NULL CHECK(connection_state IN ('disconnected','connected','reauthorization-required')),
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE gmail_draft_operations (
  operation_id TEXT PRIMARY KEY,
  draft_snapshot_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK(provider = 'gmail'),
  state TEXT NOT NULL CHECK(state IN ('approved-for-gmail-draft','creating-gmail-draft','gmail-draft-created','reconciliation-required','failed')),
  approved_snapshot_json TEXT NOT NULL,
  gmail_draft_id TEXT,
  gmail_message_id TEXT,
  attempt_started_at_utc TEXT,
  completed_at_utc TEXT,
  error_category TEXT,
  adapter_version TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  CHECK((state = 'gmail-draft-created' AND gmail_draft_id IS NOT NULL AND gmail_message_id IS NOT NULL) OR state != 'gmail-draft-created')
);

CREATE INDEX gmail_draft_operations_state_idx ON gmail_draft_operations(state);

CREATE TABLE manual_outreach_records (
  id TEXT PRIMARY KEY,
  draft_snapshot_id TEXT NOT NULL UNIQUE REFERENCES gmail_draft_operations(draft_snapshot_id),
  gmail_operation_id TEXT NOT NULL UNIQUE REFERENCES gmail_draft_operations(operation_id),
  candidate_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  identity_source TEXT NOT NULL CHECK(identity_source IN ('prospect','imported-candidate')),
  confirmation_source TEXT NOT NULL CHECK(confirmation_source = 'operator'),
  confirmed_at_utc TEXT NOT NULL,
  effective_sent_at_utc TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('awaiting-response','replied','meeting-scheduled','declined','opt-out','no-response')),
  operation_version TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);

CREATE TABLE manual_outreach_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manual_outreach_id TEXT NOT NULL REFERENCES manual_outreach_records(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('operator-confirmed-manual-send','outcome-reported')),
  outcome TEXT CHECK(outcome IN ('awaiting-response','replied','meeting-scheduled','declined','opt-out','no-response')),
  confirmation_source TEXT NOT NULL CHECK(confirmation_source = 'operator'),
  occurred_at_utc TEXT NOT NULL
);

CREATE INDEX manual_outreach_company_time_idx
  ON manual_outreach_records(company_id, effective_sent_at_utc);

CREATE INDEX manual_outreach_candidate_time_idx
  ON manual_outreach_records(candidate_id, effective_sent_at_utc);

CREATE INDEX manual_outreach_audit_record_idx
  ON manual_outreach_audit(manual_outreach_id, occurred_at_utc);

CREATE TABLE candidate_suppression_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  created_at_utc TEXT NOT NULL
);

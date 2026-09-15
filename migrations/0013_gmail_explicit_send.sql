ALTER TABLE gmail_draft_operations ADD COLUMN send_state TEXT NOT NULL DEFAULT 'not-sent' CHECK(send_state IN ('not-sent','sending','sent','send-status-uncertain'));
ALTER TABLE gmail_draft_operations ADD COLUMN sent_at_utc TEXT;
ALTER TABLE gmail_draft_operations ADD COLUMN gmail_sent_message_id TEXT;

CREATE TABLE gmail_send_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('explicit-send-started','gmail-send-confirmed','gmail-send-uncertain')),
  occurred_at_utc TEXT NOT NULL,
  FOREIGN KEY(operation_id) REFERENCES gmail_draft_operations(operation_id)
);

CREATE TABLE manual_outreach_records_v3 (
  id TEXT PRIMARY KEY,
  draft_snapshot_id TEXT NOT NULL UNIQUE REFERENCES gmail_draft_operations(draft_snapshot_id),
  gmail_operation_id TEXT NOT NULL UNIQUE REFERENCES gmail_draft_operations(operation_id),
  candidate_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  identity_source TEXT NOT NULL CHECK(identity_source IN ('prospect','imported-candidate')),
  confirmation_source TEXT NOT NULL CHECK(confirmation_source IN ('operator','networkpilot-gmail-send')),
  confirmed_at_utc TEXT NOT NULL,
  effective_sent_at_utc TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('awaiting-response','replied','meeting-scheduled','declined','opt-out','no-response','hard-bounce')),
  operation_version TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  outreach_track TEXT NOT NULL DEFAULT 'professional' CHECK(outreach_track IN ('professional','recruiter'))
);
INSERT INTO manual_outreach_records_v3 SELECT * FROM manual_outreach_records;

CREATE TABLE manual_outreach_audit_v3 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manual_outreach_id TEXT NOT NULL REFERENCES manual_outreach_records_v3(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('operator-confirmed-manual-send','gmail-send-confirmed','outcome-reported','hard-bounce-reported')),
  outcome TEXT CHECK(outcome IN ('awaiting-response','replied','meeting-scheduled','declined','opt-out','no-response','hard-bounce')),
  confirmation_source TEXT NOT NULL CHECK(confirmation_source IN ('operator','networkpilot-gmail-send')),
  occurred_at_utc TEXT NOT NULL,
  outreach_track TEXT NOT NULL DEFAULT 'professional' CHECK(outreach_track IN ('professional','recruiter'))
);
INSERT INTO manual_outreach_audit_v3 SELECT * FROM manual_outreach_audit;
DROP TABLE manual_outreach_audit;
DROP TABLE manual_outreach_records;
ALTER TABLE manual_outreach_records_v3 RENAME TO manual_outreach_records;
ALTER TABLE manual_outreach_audit_v3 RENAME TO manual_outreach_audit;
CREATE INDEX manual_outreach_company_time_idx ON manual_outreach_records(company_id, effective_sent_at_utc);
CREATE INDEX manual_outreach_candidate_time_idx ON manual_outreach_records(candidate_id, effective_sent_at_utc);
CREATE INDEX manual_outreach_audit_record_idx ON manual_outreach_audit(manual_outreach_id, occurred_at_utc);

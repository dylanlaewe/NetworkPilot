ALTER TABLE gmail_draft_operations
  ADD COLUMN outreach_track TEXT NOT NULL DEFAULT 'professional'
  CHECK(outreach_track IN ('professional','recruiter'));

ALTER TABLE manual_outreach_records
  ADD COLUMN outreach_track TEXT NOT NULL DEFAULT 'professional'
  CHECK(outreach_track IN ('professional','recruiter'));

ALTER TABLE manual_outreach_audit
  ADD COLUMN outreach_track TEXT NOT NULL DEFAULT 'professional'
  CHECK(outreach_track IN ('professional','recruiter'));

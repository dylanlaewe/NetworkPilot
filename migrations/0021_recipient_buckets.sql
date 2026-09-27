-- Additive only: no legacy classification inference and no historical snapshot backfill.
ALTER TABLE imported_candidates ADD COLUMN recipient_bucket_json TEXT;
ALTER TABLE candidate_review_audit ADD COLUMN bucket_correction_json TEXT;
ALTER TABLE daily_refresh_runs ADD COLUMN bucket_scope_json TEXT;
ALTER TABLE candidate_refresh_events ADD COLUMN bucket_scope_json TEXT;
ALTER TABLE candidate_refresh_events ADD COLUMN result_json TEXT;
ALTER TABLE provider_operations ADD COLUMN bucket_scope_json TEXT;

CREATE TABLE recruiter_resume_preference (
  singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
  resume_id TEXT REFERENCES resume_library(id),
  updated_at_utc TEXT NOT NULL
);

ALTER TABLE candidate_refresh_events ADD COLUMN diagnostics_json TEXT;
CREATE TABLE candidate_refresh_observations (
  id TEXT PRIMARY KEY,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('started','completed','failed')),
  diagnostics_json TEXT NOT NULL
);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_id TEXT NOT NULL REFERENCES companies(id),
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL CHECK (email_verified IN (0, 1)),
  years_experience REAL NOT NULL,
  opted_out INTEGER NOT NULL DEFAULT 0 CHECK (opted_out IN (0, 1)),
  relevance_score REAL NOT NULL,
  fictional INTEGER NOT NULL DEFAULT 1 CHECK (fictional = 1)
);
CREATE TABLE IF NOT EXISTS simulation_runs (
  id TEXT PRIMARY KEY,
  campaign_date TEXT NOT NULL UNIQUE,
  campaign_timezone TEXT NOT NULL,
  started_at_utc TEXT NOT NULL,
  completed_at_utc TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'weekend-no-send')),
  target INTEGER NOT NULL,
  selected_count INTEGER NOT NULL,
  shortfall INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS qualification_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  prospect_id TEXT NOT NULL REFERENCES prospects(id),
  reason_code TEXT NOT NULL,
  accepted INTEGER NOT NULL CHECK (accepted IN (0, 1)),
  prospect_name_snapshot TEXT NOT NULL,
  company_name_snapshot TEXT NOT NULL,
  industry_snapshot TEXT NOT NULL,
  email_snapshot TEXT NOT NULL,
  years_experience_snapshot REAL NOT NULL,
  relevance_score_snapshot REAL NOT NULL,
  UNIQUE(run_id, prospect_id)
);
CREATE TABLE IF NOT EXISTS outreach_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT REFERENCES simulation_runs(id) ON DELETE SET NULL,
  prospect_id TEXT NOT NULL REFERENCES prospects(id),
  company_id TEXT NOT NULL REFERENCES companies(id),
  event_type TEXT NOT NULL,
  occurred_at_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS suppression_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id TEXT NOT NULL UNIQUE REFERENCES prospects(id),
  reason TEXT NOT NULL,
  created_at_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaign_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at_utc TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS outreach_events_prospect_idx ON outreach_events(prospect_id, occurred_at_utc);
CREATE INDEX IF NOT EXISTS outreach_events_company_idx ON outreach_events(company_id, occurred_at_utc);
CREATE INDEX IF NOT EXISTS decisions_run_reason_idx ON qualification_decisions(run_id, reason_code);

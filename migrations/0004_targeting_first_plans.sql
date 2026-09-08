ALTER TABLE fictional_company_profiles ADD COLUMN registry_company_id TEXT REFERENCES target_companies(id);
ALTER TABLE fictional_company_profiles ADD COLUMN registry_match_method TEXT NOT NULL DEFAULT 'simulation-alias';
ALTER TABLE fictional_company_profiles ADD COLUMN registry_match_provenance TEXT NOT NULL DEFAULT 'fictional-simulation-alias';

CREATE TABLE campaign_plans (
  id TEXT PRIMARY KEY REFERENCES simulation_runs(id) ON DELETE CASCADE,
  plan_version TEXT NOT NULL,
  targeting_version TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL CHECK(lifecycle_status IN ('created','evaluated','planned','drafted','simulation-approved','cancelled','failed')),
  diversification_config_json TEXT NOT NULL,
  quota_relaxations_json TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT NOT NULL
);
CREATE TABLE campaign_plan_lifecycle (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL REFERENCES campaign_plans(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('created','evaluated','planned','drafted','simulation-approved','cancelled','failed')),
  occurred_at_utc TEXT NOT NULL
);
CREATE TABLE campaign_plan_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id TEXT NOT NULL REFERENCES campaign_plans(id) ON DELETE CASCADE,
  prospect_id TEXT NOT NULL REFERENCES prospects(id),
  selected INTEGER NOT NULL CHECK(selected IN (0,1)),
  rank_before_diversification INTEGER,
  selection_reason TEXT NOT NULL,
  targeting_snapshot_json TEXT NOT NULL,
  UNIQUE(plan_id, prospect_id)
);
CREATE INDEX campaign_plan_decisions_plan_selected_idx ON campaign_plan_decisions(plan_id,selected,rank_before_diversification);

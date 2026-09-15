CREATE TABLE daily_refresh_runs (
  id TEXT PRIMARY KEY,
  campaign_date TEXT NOT NULL,
  generation INTEGER NOT NULL CHECK(generation > 0),
  created_at_utc TEXT NOT NULL,
  result_json TEXT NOT NULL,
  UNIQUE(campaign_date, generation)
);

CREATE INDEX idx_daily_refresh_campaign_date ON daily_refresh_runs(campaign_date, generation DESC);

CREATE TABLE draft_dispositions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL,
  campaign_date TEXT NOT NULL,
  disposition TEXT NOT NULL CHECK(disposition IN ('skipped','permanently-excluded')),
  created_at_utc TEXT NOT NULL,
  UNIQUE(candidate_id, campaign_date)
);

CREATE INDEX draft_dispositions_campaign_idx
  ON draft_dispositions(campaign_date, disposition);

CREATE TABLE draft_disposition_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL,
  campaign_date TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('draft-skipped','candidate-permanently-excluded')),
  occurred_at_utc TEXT NOT NULL
);

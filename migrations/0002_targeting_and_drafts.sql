CREATE TABLE IF NOT EXISTS target_companies (
  id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL UNIQUE, industry_id TEXT NOT NULL,
  company_tier TEXT NOT NULL CHECK(company_tier IN ('tier-1','tier-2','tier-3','excluded','unreviewed')), enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  recognition_score REAL NOT NULL, career_upside_score REAL NOT NULL, technical_interest_score REAL NOT NULL,
  geographic_relevance_json TEXT NOT NULL, rationale TEXT NOT NULL, provenance TEXT NOT NULL,
  last_reviewed_date TEXT NOT NULL, operator_notes TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS personalization_evidence (
  id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL REFERENCES prospects(id), source_type TEXT NOT NULL,
  source_reference TEXT NOT NULL, reviewed_at_utc TEXT NOT NULL, factual_claim TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK(verification_status IN ('verified','unverified'))
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL REFERENCES prospects(id), run_id TEXT REFERENCES simulation_runs(id),
  context_key TEXT NOT NULL, template_id TEXT NOT NULL, template_version TEXT NOT NULL,
  subject TEXT NOT NULL, body TEXT NOT NULL, fact_ids_json TEXT NOT NULL, evidence_ids_json TEXT NOT NULL,
  targeting_score_version TEXT NOT NULL, targeting_score REAL NOT NULL, score_components_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('generated','needs-review','approved-for-simulation','rejected','superseded')),
  created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL,
  UNIQUE(prospect_id, template_id, template_version, context_key)
);
CREATE INDEX IF NOT EXISTS drafts_run_status_idx ON drafts(run_id,status);
CREATE INDEX IF NOT EXISTS evidence_prospect_idx ON personalization_evidence(prospect_id,verification_status);

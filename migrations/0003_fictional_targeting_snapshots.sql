CREATE TABLE IF NOT EXISTS fictional_company_profiles (
  company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  industry_id TEXT NOT NULL,
  scenario_tier TEXT NOT NULL CHECK(scenario_tier IN ('tier-1','tier-2','tier-3')),
  recognition_score REAL NOT NULL, career_upside_score REAL NOT NULL,
  technical_interest_score REAL NOT NULL, profile_version TEXT NOT NULL,
  CHECK(recognition_score BETWEEN 0 AND 100), CHECK(career_upside_score BETWEEN 0 AND 100),
  CHECK(technical_interest_score BETWEEN 0 AND 100)
);
CREATE TABLE IF NOT EXISTS fictional_targeting_profiles (
  prospect_id TEXT PRIMARY KEY REFERENCES prospects(id) ON DELETE CASCADE,
  professional_title TEXT NOT NULL, role_family_id TEXT NOT NULL, desired_role_id TEXT NOT NULL,
  persona_id TEXT NOT NULL, geography_id TEXT NOT NULL, industry_id TEXT NOT NULL,
  role_alignment REAL NOT NULL, functional_relevance REAL NOT NULL, shared_signal REAL NOT NULL,
  data_quality REAL NOT NULL, role_specific_upside REAL NOT NULL, profile_version TEXT NOT NULL,
  CHECK(role_alignment BETWEEN 0 AND 100), CHECK(functional_relevance BETWEEN 0 AND 100),
  CHECK(shared_signal BETWEEN 0 AND 100), CHECK(data_quality BETWEEN 0 AND 100),
  CHECK(role_specific_upside BETWEEN 0 AND 100)
);
ALTER TABLE drafts ADD COLUMN recipient_snapshot_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE drafts ADD COLUMN explanation_codes_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE drafts ADD COLUMN rejection_code TEXT;
ALTER TABLE drafts ADD COLUMN template_catalog_version TEXT NOT NULL DEFAULT 'catalog-v1';

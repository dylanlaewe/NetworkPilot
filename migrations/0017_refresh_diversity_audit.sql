ALTER TABLE candidate_refresh_events ADD COLUMN preferred_enrichment_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE candidate_refresh_events ADD COLUMN discovered_enrichment_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE candidate_refresh_events ADD COLUMN recruiter_enrichment_attempts INTEGER NOT NULL DEFAULT 0;

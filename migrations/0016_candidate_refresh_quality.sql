ALTER TABLE candidate_refresh_events ADD COLUMN professional_candidates_added INTEGER NOT NULL DEFAULT 0;
ALTER TABLE candidate_refresh_events ADD COLUMN recruiter_candidates_added INTEGER NOT NULL DEFAULT 0;
ALTER TABLE candidate_refresh_events ADD COLUMN companies_added INTEGER NOT NULL DEFAULT 0;

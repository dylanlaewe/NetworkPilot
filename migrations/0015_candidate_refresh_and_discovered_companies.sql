CREATE TABLE candidate_refresh_events (
  id TEXT PRIMARY KEY,
  created_at_utc TEXT NOT NULL,
  usable_before INTEGER NOT NULL,
  target_reserve INTEGER NOT NULL,
  provider_cap INTEGER NOT NULL,
  search_calls INTEGER NOT NULL,
  enrichment_credits_used INTEGER NOT NULL,
  candidates_added INTEGER NOT NULL,
  qualified_candidates_added INTEGER NOT NULL,
  usable_after INTEGER NOT NULL
);

CREATE TABLE discovered_companies (
  id TEXT PRIMARY KEY,
  normalized_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  domain TEXT,
  discovery_source TEXT NOT NULL,
  legitimacy_state TEXT NOT NULL CHECK (legitimacy_state IN ('eligible', 'blocked')),
  blocked_reason TEXT,
  first_seen_at_utc TEXT NOT NULL,
  last_seen_at_utc TEXT NOT NULL
);
CREATE UNIQUE INDEX discovered_companies_domain_unique ON discovered_companies(domain) WHERE domain IS NOT NULL;

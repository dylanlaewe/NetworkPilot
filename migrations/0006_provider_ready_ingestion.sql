CREATE TABLE import_batches (
 id TEXT PRIMARY KEY, adapter_id TEXT NOT NULL, adapter_version TEXT NOT NULL, dataset_classification TEXT NOT NULL CHECK(dataset_classification IN ('fictional','provider-shaped-fixture')),
 state TEXT NOT NULL CHECK(state IN ('started','completed','failed')), record_count INTEGER NOT NULL, accepted_count INTEGER NOT NULL, duplicate_count INTEGER NOT NULL,
 review_required_count INTEGER NOT NULL, rejected_count INTEGER NOT NULL, source_fingerprint TEXT NOT NULL UNIQUE, safe_source_snapshot_json TEXT NOT NULL,
 normalization_version TEXT NOT NULL, classification_version TEXT NOT NULL, validation_outcomes_json TEXT NOT NULL, failure_reason_codes_json TEXT NOT NULL,
 started_at_utc TEXT NOT NULL, completed_at_utc TEXT
);
CREATE TABLE imported_candidates (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES import_batches(id), source_provider_id TEXT NOT NULL, provider_record_id TEXT NOT NULL,
 source_fingerprint TEXT NOT NULL, source_snapshot_json TEXT NOT NULL, normalized_snapshot_json TEXT NOT NULL,
 lifecycle_state TEXT NOT NULL CHECK(lifecycle_state IN ('imported','normalized','review-required','eligible','rejected','suppressed','planned')),
 review_state TEXT NOT NULL CHECK(review_state IN ('pending','confirmed','corrected','rejected','suppressed')), created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL,
 UNIQUE(source_provider_id,provider_record_id)
);
CREATE TABLE candidate_review_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id TEXT NOT NULL REFERENCES imported_candidates(id), batch_id TEXT NOT NULL REFERENCES import_batches(id),
 action TEXT NOT NULL CHECK(action IN ('confirm','correct','reject','suppress','pending')), before_snapshot_json TEXT NOT NULL, after_snapshot_json TEXT NOT NULL,
 reason TEXT NOT NULL, occurred_at_utc TEXT NOT NULL
);
CREATE INDEX imported_candidate_queue_idx ON imported_candidates(lifecycle_state,updated_at_utc);

CREATE TABLE resume_library (
  id TEXT PRIMARY KEY,
  display_label TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  sha256 TEXT NOT NULL CHECK(length(sha256) = 64),
  uploaded_at_utc TEXT NOT NULL,
  role_lane TEXT CHECK(role_lane IN ('data-analytics','product','software','general')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

CREATE INDEX resume_library_active_idx ON resume_library(active, uploaded_at_utc);

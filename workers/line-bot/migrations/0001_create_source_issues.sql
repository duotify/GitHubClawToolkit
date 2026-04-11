CREATE TABLE IF NOT EXISTS source_issues (
  source_key TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'creating',
  issue_number INTEGER,
  issue_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

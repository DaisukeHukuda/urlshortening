CREATE TABLE links (
  code        TEXT PRIMARY KEY,
  target_url  TEXT NOT NULL,
  title       TEXT,
  created_at  INTEGER NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 0
);

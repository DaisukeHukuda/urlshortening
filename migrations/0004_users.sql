CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

ALTER TABLE links ADD COLUMN user_id INTEGER;
CREATE INDEX idx_links_user ON links (user_id);

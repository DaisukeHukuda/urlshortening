CREATE TABLE clicks (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  code    TEXT NOT NULL,
  ts      INTEGER NOT NULL,
  country TEXT,
  referer TEXT,
  device  TEXT,
  os      TEXT,
  browser TEXT
);

CREATE INDEX idx_clicks_code_ts ON clicks (code, ts);

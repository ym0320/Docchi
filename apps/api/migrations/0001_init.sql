CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 60),
  option_a TEXT NOT NULL CHECK(length(option_a) BETWEEN 1 AND 30),
  option_b TEXT NOT NULL CHECK(length(option_b) BETWEEN 1 AND 30),
  created_at TEXT NOT NULL,
  closes_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed'))
);

CREATE INDEX IF NOT EXISTS idx_polls_closes_at ON polls(closes_at);
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON polls(created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  selected_option TEXT NOT NULL CHECK(selected_option IN ('A','B')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_votes_poll_session ON votes(poll_id, session_hash);
CREATE INDEX IF NOT EXISTS idx_votes_poll_id ON votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);

-- Little Alexandria. Five small tables, no magic.
-- Dates a reader types (started/finished) are 'YYYY-MM-DD' text;
-- machine timestamps are unix milliseconds.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  google_sub  TEXT NOT NULL UNIQUE,
  email       TEXT,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  INTEGER NOT NULL
);

-- id is the SHA-256 of the session token, so a leaked table can't be replayed.
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

-- A shared catalogue: a book is stored once, however many readers shelve it.
-- Only the server writes here, from metadata it fetched itself.
CREATE TABLE books (
  id              TEXT PRIMARY KEY,               -- '<source>:<source_id>'
  source          TEXT NOT NULL CHECK (source IN ('openlibrary', 'google', 'fixture')),
  source_id       TEXT NOT NULL,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  authors         TEXT NOT NULL DEFAULT '[]',     -- JSON array
  published_year  INTEGER,
  page_count      INTEGER CHECK (page_count IS NULL OR page_count > 0),
  description     TEXT,
  genres          TEXT NOT NULL DEFAULT '[]',     -- JSON array
  cover_url       TEXT,
  isbn13          TEXT,
  spine_color     TEXT CHECK (spine_color IS NULL OR spine_color GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  created_at      INTEGER NOT NULL,
  UNIQUE (source, source_id)
);

-- One row per book on a reader's shelves. UNIQUE(user_id, book_id) is what
-- makes "a book lives on exactly one shelf" true.
CREATE TABLE user_books (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id      TEXT NOT NULL REFERENCES books(id),
  shelf        TEXT NOT NULL CHECK (shelf IN ('want_to_read', 'reading', 'read')),
  position     TEXT NOT NULL,                      -- fractional index, compared bytewise
  rating       INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  notes        TEXT CHECK (notes IS NULL OR length(notes) <= 20000),
  started_at   TEXT CHECK (started_at IS NULL OR date(started_at) = started_at),
  finished_at  TEXT CHECK (finished_at IS NULL OR date(finished_at) = finished_at),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  UNIQUE (user_id, book_id),
  UNIQUE (user_id, shelf, position),
  CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)
);
CREATE INDEX user_books_finished_idx ON user_books(user_id, finished_at);

CREATE TABLE reading_goals (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year     INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 3000),
  target   INTEGER NOT NULL CHECK (target BETWEEN 1 AND 1000),
  PRIMARY KEY (user_id, year)
);

-- Public profiles: a reader can share their shelves at /u/<handle>.
-- Shelves are private until the reader turns sharing on; notes are never shared.
ALTER TABLE users ADD COLUMN handle TEXT;
ALTER TABLE users ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1));
CREATE UNIQUE INDEX users_handle_idx ON users(handle);

-- Imported reading lists often know only the year a book was finished.
-- finished_at then holds the year's last day and this flag says "sometime that year".
ALTER TABLE user_books ADD COLUMN finished_approx INTEGER NOT NULL DEFAULT 0 CHECK (finished_approx IN (0, 1));

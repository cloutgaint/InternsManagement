ALTER TABLE colleges ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS colleges_visible_idx ON colleges (active) WHERE archived_at IS NULL;

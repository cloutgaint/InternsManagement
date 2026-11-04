ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'COLLEGE_COORDINATOR';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS semester text;
CREATE TABLE IF NOT EXISTS college_coordinator_accounts(
  user_id uuid PRIMARY KEY REFERENCES users(id),
  college_id uuid NOT NULL REFERENCES colleges(id),
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_college_coordinator_accounts_college ON college_coordinator_accounts(college_id);
CREATE INDEX IF NOT EXISTS idx_batches_college_semester ON batches(college_id,semester);

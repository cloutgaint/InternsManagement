CREATE TABLE IF NOT EXISTS intern_mentor_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 intern_id uuid NOT NULL REFERENCES intern_profiles(id) ON DELETE CASCADE,
 mentor_id uuid NOT NULL REFERENCES mentors(id),
 assigned_by uuid REFERENCES users(id),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_intern_mentor ON intern_mentor_assignments(intern_id) WHERE active;
CREATE INDEX IF NOT EXISTS idx_intern_mentor_mentor ON intern_mentor_assignments(mentor_id) WHERE active;

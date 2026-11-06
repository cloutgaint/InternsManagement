ALTER TABLE weekly_tasks ADD COLUMN IF NOT EXISTS target_intern_id uuid REFERENCES intern_profiles(id) ON DELETE CASCADE;
ALTER TABLE weekly_tasks ADD COLUMN IF NOT EXISTS assigning_mentor_id uuid REFERENCES mentors(id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_target_intern ON weekly_tasks(target_intern_id) WHERE target_intern_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_assigning_mentor ON weekly_tasks(assigning_mentor_id) WHERE assigning_mentor_id IS NOT NULL;

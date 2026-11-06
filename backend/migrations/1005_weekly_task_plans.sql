CREATE TABLE IF NOT EXISTS weekly_task_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 intern_id uuid NOT NULL REFERENCES intern_profiles(id),
 created_by uuid NOT NULL REFERENCES users(id),
 confirmed_by uuid REFERENCES users(id),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','CONFIRMED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 confirmed_at timestamptz
);
ALTER TABLE weekly_tasks ADD COLUMN IF NOT EXISTS task_plan_id uuid REFERENCES weekly_task_plans(id);
ALTER TABLE weekly_tasks ADD COLUMN IF NOT EXISTS plan_week integer;
CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_week ON weekly_tasks(task_plan_id,plan_week) WHERE task_plan_id IS NOT NULL;

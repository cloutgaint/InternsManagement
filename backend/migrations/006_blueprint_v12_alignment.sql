-- Aligns the schema with Blueprint v1.2 workflows. Every statement is idempotent.

-- Account decisions (Section 4 Step 3) and credential lifecycle (Section 19)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS password_reset_tokens(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Proof overrides (5.4) and bulk allotment links (5.5)
ALTER TABLE college_proofs ADD COLUMN IF NOT EXISTS override_due_date date;
ALTER TABLE college_proofs ADD COLUMN IF NOT EXISTS file_names jsonb DEFAULT '[]';
ALTER TABLE college_proofs ALTER COLUMN issue_date DROP NOT NULL;
CREATE TABLE IF NOT EXISTS batch_order_students(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES batch_allotment_orders(id) ON DELETE CASCADE,
  roll_number text NOT NULL,
  intern_id uuid REFERENCES intern_profiles(id),
  linked_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_batch_order_roll ON batch_order_students(order_id,lower(btrim(roll_number)));

-- Batch-level configuration (Sections 8, 9.2, 13, 23)
ALTER TABLE batches ADD COLUMN IF NOT EXISTS late_after time NOT NULL DEFAULT '09:30';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS group_weight numeric NOT NULL DEFAULT 60;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS individual_weight numeric NOT NULL DEFAULT 40;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS individual_pass_mark numeric NOT NULL DEFAULT 40;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS group_composition text NOT NULL DEFAULT 'SINGLE_DOMAIN';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS group_size int NOT NULL DEFAULT 5;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS certificate_mode text NOT NULL DEFAULT 'IN_APP';
ALTER TABLE batch_domains ADD COLUMN IF NOT EXISTS assessment_id uuid REFERENCES assessments(id);
ALTER TABLE batch_domains ADD COLUMN IF NOT EXISTS rubric_id uuid REFERENCES rubrics(id);

-- Attendance corrections (9.1, 20): keep the original reason separate from the decision.
ALTER TABLE attendance_exceptions ADD COLUMN IF NOT EXISTS decision_reason text;
ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'CAMERA';
ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS corrected_by uuid REFERENCES users(id);
ALTER TABLE attendance_daily ADD COLUMN IF NOT EXISTS correction_reason text;
ALTER TABLE attendance_events ADD COLUMN IF NOT EXISTS failure_reason text;
UPDATE face_enrollments SET status='REENROLLMENT_REQUIRED' WHERE status='RETAKE_REQUIRED';

-- Offer letter status chain (8.1)
ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS previewed_by uuid REFERENCES users(id);
ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS previewed_at timestamptz;
ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id);
ALTER TABLE offer_letters ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Regrouping history (Section 8)
CREATE TABLE IF NOT EXISTS group_history(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES batches(id),
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_history_group ON group_history(group_id,created_at DESC);

-- Domain task templates (Sections 6.1, 10)
CREATE TABLE IF NOT EXISTS task_templates(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid REFERENCES domains(id),
  week_no int,
  title text NOT NULL,
  description text,
  expected_output text,
  submission_types jsonb NOT NULL DEFAULT '[]',
  resources text,
  marks numeric NOT NULL DEFAULT 100,
  rubric_id uuid REFERENCES rubrics(id),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fortnight review domain rubric scores (Section 11); one review per group and period.
ALTER TABLE fortnight_reviews ADD COLUMN IF NOT EXISTS rubric_id uuid REFERENCES rubrics(id);
ALTER TABLE fortnight_reviews ADD COLUMN IF NOT EXISTS rubric_scores jsonb NOT NULL DEFAULT '[]';
ALTER TABLE fortnight_reviews ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);

-- Completion outcomes and certificate modes (Sections 4 Step 27, 13.1)
ALTER TABLE completion_approvals ADD COLUMN IF NOT EXISTS extended_to date;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS issued_by uuid REFERENCES users(id);
ALTER TABLE college_completion_reports ADD COLUMN IF NOT EXISTS emailed_to text;
ALTER TABLE college_completion_reports ADD COLUMN IF NOT EXISTS emailed_at timestamptz;

-- Scheduled reminders are de-duplicated by event key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_event ON notifications(user_id,event_key) WHERE event_key IS NOT NULL;

ALTER TABLE domain_decisions ADD COLUMN IF NOT EXISTS reason text;

-- Attendance calendar: one row per allocation day with its computed status (9, 9.2). Days only
-- count once they have passed, or once today has a record, so today is not an early absence.
CREATE OR REPLACE VIEW attendance_calendar AS
SELECT ba.id allocation_id,ba.intern_id,ba.batch_id,d::date AS day,ad.id record_id,ad.check_in,ad.check_out,COALESCE(ad.working_minutes,0) working_minutes,ad.source,ad.correction_reason,
  CASE WHEN h.name IS NOT NULL THEN 'HOLIDAY'
       WHEN ad.status IN ('PRESENT','LATE') THEN ad.status
       WHEN lv.id IS NOT NULL THEN 'ON_LEAVE'
       WHEN ad.status IS NOT NULL AND ad.status<>'ABSENT' THEN ad.status
       ELSE 'ABSENT' END AS status,
  h.name holiday_name
FROM batch_allocations ba
JOIN batches b ON b.id=ba.batch_id
CROSS JOIN LATERAL generate_series(COALESCE(ba.intern_start,b.start_date),LEAST(COALESCE(ba.intern_end,b.end_date),current_date),interval '1 day') d
LEFT JOIN attendance_daily ad ON ad.intern_id=ba.intern_id AND ad.day=d::date
LEFT JOIN holidays h ON h.batch_id=ba.batch_id AND h.day=d::date
LEFT JOIN LATERAL(SELECT lr.id FROM leave_requests lr WHERE lr.intern_id=ba.intern_id AND lr.status='APPROVED' AND d::date BETWEEN lr.from_date AND lr.to_date LIMIT 1) lv ON true
WHERE b.working_days @> to_jsonb(extract(dow FROM d)::int)
  AND (d::date<current_date OR ad.id IS NOT NULL);

-- Holidays and approved leave leave the denominator; the rest is present/(present+absent).
CREATE OR REPLACE VIEW attendance_summary AS
SELECT ba.id allocation_id,ba.intern_id,ba.batch_id,
  count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE','ABSENT'))::int working_days,
  count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE'))::int present_days,
  count(c.day) FILTER(WHERE c.status='LATE')::int late_days,
  count(c.day) FILTER(WHERE c.status='ON_LEAVE')::int leave_days,
  count(c.day) FILTER(WHERE c.status='ABSENT')::int absent_days,
  count(c.day) FILTER(WHERE c.status='HOLIDAY')::int holiday_days,
  COALESCE(sum(c.working_minutes),0)::int working_minutes,
  CASE WHEN count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE','ABSENT'))=0 THEN 0
       ELSE round(count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE'))*100.0/count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE','ABSENT')),1) END attendance_percent
FROM batch_allocations ba LEFT JOIN attendance_calendar c ON c.allocation_id=ba.id
GROUP BY ba.id,ba.intern_id,ba.batch_id;

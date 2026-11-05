CREATE TABLE IF NOT EXISTS assessment_retry_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
 intern_id UUID NOT NULL REFERENCES intern_profiles(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
 reason TEXT NOT NULL DEFAULT '',
 admin_note TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 decided_at TIMESTAMPTZ,
 approved_attempt_id UUID REFERENCES assessment_attempts(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS assessment_retry_one_pending ON assessment_retry_requests(assessment_id,intern_id) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS assessment_retry_by_intern ON assessment_retry_requests(intern_id,assessment_id);

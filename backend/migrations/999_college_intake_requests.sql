CREATE TABLE IF NOT EXISTS college_intake_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 college_id uuid NOT NULL REFERENCES colleges(id),
 coordinator_id uuid NOT NULL REFERENCES users(id),
 academic_year varchar(20) NOT NULL,
 department varchar(120) NOT NULL,
 semester varchar(60) NOT NULL,
 proposed_start date,
 proposed_end date,
 student_count integer NOT NULL CHECK(student_count BETWEEN 1 AND 10000),
 remarks text NOT NULL DEFAULT '',
 status varchar(30) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','CORRECTION_REQUESTED')),
 review_comment text,
 reviewed_by uuid REFERENCES users(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(proposed_start IS NULL OR proposed_end IS NULL OR proposed_start<=proposed_end)
);
CREATE INDEX IF NOT EXISTS idx_college_intake_college ON college_intake_requests(college_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_college_intake_status ON college_intake_requests(status,created_at DESC);
CREATE TABLE IF NOT EXISTS college_intake_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES college_intake_requests(id) ON DELETE CASCADE,
 filename varchar(255) NOT NULL,
 mime_type varchar(120) NOT NULL,
 size_bytes bigint NOT NULL,
 storage_ref text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS college_intake_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES college_intake_requests(id),
 reviewer_id uuid NOT NULL REFERENCES users(id),
 old_status varchar(30) NOT NULL,
 new_status varchar(30) NOT NULL,
 comment text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
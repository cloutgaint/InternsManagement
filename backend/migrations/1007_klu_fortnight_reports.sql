CREATE TABLE IF NOT EXISTS klu_fortnight_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 intern_id uuid NOT NULL REFERENCES intern_profiles(id),
 fortnight_no integer NOT NULL CHECK(fortnight_no BETWEEN 1 AND 52),
 from_date date NOT NULL,
 to_date date NOT NULL,
 achievements text NOT NULL DEFAULT '',
 next_plan text NOT NULL DEFAULT '',
 exceptions text NOT NULL DEFAULT '',
 next_from date,
 next_to date,
 company_comments text NOT NULL DEFAULT '',
 company_marks numeric(5,2) CHECK(company_marks BETWEEN 0 AND 30),
 university_marks numeric(5,2) CHECK(university_marks BETWEEN 0 AND 10),
 student_feedback text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','FINALIZED')),
 created_by uuid REFERENCES users(id),
 finalized_by uuid REFERENCES users(id),
 finalized_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(intern_id,fortnight_no)
);
CREATE INDEX IF NOT EXISTS idx_klu_fortnight_intern ON klu_fortnight_reports(intern_id,fortnight_no);
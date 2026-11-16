-- One final status per intern per working day. Default policy: 8h full, 4h half.
-- Preserve manually approved corrections; recompute only completed camera sessions.
UPDATE attendance_daily ad
SET status = CASE
  WHEN ad.working_minutes >= 480 THEN CASE WHEN (ad.check_in AT TIME ZONE b.timezone)::time > b.late_after THEN 'LATE' ELSE 'PRESENT' END
  WHEN ad.working_minutes >= 240 THEN 'HALF_DAY'
  ELSE 'ABSENT' END
FROM batches b
WHERE ad.batch_id=b.id AND ad.source='CAMERA' AND ad.check_in IS NOT NULL AND ad.check_out IS NOT NULL;

UPDATE attendance_daily SET status='PENDING'
WHERE source='CAMERA' AND check_in IS NOT NULL AND check_out IS NULL;

CREATE OR REPLACE VIEW attendance_calendar AS
WITH dates AS (
  SELECT ba.id allocation_id,ba.intern_id,ba.batch_id,d::date day,
         row_number() OVER (PARTITION BY ba.intern_id,d::date ORDER BY ba.intern_start DESC NULLS LAST,ba.id DESC) allocation_rank
  FROM batch_allocations ba
  JOIN batches b ON b.id=ba.batch_id
  CROSS JOIN LATERAL generate_series(COALESCE(ba.intern_start,b.start_date),LEAST(COALESCE(ba.intern_end,b.end_date),current_date),interval '1 day') d
  WHERE b.working_days @> to_jsonb(extract(dow FROM d)::int)
)
SELECT dates.allocation_id,dates.intern_id,dates.batch_id,dates.day,
       ad.id record_id,ad.check_in,ad.check_out,COALESCE(ad.working_minutes,0) working_minutes,ad.source,ad.correction_reason,
       CASE WHEN h.name IS NOT NULL THEN 'HOLIDAY'
            WHEN lv.id IS NOT NULL THEN 'ON_LEAVE'
            WHEN ad.status IS NOT NULL THEN ad.status
            ELSE 'ABSENT' END AS status,
       h.name holiday_name
FROM dates
LEFT JOIN attendance_daily ad ON ad.intern_id=dates.intern_id AND ad.day=dates.day
LEFT JOIN holidays h ON h.batch_id=dates.batch_id AND h.day=dates.day
LEFT JOIN LATERAL (SELECT lr.id FROM leave_requests lr WHERE lr.intern_id=dates.intern_id AND lr.status='APPROVED' AND dates.day BETWEEN lr.from_date AND lr.to_date LIMIT 1) lv ON true
WHERE dates.allocation_rank=1 AND (dates.day<current_date OR ad.id IS NOT NULL);

CREATE OR REPLACE VIEW attendance_summary AS
SELECT ba.id allocation_id,ba.intern_id,ba.batch_id,
  count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE','HALF_DAY','ABSENT'))::int working_days,
  count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE'))::int present_days,
  count(c.day) FILTER(WHERE c.status='LATE')::int late_days,
  count(c.day) FILTER(WHERE c.status='ON_LEAVE')::int leave_days,
  count(c.day) FILTER(WHERE c.status='ABSENT')::int absent_days,
  count(c.day) FILTER(WHERE c.status='HOLIDAY')::int holiday_days,
  COALESCE(sum(c.working_minutes),0)::int working_minutes,
  CASE WHEN count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE','HALF_DAY','ABSENT'))=0 THEN 0
       ELSE round((count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE')) + 0.5 * count(c.day) FILTER(WHERE c.status='HALF_DAY')) * 100.0 /
         count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE','HALF_DAY','ABSENT')),1) END attendance_percent,
  count(c.day) FILTER(WHERE c.status='HALF_DAY')::int half_day_days
FROM batch_allocations ba LEFT JOIN attendance_calendar c ON c.allocation_id=ba.id
GROUP BY ba.id,ba.intern_id,ba.batch_id;

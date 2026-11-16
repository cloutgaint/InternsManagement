-- Reconcile stored camera attendance and refresh duration-derived daily statuses.
UPDATE attendance_daily ad
SET working_minutes=GREATEST(0,floor(extract(epoch FROM (ad.check_out-ad.check_in))/60))::int,
    status=CASE
      WHEN extract(epoch FROM (ad.check_out-ad.check_in)) >= 25200 THEN
        CASE WHEN (ad.check_in AT TIME ZONE b.timezone)::time > b.late_after THEN 'LATE' ELSE 'PRESENT' END
      WHEN extract(epoch FROM (ad.check_out-ad.check_in)) >= 14400 THEN 'HALF_DAY'
      ELSE 'ABSENT' END
FROM batches b
WHERE ad.batch_id=b.id AND ad.source='CAMERA' AND ad.check_in IS NOT NULL AND ad.check_out IS NOT NULL;

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
            WHEN ad.source='CAMERA' AND ad.check_in IS NOT NULL AND ad.check_out IS NULL THEN 'PENDING'
            WHEN ad.source='CAMERA' AND ad.check_in IS NOT NULL AND ad.check_out IS NOT NULL THEN
              CASE WHEN extract(epoch FROM (ad.check_out-ad.check_in)) >= 25200 THEN
                CASE WHEN (ad.check_in AT TIME ZONE b.timezone)::time > b.late_after THEN 'LATE' ELSE 'PRESENT' END
              WHEN extract(epoch FROM (ad.check_out-ad.check_in)) >= 14400 THEN 'HALF_DAY'
              ELSE 'ABSENT' END
            WHEN ad.status IS NOT NULL THEN ad.status
            ELSE 'ABSENT' END AS status,
       h.name holiday_name
FROM dates
JOIN batches b ON b.id=dates.batch_id
LEFT JOIN attendance_daily ad ON ad.intern_id=dates.intern_id AND ad.day=dates.day
LEFT JOIN holidays h ON h.batch_id=dates.batch_id AND h.day=dates.day
LEFT JOIN LATERAL (SELECT lr.id FROM leave_requests lr WHERE lr.intern_id=dates.intern_id AND lr.status='APPROVED' AND dates.day BETWEEN lr.from_date AND lr.to_date LIMIT 1) lv ON true
WHERE dates.allocation_rank=1 AND (dates.day<current_date OR ad.id IS NOT NULL);


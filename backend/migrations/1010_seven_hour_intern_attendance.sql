-- Update completed camera attendance for the seven-hour internship policy.
-- Manual corrections and incomplete check-ins remain unchanged.
UPDATE attendance_daily ad
SET status = CASE
  WHEN ad.working_minutes >= 420 THEN
    CASE WHEN (ad.check_in AT TIME ZONE b.timezone)::time > b.late_after THEN 'LATE' ELSE 'PRESENT' END
  WHEN ad.working_minutes >= 240 THEN 'HALF_DAY'
  ELSE 'ABSENT' END
FROM batches b
WHERE ad.batch_id=b.id
  AND ad.source='CAMERA'
  AND ad.check_in IS NOT NULL
  AND ad.check_out IS NOT NULL;

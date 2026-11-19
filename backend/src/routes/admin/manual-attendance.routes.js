import { Router } from "express";
import { tx } from "../../common/database/index.js";
import { audit } from "../../common/audit/audit.service.js";

const router = Router();
const fail = (status, message) => Object.assign(new Error(message), { status });
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateManualAttendance(input) {
  const { internId, day, checkIn, checkOut, reason } = input || {};
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(internId || ""))) throw fail(400, "Select a valid intern");
  if (!datePattern.test(String(day || "")) || new Date(day + "T00:00:00Z").toISOString().slice(0, 10) !== day) throw fail(400, "Enter a valid attendance date");
  if (!timePattern.test(String(checkIn || "")) || !timePattern.test(String(checkOut || ""))) throw fail(400, "Enter valid check-in and check-out times");
  if (checkOut <= checkIn) throw fail(400, "Check-out must be after check-in on the same day");
  if (!String(reason || "").trim() || String(reason).trim().length < 10 || String(reason).length > 1000) throw fail(400, "Enter a reason between 10 and 1000 characters");
  return { internId, day, checkIn, checkOut, reason: reason.trim() };
}

router.post("/attendance/manual", async (req, res, next) => {
  try {
    const input = validateManualAttendance(req.body);
    const outcome = await tx(async (client) => {
      // Serialize concurrent manual submissions for the same intern/day.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.internId + ":" + input.day]);
      const allocation = (await client.query(
        `SELECT ba.batch_id,b.timezone,b.late_after,b.working_days FROM batch_allocations ba
         JOIN batches b ON b.id=ba.batch_id JOIN intern_profiles ip ON ip.id=ba.intern_id
         JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED'
         WHERE ba.intern_id=$1 AND $2::date BETWEEN ba.intern_start AND ba.intern_end
         ORDER BY ba.intern_start DESC LIMIT 1`, [input.internId, input.day],
      )).rows[0];
      if (!allocation) throw fail(409, "No active internship allocation exists for this date");
      if (!(await client.query("SELECT $1::date <= (now() AT TIME ZONE $2)::date AS valid", [input.day, allocation.timezone])).rows[0].valid) throw fail(400, "Future attendance cannot be entered");
      const workday = (await client.query(
        `SELECT b.working_days @> to_jsonb(extract(dow FROM $2::date)::int) working,
          EXISTS(SELECT 1 FROM holidays h WHERE h.batch_id=$1 AND h.day=$2::date) holiday,
          EXISTS(SELECT 1 FROM leave_requests lr WHERE lr.intern_id=$3 AND lr.status='APPROVED' AND $2::date BETWEEN lr.from_date AND lr.to_date) leave`,
        [allocation.batch_id, input.day, input.internId],
      )).rows[0];
      if (!workday.working || workday.holiday || workday.leave) throw fail(409, "Attendance cannot be entered on a non-working day, holiday or approved leave");
      const previous = (await client.query("SELECT * FROM attendance_daily WHERE intern_id=$1 AND day=$2::date FOR UPDATE", [input.internId, input.day])).rows[0];
      if (previous) throw fail(409, "Attendance already exists for this date. Use the existing exception correction workflow.");
      const computed = (await client.query(
        `SELECT ($1::date + $2::time) AT TIME ZONE $4 AS check_in,
                ($1::date + $3::time) AT TIME ZONE $4 AS check_out,
                (extract(epoch FROM ($3::time-$2::time))/60)::int AS minutes`,
        [input.day, input.checkIn, input.checkOut, allocation.timezone],
      )).rows[0];
      if (computed.check_out > new Date()) throw fail(400, "Check-out cannot be in the future");
      const minutes = Number(computed.minutes);
      const status = minutes >= 420 ? (input.checkIn > String(allocation.late_after).slice(0,5) ? "LATE" : "PRESENT") : minutes >= 240 ? "HALF_DAY" : "ABSENT";
      const record = (await client.query(
        `INSERT INTO attendance_daily(intern_id,batch_id,day,check_in,check_out,working_minutes,status,source,corrected_by,correction_reason)
         VALUES($1,$2,$3::date,$4,$5,$6,$7,'MANUAL',$8,$9) RETURNING *`,
        [input.internId, allocation.batch_id, input.day, computed.check_in, computed.check_out, minutes, status, req.user.id, input.reason],
      )).rows[0];
      return record;
    });
    await audit(req, "ATTENDANCE_MANUAL_CREATED", "attendance_daily", outcome.id, null, outcome);
    res.status(201).json(outcome);
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Attendance already exists for this date" });
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});
export default router;

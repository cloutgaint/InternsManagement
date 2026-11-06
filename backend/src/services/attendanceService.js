import { q, tx } from "../common/database/index.js";
import { audit } from "../common/audit/audit.service.js";
import { notify } from "../common/notifications/notification.service.js";

const conflict = (message) => Object.assign(new Error(message), { status: 409 });
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// Why today cannot have a camera event: not a working day, a holiday, or approved leave.
export async function attendanceDayState(internId) {
  const row = (await q(
    `SELECT b.working_days @> to_jsonb(extract(dow FROM current_date)::int) is_working_day,h.name holiday,lv.id leave_id
     FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id
     LEFT JOIN holidays h ON h.batch_id=b.id AND h.day=current_date
     LEFT JOIN LATERAL(SELECT id FROM leave_requests lr WHERE lr.intern_id=ba.intern_id AND lr.status='APPROVED' AND current_date BETWEEN lr.from_date AND lr.to_date LIMIT 1) lv ON true
     WHERE ba.intern_id=$1 AND current_date BETWEEN ba.intern_start AND ba.intern_end ORDER BY ba.intern_start DESC LIMIT 1`,
    [internId],
  )).rows[0];
  if (!row) return { blocked: false, status: "NO_ALLOCATION" };
  if (row.holiday) return { blocked: true, status: "HOLIDAY", message: "Today is a holiday: " + row.holiday };
  if (row.leave_id) return { blocked: true, status: "ON_LEAVE", message: "You are on approved leave today" };
  if (!row.is_working_day) return { blocked: true, status: "NON_WORKING_DAY", message: "Today is not a working day for your batch" };
  return { blocked: false, status: "WORKING_DAY" };
}

export async function notifyGroupMentors(internId, type, title, body, actionUrl) {
  const mentors = (await q(
    "SELECT m.user_id FROM group_members gm JOIN mentor_assignments ma ON ma.group_id=gm.group_id AND ma.active JOIN mentors m ON m.id=ma.mentor_id WHERE gm.intern_id=$1 AND gm.active UNION SELECT m.user_id FROM intern_mentor_assignments ima JOIN mentors m ON m.id=ima.mentor_id WHERE ima.intern_id=$1 AND ima.active",
    [internId],
  )).rows;
  for (const mentor of mentors) await notify(mentor.user_id, type, title, body, actionUrl);
}

const internUser = async (internId) => (await q("SELECT user_id,full_name FROM intern_profiles WHERE id=$1", [internId])).rows[0];

export async function notifyFaceDecision(internId, status, reason) {
  const intern = await internUser(internId);
  const body = {
    APPROVED: "Your face enrollment is approved. Camera attendance is now enabled.",
    REJECTED: "Your face enrollment was rejected. Reason: " + reason,
    REENROLLMENT_REQUIRED: "Please enroll your face again. Reason: " + reason,
  }[status];
  await notify(intern?.user_id, "FACE_ENROLLMENT_" + status, "Face enrollment update", body, "/intern/face-enrollment");
}

export async function decideLeave(req, id, status, reason, canDecide = null) {
  if (!["APPROVED", "REJECTED"].includes(status)) throw badRequest("Invalid leave decision");
  if (status === "REJECTED" && !String(reason || "").trim()) throw badRequest("Rejection reason is required");
  const outcome = await tx(async (client) => {
    const before = (await client.query("SELECT * FROM leave_requests WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!before || before.status !== "REQUESTED") throw conflict("Only requested leave can be decided");
    if (canDecide && !(await canDecide(before.intern_id))) throw Object.assign(new Error("This intern is not in your assigned groups"), { status: 403 });
    if (status === "APPROVED") {
      const limit = (await client.query(
        "SELECT b.leave_limit_days FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id WHERE ba.intern_id=$1 AND $2::date BETWEEN ba.intern_start AND ba.intern_end LIMIT 1",
        [before.intern_id, before.from_date],
      )).rows[0];
      const used = Number((await client.query("SELECT COALESCE(sum(requested_days),0) n FROM leave_requests WHERE intern_id=$1 AND status='APPROVED'", [before.intern_id])).rows[0].n);
      if (used + Number(before.requested_days) > Number(limit?.leave_limit_days || 0))
        throw conflict("Approval would exceed the configured leave limit");
    }
    const after = (await client.query(
      "UPDATE leave_requests SET status=$1,decision_reason=$2,decided_by=$3,decided_at=now() WHERE id=$4 RETURNING *",
      [status, reason || null, req.user.id, id],
    )).rows[0];
    return { before, after };
  });
  await audit(req, "LEAVE_" + status, "leave_request", id, outcome.before, outcome.after);
  const intern = await internUser(outcome.after.intern_id);
  await notify(intern?.user_id, "LEAVE_" + status, "Leave " + status.toLowerCase(),
    "Your leave from " + outcome.after.from_date + " to " + outcome.after.to_date + " was " + status.toLowerCase() + (reason ? ". " + reason : "."), "/intern/work-log");
  return outcome.after;
}

// An approved exception changes the attendance record; nothing is ever edited silently.
export async function decideAttendanceException(req, id, status, reason, canDecide = null) {
  if (!["APPROVED", "REJECTED", "CLOSED"].includes(status)) throw badRequest("Decision must be APPROVED, REJECTED or CLOSED");
  const decisionReason = String(reason || "").trim();
  if (!decisionReason) throw badRequest("An attendance exception decision reason is required");
  const outcome = await tx(async (client) => {
    const before = (await client.query("SELECT * FROM attendance_exceptions WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!before) throw Object.assign(new Error("Attendance exception not found"), { status: 404 });
    if (!["DETECTED", "REQUESTED"].includes(before.status)) throw conflict("Attendance exception already decided");
    if (canDecide && !(await canDecide(before.intern_id))) throw Object.assign(new Error("This intern is not in your assigned groups"), { status: 403 });
    const after = (await client.query(
      "UPDATE attendance_exceptions SET status=$1,decision_reason=$2,decided_by=$3,decided_at=now() WHERE id=$4 RETURNING *",
      [status, decisionReason, req.user.id, id],
    )).rows[0];
    let record = null;
    if (status === "APPROVED" && before.day) {
      const wanted = before.requested_value || {};
      const allocation = (await client.query(
        "SELECT batch_id FROM batch_allocations WHERE intern_id=$1 AND $2::date BETWEEN intern_start AND intern_end ORDER BY intern_start DESC LIMIT 1",
        [before.intern_id, before.day],
      )).rows[0];
      record = (await client.query(
        `INSERT INTO attendance_daily(intern_id,batch_id,day,check_in,check_out,working_minutes,status,source,corrected_by,correction_reason)
         VALUES($1,$2,$3,$4::timestamptz,$5::timestamptz,COALESCE(GREATEST(0,extract(epoch from($5::timestamptz-$4::timestamptz))/60)::int,0),$6,'MANUAL',$7,$8)
         ON CONFLICT(intern_id,day) DO UPDATE SET check_in=COALESCE(EXCLUDED.check_in,attendance_daily.check_in),check_out=COALESCE(EXCLUDED.check_out,attendance_daily.check_out),
           working_minutes=CASE WHEN EXCLUDED.check_out IS NOT NULL THEN EXCLUDED.working_minutes ELSE attendance_daily.working_minutes END,
           status=EXCLUDED.status,source='MANUAL',corrected_by=EXCLUDED.corrected_by,correction_reason=EXCLUDED.correction_reason RETURNING *`,
        [before.intern_id, allocation?.batch_id || null, before.day, wanted.checkIn || null, wanted.checkOut || null, wanted.requestedStatus || "PRESENT", req.user.id, decisionReason],
      )).rows[0];
    }
    return { before, after, record };
  });
  await audit(req, "ATTENDANCE_EXCEPTION_" + status, "attendance_exception", id, outcome.before, { ...outcome.after, record: outcome.record });
  const intern = await internUser(outcome.after.intern_id);
  if (status !== "CLOSED") await notify(intern?.user_id, "ATTENDANCE_CORRECTION_" + status, "Attendance correction " + status.toLowerCase(), "Your attendance request for " + outcome.after.day + " was " + status.toLowerCase() + ". " + decisionReason, "/intern/attendance");
  return outcome.after;
}

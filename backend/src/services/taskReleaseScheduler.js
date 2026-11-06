import { q } from "../common/database/index.js";
import { notify } from "../common/notifications/notification.service.js";
import fs from "fs";
let timer = null,
  running = false;
export async function releaseDueTasks() {
  if (running) return;
  running = true;
  try {
    const due = (
      await q(
        `UPDATE weekly_tasks SET status='RELEASED',released_at=now()
         WHERE id IN (
           SELECT id FROM weekly_tasks
           WHERE status='SCHEDULED' AND release_at IS NOT NULL AND release_at<=now()
           ORDER BY release_at FOR UPDATE SKIP LOCKED
         ) RETURNING *`,
      )
    ).rows;
    for (const x of due) {
      const t = x;
      const users = (
        await q(
          `SELECT DISTINCT ip.user_id FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id LEFT JOIN group_members gm ON gm.intern_id=ip.id AND gm.active WHERE ba.batch_id=$1 AND ($2::uuid IS NULL OR ip.final_domain_id=$2) AND ($3::uuid IS NULL OR gm.group_id=$3) AND ($4::uuid IS NULL OR ip.id=$4)`,
          [t.batch_id, t.domain_id, t.group_id, t.target_intern_id],
        )
      ).rows;
      for (const u of users)
        await notify(
          u.user_id,
          "TASK_RELEASED",
          "Weekly task released: " + t.title,
          t.due_at
            ? "Due " +
                new Date(t.due_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })
            : "Open your Tasks workspace for details.",
        );
    }
  } finally {
    running = false;
  }
}
// Reminders use event keys, so running every minute sends each one once (Blueprint Section 17).
export async function sendDueReminders() {
  const deadlines = (await q(
    `SELECT DISTINCT wt.id,wt.title,wt.due_at,ip.user_id FROM weekly_tasks wt JOIN batch_allocations ba ON ba.batch_id=wt.batch_id JOIN intern_profiles ip ON ip.id=ba.intern_id
     JOIN users u ON u.id=ip.user_id AND u.is_active WHERE wt.status='RELEASED' AND wt.due_at BETWEEN now() AND now()+interval '24 hours'
       AND (wt.target_intern_id IS NULL OR wt.target_intern_id=ip.id) AND (wt.domain_id IS NULL OR wt.domain_id=ip.final_domain_id) AND (wt.group_id IS NULL OR EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=wt.group_id AND gm.intern_id=ip.id AND gm.active))
       AND NOT EXISTS(SELECT 1 FROM task_submissions ts WHERE ts.task_id=wt.id AND ts.intern_id=ip.id)`,
  )).rows;
  for (const x of deadlines) await notify(x.user_id, "TASK_DEADLINE", "Task due soon: " + x.title, "This task is due within 24 hours.", "/intern/tasks", "TASK-DUE:" + x.id);
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata", hour: "numeric", hour12: false }));
  const phase = hour >= 19 ? "EVENING" : hour >= 11 ? "MORNING" : null;
  if (!phase) return;
  const missing = (await q(
    `SELECT ip.user_id FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id JOIN intern_profiles ip ON ip.id=ba.intern_id JOIN users u ON u.id=ip.user_id AND u.is_active
     LEFT JOIN daily_reports dr ON dr.intern_id=ip.id AND dr.day=current_date
     WHERE current_date BETWEEN ba.intern_start AND ba.intern_end AND b.working_days @> to_jsonb(extract(dow FROM current_date)::int)
       AND NOT EXISTS(SELECT 1 FROM holidays h WHERE h.batch_id=b.id AND h.day=current_date)
       AND NOT EXISTS(SELECT 1 FROM leave_requests lr WHERE lr.intern_id=ip.id AND lr.status='APPROVED' AND current_date BETWEEN lr.from_date AND lr.to_date)
       AND NOT EXISTS(SELECT 1 FROM exit_records ex WHERE ex.intern_id=ip.id)
       AND ${phase === "MORNING" ? "dr.morning_at" : "dr.evening_at"} IS NULL`,
  )).rows;
  const day = new Date().toISOString().slice(0, 10);
  for (const x of missing)
    await notify(x.user_id, "DAILY_REPORT_MISSING", phase === "MORNING" ? "Submit your morning plan" : "Submit your evening report", "Your " + phase.toLowerCase() + " daily report is still missing today.", "/intern/work-log", "DAILY:" + phase + ":" + day);
}

// Retention is opt-in: GAINT sets the period (Blueprint 5.7, 23), so nothing is purged until configured.
export async function applyRetention() {
  const proofDays = Number(process.env.PROOF_RETENTION_DAYS), faceDays = Number(process.env.FACE_RETENTION_DAYS);
  const purge = async (rows, clear, action, entity) => {
    for (const row of rows) {
      let paths = [row.path];
      try { const parsed = JSON.parse(row.path); if (Array.isArray(parsed)) paths = parsed; } catch {}
      for (const file of paths) fs.unlink(file, () => {});
      await q(clear, [row.id]);
      await q("INSERT INTO audit_logs(action,entity_type,entity_id) VALUES($1,$2,$3)", [action, entity, String(row.id)]);
    }
  };
  if (proofDays > 0) await purge((await q(
    `SELECT cp.id,cp.file_path path FROM college_proofs cp WHERE cp.file_path IS NOT NULL AND cp.batch_order_id IS NULL AND NOT EXISTS(SELECT 1 FROM batch_allocations ba WHERE ba.intern_id=cp.intern_id AND ba.intern_end+$1::int>=current_date) AND cp.created_at<now()-make_interval(days=>$1::int)`,
    [proofDays],
  )).rows, "UPDATE college_proofs SET file_path=NULL WHERE id=$1", "RETENTION_PROOF_FILE_DELETED", "college_proof");
  if (faceDays > 0) await purge((await q(
    `SELECT fe.id,fe.raw_image_path path FROM face_enrollments fe WHERE fe.raw_image_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM batch_allocations ba WHERE ba.intern_id=fe.intern_id AND ba.intern_end+$1::int>=current_date) AND fe.created_at<now()-make_interval(days=>$1::int)`,
    [faceDays],
  )).rows, "UPDATE face_enrollments SET raw_image_path=NULL,status='DELETED',decision_reason='Retention period ended' WHERE id=$1", "RETENTION_FACE_DATA_DELETED", "face_enrollment");
}

export function startTaskReleaseScheduler() {
  const tick = () => { releaseDueTasks().catch(console.error); sendDueReminders().catch(console.error); };
  tick();
  applyRetention().catch(console.error);
  setInterval(() => applyRetention().catch(console.error), 24 * 60 * 60_000).unref?.();
  timer = setInterval(tick, 60_000);
  timer.unref?.();
  return timer;
}

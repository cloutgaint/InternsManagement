import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { q, tx } from "../common/database/index.js";
import { audit } from "../common/audit/audit.service.js";
import { notify, notifyGroup } from "../common/notifications/notification.service.js";
import { sendMail } from "../common/notifications/mail.service.js";
import { generateCertificate } from "../services/certificateService.js";
import { releaseDueTasks } from "../services/taskReleaseScheduler.js";
import { documentUpload, validExternalDocumentUrl, validateUploadedDocument } from "../services/collaborationService.js";

const r = Router();
const SUBMISSION_TYPES = ["TEXT", "LINK", "REPOSITORY", "DOCUMENT", "PRESENTATION", "VIDEO", "FILE"];
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(value));
const inRange = (value, min, max) => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;

const history = (run, groupId, batchId, actorId, action, details) =>
  run("INSERT INTO group_history(group_id,batch_id,actor_id,action,details) VALUES($1,$2,$3,$4,$5)", [groupId, batchId, actorId, action, JSON.stringify(details)]);

// ---- Batch configuration (Sections 4 Steps 4-5, 8, 9.2, 13) ----
r.patch("/batches/:id", async (req, res) => {
  const before = (await q("SELECT * FROM batches WHERE id=$1", [req.params.id])).rows[0];
  if (!before) return res.status(404).json({ error: "Batch not found" });
  const b = req.body;
  const next = {
    name: String(b.name ?? before.name).trim(), code: String(b.code ?? before.code).trim(),
    start: b.startDate ?? before.start_date, end: b.endDate ?? before.end_date,
    mode: b.mode ?? before.mode, status: b.status ?? before.status,
    days: b.workingDays ?? before.working_days, minAttendance: Number(b.minAttendance ?? before.min_attendance),
    lateAfter: b.lateAfter ?? String(before.late_after).slice(0, 5), leave: Number(b.leaveLimitDays ?? before.leave_limit_days),
    groupWeight: Number(b.groupWeight ?? before.group_weight), individualWeight: Number(b.individualWeight ?? before.individual_weight),
    passMark: Number(b.individualPassMark ?? before.individual_pass_mark), composition: b.groupComposition ?? before.group_composition,
    groupSize: Number(b.groupSize ?? before.group_size), certificateMode: b.certificateMode ?? before.certificate_mode,
  };
  if (!next.name || !next.code || !validDate(next.start) || !validDate(next.end) || next.end < next.start)
    return res.status(400).json({ error: "Batch name, code and valid dates are required" });
  if (!["ONSITE", "REMOTE", "HYBRID"].includes(next.mode)) return res.status(400).json({ error: "Invalid internship mode" });
  if (!["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"].includes(next.status)) return res.status(400).json({ error: "Invalid batch status" });
  if (!Array.isArray(next.days) || !next.days.length || next.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
    return res.status(400).json({ error: "Select at least one working day" });
  if (!inRange(next.minAttendance, 0, 100) || !inRange(next.passMark, 0, 100)) return res.status(400).json({ error: "Attendance and pass marks must be between 0 and 100" });
  if (!/^\d{2}:\d{2}$/.test(next.lateAfter)) return res.status(400).json({ error: "Late-after must be a HH:MM time" });
  if (!Number.isInteger(next.leave) || next.leave < 0 || next.leave > 60) return res.status(400).json({ error: "Leave limit must be between 0 and 60 days" });
  if (!inRange(next.groupWeight, 0, 100) || !inRange(next.individualWeight, 0, 100) || next.groupWeight + next.individualWeight !== 100)
    return res.status(400).json({ error: "Group and individual weights must total 100" });
  if (!["SINGLE_DOMAIN", "CROSS_FUNCTIONAL"].includes(next.composition)) return res.status(400).json({ error: "Invalid group composition" });
  if (!Number.isInteger(next.groupSize) || next.groupSize < 2 || next.groupSize > 20) return res.status(400).json({ error: "Group size must be between 2 and 20" });
  if (!["IN_APP", "OFFLINE"].includes(next.certificateMode)) return res.status(400).json({ error: "Invalid certificate mode" });
  const x = (await q(
    `UPDATE batches SET name=$2,code=$3,start_date=$4,end_date=$5,mode=$6,status=$7,working_days=$8,min_attendance=$9,late_after=$10,leave_limit_days=$11,group_weight=$12,individual_weight=$13,individual_pass_mark=$14,group_composition=$15,group_size=$16,certificate_mode=$17 WHERE id=$1 RETURNING *`,
    [before.id, next.name, next.code, next.start, next.end, next.mode, next.status, JSON.stringify(next.days), next.minAttendance, next.lateAfter, next.leave, next.groupWeight, next.individualWeight, next.passMark, next.composition, next.groupSize, next.certificateMode],
  )).rows[0];
  // Date changes must re-flag interns whose college-approved period no longer covers the internship.
  await q(
    `UPDATE batch_allocations ba SET date_mismatch=COALESCE(cp.approved_from>ba.intern_start OR cp.approved_to<ba.intern_end,false)
     FROM (SELECT DISTINCT ON (intern_id) intern_id,approved_from,approved_to FROM college_proofs WHERE status IN ('VERIFIED','OVERRIDE') ORDER BY intern_id,created_at DESC) cp
     WHERE ba.batch_id=$1 AND cp.intern_id=ba.intern_id`,
    [before.id],
  );
  await audit(req, "BATCH_UPDATE", "batch", x.id, before, x);
  res.json(x);
});

// ---- Regrouping: merge and split (Section 4 Step 13) ----
r.post("/groups/:id/merge", async (req, res) => {
  const { targetGroupId } = req.body;
  if (!targetGroupId || targetGroupId === req.params.id) return res.status(400).json({ error: "Choose a different group to merge into" });
  const out = await tx(async (c) => {
    const groups = (await c.query("SELECT * FROM groups WHERE id=ANY($1::uuid[]) FOR UPDATE", [[req.params.id, targetGroupId]])).rows;
    const source = groups.find((g) => g.id === req.params.id), target = groups.find((g) => g.id === targetGroupId);
    if (!source || !target) throw Object.assign(new Error("Group not found"), { status: 404 });
    if (source.batch_id !== target.batch_id) throw Object.assign(new Error("Groups from different batches cannot be merged"), { status: 409 });
    const members = (await c.query("SELECT intern_id,domain_id FROM group_members WHERE group_id=$1 AND active", [source.id])).rows;
    const targetDomains = (await c.query("SELECT DISTINCT domain_id FROM group_members WHERE group_id=$1 AND active", [target.id])).rows.map((x) => x.domain_id);
    if (target.type === "SINGLE_DOMAIN" && new Set([...targetDomains, ...members.map((x) => x.domain_id)]).size > 1)
      throw Object.assign(new Error("Single-domain groups cannot mix confirmed domains"), { status: 409 });
    for (const m of members)
      await c.query("INSERT INTO group_members(group_id,intern_id,domain_id,active) VALUES($1,$2,$3,true) ON CONFLICT(group_id,intern_id) DO UPDATE SET active=true,domain_id=EXCLUDED.domain_id", [target.id, m.intern_id, m.domain_id]);
    await c.query("UPDATE group_members SET active=false WHERE group_id=$1", [source.id]);
    await c.query("UPDATE groups SET status='MERGED' WHERE id=$1", [source.id]);
    await c.query("UPDATE mentor_assignments SET active=false WHERE group_id=$1", [source.id]);
    await history(c.query.bind(c), target.id, target.batch_id, req.user.id, "MERGED", { from: source.id, moved: members.map((x) => x.intern_id) });
    return { target, moved: members.length };
  });
  await audit(req, "GROUP_MERGED", "group", targetGroupId, { source: req.params.id }, { moved: out.moved });
  await notifyGroup(targetGroupId, "GROUP_CHANGED", "Group updated", "Your project group membership changed. Open your dashboard for details.", "/intern");
  res.json({ ok: true, moved: out.moved });
});
r.post("/groups/:id/split", async (req, res) => {
  const ids = [...new Set(req.body.internIds || [])], name = String(req.body.name || "").trim();
  if (!ids.length || !name) return res.status(400).json({ error: "New group name and members are required" });
  const created = await tx(async (c) => {
    const source = (await c.query("SELECT * FROM groups WHERE id=$1 FOR UPDATE", [req.params.id])).rows[0];
    if (!source) throw Object.assign(new Error("Group not found"), { status: 404 });
    const members = (await c.query("SELECT intern_id,domain_id FROM group_members WHERE group_id=$1 AND active", [source.id])).rows;
    const moving = members.filter((m) => ids.includes(m.intern_id));
    if (moving.length !== ids.length) throw Object.assign(new Error("Every selected intern must belong to this group"), { status: 400 });
    if (moving.length === members.length) throw Object.assign(new Error("Leave at least one intern in the original group"), { status: 409 });
    const g = (await c.query("INSERT INTO groups(batch_id,name,type,status) VALUES($1,$2,$3,$4) RETURNING *", [source.batch_id, name, source.type, source.status])).rows[0];
    for (const m of moving) {
      await c.query("UPDATE group_members SET active=false WHERE group_id=$1 AND intern_id=$2", [source.id, m.intern_id]);
      await c.query("INSERT INTO group_members(group_id,intern_id,domain_id,active) VALUES($1,$2,$3,true)", [g.id, m.intern_id, m.domain_id]);
    }
    await history(c.query.bind(c), source.id, source.batch_id, req.user.id, "SPLIT", { into: g.id, moved: ids });
    return g;
  });
  await audit(req, "GROUP_SPLIT", "group", req.params.id, null, { newGroup: created.id, internIds: ids });
  res.status(201).json(created);
});
r.get("/groups/:id/history", async (req, res) => {
  res.json((await q("SELECT h.*,u.email actor_email FROM group_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.group_id=$1 ORDER BY h.created_at DESC", [req.params.id])).rows);
});

// ---- Weekly tasks: templates and release control (Sections 4 Step 20, 10) ----
const cleanTypes = (types) => (Array.isArray(types) ? types : []).filter((x) => SUBMISSION_TYPES.includes(x));
r.get("/task-templates", async (_req, res) => {
  res.json((await q("SELECT t.*,d.name domain_name FROM task_templates t LEFT JOIN domains d ON d.id=t.domain_id WHERE t.active ORDER BY d.name,t.week_no NULLS LAST,t.title")).rows);
});
r.post("/task-templates", async (req, res) => {
  const b = req.body, types = cleanTypes(b.submissionTypes);
  if (!String(b.title || "").trim() || !types.length) return res.status(400).json({ error: "Title and at least one submission type are required" });
  if (!inRange(b.marks ?? 100, 1, 1000)) return res.status(400).json({ error: "Marks must be between 1 and 1000" });
  const x = (await q(
    "INSERT INTO task_templates(domain_id,week_no,title,description,expected_output,submission_types,resources,marks,rubric_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
    [b.domainId || null, b.weekNo ? Number(b.weekNo) : null, b.title.trim(), b.description || null, b.expectedOutput || null, JSON.stringify(types), b.resources || null, Number(b.marks ?? 100), b.rubricId || null, req.user.id],
  )).rows[0];
  await audit(req, "TASK_TEMPLATE_CREATED", "task_template", x.id, null, x);
  res.status(201).json(x);
});
r.delete("/task-templates/:id", async (req, res) => {
  const x = (await q("UPDATE task_templates SET active=false WHERE id=$1 AND active RETURNING id", [req.params.id])).rows[0];
  if (!x) return res.status(404).json({ error: "Template not found" });
  await audit(req, "TASK_TEMPLATE_RETIRED", "task_template", x.id);
  res.json({ ok: true });
});
// Turns templates into scheduled tasks on the batch's configured weekday/time.
r.post("/batches/:id/schedule-tasks", async (req, res) => {
  const weekday = Number(req.body.weekday), time = String(req.body.time || ""), dueAfterDays = Number(req.body.dueAfterDays ?? 6);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !/^\d{2}:\d{2}$/.test(time))
    return res.status(400).json({ error: "Release weekday and HH:MM time are required" });
  if (!Number.isInteger(dueAfterDays) || dueAfterDays < 1 || dueAfterDays > 60) return res.status(400).json({ error: "Due-after must be 1 to 60 days" });
  const batch = (await q("SELECT * FROM batches WHERE id=$1", [req.params.id])).rows[0];
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  const templates = (await q(
    `SELECT t.* FROM task_templates t WHERE t.active AND t.week_no IS NOT NULL AND (t.domain_id IS NULL OR t.domain_id IN (SELECT domain_id FROM batch_domains WHERE batch_id=$1) OR NOT EXISTS(SELECT 1 FROM batch_domains WHERE batch_id=$1))`,
    [batch.id],
  )).rows;
  if (!templates.length) return res.status(409).json({ error: "No active week-numbered task templates apply to this batch" });
  const start = new Date(batch.start_date + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() + ((weekday - start.getUTCDay() + 7) % 7));
  const created = await tx(async (c) => {
    const out = [];
    for (const t of templates) {
      const release = new Date(start);
      release.setUTCDate(release.getUTCDate() + (t.week_no - 1) * 7);
      const day = release.toISOString().slice(0, 10);
      if (day > batch.end_date) continue;
      const exists = (await c.query("SELECT 1 FROM weekly_tasks WHERE batch_id=$1 AND title=$2 AND domain_id IS NOT DISTINCT FROM $3", [batch.id, t.title, t.domain_id])).rowCount;
      if (exists) continue;
      out.push((await c.query(
        `INSERT INTO weekly_tasks(batch_id,domain_id,title,description,expected_output,submission_types,resources,marks,rubric_id,status,release_at,due_at,release_weekday,release_time,release_timezone)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'SCHEDULED',($10::date+$11::time) AT TIME ZONE $12,($10::date+$13::int+$11::time) AT TIME ZONE $12,$14,$11::time,$12) RETURNING id,title,release_at,due_at`,
        [batch.id, t.domain_id, t.title, t.description, t.expected_output, JSON.stringify(t.submission_types), t.resources, t.marks, t.rubric_id, day, time, batch.timezone, dueAfterDays, weekday],
      )).rows[0]);
    }
    await c.query("UPDATE batches SET task_release_rule=$2 WHERE id=$1", [batch.id, JSON.stringify({ weekday, time, dueAfterDays })]);
    return out;
  });
  await audit(req, "TASK_SERIES_SCHEDULED", "batch", batch.id, null, { weekday, time, dueAfterDays, count: created.length });
  res.status(201).json(created);
});
const taskTransitions = { pause: ["SCHEDULED", "PAUSED"], resume: ["PAUSED", "SCHEDULED"] };
for (const [action, [from, to]] of Object.entries(taskTransitions)) {
  r.post("/tasks/:id/" + action, async (req, res) => {
    const x = (await q("UPDATE weekly_tasks SET status=$2 WHERE id=$1 AND status=$3 RETURNING *", [req.params.id, to, from])).rows[0];
    if (!x) return res.status(409).json({ error: "Only " + from.toLowerCase() + " tasks can be changed this way" });
    await audit(req, "TASK_" + to, "weekly_task", x.id, { status: from }, { status: to });
    res.json(x);
  });
}
r.post("/tasks/:id/publish", async (req, res) => {
  const x = (await q("UPDATE weekly_tasks SET status='SCHEDULED',release_at=now() WHERE id=$1 AND status IN ('SCHEDULED','PAUSED') RETURNING *", [req.params.id])).rows[0];
  if (!x) return res.status(409).json({ error: "Only scheduled or paused tasks can be published" });
  await audit(req, "TASK_MANUAL_PUBLISH", "weekly_task", x.id);
  await releaseDueTasks();
  res.json((await q("SELECT * FROM weekly_tasks WHERE id=$1", [x.id])).rows[0]);
});
r.patch("/tasks/:id", async (req, res) => {
  const before = (await q("SELECT * FROM weekly_tasks WHERE id=$1", [req.params.id])).rows[0];
  if (!before) return res.status(404).json({ error: "Task not found" });
  if (!["SCHEDULED", "PAUSED"].includes(before.status) && req.body.releaseAt) return res.status(409).json({ error: "A released task cannot be rescheduled" });
  const releaseAt = req.body.releaseAt ?? before.release_at, dueAt = req.body.dueAt ?? before.due_at;
  if (Number.isNaN(new Date(releaseAt).getTime()) || (dueAt && Number.isNaN(new Date(dueAt).getTime()))) return res.status(400).json({ error: "Release and due dates must be valid" });
  if (dueAt && new Date(dueAt) <= new Date(releaseAt)) return res.status(400).json({ error: "Due time must be after release time" });
  const x = (await q("UPDATE weekly_tasks SET release_at=$2,due_at=$3,title=COALESCE($4,title),description=COALESCE($5,description) WHERE id=$1 RETURNING *", [before.id, releaseAt, dueAt, req.body.title || null, req.body.description || null])).rows[0];
  await audit(req, "TASK_RESCHEDULED", "weekly_task", x.id, before, x);
  res.json(x);
});

// ---- Fortnight review scheduling (Section 11) ----
r.post("/batches/:id/schedule-reviews", async (req, res) => {
  const every = Number(req.body.everyDays ?? 14);
  if (!Number.isInteger(every) || every < 7 || every > 31) return res.status(400).json({ error: "Review interval must be 7 to 31 days" });
  const batch = (await q("SELECT * FROM batches WHERE id=$1", [req.params.id])).rows[0];
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  const groups = (await q("SELECT id FROM groups WHERE batch_id=$1 AND status='ACTIVE'", [batch.id])).rows;
  if (!groups.length) return res.status(409).json({ error: "Approve groups before scheduling reviews" });
  let created = 0;
  for (const g of groups) {
    let period = 1;
    for (let d = new Date(batch.start_date + "T00:00:00Z"); ; period++) {
      d.setUTCDate(d.getUTCDate() + every);
      const day = d.toISOString().slice(0, 10);
      if (day > batch.end_date) break;
      const exists = (await q("SELECT 1 FROM fortnight_reviews WHERE group_id=$1 AND period_no=$2", [g.id, period])).rowCount;
      if (exists) continue;
      await q("INSERT INTO fortnight_reviews(group_id,period_no,review_date,status,created_by) VALUES($1,$2,$3,'SCHEDULED',$4)", [g.id, period, day, req.user.id]);
      created++;
    }
    await notifyGroup(g.id, "REVIEW_SCHEDULED", "Fortnight reviews scheduled", "Your fortnightly project reviews have been scheduled.", null, "REVIEWS:" + g.id);
  }
  await q("UPDATE batches SET review_rule=$2 WHERE id=$1", [batch.id, JSON.stringify({ everyDays: every })]);
  await audit(req, "REVIEWS_SCHEDULED", "batch", batch.id, null, { every, created });
  res.status(201).json({ created });
});

// ---- Document centre, announcements and chat oversight (Sections 12, 14) ----
r.get("/documents", async (_req, res) => {
  res.json((await q(
    "SELECT d.id,d.kind,d.title,d.external_url,d.original_name,d.mime_type,d.size_bytes,d.visibility,d.batch_id,d.group_id,d.uploaded_by_role,d.created_at,b.name batch_name,g.name group_name FROM documents d LEFT JOIN batches b ON b.id=d.batch_id LEFT JOIN groups g ON g.id=d.group_id WHERE d.active ORDER BY d.created_at DESC LIMIT 300",
  )).rows);
});
r.post("/documents", documentUpload.single("file"), async (req, res) => {
  const discard = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  const { title, kind, externalUrl, visibility = "ALL", batchId, groupId } = req.body;
  if (req.file && !validateUploadedDocument(req.file)) { discard(); return res.status(400).json({ error: "Uploaded file content does not match its declared type" }); }
  if (externalUrl && !validExternalDocumentUrl(externalUrl)) { discard(); return res.status(400).json({ error: "External document URL must be a valid HTTP(S) link" }); }
  if (!req.file && !externalUrl) return res.status(400).json({ error: "Upload a document or provide an external URL" });
  if (!["ALL", "BATCH", "GROUP"].includes(visibility) || (visibility === "BATCH" && !batchId) || (visibility === "GROUP" && !groupId)) { discard(); return res.status(400).json({ error: "Choose who can see this document" }); }
  const x = (await q(
    "INSERT INTO documents(owner_user_id,batch_id,group_id,kind,title,file_path,external_url,visibility,uploaded_by_role,mime_type,original_name,size_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ADMIN',$9,$10,$11) RETURNING id,title,visibility",
    [req.user.id, visibility === "BATCH" ? batchId : null, visibility === "GROUP" ? groupId : null, kind || "GUIDELINE", title || req.file?.originalname || "Document", req.file?.path || null, externalUrl || null, visibility, req.file?.mimetype || null, req.file?.originalname || null, req.file?.size || null],
  )).rows[0];
  await audit(req, "DOCUMENT_PUBLISHED", "document", x.id, null, x);
  res.status(201).json(x);
});
r.get("/documents/:id/file", async (req, res) => {
  const d = (await q("SELECT * FROM documents WHERE id=$1 AND active", [req.params.id])).rows[0];
  if (!d?.file_path || !fs.existsSync(d.file_path)) return res.status(404).json({ error: "File not found" });
  res.download(path.resolve(d.file_path), d.original_name || path.basename(d.file_path));
});
r.delete("/documents/:id", async (req, res) => {
  const x = (await q("UPDATE documents SET active=false WHERE id=$1 AND active RETURNING id,title", [req.params.id])).rows[0];
  if (!x) return res.status(404).json({ error: "Document not found" });
  await audit(req, "DOCUMENT_REMOVED", "document", x.id, x);
  res.json({ ok: true });
});
r.post("/announcements", async (req, res) => {
  const title = String(req.body.title || "").trim(), body = String(req.body.body || "").trim(), batchId = req.body.batchId || null;
  if (!title || !body) return res.status(400).json({ error: "Title and message are required" });
  const users = (await q(
    `SELECT DISTINCT ip.user_id FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id JOIN users u ON u.id=ip.user_id AND u.is_active WHERE ($1::uuid IS NULL OR ba.batch_id=$1)
     UNION SELECT DISTINCT m.user_id FROM mentors m JOIN users u ON u.id=m.user_id AND u.is_active LEFT JOIN mentor_assignments ma ON ma.mentor_id=m.id AND ma.active LEFT JOIN groups g ON g.id=ma.group_id WHERE m.active AND ($1::uuid IS NULL OR g.batch_id=$1)`,
    [batchId],
  )).rows;
  for (const u of users) await notify(u.user_id, "ANNOUNCEMENT", title, body);
  await audit(req, "ANNOUNCEMENT_SENT", "batch", batchId, null, { title, recipients: users.length });
  res.status(201).json({ recipients: users.length });
});
r.get("/groups/:id/chat", async (req, res) => {
  res.json((await q(
    `SELECT cm.*,COALESCE(ip.full_name,m.full_name,'Admin') sender_name FROM chat_messages cm JOIN users u ON u.id=cm.sender_id LEFT JOIN intern_profiles ip ON ip.user_id=u.id LEFT JOIN mentors m ON m.user_id=u.id WHERE cm.group_id=$1 ORDER BY cm.created_at DESC LIMIT 200`,
    [req.params.id],
  )).rows.reverse());
});
r.post("/groups/:id/chat", async (req, res) => {
  const message = String(req.body.message || "").trim();
  if (!message) return res.status(400).json({ error: "Message is required" });
  const x = (await q("INSERT INTO chat_messages(group_id,sender_id,message) VALUES($1,$2,$3) RETURNING *", [req.params.id, req.user.id, message])).rows[0];
  await notifyGroup(req.params.id, "GROUP_CHAT", "Message from Admin", message.slice(0, 120), null, "CHAT:" + x.id, req.user.id);
  res.status(201).json(x);
});
r.delete("/chat/:id", async (req, res) => {
  const before = (await q("SELECT * FROM chat_messages WHERE id=$1", [req.params.id])).rows[0];
  if (!before) return res.status(404).json({ error: "Message not found" });
  const x = (await q("UPDATE chat_messages SET message='[Removed by Admin]',attachment_id=NULL,edited_at=now() WHERE id=$1 RETURNING *", [before.id])).rows[0];
  await audit(req, "CHAT_MESSAGE_MODERATED", "chat_message", x.id, before, x);
  res.json(x);
});

// ---- Operational reports (Section 18) ----
r.get("/reports/operations", async (_req, res) => {
  const one = async (sql) => (await q(sql)).rows;
  const [byCollege, byBatch, byDomain, proofStatus, proofTurnaround, overrides, mismatches, offerStatus, faceStatus, assessment, preference, dailyCompliance, tasks, reviews, mentorLoad, outcomes] = await Promise.all([
    one(`SELECT c.name,count(*)::int interns FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED' LEFT JOIN colleges c ON c.id=ip.college_id GROUP BY c.name ORDER BY 2 DESC`),
    one(`SELECT b.name,b.status,count(ba.id)::int interns FROM batches b LEFT JOIN batch_allocations ba ON ba.batch_id=b.id GROUP BY b.id ORDER BY b.start_date DESC`),
    one(`SELECT d.name,count(ip.id)::int interns FROM domains d LEFT JOIN intern_profiles ip ON ip.final_domain_id=d.id GROUP BY d.id ORDER BY 2 DESC`),
    one(`SELECT status,count(*)::int n FROM college_proofs GROUP BY status ORDER BY 2 DESC`),
    one(`SELECT round(avg(extract(epoch FROM pv.created_at-cp.created_at)/3600)::numeric,1) avg_hours FROM college_proofs cp JOIN LATERAL(SELECT created_at FROM proof_verifications x WHERE x.proof_id=cp.id ORDER BY created_at LIMIT 1) pv ON true`),
    one(`SELECT cp.reason,cp.override_due_date,cp.created_at,ip.full_name FROM college_proofs cp JOIN intern_profiles ip ON ip.id=cp.intern_id WHERE cp.status='OVERRIDE' ORDER BY cp.created_at DESC LIMIT 100`),
    one(`SELECT ip.full_name,b.name batch_name,ba.intern_start,ba.intern_end,ba.override_reason FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id JOIN batches b ON b.id=ba.batch_id WHERE ba.date_mismatch ORDER BY ba.intern_start DESC LIMIT 100`),
    one(`SELECT status,count(*)::int n FROM offer_letters GROUP BY status ORDER BY 2 DESC`),
    one(`SELECT status,count(*)::int n FROM face_enrollments WHERE status<>'DELETED' GROUP BY status ORDER BY 2 DESC`),
    one(`SELECT a.name,s.name section,round(avg(COALESCE(ans.manual_score,ans.auto_score,0))::numeric,2) avg_score,count(DISTINCT aa.id)::int attempts FROM assessments a JOIN assessment_sections s ON s.assessment_id=a.id JOIN assessment_attempts aa ON aa.assessment_id=a.id JOIN assessment_answers ans ON ans.attempt_id=aa.id AND s.question_ids ? ans.question_id::text GROUP BY a.id,s.id ORDER BY a.name,s.name`),
    one(`SELECT count(*) FILTER(WHERE d.name=ip.preferred_domains->>0 OR d.id::text=ip.preferred_domains->>0)::int first_choice,count(*)::int confirmed FROM intern_profiles ip JOIN domains d ON d.id=ip.final_domain_id`),
    one(`SELECT b.name batch_name,count(c.day) FILTER(WHERE c.status IN ('PRESENT','LATE'))::int expected,count(dr.id) FILTER(WHERE dr.morning_at IS NOT NULL)::int morning,count(dr.id) FILTER(WHERE dr.evening_at IS NOT NULL)::int evening FROM attendance_calendar c JOIN batches b ON b.id=c.batch_id LEFT JOIN daily_reports dr ON dr.intern_id=c.intern_id AND dr.day=c.day GROUP BY b.id ORDER BY b.name`),
    one(`SELECT wt.title,wt.status,count(ts.id)::int submissions,count(ts.id) FILTER(WHERE ts.is_late)::int late,count(ts.id) FILTER(WHERE ts.status IN ('SUBMITTED','RESUBMITTED'))::int pending_evaluation FROM weekly_tasks wt LEFT JOIN task_submissions ts ON ts.task_id=wt.id GROUP BY wt.id ORDER BY wt.release_at DESC NULLS LAST LIMIT 100`),
    one(`SELECT g.name group_name,fr.period_no,fr.status,fr.group_marks,round(avg(rim.marks),1) individual_avg FROM fortnight_reviews fr JOIN groups g ON g.id=fr.group_id LEFT JOIN review_individual_marks rim ON rim.review_id=fr.id GROUP BY fr.id,g.name ORDER BY g.name,fr.period_no`),
    one(`SELECT m.full_name,count(DISTINCT ma.group_id)::int groups,count(DISTINCT gm.intern_id)::int interns,m.max_groups,m.max_interns FROM mentors m LEFT JOIN mentor_assignments ma ON ma.mentor_id=m.id AND ma.active LEFT JOIN group_members gm ON gm.group_id=ma.group_id AND gm.active WHERE m.active GROUP BY m.id ORDER BY m.full_name`),
    one(`SELECT COALESCE(ex.type,ca.status,'IN_PROGRESS') outcome,count(*)::int n FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED' LEFT JOIN LATERAL(SELECT status FROM completion_approvals x WHERE x.intern_id=ip.id ORDER BY approved_at DESC LIMIT 1) ca ON true LEFT JOIN LATERAL(SELECT type FROM exit_records x WHERE x.intern_id=ip.id LIMIT 1) ex ON true GROUP BY 1 ORDER BY 2 DESC`),
  ]);
  res.json({ byCollege, byBatch, byDomain, proofStatus, proofTurnaroundHours: proofTurnaround[0]?.avg_hours ?? null, overrides, mismatches, offerStatus, faceStatus, assessment, preferenceVsConfirmed: preference[0], dailyCompliance, tasks, reviews, mentorLoad, outcomes });
});
r.get("/reports/export.pdf", async (req, res) => {
  const rows = (await q(
    `SELECT ip.full_name,ip.roll_number,c.name college,b.name batch,d.name domain,COALESCE(s.attendance_percent,0) attendance,ca.status completion FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED' LEFT JOIN colleges c ON c.id=ip.college_id
     LEFT JOIN LATERAL(SELECT * FROM batch_allocations z WHERE z.intern_id=ip.id ORDER BY z.intern_start DESC NULLS LAST LIMIT 1) ba ON true LEFT JOIN batches b ON b.id=ba.batch_id LEFT JOIN domains d ON d.id=ip.final_domain_id LEFT JOIN attendance_summary s ON s.allocation_id=ba.id
     LEFT JOIN LATERAL(SELECT status FROM completion_approvals z WHERE z.intern_id=ip.id ORDER BY z.approved_at DESC LIMIT 1) ca ON true ORDER BY b.name,ip.full_name`,
  )).rows;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="gaint-intern-report.pdf"');
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
  doc.pipe(res);
  doc.fontSize(16).text("GAINT Intern Report").fontSize(9).text("Generated " + new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC").moveDown();
  const columns = [["Name", 170, "full_name"], ["Roll", 80, "roll_number"], ["College", 150, "college"], ["Batch", 110, "batch"], ["Domain", 110, "domain"], ["Att %", 40, "attendance"], ["Completion", 80, "completion"]];
  const line = (values, bold) => {
    if (doc.y > 540) doc.addPage();
    const y = doc.y;
    let x = 36;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    columns.forEach(([, width], i) => { doc.text(String(values[i] ?? "-"), x, y, { width: width - 6, lineBreak: false, ellipsis: true }); x += width; });
    doc.y = y + 14;
  };
  line(columns.map((c) => c[0]), true);
  for (const row of rows) line(columns.map((c) => row[c[2]]));
  doc.end();
});
r.post("/reports/completion/:id/email", async (req, res) => {
  const report = (await q(
    `SELECT ccr.*,ip.full_name,cc.email coordinator_email FROM college_completion_reports ccr JOIN intern_profiles ip ON ip.id=ccr.intern_id
     LEFT JOIN LATERAL(SELECT coordinator_id FROM college_proofs p WHERE p.intern_id=ip.id AND p.coordinator_id IS NOT NULL ORDER BY p.created_at DESC LIMIT 1) cp ON true LEFT JOIN college_coordinators cc ON cc.id=cp.coordinator_id WHERE ccr.id=$1 AND ccr.status='GENERATED'`,
    [req.params.id],
  )).rows[0];
  if (!report?.file_path || !fs.existsSync(report.file_path)) return res.status(404).json({ error: "Generated report not found" });
  const to = String(req.body.email || report.coordinator_email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: "A faculty coordinator email is required" });
  const sent = await sendMail({ to, subject: "Internship completion report - " + report.full_name, text: "Please find the attached GAINT internship completion report for " + report.full_name + ".", attachments: [{ filename: "college-completion-report.pdf", path: report.file_path }] });
  if (!sent.sent) return res.status(503).json({ error: "Email could not be sent. Check the SMTP configuration." });
  await q("UPDATE college_completion_reports SET emailed_to=$2,emailed_at=now() WHERE id=$1", [report.id, to]);
  await audit(req, "COMPLETION_REPORT_EMAILED", "college_completion_report", report.id, null, { to });
  res.json({ ok: true, to });
});

// ---- Completion outcomes and certificates (Section 4 Steps 27-28, 13) ----
r.post("/completions/:internId/decision", async (req, res) => {
  const { reason, extendedTo } = req.body;
  const status = req.body.status === "REJECTED" ? "INCOMPLETE" : req.body.status;
  if (!["APPROVED", "INCOMPLETE", "EXTENDED"].includes(status)) return res.status(400).json({ error: "Invalid completion decision" });
  if (status !== "APPROVED" && !String(reason || "").trim()) return res.status(400).json({ error: "A reason is required for this completion outcome" });
  const p = (await q(
    `SELECT ip.user_id,ip.full_name,ba.id allocation_id,ba.intern_end,b.min_attendance,b.individual_pass_mark,s.attendance_percent FROM intern_profiles ip
     LEFT JOIN LATERAL(SELECT * FROM batch_allocations x WHERE x.intern_id=ip.id ORDER BY x.intern_start DESC NULLS LAST LIMIT 1) ba ON true LEFT JOIN batches b ON b.id=ba.batch_id LEFT JOIN attendance_summary s ON s.allocation_id=ba.id WHERE ip.id=$1`,
    [req.params.internId],
  )).rows[0];
  if (!p) return res.status(404).json({ error: "Intern not found" });
  const exit = (await q("SELECT type FROM exit_records WHERE intern_id=$1 AND type IN ('WITHDRAWN','TERMINATED') LIMIT 1", [req.params.internId])).rows[0];
  if (exit) return res.status(409).json({ error: "Withdrawn or terminated interns cannot receive a completion outcome" });
  if (status === "APPROVED") {
    const evaluation = (await q("SELECT * FROM final_evaluations WHERE intern_id=$1 ORDER BY created_at DESC LIMIT 1", [req.params.internId])).rows[0];
    if (!evaluation) return res.status(409).json({ error: "Mentor final evaluation is required before completion approval" });
    if (evaluation.recommendation !== "COMPLETED") return res.status(409).json({ error: "Mentor must recommend COMPLETED before approval" });
    if (Number(evaluation.individual_marks) < Number(p.individual_pass_mark ?? 0))
      return res.status(409).json({ error: "Individual marks " + evaluation.individual_marks + " are below the batch pass mark of " + p.individual_pass_mark + ". Record Incomplete or Extended instead." });
    if (Number(p.attendance_percent ?? 0) < Number(p.min_attendance ?? 0))
      return res.status(409).json({ error: "Attendance " + p.attendance_percent + "% is below the batch minimum of " + p.min_attendance + "%. Record Incomplete or Extended instead." });
  }
  if (status === "EXTENDED") {
    if (!validDate(extendedTo)) return res.status(400).json({ error: "A new end date is required to extend an internship" });
    if (!p.allocation_id || extendedTo <= p.intern_end) return res.status(409).json({ error: "The new end date must be after the current internship end date" });
  }
  const x = await tx(async (c) => {
    const row = (await c.query("INSERT INTO completion_approvals(intern_id,status,reason,approved_by,extended_to) VALUES($1,$2,$3,$4,$5) RETURNING *", [req.params.internId, status, reason || null, req.user.id, status === "EXTENDED" ? extendedTo : null])).rows[0];
    if (status === "EXTENDED") await c.query("UPDATE batch_allocations SET intern_end=$2 WHERE id=$1", [p.allocation_id, extendedTo]);
    return row;
  });
  await audit(req, "COMPLETION_" + status, "intern", req.params.internId, null, x);
  const body = { APPROVED: "Your internship is marked Successfully Completed.", INCOMPLETE: "Your internship is marked Incomplete. Reason: " + reason, EXTENDED: "Your internship is extended to " + extendedTo + ". " + reason }[status];
  await notify(p.user_id, "COMPLETION_" + status, "Internship completion update", body, "/intern/certificate");
  res.status(201).json(x);
});
r.post("/certificates/:internId/issue", async (req, res) => {
  const ok = (await q("SELECT 1 FROM (SELECT status FROM completion_approvals WHERE intern_id=$1 ORDER BY approved_at DESC,id DESC LIMIT 1) latest WHERE status='APPROVED'", [req.params.internId])).rowCount;
  if (!ok) return res.status(409).json({ error: "Completion approval required" });
  const exit = (await q("SELECT 1 FROM exit_records WHERE intern_id=$1 AND type IN ('WITHDRAWN','TERMINATED') LIMIT 1", [req.params.internId])).rowCount;
  if (exit) return res.status(409).json({ error: "Withdrawn or terminated interns are not eligible for certificates" });
  const existing = (await q("SELECT * FROM certificates WHERE intern_id=$1 AND status='ISSUED' ORDER BY created_at DESC LIMIT 1", [req.params.internId])).rows[0];
  if (existing) return res.status(409).json({ error: "Certificate already issued", certificate: existing });
  const p = (await q(
    `SELECT ip.*,d.name domain_name,ba.intern_start,ba.intern_end,b.certificate_mode FROM intern_profiles ip LEFT JOIN domains d ON d.id=ip.final_domain_id
     LEFT JOIN LATERAL(SELECT * FROM batch_allocations x WHERE x.intern_id=ip.id ORDER BY x.intern_start DESC NULLS LAST LIMIT 1) ba ON true LEFT JOIN batches b ON b.id=ba.batch_id WHERE ip.id=$1`,
    [req.params.internId],
  )).rows[0];
  if (!p) return res.status(404).json({ error: "Intern not found" });
  const mode = req.body.mode || p.certificate_mode || "IN_APP";
  if (!["IN_APP", "OFFLINE"].includes(mode)) return res.status(400).json({ error: "Certificate mode must be IN_APP or OFFLINE" });
  if (mode === "OFFLINE" && !String(req.body.serialNumber || "").trim()) return res.status(400).json({ error: "Record the offline certificate serial number" });
  const issueDate = mode === "OFFLINE" && req.body.issueDate ? req.body.issueDate : new Date().toISOString().slice(0, 10);
  if (!validDate(issueDate)) return res.status(400).json({ error: "Invalid issue date" });
  const certId = "GAINT-CERT-" + new Date().getFullYear() + "-" + crypto.randomBytes(5).toString("hex").toUpperCase();
  const period = p.intern_start && p.intern_end ? p.intern_start + " to " + p.intern_end : "";
  const filePath = mode === "IN_APP" ? await generateCertificate({ certificateId: certId, name: p.full_name, domain: p.domain_name, period, issueDate }) : null;
  const x = (await q(
    "INSERT INTO certificates(intern_id,mode,status,certificate_id,issue_date,file_path,domain_snapshot,date_snapshot,serial_number,issued_by) VALUES($1,$2,'ISSUED',$3,$4,$5,$6,$7,$8,$9) RETURNING *",
    [p.id, mode, certId, issueDate, filePath, p.domain_name || "", period, req.body.serialNumber || null, req.user.id],
  )).rows[0];
  await audit(req, "CERTIFICATE_ISSUED", "certificate", x.id, null, x);
  await notify(p.user_id, "CERTIFICATE_ISSUED", "Certificate issued", mode === "IN_APP" ? "Your completion certificate " + certId + " is available." : "Your offline certificate " + (req.body.serialNumber || "") + " has been recorded.", "/intern/certificate");
  res.status(201).json(x);
});
export default r;

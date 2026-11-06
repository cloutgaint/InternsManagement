import { Router } from "express";
import { q, tx } from "../common/database/index.js";
import { audit } from "../common/audit/audit.service.js";
import fs from "fs";
import path from "path";
import { documentUpload, validExternalDocumentUrl, validateUploadedDocument } from "../services/collaborationService.js";
import { notify, notifyGroup } from "../common/notifications/notification.service.js";
import { decideAttendanceException, decideLeave } from "../services/attendanceService.js";
import { auth, permit } from "../common/security/auth.middleware.js";
const r = Router();
const REVIEW_STATUSES = ["SCHEDULED", "CONDUCTED", "MARKS_ENTERED", "PUBLISHED"];
r.use(auth, permit("MENTOR"));
async function mid(uid) {
  return (await q("SELECT id FROM mentors WHERE user_id=$1", [uid])).rows[0]
    ?.id;
}
r.get("/groups/:id/collaboration", async (req, res) => {
  const m = await mid(req.user.id);
  const ok = (
    await q(
      "SELECT 1 FROM mentor_assignments WHERE mentor_id=$1 AND group_id=$2 AND active",
      [m, req.params.id],
    )
  ).rowCount;
  if (!ok) return res.status(403).json({ error: "Group not assigned to you" });
  const documents = (
    await q(
      "SELECT id,kind,title,external_url,original_name,mime_type,size_bytes,created_at,owner_user_id FROM documents WHERE active AND (visibility='ALL' OR group_id=$1 OR (visibility='BATCH' AND batch_id=(SELECT batch_id FROM groups WHERE id=$1))) ORDER BY created_at DESC",
      [req.params.id],
    )
  ).rows;
  const messages = (
    await q(
      `SELECT cm.*,COALESCE(ip.full_name,m.full_name,'Admin') sender_name,d.title attachment_title,d.original_name attachment_name FROM chat_messages cm JOIN users u ON u.id=cm.sender_id LEFT JOIN intern_profiles ip ON ip.user_id=u.id LEFT JOIN mentors m ON m.user_id=u.id LEFT JOIN documents d ON d.id=cm.attachment_id WHERE cm.group_id=$1 ORDER BY cm.created_at DESC LIMIT 100`,
      [req.params.id],
    )
  ).rows.reverse();
  res.json({ documents, messages });
});
r.post(
  "/groups/:id/documents",
  documentUpload.single("file"),
  async (req, res) => {
    const m = await mid(req.user.id);
    const ok = (
      await q(
        "SELECT 1 FROM mentor_assignments WHERE mentor_id=$1 AND group_id=$2 AND active",
        [m, req.params.id],
      )
    ).rowCount;
    if (!ok) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: "Group not assigned to you" });
    }
    if (req.file && !validateUploadedDocument(req.file)) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: "Uploaded file content does not match its declared type" }); }
    if (req.body.externalUrl && !validExternalDocumentUrl(req.body.externalUrl)) { if (req.file) fs.unlinkSync(req.file.path); return res.status(400).json({ error: "External document URL must be a valid HTTP(S) link" }); }
    if (!req.file && !req.body.externalUrl)
      return res
        .status(400)
        .json({ error: "Upload a document or provide an external URL" });
    const x = (
      await q(
        "INSERT INTO documents(owner_user_id,group_id,kind,title,file_path,external_url,visibility,uploaded_by_role,mime_type,original_name,size_bytes) VALUES($1,$2,$3,$4,$5,$6,'GROUP','MENTOR',$7,$8,$9) RETURNING *",
        [
          req.user.id,
          req.params.id,
          req.body.kind || "MENTOR_RESOURCE",
          req.body.title || req.file?.originalname || "Mentor resource",
          req.file?.path || null,
          req.body.externalUrl || null,
          req.file?.mimetype || null,
          req.file?.originalname || null,
          req.file?.size || null,
        ],
      )
    ).rows[0];
    await notifyGroup(
      req.params.id,
      "DOCUMENT_SHARED",
      "Mentor shared a document",
      x.title,
      "/intern/collaboration",
      "DOC:" + x.id,
      req.user.id,
    );
    res.status(201).json(x);
  },
);
r.get("/documents/:id/file", async (req, res) => {
  const m = await mid(req.user.id);
  const d = (
    await q(
      "SELECT d.* FROM documents d JOIN mentor_assignments ma ON ma.group_id=d.group_id AND ma.mentor_id=$1 AND ma.active WHERE d.id=$2 AND d.active",
      [m, req.params.id],
    )
  ).rows[0];
  if (!d?.file_path || !fs.existsSync(d.file_path))
    return res.status(404).json({ error: "File not found" });
  res.download(
    path.resolve(d.file_path),
    d.original_name || path.basename(d.file_path),
  );
});
r.post("/groups/:id/chat", async (req, res) => {
  const m = await mid(req.user.id),
    ok = (
      await q(
        "SELECT 1 FROM mentor_assignments WHERE mentor_id=$1 AND group_id=$2 AND active",
        [m, req.params.id],
      )
    ).rowCount;
  if (!ok) return res.status(403).json({ error: "Group not assigned to you" });
  const message = String(req.body.message || "").trim();
  if (!message && !req.body.attachmentId)
    return res.status(400).json({ error: "Message or attachment is required" });
  if (req.body.attachmentId) {
    const attachment = await q("SELECT 1 FROM documents WHERE id=$1 AND group_id=$2 AND active", [req.body.attachmentId, req.params.id]);
    if (!attachment.rowCount) return res.status(403).json({ error: "Attachment is not available to this group" });
  }
  const x = (
    await q(
      "INSERT INTO chat_messages(group_id,sender_id,message,attachment_id) VALUES($1,$2,$3,$4) RETURNING *",
      [req.params.id, req.user.id, message, req.body.attachmentId || null],
    )
  ).rows[0];
  await notifyGroup(
    req.params.id,
    "GROUP_CHAT",
    "New mentor message",
    message.slice(0, 120) || "Mentor shared an attachment",
    "/intern/collaboration",
    "CHAT:" + x.id,
    req.user.id,
  );
  res.status(201).json(x);
});
r.get("/notifications", async (req, res) =>
  res.json(
    (
      await q(
        "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
        [req.user.id],
      )
    ).rows,
  ),
);
r.post("/notifications/:id/read", async (req, res) => {
  const x = (
    await q(
      "UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING *",
      [req.params.id, req.user.id],
    )
  ).rows[0];
  if (!x) return res.status(404).json({ error: "Notification not found" });
  res.json(x);
});
r.get("/operations", async (req, res) => {
  const m = await mid(req.user.id);
  const groups = (
    await q(
      "SELECT g.id,g.name FROM groups g JOIN mentor_assignments ma ON ma.group_id=g.id WHERE ma.mentor_id=$1 AND ma.active",
      [m],
    )
  ).rows;
  const ids = groups.map((x) => x.id);
  if (!ids.length)
    return res.json({
      groups: [],
      interns: [],
      attendance: [],
      leave: [],
      dailyReports: [],
      milestones: [],
    });
  const interns = (
    await q(
      `SELECT ip.id,ip.full_name,ip.roll_number,g.id group_id,g.name group_name FROM intern_profiles ip JOIN group_members gm ON gm.intern_id=ip.id AND gm.active JOIN groups g ON g.id=gm.group_id JOIN mentor_assignments ma ON ma.group_id=g.id AND ma.mentor_id=$1 AND ma.active ORDER BY ip.full_name`,
      [m],
    )
  ).rows;
  const attendance = (
    await q(
      `SELECT ad.*,ip.full_name,g.name group_name FROM attendance_daily ad JOIN intern_profiles ip ON ip.id=ad.intern_id JOIN group_members gm ON gm.intern_id=ip.id AND gm.active JOIN groups g ON g.id=gm.group_id JOIN mentor_assignments ma ON ma.group_id=g.id AND ma.mentor_id=$1 AND ma.active ORDER BY ad.day DESC LIMIT 100`,
      [m],
    )
  ).rows;
  const leave = (
    await q(
      `SELECT lr.*,ip.full_name,g.name group_name FROM leave_requests lr JOIN intern_profiles ip ON ip.id=lr.intern_id JOIN group_members gm ON gm.intern_id=ip.id AND gm.active JOIN groups g ON g.id=gm.group_id JOIN mentor_assignments ma ON ma.group_id=g.id AND ma.mentor_id=$1 AND ma.active ORDER BY lr.created_at DESC LIMIT 100`,
      [m],
    )
  ).rows;
  const dailyReports = (
    await q(
      `SELECT dr.*,ip.full_name,g.name group_name FROM daily_reports dr JOIN intern_profiles ip ON ip.id=dr.intern_id JOIN group_members gm ON gm.intern_id=ip.id AND gm.active JOIN groups g ON g.id=gm.group_id JOIN mentor_assignments ma ON ma.group_id=g.id AND ma.mentor_id=$1 AND ma.active ORDER BY dr.day DESC LIMIT 100`,
      [m],
    )
  ).rows;
  const milestones = (
    await q(
      `SELECT g.id group_id,g.name group_name,p.id project_id,p.title,p.milestones FROM groups g JOIN mentor_assignments ma ON ma.group_id=g.id AND ma.mentor_id=$1 AND ma.active LEFT JOIN project_assignments pa ON pa.group_id=g.id AND pa.status='ASSIGNED' LEFT JOIN projects p ON p.id=pa.project_id`,
      [m],
    )
  ).rows;
  res.json({ groups, interns, attendance, leave, dailyReports, milestones });
});
r.get("/dashboard", async (req, res) => {
  const m = await mid(req.user.id);
  const groups = (
    await q(
      `SELECT g.* FROM groups g JOIN mentor_assignments ma ON ma.group_id=g.id WHERE ma.mentor_id=$1 AND ma.active`,
      [m],
    )
  ).rows;
  const submissions = (
    await q(
      `SELECT ts.*,wt.title,wt.marks task_marks,wt.rubric_id,r.name rubric_name,ip.full_name,COALESCE(json_agg(rc ORDER BY rc.name) FILTER(WHERE rc.id IS NOT NULL),'[]') rubric_criteria FROM task_submissions ts JOIN weekly_tasks wt ON wt.id=ts.task_id JOIN intern_profiles ip ON ip.id=ts.intern_id LEFT JOIN rubrics r ON r.id=wt.rubric_id LEFT JOIN rubric_criteria rc ON rc.rubric_id=r.id WHERE (wt.assigning_mentor_id=$1 OR (wt.assigning_mentor_id IS NULL AND EXISTS(SELECT 1 FROM intern_mentor_assignments ima WHERE ima.intern_id=ts.intern_id AND ima.mentor_id=$1 AND ima.active))) AND ts.status IN ('SUBMITTED','RESUBMITTED') GROUP BY ts.id,wt.id,r.id,ip.id ORDER BY ts.submitted_at`,
      [m],
    )
  ).rows;
  res.json({ groups, submissions });
});
r.get("/submissions/:id", async (req, res) => {
  const m = await mid(req.user.id);
  const x = (
    await q(
      `SELECT ts.*,wt.title,wt.description,wt.expected_output,wt.marks task_marks,wt.rubric_id,r.name rubric_name,ip.full_name,COALESCE(json_agg(rc ORDER BY rc.name) FILTER(WHERE rc.id IS NOT NULL),'[]') rubric_criteria FROM task_submissions ts JOIN weekly_tasks wt ON wt.id=ts.task_id JOIN intern_profiles ip ON ip.id=ts.intern_id LEFT JOIN rubrics r ON r.id=wt.rubric_id LEFT JOIN rubric_criteria rc ON rc.rubric_id=r.id WHERE (wt.assigning_mentor_id=$1 OR (wt.assigning_mentor_id IS NULL AND EXISTS(SELECT 1 FROM intern_mentor_assignments ima WHERE ima.intern_id=ts.intern_id AND ima.mentor_id=$1 AND ima.active))) AND ts.id=$2 GROUP BY ts.id,wt.id,r.id,ip.id`,
      [m, req.params.id],
    )
  ).rows[0];
  if (!x)
    return res.status(403).json({ error: "Submission is not assigned to you" });
  res.json(x);
});
r.post("/submissions/:id/evaluate", async (req, res) => {
  const m = await mid(req.user.id);
  const row = (
    await q(
      `SELECT ts.*,wt.marks task_marks,wt.rubric_id FROM task_submissions ts JOIN weekly_tasks wt ON wt.id=ts.task_id WHERE (wt.assigning_mentor_id=$1 OR (wt.assigning_mentor_id IS NULL AND EXISTS(SELECT 1 FROM intern_mentor_assignments ima WHERE ima.intern_id=ts.intern_id AND ima.mentor_id=$1 AND ima.active))) AND ts.id=$2`,
      [m, req.params.id],
    )
  ).rows[0];
  if (!row)
    return res.status(403).json({ error: "Submission is not assigned to you" });
  if (!["SUBMITTED", "RESUBMITTED"].includes(row.status))
    return res
      .status(409)
      .json({ error: "Only submitted work can be evaluated" });
  const decision = req.body.decision;
  if (!["APPROVED", "REWORK_REQUIRED", "REJECTED"].includes(decision))
    return res
      .status(400)
      .json({ error: "Choose Approved, Rework Required or Rejected" });
  let marks = Number(req.body.marks),
    rubricScores = [];
  if (row.rubric_id) {
    const cs = (
      await q(
        "SELECT * FROM rubric_criteria WHERE rubric_id=$1 ORDER BY name",
        [row.rubric_id],
      )
    ).rows;
    try {
      rubricScores = cs.map((c) => {
        const v = (req.body.rubricScores || []).find(
            (x) => x.criterionId === c.id,
          ),
          awarded = Number(v?.awarded);
        if (
          !Number.isFinite(awarded) ||
          awarded < 0 ||
          awarded > Number(c.max_marks)
        )
          throw new Error();
        return {
          criterionId: c.id,
          name: c.name,
          awarded,
          maxMarks: Number(c.max_marks),
          weight: Number(c.weight),
        };
      });
    } catch {
      return res.status(400).json({
        error: "Complete every rubric criterion within its maximum marks",
      });
    }
    const weighted = rubricScores.reduce(
      (n, c) => n + (c.awarded / c.maxMarks) * c.weight,
      0,
    );
    marks = Number(
      ((weighted / 100) * Number(row.task_marks || 100)).toFixed(2),
    );
  }
  if (
    !Number.isFinite(marks) ||
    marks < 0 ||
    marks > Number(row.task_marks || 100)
  )
    return res
      .status(400)
      .json({ error: "Marks are outside the task maximum" });
  if (!String(req.body.feedback || "").trim())
    return res.status(400).json({ error: "Mentor feedback is required" });
  if (
    decision === "REWORK_REQUIRED" &&
    (!String(req.body.reworkInstructions || "").trim() || !req.body.reworkDueAt)
  )
    return res
      .status(400)
      .json({ error: "Rework instructions and due date are required" });
  const outcome = await tx(async (client) => {
    const locked = (await client.query("SELECT status FROM task_submissions WHERE id=$1 FOR UPDATE", [row.id])).rows[0];
    if (!locked || !["SUBMITTED", "RESUBMITTED"].includes(locked.status))
      return { conflict: true };
    const x = (await client.query(
      "INSERT INTO task_evaluations(submission_id,mentor_id,marks,feedback,status,rubric_scores,decision,rework_instructions,rework_due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [row.id, m, marks, req.body.feedback, decision, JSON.stringify(rubricScores), decision, req.body.reworkInstructions || null, req.body.reworkDueAt || null],
    )).rows[0];
    await client.query(
      "UPDATE task_submissions SET status=$1,rework_due_at=$2,mentor_feedback=$3 WHERE id=$4",
      [decision, decision === "REWORK_REQUIRED" ? req.body.reworkDueAt : null, req.body.feedback, row.id],
    );
    return { evaluation: x };
  });
  if (outcome.conflict) return res.status(409).json({ error: "Submission has already been evaluated" });
  await audit(req, "TASK_EVALUATED", "task_submission", row.id, { status: row.status }, outcome.evaluation);
  const owner = (await q("SELECT user_id FROM intern_profiles WHERE id=$1", [row.intern_id])).rows[0]?.user_id;
  await notify(owner, "TASK_" + decision, decision === "REWORK_REQUIRED" ? "Task rework requested" : "Task evaluated", "Your task submission was marked " + decision.replaceAll("_", " ").toLowerCase() + ". " + req.body.feedback, "/intern/tasks");
  res.status(201).json(outcome.evaluation);
});
r.get("/assessment-evaluations", async (req, res) => {
  const m = await mid(req.user.id);
  res.json(
    (
      await q(
        `SELECT DISTINCT aa.id attempt_id,aa.status,aa.total_score,aa.submitted_at,a.name assessment_name,ip.full_name,ip.id intern_id,COUNT(ans.id) FILTER(WHERE qb.type NOT IN ('MCQ','MULTI_SELECT','TRUE_FALSE') AND ans.manual_score IS NULL) pending_manual FROM assessment_attempts aa JOIN assessments a ON a.id=aa.assessment_id JOIN intern_profiles ip ON ip.id=aa.intern_id JOIN group_members gm ON gm.intern_id=ip.id AND gm.active JOIN mentor_assignments ma ON ma.group_id=gm.group_id AND ma.mentor_id=$1 AND ma.active JOIN assessment_answers ans ON ans.attempt_id=aa.id JOIN question_bank qb ON qb.id=ans.question_id WHERE aa.status IN ('PENDING_EVALUATION','SUBMITTED','EVALUATED') GROUP BY aa.id,a.name,ip.full_name,ip.id ORDER BY aa.submitted_at DESC`,
        [m],
      )
    ).rows,
  );
});
r.get("/assessment-evaluations/:attemptId", async (req, res) => {
  const m = await mid(req.user.id);
  const at = (
    await q(
      `SELECT DISTINCT aa.*,a.name assessment_name,ip.full_name FROM assessment_attempts aa JOIN assessments a ON a.id=aa.assessment_id JOIN intern_profiles ip ON ip.id=aa.intern_id JOIN group_members gm ON gm.intern_id=ip.id AND gm.active JOIN mentor_assignments ma ON ma.group_id=gm.group_id AND ma.mentor_id=$1 AND ma.active WHERE aa.id=$2`,
      [m, req.params.attemptId],
    )
  ).rows[0];
  if (!at)
    return res
      .status(403)
      .json({ error: "This intern is not assigned to you" });
  at.answers = (
    await q(
      `SELECT ans.*,qb.question,qb.type,qb.marks,qb.marking_guide,qb.correct_answer,s.name section_name,s.pass_score,s.rubric_id,r.name rubric_name,COALESCE(json_agg(rc ORDER BY rc.name) FILTER(WHERE rc.id IS NOT NULL),'[]') rubric_criteria FROM assessment_answers ans JOIN question_bank qb ON qb.id=ans.question_id LEFT JOIN assessment_sections s ON s.assessment_id=$2 AND s.question_ids ? qb.id::text LEFT JOIN rubrics r ON r.id=s.rubric_id LEFT JOIN rubric_criteria rc ON rc.rubric_id=r.id WHERE ans.attempt_id=$2 GROUP BY ans.id,qb.id,s.id,r.id ORDER BY ans.id`,
      [m, at.id],
    )
  ).rows;
  res.json(at);
});
r.post("/assessment-answers/:answerId/evaluate", async (req, res) => {
  const m = await mid(req.user.id);
  const row = (
    await q(
      `SELECT ans.*,qb.marks,qb.type,s.rubric_id FROM assessment_answers ans JOIN assessment_attempts aa ON aa.id=ans.attempt_id JOIN intern_profiles ip ON ip.id=aa.intern_id JOIN group_members gm ON gm.intern_id=ip.id AND gm.active JOIN mentor_assignments ma ON ma.group_id=gm.group_id AND ma.mentor_id=$1 AND ma.active JOIN question_bank qb ON qb.id=ans.question_id LEFT JOIN assessment_sections s ON s.assessment_id=aa.assessment_id AND s.question_ids ? qb.id::text WHERE ans.id=$2`,
      [m, req.params.answerId],
    )
  ).rows[0];
  if (!row)
    return res
      .status(403)
      .json({ error: "Answer not found or intern is not assigned to you" });
  if (["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(row.type))
    return res
      .status(409)
      .json({ error: "Only written answers require mentor evaluation" });
  let score = Number(req.body.score),
    rubricScores = [];
  if (row.rubric_id) {
    const criteria = (
      await q(
        "SELECT * FROM rubric_criteria WHERE rubric_id=$1 ORDER BY name",
        [row.rubric_id],
      )
    ).rows;
    rubricScores = criteria.map((c) => {
      const input = (req.body.rubricScores || []).find(
        (x) => x.criterionId === c.id,
      );
      const awarded = Number(input?.awarded ?? -1);
      if (awarded < 0 || awarded > Number(c.max_marks))
        throw Object.assign(
          new Error("Complete every rubric criterion within its maximum marks"),
          { status: 400 },
        );
      return {
        criterionId: c.id,
        name: c.name,
        awarded,
        maxMarks: Number(c.max_marks),
        weight: Number(c.weight),
      };
    });
    const weighted = rubricScores.reduce(
      (n, c) => n + (c.awarded / c.maxMarks) * c.weight,
      0,
    );
    score = Number(((weighted / 100) * Number(row.marks)).toFixed(2));
  }
  if (!Number.isFinite(score) || score < 0 || score > Number(row.marks))
    return res
      .status(400)
      .json({ error: "Score must be between 0 and " + row.marks });
  const x = (
    await q(
      "UPDATE assessment_answers SET manual_score=$1,rubric_scores=$2,feedback=$3,status='EVALUATED',evaluator_id=$4,evaluated_at=now() WHERE id=$5 RETURNING *",
      [score, rubricScores, req.body.feedback || null, req.user.id, row.id],
    )
  ).rows[0];
  await q(
    `UPDATE assessment_attempts aa SET total_score=(SELECT COALESCE(SUM(COALESCE(manual_score,auto_score,0)),0) FROM assessment_answers WHERE attempt_id=aa.id),status=CASE WHEN NOT EXISTS(SELECT 1 FROM assessment_answers ans JOIN question_bank qb ON qb.id=ans.question_id WHERE ans.attempt_id=aa.id AND qb.type NOT IN ('MCQ','MULTI_SELECT','TRUE_FALSE') AND ans.manual_score IS NULL) THEN 'EVALUATED' ELSE 'PENDING_EVALUATION' END WHERE aa.id=$1`,
    [x.attempt_id],
  );
  res.json(x);
});
r.post("/reviews", async (req, res) => {
  const m = await mid(req.user.id);
  const b = req.body;
  const allowed = (
    await q(
      "SELECT 1 FROM mentor_assignments WHERE mentor_id=$1 AND group_id=$2 AND active",
      [m, b.groupId],
    )
  ).rowCount;
  if (!allowed) return res.status(403).json({ error: "Not assigned" });
  if (!Number.isInteger(Number(b.periodNo)) || Number(b.periodNo) < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.reviewDate || "")))
    return res.status(400).json({ error: "Valid review period and date are required" });
  if (!REVIEW_STATUSES.includes(b.status || "CONDUCTED"))
    return res.status(400).json({ error: "Invalid review status" });
  if ((await q("SELECT 1 FROM fortnight_reviews WHERE group_id=$1 AND period_no=$2", [b.groupId, b.periodNo])).rowCount)
    return res.status(409).json({ error: "Fortnight " + b.periodNo + " already has a review for this group. Update it instead." });
  if (b.groupMarks != null && (!Number.isFinite(Number(b.groupMarks)) || Number(b.groupMarks) < 0 || Number(b.groupMarks) > 100))
    return res.status(400).json({ error: "Group marks must be between 0 and 100" });
  const individuals = b.individualMarks || [];
  if (!Array.isArray(individuals) || individuals.some(im => !im.internId || !Number.isFinite(Number(im.marks)) || Number(im.marks) < 0 || Number(im.marks) > 100) || new Set(individuals.map(im => im.internId)).size !== individuals.length)
    return res.status(400).json({ error: "Individual marks must be unique and between 0 and 100" });
  const members = (await q("SELECT intern_id FROM group_members WHERE group_id=$1 AND active", [b.groupId])).rows;
  const memberIds = new Set(members.map(x => x.intern_id));
  if (individuals.some(im => !memberIds.has(im.internId)))
    return res.status(400).json({ error: "Individual review contains an intern outside this group" });
  const x = await tx(async client => {
    const review = (await client.query(
      "INSERT INTO fortnight_reviews(group_id,period_no,review_date,status,progress,domain_review,presentation_review,group_marks,feedback,action_items,next_expectations,published_at,rubric_id,rubric_scores,created_by) VALUES($1,$2,$3,$4::text,$5,$6,$7,$8,$9,$10,$11,CASE WHEN $4::text='PUBLISHED' THEN now() END,$12,$13,$14) RETURNING *",
      [b.groupId,b.periodNo,b.reviewDate,b.status || "CONDUCTED",b.progress,b.domainReview,b.presentationReview,b.groupMarks,b.feedback,b.actionItems,b.nextExpectations,b.rubricId || null,JSON.stringify(b.rubricScores || []),req.user.id],
    )).rows[0];
    for (const im of individuals)
      await client.query("INSERT INTO review_individual_marks(review_id,intern_id,marks,contribution_note) VALUES($1,$2,$3,$4)",[review.id,im.internId,im.marks,im.note || null]);
    return review;
  });
  await audit(req, "REVIEW_RECORDED", "fortnight_review", x.id, null, x);
  if (x.status === "PUBLISHED") await notifyGroup(x.group_id, "REVIEW_PUBLISHED", "Fortnight review published", "Feedback for fortnight " + x.period_no + " is available.", "/intern", "REVIEW:" + x.id, req.user.id);
  res.status(201).json(x);
});
// Scheduled -> Conducted -> Marks/Feedback Entered -> Published (Section 20).
r.patch("/reviews/:id", async (req, res) => {
  const m = await mid(req.user.id), b = req.body;
  const before = (await q("SELECT fr.* FROM fortnight_reviews fr JOIN mentor_assignments ma ON ma.group_id=fr.group_id AND ma.mentor_id=$1 AND ma.active WHERE fr.id=$2", [m, req.params.id])).rows[0];
  if (!before) return res.status(404).json({ error: "Review not found" });
  if (before.status === "PUBLISHED") return res.status(409).json({ error: "A published review cannot be changed" });
  const status = b.status || before.status;
  if (!REVIEW_STATUSES.includes(status) || REVIEW_STATUSES.indexOf(status) < REVIEW_STATUSES.indexOf(before.status))
    return res.status(409).json({ error: "Reviews move forward: Scheduled, Conducted, Marks Entered, Published" });
  const groupMarks = b.groupMarks === undefined ? before.group_marks : b.groupMarks;
  if (groupMarks != null && (!Number.isFinite(Number(groupMarks)) || Number(groupMarks) < 0 || Number(groupMarks) > 100))
    return res.status(400).json({ error: "Group marks must be between 0 and 100" });
  const individuals = b.individualMarks;
  const members = new Set((await q("SELECT intern_id FROM group_members WHERE group_id=$1 AND active", [before.group_id])).rows.map((x) => x.intern_id));
  if (individuals !== undefined && (!Array.isArray(individuals) || individuals.some((im) => !members.has(im.internId) || !Number.isFinite(Number(im.marks)) || Number(im.marks) < 0 || Number(im.marks) > 100)))
    return res.status(400).json({ error: "Individual marks must be between 0 and 100 for members of this group" });
  if (status === "PUBLISHED") {
    const count = individuals ? individuals.length : Number((await q("SELECT count(*) n FROM review_individual_marks WHERE review_id=$1", [before.id])).rows[0].n);
    if (groupMarks == null || count < members.size) return res.status(409).json({ error: "Enter group marks and every member's individual marks before publishing" });
  }
  const x = await tx(async (client) => {
    const row = (await client.query(
      `UPDATE fortnight_reviews SET status=$2,review_date=COALESCE($3,review_date),progress=COALESCE($4,progress),domain_review=COALESCE($5,domain_review),presentation_review=COALESCE($6,presentation_review),group_marks=$7,feedback=COALESCE($8,feedback),action_items=COALESCE($9,action_items),next_expectations=COALESCE($10,next_expectations),rubric_id=COALESCE($11,rubric_id),rubric_scores=COALESCE($12,rubric_scores),published_at=CASE WHEN $2::text='PUBLISHED' THEN now() ELSE published_at END,updated_at=now() WHERE id=$1 RETURNING *`,
      [before.id, status, b.reviewDate || null, b.progress ?? null, b.domainReview ?? null, b.presentationReview ?? null, groupMarks, b.feedback ?? null, b.actionItems ?? null, b.nextExpectations ?? null, b.rubricId || null, b.rubricScores ? JSON.stringify(b.rubricScores) : null],
    )).rows[0];
    if (individuals) {
      await client.query("DELETE FROM review_individual_marks WHERE review_id=$1", [before.id]);
      for (const im of individuals)
        await client.query("INSERT INTO review_individual_marks(review_id,intern_id,marks,contribution_note) VALUES($1,$2,$3,$4)", [before.id, im.internId, im.marks, im.note || null]);
    }
    return row;
  });
  await audit(req, "REVIEW_UPDATED", "fortnight_review", x.id, before, x);
  if (x.status === "PUBLISHED") await notifyGroup(x.group_id, "REVIEW_PUBLISHED", "Fortnight review published", "Feedback for fortnight " + x.period_no + " is available.", "/intern", "REVIEW:" + x.id, req.user.id);
  res.json(x);
});
r.get("/submissions/:id/file", async (req, res) => {
  const m = await mid(req.user.id);
  const x = (await q(
    "SELECT ts.file_path,ts.file_name,ts.mime_type FROM task_submissions ts JOIN weekly_tasks wt ON wt.id=ts.task_id WHERE (wt.assigning_mentor_id=$1 OR (wt.assigning_mentor_id IS NULL AND EXISTS(SELECT 1 FROM intern_mentor_assignments ima WHERE ima.intern_id=ts.intern_id AND ima.mentor_id=$1 AND ima.active))) AND ts.id=$2",
    [m, req.params.id],
  )).rows[0];
  if (!x?.file_path || !fs.existsSync(x.file_path)) return res.status(404).json({ error: "Submission file not found" });
  res.download(path.resolve(x.file_path), x.file_name || "submission");
});
const internInMyGroups = (mentorId) => async (internId) =>
  (await q("SELECT 1 FROM group_members gm JOIN mentor_assignments ma ON ma.group_id=gm.group_id AND ma.mentor_id=$1 AND ma.active WHERE gm.intern_id=$2 AND gm.active LIMIT 1", [mentorId, internId])).rowCount > 0;
r.post("/leave-requests/:id/decision", async (req, res) => {
  const m = await mid(req.user.id);
  res.json(await decideLeave(req, req.params.id, req.body.status, req.body.reason, internInMyGroups(m)));
});
r.get("/attendance-exceptions", async (req, res) => {
  const m = await mid(req.user.id);
  res.json((await q(
    `SELECT ae.*,ip.full_name,g.name group_name FROM attendance_exceptions ae JOIN intern_profiles ip ON ip.id=ae.intern_id JOIN group_members gm ON gm.intern_id=ip.id AND gm.active JOIN groups g ON g.id=gm.group_id JOIN mentor_assignments ma ON ma.group_id=g.id AND ma.mentor_id=$1 AND ma.active ORDER BY CASE WHEN ae.status IN('DETECTED','REQUESTED') THEN 0 ELSE 1 END,ae.created_at DESC LIMIT 100`,
    [m],
  )).rows);
});
r.post("/attendance-exceptions/:id/decision", async (req, res) => {
  const m = await mid(req.user.id);
  res.json(await decideAttendanceException(req, req.params.id, req.body.status, req.body.reason, internInMyGroups(m)));
});
r.get("/reviews/:id/report", async (req, res) => {
  const m = await mid(req.user.id);
  const review = (
    await q(
      `SELECT fr.*,g.name group_name,b.name batch_name,p.title project_title FROM fortnight_reviews fr JOIN groups g ON g.id=fr.group_id LEFT JOIN batches b ON b.id=g.batch_id LEFT JOIN project_assignments pa ON pa.group_id=g.id AND pa.status='ASSIGNED' LEFT JOIN projects p ON p.id=pa.project_id JOIN mentor_assignments ma ON ma.group_id=g.id AND ma.mentor_id=$1 AND ma.active WHERE fr.id=$2`,
      [m, req.params.id],
    )
  ).rows[0];
  if (!review) return res.status(404).json({ error: "Review not found" });
  const members = (
    await q(
      `SELECT rim.marks,rim.contribution_note,ip.full_name,ip.roll_number FROM review_individual_marks rim JOIN intern_profiles ip ON ip.id=rim.intern_id WHERE rim.review_id=$1 ORDER BY ip.full_name`,
      [review.id],
    )
  ).rows;
  res.json({ review, members, generatedAt: new Date().toISOString() });
});
r.get("/reviews", async (req, res) => {
  const m = await mid(req.user.id);
  res.json(
    (
      await q(
        `SELECT fr.*,g.name group_name,(SELECT count(*) FROM review_individual_marks rim WHERE rim.review_id=fr.id) individual_count FROM fortnight_reviews fr JOIN groups g ON g.id=fr.group_id JOIN mentor_assignments ma ON ma.group_id=g.id AND ma.mentor_id=$1 AND ma.active ORDER BY fr.review_date DESC,fr.period_no DESC`,
        [m],
      )
    ).rows,
  );
});
r.get("/groups/:id/members", async (req, res) => {
  const m = await mid(req.user.id);
  const ok = (
    await q(
      "SELECT 1 FROM mentor_assignments WHERE mentor_id=$1 AND group_id=$2 AND active",
      [m, req.params.id],
    )
  ).rowCount;
  if (!ok) return res.status(403).json({ error: "Not assigned" });
  res.json(
    (
      await q(
        "SELECT ip.id,ip.full_name,ip.program,ip.branch FROM group_members gm JOIN intern_profiles ip ON ip.id=gm.intern_id WHERE gm.group_id=$1 AND gm.active",
        [req.params.id],
      )
    ).rows,
  );
});
r.get("/final-evaluations/candidates", async (req, res) => {
  const m = await mid(req.user.id);
  res.json(
    (
      await q(
        `SELECT ip.id intern_id,ip.full_name,ip.roll_number,g.id group_id,g.name group_name,p.title project_title,COALESCE(att.pct,0) attendance_pct,COALESCE(ts.avg_marks,0) task_avg,COALESCE(rv.avg_marks,0) review_avg,fe.id evaluation_id,fe.group_marks,fe.individual_marks,fe.mentor_feedback,fe.recommendation FROM intern_profiles ip JOIN group_members gm ON gm.intern_id=ip.id AND gm.active JOIN groups g ON g.id=gm.group_id JOIN mentor_assignments ma ON ma.group_id=g.id AND ma.mentor_id=$1 AND ma.active LEFT JOIN project_assignments pa ON pa.group_id=g.id AND pa.status='ASSIGNED' LEFT JOIN projects p ON p.id=pa.project_id LEFT JOIN LATERAL(SELECT z.attendance_percent pct FROM attendance_summary z JOIN batch_allocations za ON za.id=z.allocation_id WHERE z.intern_id=ip.id ORDER BY za.intern_start DESC NULLS LAST LIMIT 1)att ON true LEFT JOIN LATERAL(SELECT round(avg(te.marks),1) avg_marks FROM task_submissions ts JOIN task_evaluations te ON te.submission_id=ts.id WHERE ts.intern_id=ip.id AND te.decision='APPROVED')ts ON true LEFT JOIN LATERAL(SELECT round(avg(rim.marks),1) avg_marks FROM review_individual_marks rim JOIN fortnight_reviews fr ON fr.id=rim.review_id WHERE rim.intern_id=ip.id AND fr.status='PUBLISHED')rv ON true LEFT JOIN LATERAL(SELECT * FROM final_evaluations x WHERE x.intern_id=ip.id ORDER BY x.created_at DESC LIMIT 1)fe ON true ORDER BY g.name,ip.full_name`,
        [m],
      )
    ).rows,
  );
});
r.post("/final-evaluations", async (req, res) => {
  const m = await mid(req.user.id),
    b = req.body;
  const ok = (
    await q(
      "SELECT 1 FROM mentor_assignments ma JOIN group_members gm ON gm.group_id=ma.group_id AND gm.intern_id=$3 AND gm.active WHERE ma.mentor_id=$1 AND ma.group_id=$2 AND ma.active",
      [m, b.groupId, b.internId],
    )
  ).rowCount;
  if (!ok)
    return res
      .status(403)
      .json({ error: "Intern is not in your assigned group" });
  const acceptedSubmission=(await q("SELECT 1 FROM final_project_submissions WHERE group_id=$1 AND status='ACCEPTED'",[b.groupId])).rowCount;
  if(!acceptedSubmission)return res.status(409).json({error:"An accepted final project submission is required before final evaluation"});
  if (b.groupMarks === "" || b.groupMarks == null || b.individualMarks === "" || b.individualMarks == null)
    return res.status(400).json({ error: "Group and individual marks are required" });
  const groupMarks = Number(b.groupMarks),
    individualMarks = Number(b.individualMarks);
  if (
    !Number.isFinite(groupMarks) ||
    groupMarks < 0 ||
    groupMarks > 100 ||
    !Number.isFinite(individualMarks) ||
    individualMarks < 0 ||
    individualMarks > 100
  )
    return res
      .status(400)
      .json({ error: "Group and individual marks must be between 0 and 100" });
  if (!String(b.mentorFeedback || "").trim())
    return res.status(400).json({ error: "Mentor feedback is required" });
  if (!["COMPLETED", "NEEDS_WORK"].includes(b.recommendation))
    return res.status(400).json({ error: "Choose COMPLETED or NEEDS_WORK" });
  const existing = (
    await q(
      "SELECT 1 FROM completion_approvals WHERE intern_id=$1 AND status='APPROVED'",
      [b.internId],
    )
  ).rowCount;
  if (existing)
    return res
      .status(409)
      .json({ error: "Final evaluation is locked after completion approval" });
  const x = (
    await q(
      "INSERT INTO final_evaluations(intern_id,group_id,group_marks,individual_marks,mentor_feedback,recommendation) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
      [
        b.internId,
        b.groupId,
        groupMarks,
        individualMarks,
        b.mentorFeedback,
        b.recommendation,
      ],
    )
  ).rows[0];
  await audit(
    req,
    "FINAL_EVALUATION_SUBMITTED",
    "final_evaluation",
    x.id,
    null,
    x,
  );
  res.status(201).json(x);
});

r.get("/final-project-submissions",async(req,res)=>{
 const m=await mid(req.user.id);
 const rows=(await q(`SELECT fps.id,fps.group_id,fps.project_id,fps.document_id,fps.repository_url,fps.demo_url,fps.notes,fps.status,fps.mentor_feedback,fps.reviewed_at,fps.created_at,g.name group_name,p.title project_title,d.title document_title
 FROM final_project_submissions fps JOIN mentor_assignments ma ON ma.group_id=fps.group_id AND ma.mentor_id=$1 AND ma.active JOIN groups g ON g.id=fps.group_id JOIN projects p ON p.id=fps.project_id LEFT JOIN documents d ON d.id=fps.document_id ORDER BY fps.updated_at DESC`,[m])).rows;
 res.json(rows);
});
r.post("/final-project-submissions/:id/review",async(req,res)=>{
 const m=await mid(req.user.id);
 const {status,feedback}=req.body||{};
 if(!["ACCEPTED","REVISION_REQUESTED"].includes(status)||typeof feedback!=="string"||!feedback.trim()||feedback.length>5000)return res.status(400).json({error:"Review decision and feedback are required"});
 const x=(await q(`UPDATE final_project_submissions fps SET status=$3,mentor_feedback=$4,reviewed_by=$5,reviewed_at=now(),updated_at=now()
 FROM mentor_assignments ma WHERE fps.id=$1 AND ma.group_id=fps.group_id AND ma.mentor_id=$2 AND ma.active RETURNING fps.*`,[req.params.id,m,status,feedback.trim(),req.user.id])).rows[0];
 if(!x)return res.status(404).json({error:"Submission not found in your assigned groups"});
 res.json(x);
});

r.get("/task-interns",async(req,res)=>{
 const x=await q("SELECT ip.id,ip.full_name,ba.batch_id FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.is_active AND u.status<>'DELETED' JOIN batch_allocations ba ON ba.intern_id=ip.id WHERE current_date BETWEEN ba.intern_start AND ba.intern_end ORDER BY ip.full_name");
 res.json(x.rows);
});
r.get("/assigned-tasks",async(req,res)=>{
 const m=await mid(req.user.id);
 res.json((await q("SELECT wt.*,ip.full_name intern_name FROM weekly_tasks wt JOIN intern_profiles ip ON ip.id=wt.target_intern_id WHERE wt.assigning_mentor_id=$1 ORDER BY wt.release_at DESC",[m])).rows);
});
r.post("/assigned-tasks",async(req,res)=>{
 const m=await mid(req.user.id),b=req.body||{};
 if(!m)return res.status(403).json({error:"Mentor not found"});
 if(!b.internId||!String(b.title||"").trim()||!String(b.description||"").trim())return res.status(400).json({error:"Intern, title and instructions are required"});
 const due=b.dueAt?new Date(b.dueAt):null;
 if(due&&(!Number.isFinite(due.getTime())||due<=new Date()))return res.status(400).json({error:"Invalid due date"});
 const marks=Number(b.marks??100);
 if(!Number.isFinite(marks)||marks<=0||marks>1000)return res.status(400).json({error:"Invalid marks"});
 const intern=(await q("SELECT ip.id,ip.user_id,ba.batch_id FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.is_active AND u.status<>'DELETED' JOIN batch_allocations ba ON ba.intern_id=ip.id WHERE ip.id=$1 AND current_date BETWEEN ba.intern_start AND ba.intern_end ORDER BY ba.intern_start DESC LIMIT 1",[b.internId])).rows[0];
 if(!intern)return res.status(400).json({error:"Intern has no active allocation"});
 const types=["TEXT","LINK","REPOSITORY","DOCUMENT","PRESENTATION","VIDEO","FILE"].filter(x=>(b.submissionTypes||["REPOSITORY"]).includes(x));
 if(!types.length)return res.status(400).json({error:"Select submission type"});
 const x=(await q("INSERT INTO weekly_tasks(batch_id,title,description,expected_output,submission_types,resources,release_at,due_at,marks,status,release_timezone,target_intern_id,assigning_mentor_id) VALUES($1,$2,$3,$4,$5,$6,now(),$7,$8,'RELEASED','Asia/Kolkata',$9,$10) RETURNING *",[intern.batch_id,String(b.title).trim(),String(b.description).trim(),b.expectedOutput||null,JSON.stringify(types),b.resources||null,due?due.toISOString():null,marks,intern.id,m])).rows[0];
 await audit(req,"MENTOR_TASK_ASSIGNED","weekly_task",x.id,null,{internId:intern.id});
 await notify(intern.user_id,"TASK_ASSIGNED","New mentor task",x.title,"/intern/tasks");
 res.status(201).json(x);
});

export default r;

import {
  DEFAULT_WEIGHTS,
  validateWeights,
  calculatePerformance,
} from "../services/performanceScoreService.js";
import { Router } from "express";
import bcrypt from "bcryptjs";
import batchAllotmentOrders from "./batchAllotmentOrders.js";
import adminWorkflow from "./adminWorkflow.js";
import { offerSnapshot } from "../services/offerLetterSnapshot.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { q, tx } from "../common/database/index.js";
import { auth, permit } from "../common/security/auth.middleware.js";
import { audit } from "../common/audit/audit.service.js";
import { sendProofFile, latestProof } from "../services/proofService.js";
import {
  decideAttendanceException,
  decideLeave,
  notifyFaceDecision,
} from "../services/attendanceService.js";
import {
  detectFileType,
  readSecureFile,
} from "../common/storage/secureFiles.js";
import { adminResetPassword } from "../modules/auth/auth.service.js";
import { generateQuestions } from "../services/aiQuestionService.js";
import { generateCertificate } from "../services/certificateService.js";
import { generateCompletionReport } from "../services/completionReportService.js";
import {
  notify,
  notifyGroup,
  notifyWithEmail,
} from "../common/notifications/notification.service.js";
const r = Router();
async function notifyMentorAssigned(mentorId, groupId) {
  const info = (
    await q(
      "SELECT m.user_id,m.full_name,g.name FROM mentors m,groups g WHERE m.id=$1 AND g.id=$2",
      [mentorId, groupId],
    )
  ).rows[0];
  if (!info) return;
  await notify(
    info.user_id,
    "MENTOR_ASSIGNED",
    "Group assigned",
    "You are now mentoring " + info.name + ".",
    "/mentor",
  );
  await notifyGroup(
    groupId,
    "MENTOR_ASSIGNED",
    "Mentor assigned",
    info.full_name + " is now mentoring " + info.name + ".",
    null,
    null,
    info.user_id,
  );
}
r.use(auth, permit("ADMIN", "SUPER_ADMIN"));
r.use(batchAllotmentOrders);
r.use(adminWorkflow);
r.get("/dashboard", async (req, res) => {
  const sql = `SELECT (SELECT count(*) FROM users WHERE role='INTERN' AND status<>'DELETED') interns,(SELECT count(*) FROM users WHERE role='INTERN' AND is_active AND status<>'DELETED') active_interns,(SELECT count(*) FROM college_proofs WHERE status IN ('UPLOADED','UNDER_REVIEW')) proofs_pending,(SELECT count(*) FROM users WHERE role='INTERN' AND status='PENDING_APPROVAL') approvals_pending,(SELECT count(*) FROM face_enrollments WHERE status='PENDING_ADMIN_APPROVAL') faces_pending,(SELECT count(*) FROM task_submissions WHERE status IN ('SUBMITTED','RESUBMITTED')) task_evaluations_pending,(SELECT count(*) FROM attendance_exceptions WHERE status IN ('DETECTED','REQUESTED')) attendance_exceptions,(SELECT count(*) FROM leave_requests WHERE status='REQUESTED') leave_pending,(SELECT count(*) FROM groups WHERE status IN ('SYSTEM_DRAFT','DRAFT')) groups_pending,(SELECT count(*) FROM batch_allocations WHERE current_date BETWEEN intern_start AND intern_end) active_allocations,(SELECT count(*) FROM fortnight_reviews WHERE status='PUBLISHED') published_reviews,(SELECT count(*) FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED' WHERE EXISTS(SELECT 1 FROM final_evaluations fe WHERE fe.intern_id=ip.id) AND NOT EXISTS(SELECT 1 FROM completion_approvals ca WHERE ca.intern_id=ip.id) AND NOT EXISTS(SELECT 1 FROM exit_records ex WHERE ex.intern_id=ip.id)) completions_pending,(SELECT count(*) FROM college_proofs WHERE status='OVERRIDE') proof_overrides,(SELECT count(*) FROM batch_allocations WHERE date_mismatch) date_mismatches,(SELECT count(*) FROM offer_letters WHERE status IN ('DRAFT','PREVIEWED','APPROVED')) offers_pending,(SELECT count(*) FROM question_bank WHERE status='DRAFT' AND source<>'MANUAL') ai_questions_pending,(SELECT count(*) FROM assessment_attempts WHERE status='PENDING_EVALUATION') assessments_to_evaluate,(SELECT count(*) FROM certificates WHERE status='ISSUED') certificates_issued`;
  res.json((await q(sql)).rows[0]);
});
r.get("/performance/weights", async (req, res) =>
  res.json(
    (
      await q(
        "SELECT batch_id,domain_id,weights,updated_at FROM performance_weight_configs ORDER BY updated_at DESC",
      )
    ).rows,
  ),
);
r.put("/performance/weights", async (req, res) => {
  const { batchId, domainId = null, weights } = req.body;
  if (!batchId || !validateWeights(weights))
    return res
      .status(400)
      .json({
        error: "Batch and four nonnegative weights totaling 100 are required",
      });
  const batch = (await q("SELECT id FROM batches WHERE id=$1", [batchId]))
    .rows[0];
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  if (
    domainId &&
    !(await q("SELECT id FROM domains WHERE id=$1", [domainId])).rowCount
  )
    return res.status(404).json({ error: "Domain not found" });
  const x = (
    await q(
      `INSERT INTO performance_weight_configs(batch_id,domain_id,weights) VALUES($1,$2,$3)
 ON CONFLICT DO NOTHING RETURNING *`,
      [batchId, domainId, JSON.stringify(weights)],
    )
  ).rows[0];
  const result =
    x ||
    (
      await q(
        "UPDATE performance_weight_configs SET weights=$3,updated_at=now() WHERE batch_id=$1 AND domain_id IS NOT DISTINCT FROM $2 RETURNING *",
        [batchId, domainId, JSON.stringify(weights)],
      )
    ).rows[0];
  await audit(
    req,
    "PERFORMANCE_WEIGHTS_UPDATED",
    "batch",
    batchId,
    null,
    result,
  );
  res.json(result);
});
r.get("/performance", async (req, res) => {
  const rows = (
    await q(`SELECT ip.id,ip.full_name,ip.roll_number,c.name college_name,b.name batch_name,ba.batch_id,ip.final_domain_id domain_id,d.name domain_name,g.name group_name,p.title project_title,
COALESCE(att.present_days,0)::int present_days,COALESCE(att.total_days,0)::int attendance_days,COALESCE(att.late_days,0)::int late_days,COALESCE(att.absent_days,0)::int absent_days,COALESCE(att.leave_days,0)::int leave_days,CASE WHEN COALESCE(att.total_days,0)=0 THEN 0 ELSE round(att.present_days*100.0/att.total_days,1) END attendance_pct,
COALESCE(ts.task_count,0)::int task_count,COALESCE(ts.approved_tasks,0)::int approved_tasks,COALESCE(ts.avg_task_marks,0)::numeric(10,1) avg_task_marks,
COALESCE(rv.review_count,0)::int review_count,COALESCE(rv.avg_individual_marks,0)::numeric(10,1) avg_individual_marks,
COALESCE(fe.individual_marks,0)::numeric(10,1) final_individual_marks,fe.recommendation
FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.role='INTERN' AND u.status<>'DELETED' LEFT JOIN colleges c ON c.id=ip.college_id LEFT JOIN LATERAL(SELECT ba.* FROM batch_allocations ba WHERE ba.intern_id=ip.id ORDER BY ba.intern_start DESC LIMIT 1)ba ON true LEFT JOIN batches b ON b.id=ba.batch_id LEFT JOIN domains d ON d.id=ip.final_domain_id LEFT JOIN group_members gm ON gm.intern_id=ip.id AND gm.active LEFT JOIN groups g ON g.id=gm.group_id LEFT JOIN project_assignments pa ON pa.group_id=g.id AND pa.status='ASSIGNED' LEFT JOIN projects p ON p.id=pa.project_id
LEFT JOIN LATERAL(SELECT z.working_days total_days,z.present_days,z.late_days,z.absent_days,z.leave_days FROM attendance_summary z WHERE z.allocation_id=ba.id)att ON true
LEFT JOIN LATERAL(SELECT count(*) task_count,count(*) FILTER(WHERE x.status='APPROVED') approved_tasks,avg(te.marks) avg_task_marks FROM task_submissions x LEFT JOIN LATERAL(SELECT marks FROM task_evaluations e WHERE e.submission_id=x.id ORDER BY e.created_at DESC LIMIT 1)te ON true WHERE x.intern_id=ip.id)ts ON true
LEFT JOIN LATERAL(SELECT count(*) review_count,avg(rim.marks) avg_individual_marks FROM review_individual_marks rim JOIN fortnight_reviews fr ON fr.id=rim.review_id WHERE rim.intern_id=ip.id AND fr.status='PUBLISHED')rv ON true
LEFT JOIN LATERAL(SELECT individual_marks,recommendation FROM final_evaluations x WHERE x.intern_id=ip.id ORDER BY x.created_at DESC LIMIT 1)fe ON true ORDER BY ip.full_name`)
  ).rows;
  const configs = (
    await q("SELECT batch_id,domain_id,weights FROM performance_weight_configs")
  ).rows;
  const configured = rows.map((x) => {
    const config =
      configs.find(
        (c) => c.batch_id === x.batch_id && c.domain_id === x.domain_id,
      ) || configs.find((c) => c.batch_id === x.batch_id && !c.domain_id);
    const weights = config?.weights || DEFAULT_WEIGHTS;
    return {
      ...x,
      performance_score: calculatePerformance(
        {
          attendance_pct:
            Number(x.attendance_days) > 0 ? x.attendance_pct : null,
          avg_task_marks:
            Number(x.approved_tasks) > 0 ? x.avg_task_marks : null,
          avg_individual_marks:
            Number(x.review_count) > 0 ? x.avg_individual_marks : null,
          final_individual_marks: x.recommendation
            ? x.final_individual_marks
            : null,
        },
        weights,
      ),
      performance_weights: weights,
    };
  });
  const summary = {
    interns: rows.length,
    avgAttendance: rows.length
      ? Number(
          (
            rows.reduce((n, x) => n + Number(x.attendance_pct || 0), 0) /
            rows.length
          ).toFixed(1),
        )
      : 0,
    avgTaskMarks: rows.length
      ? Number(
          (
            rows.reduce((n, x) => n + Number(x.avg_task_marks || 0), 0) /
            rows.length
          ).toFixed(1),
        )
      : 0,
    avgIndividualMarks: rows.length
      ? Number(
          (
            rows.reduce((n, x) => n + Number(x.avg_individual_marks || 0), 0) /
            rows.length
          ).toFixed(1),
        )
      : 0,
  };
  res.json({ summary, interns: configured });
});
r.get("/proofs", async (req, res) =>
  res.json(
    (
      await q(`SELECT cp.*,ip.full_name,ip.roll_number,ip.program,ip.branch,ip.user_id,ip.university,ip.year_semester,ip.mobile,c.name college_name,u.email,u.status account_status,u.status_reason account_status_reason,u.is_active,cc.name coordinator_name,cc.designation coordinator_designation,cc.email coordinator_email,cc.phone coordinator_phone,
 EXISTS(SELECT 1 FROM college_proofs d WHERE d.id<>cp.id AND d.intern_id<>cp.intern_id AND d.batch_order_id IS NULL AND lower(d.reference_number)=lower(cp.reference_number) AND d.status<>'REJECTED') duplicate_reference,
 EXISTS(SELECT 1 FROM college_proofs d WHERE d.id<>cp.id AND d.file_hash=cp.file_hash AND d.batch_order_id IS NULL AND d.status<>'REJECTED' AND d.intern_id<>cp.intern_id) duplicate_file,
 ba.intern_start allocated_from,ba.intern_end allocated_to,
 CASE WHEN ba.id IS NOT NULL AND (cp.approved_from>ba.intern_start OR cp.approved_to<ba.intern_end) THEN true ELSE false END date_mismatch,
 pv.checklist last_checklist,pv.outcome last_outcome,pv.reason last_verification_reason,pv.created_at last_verified_at
 FROM college_proofs cp JOIN intern_profiles ip ON ip.id=cp.intern_id JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED' LEFT JOIN colleges c ON c.id=ip.college_id LEFT JOIN college_coordinators cc ON cc.id=cp.coordinator_id
 LEFT JOIN LATERAL (SELECT * FROM batch_allocations x WHERE x.intern_id=ip.id ORDER BY x.intern_start DESC NULLS LAST LIMIT 1) ba ON true
 LEFT JOIN LATERAL (SELECT * FROM proof_verifications x WHERE x.proof_id=cp.id ORDER BY x.created_at DESC LIMIT 1) pv ON true
 ORDER BY cp.created_at DESC`)
    ).rows,
  ),
);
r.post("/proofs/:id/verify", async (req, res) => {
  const { outcome, reason, checklist = {} } = req.body;
  if (
    !["VERIFIED", "REUPLOAD_REQUESTED", "REJECTED", "OVERRIDE"].includes(
      outcome,
    )
  )
    return res.status(400).json({ error: "Invalid outcome" });
  if (outcome !== "VERIFIED" && !String(reason || "").trim())
    return res
      .status(400)
      .json({ error: "Reason required for re-upload, rejection or override" });
  if (outcome === "OVERRIDE" && req.user.role !== "SUPER_ADMIN")
    return res
      .status(403)
      .json({ error: "Only a Super Admin can override proof verification" });
  if (req.body.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.dueDate)))
    return res.status(400).json({ error: "Invalid proof due date" });
  const proof = (
    await q(
      `SELECT cp.*,ip.full_name,ip.roll_number,c.name college_name,ba.intern_start,ba.intern_end,
 EXISTS(SELECT 1 FROM college_proofs d WHERE d.id<>cp.id AND d.intern_id<>cp.intern_id AND d.batch_order_id IS NULL AND lower(d.reference_number)=lower(cp.reference_number) AND d.status<>'REJECTED') duplicate_reference,
 EXISTS(SELECT 1 FROM college_proofs d WHERE d.id<>cp.id AND d.intern_id<>cp.intern_id AND d.batch_order_id IS NULL AND d.file_hash=cp.file_hash AND d.status<>'REJECTED') duplicate_file
 FROM college_proofs cp JOIN intern_profiles ip ON ip.id=cp.intern_id LEFT JOIN colleges c ON c.id=ip.college_id LEFT JOIN LATERAL (SELECT * FROM batch_allocations x WHERE x.intern_id=ip.id ORDER BY x.intern_start DESC NULLS LAST LIMIT 1) ba ON true WHERE cp.id=$1`,
      [req.params.id],
    )
  ).rows[0];
  if (!proof) return res.status(404).json({ error: "Proof not found" });
  const required = [
    "nameMatch",
    "rollMatch",
    "collegeMatch",
    "datesValid",
    "signatureSeal",
    "referenceMatch",
    "duplicateChecked",
  ];
  const missing = required.filter((k) => checklist[k] !== true);
  const dateMismatch = !!(
    proof.intern_start &&
    proof.intern_end &&
    (new Date(proof.approved_from) > new Date(proof.intern_start) ||
      new Date(proof.approved_to) < new Date(proof.intern_end))
  );
  if (outcome === "VERIFIED" && missing.length)
    return res.status(400).json({
      error: "Complete every verification checklist item before verifying",
      missing,
    });
  if (
    outcome === "VERIFIED" &&
    (proof.duplicate_reference || proof.duplicate_file)
  )
    return res.status(409).json({
      error:
        "Duplicate reference/file detected. Resolve the duplicate before verification.",
    });
  if (outcome === "VERIFIED" && dateMismatch)
    return res.status(409).json({
      error:
        "College-approved dates do not cover the allocated internship dates.",
    });
  const p = await tx(async (c) => {
    const updated = (
      await c.query(
        "UPDATE college_proofs SET status=$1,reason=$2,override_due_date=$4 WHERE id=$3 RETURNING *",
        [
          outcome,
          reason || null,
          req.params.id,
          outcome === "OVERRIDE" ? req.body.dueDate || null : null,
        ],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO proof_verifications(proof_id,actor_id,outcome,checklist,reason) VALUES($1,$2,$3,$4,$5)",
      [updated.id, req.user.id, outcome, checklist, reason || null],
    );
    const userStatus =
      outcome === "VERIFIED"
        ? "PENDING_APPROVAL"
        : outcome === "REUPLOAD_REQUESTED"
          ? "PROOF_REUPLOAD_REQUIRED"
          : outcome === "REJECTED"
            ? "PROOF_REJECTED"
            : "PENDING_APPROVAL";
    // An already active intern (e.g. a late proof after an override) keeps their active status.
    await c.query(
      "UPDATE users u SET status=CASE WHEN u.is_active AND $2 IN ('VERIFIED','OVERRIDE') THEN u.status ELSE $1 END,status_reason=$4,is_active=CASE WHEN $2 IN ('REJECTED','REUPLOAD_REQUESTED') THEN false ELSE is_active END FROM intern_profiles ip WHERE ip.user_id=u.id AND ip.id=$3",
      [
        userStatus,
        outcome,
        updated.intern_id,
        outcome === "VERIFIED" ? null : reason,
      ],
    );
    return updated;
  });
  await audit(req, "PROOF_" + outcome, "college_proof", p.id, proof, {
    ...p,
    checklist,
    dateMismatch,
  });
  const applicant = (
    await q("SELECT user_id FROM intern_profiles WHERE id=$1", [p.intern_id])
  ).rows[0]?.user_id;
  const proofMessages = {
    VERIFIED: [
      "College proof verified",
      "Your college permission proof is verified. Your account is awaiting Admin approval.",
    ],
    REUPLOAD_REQUESTED: [
      "College proof re-upload requested",
      "Please upload a new college permission proof. Reason: " +
        reason +
        ". Use Check Application Status on the sign-in page.",
    ],
    REJECTED: [
      "College proof rejected",
      "Your college permission proof was rejected. Reason: " + reason,
    ],
    OVERRIDE: [
      "College proof override recorded",
      "Admin recorded an override for your college proof" +
        (req.body.dueDate ? ". Submit the proof by " + req.body.dueDate : "") +
        ".",
    ],
  };
  await notifyWithEmail(
    applicant,
    "PROOF_" + outcome,
    ...proofMessages[outcome],
  );
  res.json({ ...p, dateMismatch });
});
const APPROVABLE = [
  "PENDING_APPROVAL",
  "PROOF_UNDER_REVIEW",
  "PROOF_REUPLOAD_REQUIRED",
  "CORRECTION_REQUESTED",
  "PROOF_OVERRIDE",
  "REGISTERED",
];
r.post("/interns/:userId/approve", async (req, res) => {
  const applicant = (
    await q(
      "SELECT u.id,u.status,ip.id intern_id FROM users u JOIN intern_profiles ip ON ip.user_id=u.id WHERE u.id=$1 AND u.role='INTERN'",
      [req.params.userId],
    )
  ).rows[0];
  if (!applicant) return res.status(404).json({ error: "Applicant not found" });
  if (!APPROVABLE.includes(applicant.status))
    return res
      .status(409)
      .json({
        error: "This account cannot be approved from its current status",
      });
  const proof = await latestProof(applicant.intern_id);
  const overrideReason = String(req.body.overrideReason || "").trim();
  const usable = ["VERIFIED", "OVERRIDE"].includes(proof?.status);
  if (!usable && req.user.role !== "SUPER_ADMIN")
    return res.status(409).json({ error: "Verified college proof required" });
  if (!usable && !overrideReason)
    return res
      .status(400)
      .json({ error: "Super Admin override reason required" });
  const u = await tx(async (c) => {
    if (!usable && proof) {
      await c.query(
        "UPDATE college_proofs SET status='OVERRIDE',reason=$2,override_due_date=$3 WHERE id=$1",
        [proof.id, overrideReason, req.body.dueDate || null],
      );
      await c.query(
        "INSERT INTO proof_verifications(proof_id,actor_id,outcome,reason) VALUES($1,$2,'OVERRIDE',$3)",
        [proof.id, req.user.id, overrideReason],
      );
    }
    return (
      await c.query(
        "UPDATE users SET status='ACTIVE',is_active=true,status_reason=NULL,updated_at=now() WHERE id=$1 AND role='INTERN' RETURNING id,email,status",
        [req.params.userId],
      )
    ).rows[0];
  });
  await audit(
    req,
    "ACCOUNT_APPROVED",
    "user",
    req.params.userId,
    { status: applicant.status },
    {
      ...u,
      overrideReason: overrideReason || undefined,
    },
  );
  await notifyWithEmail(
    u.id,
    "ACCOUNT_APPROVED",
    "Account approved",
    "Your GAINT internship account is approved. You can now sign in.",
    "/intern",
  );
  res.json(u);
});
for (const [route, status, type, title] of [
  ["reject", "REJECTED", "ACCOUNT_REJECTED", "Application rejected"],
  [
    "request-correction",
    "CORRECTION_REQUESTED",
    "ACCOUNT_CORRECTION_REQUESTED",
    "Application correction requested",
  ],
]) {
  r.post("/interns/:userId/" + route, async (req, res) => {
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "A reason is required" });
    const before = (
      await q(
        "SELECT id,status,is_active FROM users WHERE id=$1 AND role='INTERN' AND status<>'DELETED'",
        [req.params.userId],
      )
    ).rows[0];
    if (!before) return res.status(404).json({ error: "Applicant not found" });
    if (before.is_active)
      return res
        .status(409)
        .json({ error: "Only accounts awaiting approval can be changed here" });
    const u = (
      await q(
        "UPDATE users SET status=$1,status_reason=$2,updated_at=now() WHERE id=$3 RETURNING id,email,status,status_reason",
        [status, reason, before.id],
      )
    ).rows[0];
    await audit(req, type, "user", u.id, before, u);
    await notifyWithEmail(u.id, type, title, reason);
    res.json(u);
  });
}
r.post("/users/:userId/reset-password", async (req, res) => {
  if (req.user.role !== "SUPER_ADMIN")
    return res
      .status(403)
      .json({ error: "Only a Super Admin can reset passwords" });
  const target = (
    await q("SELECT id,email FROM users WHERE id=$1 AND status<>'DELETED'", [
      req.params.userId,
    ])
  ).rows[0];
  if (!target) return res.status(404).json({ error: "User not found" });
  try {
    await adminResetPassword(target.id, String(req.body.password || ""));
  } catch (error) {
    if (error.status)
      return res.status(error.status).json({ error: error.message });
    throw error;
  }
  await audit(req, "PASSWORD_RESET_BY_ADMIN", "user", target.id);
  res.json({ ok: true });
});
for (const [path, table] of Object.entries({
  colleges: "colleges",
  domains: "domains",
  batches: "batches",
  projects: "projects",
  questions: "question_bank",
  assessments: "assessments",
  tasks: "weekly_tasks",
  groups: "groups",
})) {
  r.get("/" + path, async (req, res) =>
    res.json((await q(`SELECT * FROM ${table} ORDER BY 1 DESC`)).rows),
  );
}
r.post("/domains", async (req, res) => {
  const {
    name,
    code,
    category,
    description,
    defaultCapacity = 25,
    allowedDeliverables = [],
  } = req.body;
  const x = (
    await q(
      "INSERT INTO domains(name,code,category,description,default_capacity,allowed_deliverables) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
      [
        name,
        code,
        category,
        description,
        defaultCapacity,
        JSON.stringify(allowedDeliverables),
      ],
    )
  ).rows[0];
  await audit(req, "DOMAIN_CREATE", "domain", x.id, null, x);
  res.status(201).json(x);
});
r.get("/domain-master", async (req, res) => {
  const ds = (await q("SELECT * FROM domains ORDER BY name")).rows;
  for (const d of ds) {
    d.subdomains = (
      await q("SELECT * FROM subdomains WHERE domain_id=$1 ORDER BY name", [
        d.id,
      ])
    ).rows;
    d.rubrics = (
      await q(
        `SELECT r.*,COALESCE(json_agg(rc ORDER BY rc.name) FILTER(WHERE rc.id IS NOT NULL),'[]') criteria FROM rubrics r LEFT JOIN rubric_criteria rc ON rc.rubric_id=r.id WHERE r.domain_id=$1 GROUP BY r.id ORDER BY r.name`,
        [d.id],
      )
    ).rows;
    d.batch_capacities = (
      await q(
        `SELECT bd.*,b.name batch_name FROM batch_domains bd JOIN batches b ON b.id=bd.batch_id WHERE bd.domain_id=$1 ORDER BY b.start_date DESC`,
        [d.id],
      )
    ).rows;
  }
  res.json(ds);
});
r.patch("/domains/:id", async (req, res) => {
  const before = (await q("SELECT * FROM domains WHERE id=$1", [req.params.id]))
    .rows[0];
  if (!before) return res.status(404).json({ error: "Domain not found" });
  const b = req.body;
  const x = (
    await q(
      "UPDATE domains SET name=$1,code=$2,category=$3,description=$4,default_capacity=$5,allowed_deliverables=$6,active=$7 WHERE id=$8 RETURNING *",
      [
        b.name ?? before.name,
        b.code ?? before.code,
        b.category ?? before.category,
        b.description ?? before.description,
        Number(b.defaultCapacity ?? before.default_capacity),
        JSON.stringify(b.allowedDeliverables ?? before.allowed_deliverables),
        b.active === undefined ? before.active : !!b.active,
        req.params.id,
      ],
    )
  ).rows[0];
  await audit(req, "DOMAIN_UPDATE", "domain", x.id, before, x);
  res.json(x);
});
r.post("/domains/:id/subdomains", async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code)
    return res
      .status(400)
      .json({ error: "Sub-domain name and code are required" });
  const x = (
    await q(
      "INSERT INTO subdomains(domain_id,name,code,active) VALUES($1,$2,$3,true) RETURNING *",
      [req.params.id, name, code],
    )
  ).rows[0];
  await audit(req, "SUBDOMAIN_CREATE", "subdomain", x.id, null, x);
  res.status(201).json(x);
});
r.patch("/subdomains/:id", async (req, res) => {
  const before = (
    await q("SELECT * FROM subdomains WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before) return res.status(404).json({ error: "Sub-domain not found" });
  const x = (
    await q(
      "UPDATE subdomains SET name=$1,code=$2,active=$3 WHERE id=$4 RETURNING *",
      [
        req.body.name ?? before.name,
        req.body.code ?? before.code,
        req.body.active === undefined ? before.active : !!req.body.active,
        req.params.id,
      ],
    )
  ).rows[0];
  await audit(req, "SUBDOMAIN_UPDATE", "subdomain", x.id, before, x);
  res.json(x);
});
r.put("/batches/:batchId/domains/:domainId", async (req, res) => {
  const cap = Number(req.body.capacity);
  if (!Number.isInteger(cap) || cap < 1)
    return res
      .status(400)
      .json({ error: "Capacity must be a positive whole number" });
  const x = (
    await q(
      "INSERT INTO batch_domains(batch_id,domain_id,capacity,assessment_id,rubric_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(batch_id,domain_id) DO UPDATE SET capacity=EXCLUDED.capacity,assessment_id=COALESCE(EXCLUDED.assessment_id,batch_domains.assessment_id),rubric_id=COALESCE(EXCLUDED.rubric_id,batch_domains.rubric_id) RETURNING *",
      [
        req.params.batchId,
        req.params.domainId,
        cap,
        req.body.assessmentId || null,
        req.body.rubricId || null,
      ],
    )
  ).rows[0];
  await audit(
    req,
    "DOMAIN_CAPACITY_SET",
    "batch_domain",
    req.params.batchId + "-" + req.params.domainId,
    null,
    x,
  );
  res.json(x);
});
r.post("/colleges", async (req, res) => {
  const name = String(req.body.name || "").trim(),
    university = String(req.body.university || "").trim();
  if (!name) return res.status(400).json({ error: "College name is required" });
  try {
    const x = (
      await q(
        "INSERT INTO colleges(name,university,active) VALUES($1,$2,true) RETURNING *",
        [name, university || null],
      )
    ).rows[0];
    await audit(req, "COLLEGE_CREATE", "college", x.id, null, x);
    res.status(201).json(x);
  } catch (e) {
    if (e.code === "23505")
      return res.status(409).json({ error: "College already exists" });
    throw e;
  }
});
r.patch("/colleges/:id", async (req, res) => {
  const before = (
    await q("SELECT * FROM colleges WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before) return res.status(404).json({ error: "College not found" });
  const name = String(req.body.name ?? before.name).trim(),
    university = String(req.body.university ?? before.university ?? "").trim(),
    active = req.body.active === undefined ? before.active : !!req.body.active;
  try {
    const x = (
      await q(
        "UPDATE colleges SET name=$1,university=$2,active=$3 WHERE id=$4 RETURNING *",
        [name, university || null, active, req.params.id],
      )
    ).rows[0];
    await audit(req, "COLLEGE_UPDATE", "college", x.id, before, x);
    res.json(x);
  } catch (e) {
    if (e.code === "23505")
      return res.status(409).json({ error: "College name already exists" });
    throw e;
  }
});
r.post("/batches", async (req, res) => {
  const b = req.body;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const validDate = (value) =>
    datePattern.test(String(value || "")) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (
    !b.collegeId ||
    !String(b.name || "").trim() ||
    !String(b.code || "").trim() ||
    !validDate(b.startDate) ||
    !validDate(b.endDate)
  )
    return res
      .status(400)
      .json({
        error:
          "College, batch name, code and valid start/end dates are required",
      });
  if (b.endDate < b.startDate)
    return res
      .status(400)
      .json({ error: "Batch end date cannot be before start date" });
  if (
    b.semester &&
    !/^SEM(?:ESTER)?[ -]?[1-8]$/i.test(String(b.semester).trim())
  )
    return res
      .status(400)
      .json({ error: "Semester must be SEM1 through SEM8" });
  if (!["ONSITE", "REMOTE", "HYBRID"].includes(b.mode || "ONSITE"))
    return res.status(400).json({ error: "Invalid internship mode" });
  const x = (
    await q(
      "INSERT INTO batches(college_id,name,code,start_date,end_date,mode,task_release_rule,review_rule,min_attendance,semester) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [
        b.collegeId,
        b.name,
        b.code,
        b.startDate,
        b.endDate,
        b.mode || "ONSITE",
        b.taskReleaseRule || {},
        b.reviewRule || {},
        b.minAttendance || 75,
        b.semester || null,
      ],
    )
  ).rows[0];
  await audit(req, "BATCH_CREATE", "batch", x.id, null, x);
  res.status(201).json(x);
});
r.post("/allocate", async (req, res) => {
  const { batchId, internId, internStart, internEnd, overrideReason } =
    req.body;
  const info = (
    await q(
      `SELECT b.*,ip.full_name,ip.college_id intern_college,cp.id proof_id,cp.status proof_status,cp.approved_from,cp.approved_to,cp.reference_number FROM batches b JOIN intern_profiles ip ON ip.id=$2 JOIN users u ON u.id=ip.user_id LEFT JOIN LATERAL (SELECT * FROM college_proofs p WHERE p.intern_id=ip.id ORDER BY p.created_at DESC,p.id DESC LIMIT 1) cp ON true WHERE b.id=$1 AND u.role='INTERN' AND u.is_active=true AND u.status='ACTIVE'`,
      [batchId, internId],
    )
  ).rows[0];
  if (!info)
    return res.status(404).json({ error: "Batch or intern not found" });
  if (!info.proof_id || !["VERIFIED", "OVERRIDE"].includes(info.proof_status))
    return res.status(409).json({
      error:
        "Verified college permission proof is required before duration allocation",
    });
  if (
    info.college_id &&
    info.intern_college &&
    info.college_id !== info.intern_college
  )
    return res.status(409).json({
      error: "Intern college does not match the selected batch college",
    });
  if (overrideReason && req.user.role !== "SUPER_ADMIN")
    return res
      .status(403)
      .json({
        error: "Only Super Admin can authorize a college-date override",
      });
  const start = internStart || String(info.start_date).slice(0, 10),
    end = internEnd || String(info.end_date).slice(0, 10);
  const validDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(start) || !validDate(end))
    return res
      .status(400)
      .json({ error: "Valid internship start and end dates are required" });
  if (new Date(end) < new Date(start))
    return res
      .status(400)
      .json({ error: "Internship end date cannot be before start date" });
  if (
    new Date(start) < new Date(info.start_date) ||
    new Date(end) > new Date(info.end_date)
  )
    return res.status(400).json({
      error: "Internship dates must stay within the selected batch dates",
    });
  const mismatch =
    new Date(info.approved_from) > new Date(start) ||
    new Date(info.approved_to) < new Date(end);
  if (mismatch && !String(overrideReason || "").trim())
    return res.status(409).json({
      error:
        "Selected duration is outside the college-approved period. Provide an Admin override reason or correct the dates.",
    });
  const existing=(await q("SELECT ba.id,b.name batch_name FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id WHERE ba.intern_id=$1 LIMIT 1",[internId])).rows[0];
  if(existing)return res.status(409).json({error:"Already allocated to "+existing.batch_name+". Use Edit Batch to transfer this intern."});
  const before =
    (
      await q(
        "SELECT * FROM batch_allocations WHERE batch_id=$1 AND intern_id=$2",
        [batchId, internId],
      )
    ).rows[0] || null;
  const x = (
    await q(
      `INSERT INTO batch_allocations(batch_id,intern_id,status,intern_start,intern_end,date_mismatch,override_reason) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(batch_id,intern_id) DO UPDATE SET intern_start=EXCLUDED.intern_start,intern_end=EXCLUDED.intern_end,date_mismatch=EXCLUDED.date_mismatch,override_reason=EXCLUDED.override_reason,status=EXCLUDED.status RETURNING *`,
      [
        batchId,
        internId,
        mismatch ? "ALLOTTED_WITH_OVERRIDE" : "ALLOTMENT_VERIFIED",
        start,
        end,
        mismatch,
        overrideReason || null,
      ],
    )
  ).rows[0];
  await q(
    "INSERT INTO allotment_verifications(allocation_id,actor_id,status,reason) VALUES($1,$2,$3,$4)",
    [
      x.id,
      req.user.id,
      mismatch ? "OVERRIDDEN" : "VERIFIED",
      overrideReason || null,
    ],
  );
  await audit(
    req,
    before ? "ALLOCATION_UPDATE" : "ALLOCATION_CREATE",
    "batch_allocation",
    x.id,
    before,
    { ...x, proofReference: info.reference_number },
  );
  res.status(before ? 200 : 201).json({
    ...x,
    proofApprovedFrom: info.approved_from,
    proofApprovedTo: info.approved_to,
  });
});
r.patch("/allocations/:id/batch",async(req,res)=>{
  const {batchId}=req.body||{};
  if(!batchId)return res.status(400).json({error:"Select the new batch"});
  const result=await tx(async c=>{
    const original=(await c.query("SELECT ba.* FROM batch_allocations ba WHERE ba.id=$1",[req.params.id])).rows[0];
    if(!original)return {code:404,error:"Allocation not found"};
    await c.query("SELECT id FROM intern_profiles WHERE id=$1 FOR UPDATE",[original.intern_id]);
    const rows=(await c.query("SELECT ba.*,b.name batch_name FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id WHERE ba.intern_id=$1 FOR UPDATE OF ba",[original.intern_id])).rows;
    if(rows.length!==1)return {code:409,error:"Multiple allocations already exist for this intern. Resolve them before transferring."};
    const current=rows[0];
    if(current.batch_id===batchId)return {code:409,error:"Already allocated to this batch. Select a different batch."};
    const linked=(await c.query("SELECT 1 FROM offer_letters WHERE allocation_id=$1 AND status<>'REVOKED' LIMIT 1",[current.id])).rowCount;
    if(linked)return {code:409,error:"An offer letter already exists. Revoke it before transferring the intern to another batch."};
    const target=(await c.query(`SELECT b.*,ip.college_id intern_college,cp.status proof_status,cp.approved_from,cp.approved_to FROM batches b JOIN intern_profiles ip ON ip.id=$2 JOIN users u ON u.id=ip.user_id LEFT JOIN LATERAL(SELECT status,approved_from,approved_to FROM college_proofs p WHERE p.intern_id=ip.id ORDER BY p.created_at DESC,p.id DESC LIMIT 1) cp ON true WHERE b.id=$1 AND u.role='INTERN' AND u.is_active=true AND u.status='ACTIVE'`,[batchId,current.intern_id])).rows[0];
    if(!target)return {code:404,error:"Target batch or active intern not found"};
    if(target.college_id&&target.intern_college&&target.college_id!==target.intern_college)return {code:409,error:"Selected batch belongs to another college"};
    if(!["VERIFIED","OVERRIDE"].includes(target.proof_status))return {code:409,error:"Verified college permission proof is required"};
    const start=String(target.start_date).slice(0,10),end=String(target.end_date).slice(0,10);
    const mismatch=String(target.approved_from).slice(0,10)>start||String(target.approved_to).slice(0,10)<end;
    const reason=String(req.body?.overrideReason||"").trim();
    if(mismatch&&(!reason||req.user.role!=="SUPER_ADMIN"))return {code:403,error:"Target batch is outside college-approved dates. Super Admin must enter an override reason."};
    if(!mismatch&&reason)return {code:400,error:"Override reason is not needed for this batch"};
    const duplicate=(await c.query("SELECT 1 FROM batch_allocations WHERE intern_id=$1 AND batch_id=$2 AND id<>$3",[current.intern_id,batchId,current.id])).rowCount;
    if(duplicate)return {code:409,error:"Already allocated to the selected batch"};
    const updated=(await c.query("UPDATE batch_allocations SET batch_id=$2,intern_start=$3,intern_end=$4,date_mismatch=$5,override_reason=$6,status=$7 WHERE id=$1 RETURNING *",[current.id,batchId,start,end,mismatch,reason||null,mismatch?"ALLOTTED_WITH_OVERRIDE":"ALLOTMENT_VERIFIED"])).rows[0];
    await c.query("INSERT INTO allotment_verifications(allocation_id,actor_id,status,reason) VALUES($1,$2,$3,$4)",[updated.id,req.user.id,mismatch?"OVERRIDDEN":"VERIFIED",reason||null]);
    return {updated,before:current};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  await audit(req,"ALLOCATION_BATCH_TRANSFER","batch_allocation",result.updated.id,result.before,{...result.updated,transferReason:String(req.body?.reason||"").trim()||null});
  res.json(result.updated);
});
r.post("/allocations/:id/early-end",async(req,res)=>{
  const endDate=String(req.body?.endDate||""),reason=String(req.body?.reason||"").trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||Number.isNaN(Date.parse(endDate))||new Date(endDate).toISOString().slice(0,10)!==endDate||reason.length<10||reason.length>1000)return res.status(400).json({error:"Valid revised end date and a reason of 10–1000 characters are required"});
  const before=(await q("SELECT ba.*,b.end_date batch_end FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id WHERE ba.id=$1",[req.params.id])).rows[0];
  if(!before)return res.status(404).json({error:"Allocation not found"});
  const start=String(before.intern_start).slice(0,10),oldEnd=String(before.intern_end).slice(0,10);
  if(endDate<start||endDate>=oldEnd||endDate>String(before.batch_end).slice(0,10))return res.status(400).json({error:"Early end must be within the internship period and before the current end date"});
  const x=(await q("UPDATE batch_allocations SET intern_end=$2 WHERE id=$1 AND intern_end=$3 RETURNING *",[before.id,endDate,before.intern_end])).rows[0];
  if(!x)return res.status(409).json({error:"Allotment changed; refresh and retry"});
  await audit(req,"ALLOCATION_EARLY_END","batch_allocation",x.id,before,{...x,earlyEndReason:reason});
  res.json({allocation:x,completionApproved:false,message:"Early end saved. Final completion requires separate evaluation and approval."});
});
r.get("/allocations", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT ba.*,ip.full_name,ip.roll_number,c.name college_name,b.name batch_name,b.code batch_code,b.start_date batch_start,b.end_date batch_end,cp.approved_from proof_from,cp.approved_to proof_to,cp.reference_number proof_reference,av.status verification_status,av.reason verification_reason,av.created_at verified_at FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id JOIN users visible_user ON visible_user.id=ip.user_id AND visible_user.status<>'DELETED' JOIN batches b ON b.id=ba.batch_id LEFT JOIN colleges c ON c.id=ip.college_id LEFT JOIN LATERAL (SELECT * FROM college_proofs p WHERE p.intern_id=ip.id AND p.status IN ('VERIFIED','OVERRIDE') ORDER BY p.created_at DESC LIMIT 1) cp ON true LEFT JOIN LATERAL (SELECT * FROM allotment_verifications x WHERE x.allocation_id=ba.id ORDER BY x.created_at DESC LIMIT 1) av ON true ORDER BY ba.intern_start DESC`,
      )
    ).rows,
  ),
);
r.get("/offer-letters", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT ol.*,ip.id intern_id,ip.full_name,c.name college_name,b.name batch_name,ba.status allocation_status FROM offer_letters ol JOIN batch_allocations ba ON ba.id=ol.allocation_id JOIN intern_profiles ip ON ip.id=ba.intern_id JOIN users visible_user ON visible_user.id=ip.user_id AND visible_user.status<>'DELETED' JOIN batches b ON b.id=ba.batch_id LEFT JOIN colleges c ON c.id=ip.college_id ORDER BY ol.created_at DESC`,
      )
    ).rows,
  ),
);
r.get("/offer-letter-templates", async (req, res) =>
  res.json(
    (
      await q(
        "SELECT * FROM offer_letter_templates WHERE active=true ORDER BY version DESC,name",
      )
    ).rows,
  ),
);
r.post("/offer-letter-templates", async (req, res) => {
  const { name, body, signatory } = req.body;
  if (!String(name || "").trim() || !String(body || "").trim())
    return res
      .status(400)
      .json({ error: "Template name and body are required" });
  const x = (
    await q(
      "INSERT INTO offer_letter_templates(name,body,signatory) VALUES($1,$2,$3) RETURNING *",
      [name.trim(), body, signatory || null],
    )
  ).rows[0];
  await audit(
    req,
    "OFFER_TEMPLATE_CREATE",
    "offer_letter_template",
    x.id,
    null,
    x,
  );
  res.status(201).json(x);
});
r.post("/offer-letters", async (req, res) => {
  const { allocationId, templateId, fromDate, toDate } = req.body;
  const info = (
    await q(
      `SELECT ba.*,ip.full_name,c.name college_name,b.name batch_name,cp.approved_from,cp.approved_to FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id JOIN users visible_user ON visible_user.id=ip.user_id AND visible_user.status<>'DELETED' JOIN batches b ON b.id=ba.batch_id LEFT JOIN colleges c ON c.id=ip.college_id LEFT JOIN LATERAL(SELECT approved_from,approved_to FROM college_proofs p WHERE p.intern_id=ip.id AND p.status IN ('VERIFIED','OVERRIDE') ORDER BY p.created_at DESC LIMIT 1) cp ON true WHERE ba.id=$1`,
      [allocationId],
    )
  ).rows[0];
  if (!info) return res.status(404).json({ error: "Allocation not found" });
  if (!["ALLOTMENT_VERIFIED", "ALLOTTED_WITH_OVERRIDE"].includes(info.status))
    return res.status(409).json({
      error:
        "Verified internship allotment is required before drafting an offer letter",
    });
  const open = (
    await q(
      "SELECT 1 FROM offer_letters WHERE allocation_id=$1 AND status<>'REVOKED' LIMIT 1",
      [info.id],
    )
  ).rowCount;
  if (open)
    return res
      .status(409)
      .json({
        error:
          "This allocation already has an offer letter. Use Reissue to correct it.",
      });
  const from = fromDate || info.intern_start,
    to = toDate || info.intern_end;
  if (!from || !to || to < from)
    return res
      .status(400)
      .json({ error: "Confirm valid From and To dates for the offer letter" });
  if (
    !info.override_reason &&
    ((info.approved_from && from < info.approved_from) ||
      (info.approved_to && to > info.approved_to))
  )
    return res
      .status(409)
      .json({ error: "Offer dates fall outside the college-approved period" });
  const tpl = (
    await q(
      "SELECT * FROM offer_letter_templates WHERE id=$1 AND active=true",
      [templateId],
    )
  ).rows[0];
  if (!tpl)
    return res
      .status(400)
      .json({ error: "Select an active offer letter template" });
  const ref =
    "GAINT-OFFER-" +
    new Date().getFullYear() +
    "-" +
    crypto.randomBytes(5).toString("hex").toUpperCase();
  const x = (
    await q(
      `INSERT INTO offer_letters(allocation_id,student_name_snapshot,college_snapshot,batch_snapshot,from_date,to_date,duration_text,template_id,template_version,reference_number,status,issued_by) VALUES($1,$2,$3,$4,$5,$6,($6::date-$5::date+1)||' days',$7,$8,$9,'DRAFT',$10) RETURNING *`,
      [
        info.id,
        info.full_name,
        info.college_name,
        info.batch_name,
        from,
        to,
        tpl.id,
        tpl.version,
        ref,
        req.user.id,
      ],
    )
  ).rows[0];
  await q(
    "INSERT INTO offer_letter_versions(offer_letter_id,version,snapshot) VALUES($1,1,$2)",
    [x.id, x],
  );
  await audit(req, "OFFER_DRAFTED", "offer_letter", x.id, null, x);
  res.status(201).json(x);
});
r.get("/offer-letters/:id/preview", async (req, res) => {
  const x = (
    await q(
      `SELECT ol.*,olt.body template_body,olt.signatory FROM offer_letters ol LEFT JOIN offer_letter_templates olt ON olt.id=ol.template_id WHERE ol.id=$1`,
      [req.params.id],
    )
  ).rows[0];
  if (!x) return res.status(404).json({ error: "Offer letter not found" });
  const values = {
    student_name: x.student_name_snapshot,
    college: x.college_snapshot,
    batch: x.batch_snapshot,
    from_date: String(x.from_date).slice(0, 10),
    to_date: String(x.to_date).slice(0, 10),
    duration: x.duration_text,
    reference_number: x.reference_number,
  };
  let body =
    x.template_body ||
    "Dear {{student_name}},\n\nYou are offered an internship with GAINT from {{from_date}} to {{to_date}} under {{batch}}.\n\nRegards,\nGAINT Clout Technologies";
  for (const [k, v] of Object.entries(values))
    body = body.replaceAll("{{" + k + "}}", v || "");
  res.json({
    ...x,
    rendered_body: x.issued_snapshot?.rendered_body ?? body,
    signatory: x.issued_snapshot?.signatory ?? x.signatory,
  });
});
r.post("/offer-letters/:id/mark-previewed", async (req, res) => {
  const before = (
    await q("SELECT * FROM offer_letters WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before) return res.status(404).json({ error: "Offer letter not found" });
  const x = (
    await q(
      "UPDATE offer_letters SET status='PREVIEWED',previewed_by=$2,previewed_at=now() WHERE id=$1 AND status IN ('DRAFT','PREVIEWED') RETURNING *",
      [req.params.id, req.user.id],
    )
  ).rows[0];
  if (!x)
    return res
      .status(409)
      .json({ error: "Only a draft offer letter can be previewed" });
  await audit(req, "OFFER_PREVIEWED", "offer_letter", x.id, before, x);
  res.json(x);
});
r.post("/offer-letters/:id/approve", async (req, res) => {
  const before = (
    await q("SELECT * FROM offer_letters WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before) return res.status(404).json({ error: "Offer letter not found" });
  if (before.status !== "PREVIEWED")
    return res
      .status(409)
      .json({ error: "Preview the offer letter before approving it" });
  const x = (
    await q(
      "UPDATE offer_letters SET status='APPROVED',approved_by=$2,approved_at=now() WHERE id=$1 AND status='PREVIEWED' RETURNING *",
      [req.params.id, req.user.id],
    )
  ).rows[0];
  if (!x)
    return res
      .status(409)
      .json({ error: "Offer letter state changed; reload and retry" });
  await audit(req, "OFFER_APPROVED", "offer_letter", x.id, before, x);
  res.json(x);
});
r.post("/offer-letters/:id/issue", async (req, res) => {
  const before = (
    await q("SELECT * FROM offer_letters WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before) return res.status(404).json({ error: "Offer letter not found" });
  if (before.status !== "APPROVED")
    return res
      .status(409)
      .json({ error: "Admin approval is required before issue" });
  const template = (
    await q(
      "SELECT body template_body,signatory FROM offer_letter_templates WHERE id=$1",
      [before.template_id],
    )
  ).rows[0];
  if (!template)
    return res.status(409).json({ error: "Offer template unavailable" });
  const issuedAt = req.body.issueAt;
  if (!issuedAt || Number.isNaN(new Date(issuedAt).getTime()))
    return res
      .status(400)
      .json({ error: "Declare the offer letter issue date and time" });
  const versionCount = Number(
    (
      await q(
        "SELECT count(*) n FROM offer_letter_versions WHERE offer_letter_id=$1",
        [before.id],
      )
    ).rows[0].n,
  );
  const issuedStatus = versionCount > 1 ? "REISSUED" : "ISSUED";
  const snapshot = offerSnapshot({
    ...before,
    ...template,
    issue_at: issuedAt,
  });
  const x = (
    await q(
      "UPDATE offer_letters SET status=$5,issue_at=$2::timestamptz,issued_by=$3,issued_snapshot=$4 WHERE id=$1 AND status='APPROVED' RETURNING *",
      [req.params.id, issuedAt, req.user.id, snapshot, issuedStatus],
    )
  ).rows[0];
  if (!x)
    return res
      .status(409)
      .json({ error: "Offer letter state changed; reload and retry" });
  await q(
    "UPDATE offer_letter_versions SET issued_snapshot=$2 WHERE offer_letter_id=$1 AND version=(SELECT max(version) FROM offer_letter_versions WHERE offer_letter_id=$1)",
    [x.id, snapshot],
  );
  const uid = (
    await q(
      "SELECT ip.user_id FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id WHERE ba.id=$1",
      [x.allocation_id],
    )
  ).rows[0]?.user_id;
  if (uid)
    await q(
      "INSERT INTO notifications(user_id,type,title,body,action_url) VALUES($1,'OFFER_LETTER',$3,$2,'/intern')",
      [
        uid,
        "Your internship offer letter " +
          x.reference_number +
          " is now available.",
        issuedStatus === "REISSUED"
          ? "Offer letter reissued"
          : "Offer letter issued",
      ],
    );
  await audit(req, "OFFER_ISSUED", "offer_letter", x.id, before, x);
  res.json(x);
});
r.post("/offer-letters/:id/reissue", async (req, res) => {
  const reason = String(req.body.reason || "").trim();
  if (!reason)
    return res.status(400).json({ error: "Reissue reason is required" });
  const old = (
    await q("SELECT * FROM offer_letters WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!old || !["ISSUED", "REISSUED", "REVOKED"].includes(old.status))
    return res
      .status(409)
      .json({ error: "Only issued or revoked letters can be reissued" });
  // Corrections flow from the verified profile and allotment, never from a second typed name.
  const current = (
    await q(
      "SELECT ip.full_name,c.name college_name,b.name batch_name,ba.intern_start,ba.intern_end FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id JOIN batches b ON b.id=ba.batch_id LEFT JOIN colleges c ON c.id=ip.college_id WHERE ba.id=$1",
      [old.allocation_id],
    )
  ).rows[0];
  const from = req.body.fromDate || current.intern_start,
    to = req.body.toDate || current.intern_end;
  if (to < from)
    return res
      .status(400)
      .json({ error: "Offer To date cannot be before From date" });
  const version = (
    await q(
      "SELECT COALESCE(max(version),0)+1 v FROM offer_letter_versions WHERE offer_letter_id=$1",
      [old.id],
    )
  ).rows[0].v;
  const x = (
    await q(
      "UPDATE offer_letters SET status='DRAFT',issue_at=null,issued_snapshot=null,previewed_at=null,previewed_by=null,approved_at=null,approved_by=null,reason=$2,student_name_snapshot=$3,college_snapshot=$4,batch_snapshot=$5,from_date=$6,to_date=$7,duration_text=($7::date-$6::date+1)||' days' WHERE id=$1 RETURNING *",
      [
        old.id,
        reason,
        current.full_name,
        current.college_name,
        current.batch_name,
        from,
        to,
      ],
    )
  ).rows[0];
  await q(
    "INSERT INTO offer_letter_versions(offer_letter_id,version,snapshot,reason) VALUES($1,$2,$3,$4)",
    [x.id, version, x, reason],
  );
  await audit(req, "OFFER_REISSUE_DRAFT", "offer_letter", x.id, old, x);
  res.json(x);
});
r.post("/offer-letters/:id/revoke", async (req, res) => {
  const reason = String(req.body.reason || "").trim();
  if (!reason)
    return res.status(400).json({ error: "Revocation reason is required" });
  const before = (
    await q("SELECT * FROM offer_letters WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before || !["ISSUED", "REISSUED"].includes(before.status))
    return res
      .status(409)
      .json({ error: "Only an issued offer letter can be revoked" });
  const x = (
    await q(
      "UPDATE offer_letters SET status='REVOKED',reason=$2 WHERE id=$1 AND status IN ('ISSUED','REISSUED') RETURNING *",
      [req.params.id, reason],
    )
  ).rows[0];
  if (!x)
    return res
      .status(409)
      .json({ error: "Offer letter state changed; reload and retry" });
  await audit(req, "OFFER_REVOKED", "offer_letter", x.id, before, x);
  const offerOwner = (
    await q(
      "SELECT ip.user_id FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id WHERE ba.id=$1",
      [x.allocation_id],
    )
  ).rows[0]?.user_id;
  await notify(
    offerOwner,
    "OFFER_LETTER",
    "Offer letter revoked",
    "Your offer letter " +
      x.reference_number +
      " was revoked. Reason: " +
      reason,
    "/intern",
  );
  res.json(x);
});
async function domainRecommendation(internId, batchId) {
  const ip = (
    await q("SELECT preferred_domains FROM intern_profiles WHERE id=$1", [
      internId,
    ])
  ).rows[0];
  if (!ip) throw Object.assign(new Error("Intern not found"), { status: 404 });
  const rows = (
    await q(
      `SELECT s.domain_id,d.name domain_name,SUM(COALESCE(ans.manual_score,ans.auto_score,0)) earned,SUM(qb.marks) possible FROM assessment_attempts aa JOIN assessments a ON a.id=aa.assessment_id JOIN assessment_sections s ON s.assessment_id=a.id JOIN domains d ON d.id=s.domain_id JOIN assessment_answers ans ON ans.attempt_id=aa.id AND s.question_ids ? ans.question_id::text JOIN question_bank qb ON qb.id=ans.question_id WHERE aa.intern_id=$1 AND a.batch_id=$2 AND aa.status='EVALUATED' AND s.domain_id IS NOT NULL GROUP BY s.domain_id,d.name`,
      [internId, batchId],
    )
  ).rows;
  const prefs = Array.isArray(ip.preferred_domains) ? ip.preferred_domains : [];
  const recs = rows
    .map((x) => {
      const assessment =
        Number(x.possible) > 0
          ? (Number(x.earned) / Number(x.possible)) * 100
          : 0;
      const prefIndex = prefs.findIndex(
        (p) =>
          String(p).toLowerCase() === String(x.domain_name).toLowerCase() ||
          String(p) === String(x.domain_id),
      );
      const preference = prefIndex < 0 ? 0 : Math.max(0, 10 - prefIndex * 3);
      return {
        domainId: x.domain_id,
        domainName: x.domain_name,
        assessmentScore: Number(assessment.toFixed(2)),
        preferenceBonus: preference,
        recommendationScore: Number(
          Math.min(100, assessment * 0.9 + preference).toFixed(2),
        ),
        evidence: { earned: Number(x.earned), possible: Number(x.possible) },
      };
    })
    .sort((x, y) => y.recommendationScore - x.recommendationScore);
  return { preferences: prefs, recommendations: recs };
}
r.get("/domain-recommendations", async (req, res) => {
  const rows = (
    await q(
      `SELECT ip.id intern_id,ip.full_name,ip.preferred_domains,ba.batch_id,b.name batch_name,ip.final_domain_id,fd.name final_domain_name FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED' JOIN batch_allocations ba ON ba.intern_id=ip.id JOIN batches b ON b.id=ba.batch_id LEFT JOIN domains fd ON fd.id=ip.final_domain_id ORDER BY ip.full_name`,
    )
  ).rows;
  const out = [];
  for (const x of rows) {
    const r = await domainRecommendation(x.intern_id, x.batch_id);
    out.push({ ...x, ...r });
  }
  res.json(out);
});
r.post("/domain-recommendations/:internId/calculate", async (req, res) => {
  try {
    const { batchId } = req.body;
    const r = await domainRecommendation(req.params.internId, batchId);
    if (!r.recommendations.length)
      return res.status(409).json({
        error: "No evaluated domain assessment results are available yet",
      });
    await q(
      "INSERT INTO domain_decisions(intern_id,batch_id,preferences,recommendations) VALUES($1,$2,$3,$4)",
      [
        req.params.internId,
        batchId,
        JSON.stringify(r.preferences),
        JSON.stringify(r.recommendations),
      ],
    );
    await audit(
      req,
      "DOMAIN_RECOMMENDATION_CALCULATED",
      "intern_profile",
      req.params.internId,
      null,
      r,
    );
    res.json(r);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});
r.post("/domain-confirm", async (req, res) => {
  const { internId, batchId, domainId, reason } = req.body;
  const latest = (
    await q(
      "SELECT * FROM domain_decisions WHERE intern_id=$1 AND batch_id=$2 ORDER BY created_at DESC LIMIT 1",
      [internId, batchId],
    )
  ).rows[0];
  if (!latest?.recommendations?.length)
    return res.status(409).json({
      error: "Calculate the domain recommendation before Admin confirmation",
    });
  if (latest.confirmed_domain_id === domainId)
    return res
      .status(409)
      .json({ error: "Domain decision already confirmed; reload" });
  // The recommendation is advisory: Admin may confirm or change it, but must explain a departure.
  const domain = (
    await q(
      "SELECT id,name,default_capacity FROM domains WHERE id=$1 AND active",
      [domainId],
    )
  ).rows[0];
  if (!domain)
    return res.status(400).json({ error: "Select an active domain" });
  const offered = (
    await q("SELECT domain_id,capacity FROM batch_domains WHERE batch_id=$1", [
      batchId,
    ])
  ).rows;
  if (offered.length && !offered.some((x) => x.domain_id === domainId))
    return res
      .status(409)
      .json({ error: "This domain is not offered in the intern's batch" });
  const top = latest.recommendations[0]?.domainId;
  if (domainId !== top && !String(reason || "").trim())
    return res
      .status(400)
      .json({
        error:
          "A reason is required when the confirmed domain differs from the top recommendation",
      });
  const capacity = Number(
    offered.find((x) => x.domain_id === domainId)?.capacity ??
      domain.default_capacity ??
      25,
  );
  const used = Number(
    (
      await q(
        "SELECT count(*) n FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id WHERE ba.batch_id=$1 AND ip.final_domain_id=$2 AND ip.id<>$3",
        [batchId, domainId, internId],
      )
    ).rows[0].n,
  );
  if (used >= capacity)
    return res
      .status(409)
      .json({
        error:
          domain.name +
          " has reached its capacity of " +
          capacity +
          " for this batch",
      });
  const grouped = (
    await q(
      "SELECT 1 FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.intern_id=$1 AND gm.active AND g.status='ACTIVE'",
      [internId],
    )
  ).rowCount;
  if (
    grouped &&
    latest.confirmed_domain_id &&
    latest.confirmed_domain_id !== domainId
  )
    return res
      .status(409)
      .json({
        error:
          "Remove the intern from their active group before changing the domain",
      });
  const x = await tx(async (client) => {
    const decision = latest.confirmed_domain_id
      ? (
          await client.query(
            "INSERT INTO domain_decisions(intern_id,batch_id,preferences,recommendations,confirmed_domain_id,confirmed_by,reason) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
            [
              internId,
              batchId,
              JSON.stringify(latest.preferences),
              JSON.stringify(latest.recommendations),
              domainId,
              req.user.id,
              reason || null,
            ],
          )
        ).rows[0]
      : (
          await client.query(
            "UPDATE domain_decisions SET confirmed_domain_id=$1,confirmed_by=$2,reason=$4 WHERE id=$3 RETURNING *",
            [domainId, req.user.id, latest.id, reason || null],
          )
        ).rows[0];
    const profile = await client.query(
      "UPDATE intern_profiles SET final_domain_id=$1 WHERE id=$2 RETURNING user_id",
      [domainId, internId],
    );
    if (!profile.rowCount) throw new Error("Intern profile not found");
    return { decision, userId: profile.rows[0].user_id };
  });
  await audit(
    req,
    latest.confirmed_domain_id ? "DOMAIN_CHANGED" : "DOMAIN_CONFIRMED",
    "domain_decision",
    x.decision.id,
    latest,
    x.decision,
  );
  await notify(
    x.userId,
    "DOMAIN_CONFIRMED",
    "Final domain confirmed",
    "GAINT confirmed your internship domain: " + domain.name + ".",
    "/intern",
  );
  res.json(x.decision);
});
r.get("/leave-requests", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT lr.*,ip.full_name,ip.roll_number,b.name batch_name,b.leave_limit_days,COALESCE((SELECT sum(x.requested_days) FROM leave_requests x WHERE x.intern_id=lr.intern_id AND x.status='APPROVED'),0)::int approved_days FROM leave_requests lr JOIN intern_profiles ip ON ip.id=lr.intern_id JOIN users visible_user ON visible_user.id=ip.user_id AND visible_user.status<>'DELETED' LEFT JOIN batch_allocations ba ON ba.intern_id=ip.id AND lr.from_date BETWEEN ba.intern_start AND ba.intern_end LEFT JOIN batches b ON b.id=ba.batch_id ORDER BY CASE lr.status WHEN 'REQUESTED' THEN 0 ELSE 1 END,lr.created_at DESC`,
      )
    ).rows,
  ),
);
r.post("/leave-requests/:id/decision", async (req, res) => {
  res.json(
    await decideLeave(req, req.params.id, req.body.status, req.body.reason),
  );
});
r.get("/holidays", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT h.*,b.name batch_name FROM holidays h JOIN batches b ON b.id=h.batch_id ORDER BY h.day DESC`,
      )
    ).rows,
  ),
);
r.post("/holidays", async (req, res) => {
  const { batchId, day, name } = req.body;
  if (!batchId || !day || !String(name || "").trim())
    return res
      .status(400)
      .json({ error: "Batch, date and holiday name are required" });
  const x = (
    await q(
      "INSERT INTO holidays(batch_id,day,name) VALUES($1,$2,$3) ON CONFLICT(batch_id,day) DO UPDATE SET name=EXCLUDED.name RETURNING *",
      [batchId, day, name.trim()],
    )
  ).rows[0];
  await audit(req, "HOLIDAY_SET", "holiday", x.id, null, x);
  res.status(201).json(x);
});
r.delete("/holidays/:id", async (req, res) => {
  const x = (
    await q("DELETE FROM holidays WHERE id=$1 RETURNING *", [req.params.id])
  ).rows[0];
  if (!x) return res.status(404).json({ error: "Holiday not found" });
  await audit(req, "HOLIDAY_DELETE", "holiday", x.id, x, null);
  res.json({ ok: true });
});
r.patch("/batches/:id/leave-policy", async (req, res) => {
  const n = Number(req.body.leaveLimitDays);
  if (!Number.isInteger(n) || n < 0 || n > 60)
    return res
      .status(400)
      .json({ error: "Leave limit must be between 0 and 60 days" });
  const x = (
    await q("UPDATE batches SET leave_limit_days=$1 WHERE id=$2 RETURNING *", [
      n,
      req.params.id,
    ])
  ).rows[0];
  if (!x) return res.status(404).json({ error: "Batch not found" });
  await audit(req, "LEAVE_POLICY_UPDATE", "batch", x.id, null, {
    leaveLimitDays: n,
  });
  res.json(x);
});
r.get("/face-enrollments", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT fe.*,ip.full_name,ip.roll_number,u.email,b.name batch_name FROM face_enrollments fe JOIN intern_profiles ip ON ip.id=fe.intern_id JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED' LEFT JOIN LATERAL(SELECT b.name FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id WHERE ba.intern_id=ip.id ORDER BY ba.intern_start DESC LIMIT 1)b ON true WHERE fe.status<>'DELETED' ORDER BY CASE fe.status WHEN 'PENDING_ADMIN_APPROVAL' THEN 0 ELSE 1 END,fe.created_at DESC`,
      )
    ).rows,
  ),
);
r.get("/face-enrollments/:id/image", async (req, res) => {
  const x = (
    await q(
      "SELECT raw_image_path FROM face_enrollments WHERE id=$1 AND status<>'DELETED'",
      [req.params.id],
    )
  ).rows[0];
  if (!x?.raw_image_path || !fs.existsSync(path.resolve(x.raw_image_path)))
    return res.status(404).json({ error: "Enrollment image not found" });
  const image = readSecureFile(path.resolve(x.raw_image_path));
  await audit(
    req,
    "FACE_ENROLLMENT_IMAGE_VIEWED",
    "face_enrollment",
    req.params.id,
  );
  res.set("Content-Type", detectFileType(image)?.mime || "image/jpeg");
  res.set("Cache-Control", "private, no-store");
  res.send(image);
});
r.delete("/face-enrollments/:id", async (req, res) => {
  const before = (
    await q(
      "SELECT * FROM face_enrollments WHERE id=$1 AND status<>'DELETED'",
      [req.params.id],
    )
  ).rows[0];
  if (!before)
    return res.status(404).json({ error: "Face enrollment not found" });
  const x = (
    await q(
      "UPDATE face_enrollments SET status='DELETED',decision_reason='Removed by administrator',approved_at=NULL,raw_image_path=NULL WHERE id=$1 AND status<>'DELETED' RETURNING *",
      [req.params.id],
    )
  ).rows[0];
  if (!x) return res.status(409).json({ error: "Enrollment changed; reload" });
  if (before.raw_image_path) fs.unlink(before.raw_image_path, () => {});
  await audit(req, "FACE_ENROLLMENT_DELETED", "face_enrollment", x.id, before, {
    status: "DELETED",
  });
  res.json({ ok: true });
});
r.post("/face-enrollments/:id/decision", async (req, res) => {
  const { reason } = req.body;
  const status =
    req.body.status === "RETAKE_REQUIRED"
      ? "REENROLLMENT_REQUIRED"
      : req.body.status;
  if (!["APPROVED", "REJECTED", "REENROLLMENT_REQUIRED"].includes(status))
    return res.status(400).json({ error: "Invalid face enrollment decision" });
  if (status !== "APPROVED" && !String(reason || "").trim())
    return res.status(400).json({ error: "Reason is required" });
  const before = (
    await q("SELECT * FROM face_enrollments WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before)
    return res.status(404).json({ error: "Face enrollment not found" });
  if (before.status !== "PENDING_ADMIN_APPROVAL")
    return res
      .status(409)
      .json({ error: "Only pending face enrollments can be reviewed" });
  const x = (
    await q(
      `UPDATE face_enrollments SET status=$1,decision_reason=$2,approved_by=$3,approved_at=CASE WHEN $1='APPROVED' THEN now() ELSE NULL END WHERE id=$4 AND status='PENDING_ADMIN_APPROVAL' RETURNING *`,
      [status, reason || null, req.user.id, before.id],
    )
  ).rows[0];
  if (!x)
    return res
      .status(409)
      .json({ error: "Enrollment decision changed; reload" });
  await audit(
    req,
    "FACE_ENROLLMENT_" + status,
    "face_enrollment",
    x.id,
    before,
    x,
  );
  await notifyFaceDecision(x.intern_id, status, reason);
  res.json(x);
});
// Persistent match failures: Admin retires an approved enrollment so the intern can enroll again.
r.post("/face-enrollments/:id/require-reenrollment", async (req, res) => {
  const reason = String(req.body.reason || "").trim();
  if (!reason) return res.status(400).json({ error: "Reason is required" });
  const before = (
    await q("SELECT * FROM face_enrollments WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before)
    return res.status(404).json({ error: "Face enrollment not found" });
  if (before.status !== "APPROVED")
    return res
      .status(409)
      .json({ error: "Only an approved enrollment can require re-enrollment" });
  const x = (
    await q(
      "UPDATE face_enrollments SET status='REENROLLMENT_REQUIRED',decision_reason=$2,approved_by=$3,approved_at=NULL WHERE id=$1 AND status='APPROVED' RETURNING *",
      [before.id, reason, req.user.id],
    )
  ).rows[0];
  if (!x) return res.status(409).json({ error: "Enrollment changed; reload" });
  await audit(
    req,
    "FACE_ENROLLMENT_REENROLLMENT_REQUIRED",
    "face_enrollment",
    x.id,
    before,
    x,
  );
  await notifyFaceDecision(x.intern_id, "REENROLLMENT_REQUIRED", reason);
  res.json(x);
});
r.get("/attendance-exceptions", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT ae.*,ip.full_name,ip.roll_number,b.name batch_name FROM attendance_exceptions ae JOIN intern_profiles ip ON ip.id=ae.intern_id JOIN users visible_user ON visible_user.id=ip.user_id AND visible_user.status<>'DELETED' LEFT JOIN batch_allocations ba ON ba.intern_id=ip.id AND ae.day BETWEEN ba.intern_start AND ba.intern_end LEFT JOIN batches b ON b.id=ba.batch_id ORDER BY CASE WHEN ae.status IN('DETECTED','REQUESTED') THEN 0 ELSE 1 END,ae.created_at DESC`,
      )
    ).rows,
  ),
);
r.get("/attendance-records", async (req, res) => {
  const {
    batchId = null,
    from = null,
    to = null,
    status = null,
    domainId = null,
    groupId = null,
  } = req.query;
  res.json(
    (
      await q(
        `SELECT ac.day,ac.status,ac.check_in,ac.check_out,ac.working_minutes,ac.source,ac.correction_reason,ac.holiday_name,ac.intern_id,ip.full_name,ip.roll_number,b.name batch_name,d.name domain_name,g.name group_name
     FROM attendance_calendar ac JOIN intern_profiles ip ON ip.id=ac.intern_id JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED' JOIN batches b ON b.id=ac.batch_id
     LEFT JOIN domains d ON d.id=ip.final_domain_id LEFT JOIN group_members gm ON gm.intern_id=ip.id AND gm.active LEFT JOIN groups g ON g.id=gm.group_id
     WHERE ($1::uuid IS NULL OR ac.batch_id=$1) AND ($2::date IS NULL OR ac.day>=$2) AND ($3::date IS NULL OR ac.day<=$3) AND ($4::text IS NULL OR ac.status=$4)
       AND ($5::uuid IS NULL OR ip.final_domain_id=$5) AND ($6::uuid IS NULL OR gm.group_id=$6)
     ORDER BY ac.day DESC,ip.full_name LIMIT 1000`,
        [
          batchId || null,
          from || null,
          to || null,
          status || null,
          domainId || null,
          groupId || null,
        ],
      )
    ).rows,
  );
});
r.get("/daily-reports", async (req, res) => {
  const { batchId = null, day = null, internId = null } = req.query;
  res.json(
    (
      await q(
        `SELECT dr.*,ip.full_name,ip.roll_number,b.name batch_name,g.name group_name FROM daily_reports dr JOIN intern_profiles ip ON ip.id=dr.intern_id JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED'
     LEFT JOIN LATERAL(SELECT x.batch_id FROM batch_allocations x WHERE x.intern_id=ip.id AND dr.day BETWEEN x.intern_start AND x.intern_end LIMIT 1) ba ON true LEFT JOIN batches b ON b.id=ba.batch_id
     LEFT JOIN group_members gm ON gm.intern_id=ip.id AND gm.active LEFT JOIN groups g ON g.id=gm.group_id
     WHERE ($1::uuid IS NULL OR ba.batch_id=$1) AND ($2::date IS NULL OR dr.day=$2) AND ($3::uuid IS NULL OR dr.intern_id=$3) ORDER BY dr.day DESC,ip.full_name LIMIT 500`,
        [batchId || null, day || null, internId || null],
      )
    ).rows,
  );
});
r.post("/attendance-exceptions/:id/decision", async (req, res) => {
  res.json(
    await decideAttendanceException(
      req,
      req.params.id,
      req.body.status,
      req.body.reason,
    ),
  );
});
r.get("/proofs/:id/file", async (req, res) => {
  const p = (
    await q("SELECT id,file_path FROM college_proofs WHERE id=$1", [
      req.params.id,
    ])
  ).rows[0];
  if (!p?.file_path)
    return res.status(404).json({ error: "Proof file not found" });
  await audit(req, "PROOF_FILE_VIEWED", "college_proof", p.id, null, {
    index: Number(req.query.index) || 0,
  });
  sendProofFile(res, p, req.query.index);
});
r.get("/proofs/:id/history", async (req, res) => {
  const p = (
    await q("SELECT intern_id FROM college_proofs WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!p) return res.status(404).json({ error: "Proof not found" });
  res.json(
    (
      await q(
        `SELECT cp.id,cp.version,cp.status,cp.reason,cp.reference_number,cp.created_at,cp.file_names,pv.outcome,pv.reason decision_reason,pv.created_at decided_at
     FROM college_proofs cp LEFT JOIN LATERAL(SELECT * FROM proof_verifications x WHERE x.proof_id=cp.id ORDER BY x.created_at DESC LIMIT 1) pv ON true
     WHERE cp.intern_id=$1 ORDER BY cp.created_at DESC`,
        [p.intern_id],
      )
    ).rows,
  );
});

r.delete("/interns/:userId", async (req, res, next) => {
  try {
    const student = (
      await q(
        "SELECT u.id,u.email,u.status,ip.full_name FROM users u JOIN intern_profiles ip ON ip.user_id=u.id WHERE u.id=$1 AND u.role='INTERN'",
        [req.params.userId],
      )
    ).rows[0];
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.status === "DELETED")
      return res.status(409).json({ error: "Student record already removed" });
    await q(
      "UPDATE users SET status='DELETED',is_active=false,updated_at=now() WHERE id=$1 AND role='INTERN'",
      [req.params.userId],
    );
    await audit(req, "STUDENT_RECORD_REMOVED", "user", student.id, student, {
      status: "DELETED",
      is_active: false,
    });
    res.json({
      message:
        "Student removed from active records. Historical records are retained for audit.",
    });
  } catch (error) {
    next(error);
  }
});
r.get("/interns", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT ip.*,u.email,u.status account_status,u.is_active,c.name college_name,b.id batch_id,b.name batch_name,ba.id allocation_id,d.name final_domain FROM intern_profiles ip JOIN users u ON u.id=ip.user_id LEFT JOIN colleges c ON c.id=ip.college_id LEFT JOIN batch_allocations ba ON ba.intern_id=ip.id LEFT JOIN batches b ON b.id=ba.batch_id LEFT JOIN domains d ON d.id=ip.final_domain_id WHERE u.status<>'DELETED' ORDER BY ip.created_at DESC`,
      )
    ).rows,
  ),
);
r.post("/mentors", async (req, res) => {
  const b = req.body || {},
    fullName = String(b.fullName || "").trim(),
    email = String(b.email || "")
      .trim()
      .toLowerCase(),
    password = String(b.password || "");
  const expertise = Array.isArray(b.expertise)
    ? b.expertise.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const maxGroups = Number(b.maxGroups),
    maxInterns = Number(b.maxInterns);
  if (
    fullName.length < 2 ||
    fullName.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 12 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password) ||
    !Number.isInteger(maxGroups) ||
    maxGroups < 1 ||
    maxGroups > 100 ||
    !Number.isInteger(maxInterns) ||
    maxInterns < 1 ||
    maxInterns > 1000 ||
    expertise.length > 20 ||
    expertise.some((x) => x.length > 100)
  )
    return res
      .status(400)
      .json({
        error:
          "Provide name, valid email, strong password (12+ characters, upper/lowercase, number, symbol), valid capacities and expertise",
      });
  if ((await q("SELECT 1 FROM users WHERE lower(email)=$1", [email])).rowCount)
    return res.status(409).json({ error: "Email is already registered" });
  const passwordHash = await bcrypt.hash(password, 12);
  let created;
  try {
    created = await tx(async (c) => {
      const u = (
        await c.query(
          "INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,$2,'MENTOR','ACTIVE',true) RETURNING id,email",
          [email, passwordHash],
        )
      ).rows[0];
      const m = (
        await c.query(
          "INSERT INTO mentors(user_id,full_name,expertise,max_groups,max_interns,active) VALUES($1,$2,$3::jsonb,$4,$5,true) RETURNING id,full_name,expertise,max_groups,max_interns",
          [u.id, fullName, JSON.stringify(expertise), maxGroups, maxInterns],
        )
      ).rows[0];
      return { ...m, user_id: u.id, email: u.email };
    });
  } catch (e) {
    if (e.code === "23505")
      return res.status(409).json({ error: "Email is already registered" });
    throw e;
  }
  await audit(req, "MENTOR_CREATED", "mentor", created.id, null, {
    user_id: created.user_id,
    email: created.email,
    full_name: created.full_name,
    max_groups: created.max_groups,
    max_interns: created.max_interns,
  });
  res.status(201).json(created);
});
r.get("/mentors", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT m.*,u.email,COUNT(DISTINCT ma.group_id) FILTER(WHERE ma.active)::int assigned_groups,COUNT(DISTINCT gm.intern_id) FILTER(WHERE ma.active AND gm.active)::int assigned_interns FROM mentors m JOIN users u ON u.id=m.user_id LEFT JOIN mentor_assignments ma ON ma.mentor_id=m.id LEFT JOIN group_members gm ON gm.group_id=ma.group_id WHERE m.active GROUP BY m.id,u.email ORDER BY m.full_name`,
      )
    ).rows,
  ),
);
r.get("/groups/:id/manage", async (req, res) => {
  const g = (
    await q(
      `SELECT g.*,COUNT(gm.intern_id) FILTER(WHERE gm.active)::int member_count FROM groups g LEFT JOIN group_members gm ON gm.group_id=g.id WHERE g.id=$1 GROUP BY g.id`,
      [req.params.id],
    )
  ).rows[0];
  if (!g) return res.status(404).json({ error: "Group not found" });
  g.members = (
    await q(
      `SELECT ip.id intern_id,ip.full_name,ip.final_domain_id,d.name domain_name FROM group_members gm JOIN intern_profiles ip ON ip.id=gm.intern_id LEFT JOIN domains d ON d.id=gm.domain_id WHERE gm.group_id=$1 AND gm.active ORDER BY ip.full_name`,
      [g.id],
    )
  ).rows;
  g.mentor_assignments = (
    await q(
      `SELECT ma.*,m.full_name mentor_name,m.expertise,m.max_groups,m.max_interns FROM mentor_assignments ma JOIN mentors m ON m.id=ma.mentor_id WHERE ma.group_id=$1 AND ma.active ORDER BY ma.is_lead DESC,m.full_name`,
      [g.id],
    )
  ).rows;
  res.json(g);
});
r.patch("/groups/:id/members", async (req, res) => {
  const g = (await q("SELECT * FROM groups WHERE id=$1", [req.params.id]))
    .rows[0];
  if (!g) return res.status(404).json({ error: "Group not found" });
  const ids = [...new Set(req.body.internIds || [])];
  if (!ids.length)
    return res
      .status(400)
      .json({ error: "A group must contain at least one intern" });
  const people = (
    await q(
      `SELECT ip.id,ip.final_domain_id,d.name domain_name FROM intern_profiles ip JOIN batch_allocations ba ON ba.intern_id=ip.id LEFT JOIN domains d ON d.id=ip.final_domain_id WHERE ip.id=ANY($1::uuid[]) AND ba.batch_id=$2`,
      [ids, g.batch_id],
    )
  ).rows;
  if (people.length !== ids.length)
    return res
      .status(400)
      .json({ error: "Every selected intern must belong to the same batch" });
  if (people.some((x) => !x.final_domain_id))
    return res
      .status(409)
      .json({ error: "Every member must have a confirmed domain" });
  if (
    g.type === "SINGLE_DOMAIN" &&
    new Set(people.map((x) => x.final_domain_id)).size > 1
  )
    return res
      .status(409)
      .json({ error: "Single-domain groups cannot mix confirmed domains" });
  const conflicts = (
    await q(
      `SELECT gm.intern_id,g.name FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.intern_id=ANY($1::uuid[]) AND gm.active AND g.batch_id=$2 AND g.id<>$3 AND g.status='ACTIVE'`,
      [ids, g.batch_id, g.id],
    )
  ).rows;
  if (conflicts.length)
    return res.status(409).json({
      error:
        "One or more interns already belong to another active group in this batch",
    });
  await tx(async (c) => {
    await c.query(
      "INSERT INTO group_history(group_id,batch_id,actor_id,action,details) VALUES($1,$2,$3,'MEMBERS_CHANGED',$4)",
      [g.id, g.batch_id, req.user.id, JSON.stringify({ internIds: ids })],
    );
    await c.query("UPDATE group_members SET active=false WHERE group_id=$1", [
      g.id,
    ]);
    for (const p of people)
      await c.query(
        `INSERT INTO group_members(group_id,intern_id,domain_id,active) VALUES($1,$2,$3,true) ON CONFLICT(group_id,intern_id) DO UPDATE SET domain_id=EXCLUDED.domain_id,active=true`,
        [g.id, p.id, p.final_domain_id],
      );
  });
  await audit(req, "GROUP_MEMBERS_REBALANCED", "group", g.id, null, {
    internIds: ids,
  });
  res.json({ ok: true, count: ids.length });
});
r.post("/groups/:id/mentor", async (req, res) => {
  const { mentorId, domainId, isLead = true } = req.body;
  const g = (await q("SELECT * FROM groups WHERE id=$1", [req.params.id]))
      .rows[0],
    m = (
      await q("SELECT * FROM mentors WHERE id=$1 AND active=true", [mentorId])
    ).rows[0];
  if (!g || !m)
    return res.status(404).json({ error: "Group or mentor not found" });
  const load = (
    await q(
      `SELECT COUNT(DISTINCT ma.group_id)::int groups,COUNT(DISTINCT gm.intern_id)::int interns FROM mentor_assignments ma LEFT JOIN group_members gm ON gm.group_id=ma.group_id AND gm.active WHERE ma.mentor_id=$1 AND ma.active AND ma.group_id<>$2`,
      [m.id, g.id],
    )
  ).rows[0];
  const groupCount = Number(
    (
      await q(
        "SELECT count(*) n FROM group_members WHERE group_id=$1 AND active",
        [g.id],
      )
    ).rows[0].n,
  );
  if (Number(load.groups) >= Number(m.max_groups))
    return res.status(409).json({
      error:
        m.full_name +
        " has reached the maximum group capacity (" +
        m.max_groups +
        ")",
    });
  if (Number(load.interns) + groupCount > Number(m.max_interns))
    return res.status(409).json({
      error:
        m.full_name +
        " would exceed intern capacity (" +
        (Number(load.interns) + groupCount) +
        "/" +
        m.max_interns +
        ")",
    });
  if (
    domainId &&
    Array.isArray(m.expertise) &&
    m.expertise.length &&
    !m.expertise.includes(domainId)
  ) {
    const d = (await q("SELECT name FROM domains WHERE id=$1", [domainId]))
      .rows[0];
    if (
      !m.expertise.some(
        (x) => String(x).toLowerCase() === String(d?.name || "").toLowerCase(),
      )
    )
      return res
        .status(409)
        .json({ error: "Mentor expertise does not match the selected domain" });
  }
  const x = await tx(async (c) => {
    if (isLead) {
      await c.query(
        "UPDATE mentor_assignments SET active=false WHERE group_id=$1 AND is_lead=true",
        [g.id],
      );
      await c.query("UPDATE groups SET lead_mentor_id=$1 WHERE id=$2", [
        m.id,
        g.id,
      ]);
    }
    return (
      await c.query(
        `INSERT INTO mentor_assignments(mentor_id,group_id,domain_id,is_lead,active) VALUES($1,$2,$3,$4,true) RETURNING *`,
        [m.id, g.id, domainId || null, !!isLead],
      )
    ).rows[0];
  });
  await audit(req, "MENTOR_ASSIGNED", "group", g.id, null, {
    mentorId: m.id,
    domainId: domainId || null,
    isLead: !!isLead,
  });
  await notifyMentorAssigned(m.id, g.id);
  res.status(201).json(x);
});
r.post("/groups/:id/mentor/reassign", async (req, res) => {
  const { mentorId, domainId, reason } = req.body;
  if (!String(reason || "").trim())
    return res.status(400).json({ error: "Reassignment reason is required" });
  const old = (
    await q(
      "SELECT * FROM mentor_assignments WHERE group_id=$1 AND is_lead=true AND active=true",
      [req.params.id],
    )
  ).rows[0];
  if (old)
    await q("UPDATE mentor_assignments SET active=false WHERE id=$1", [old.id]);
  req.body.isLead = true;
  const g = (await q("SELECT * FROM groups WHERE id=$1", [req.params.id]))
      .rows[0],
    m = (
      await q("SELECT * FROM mentors WHERE id=$1 AND active=true", [mentorId])
    ).rows[0];
  if (!g || !m)
    return res.status(404).json({ error: "Group or mentor not found" });
  const load = (
      await q(
        `SELECT COUNT(DISTINCT ma.group_id)::int groups,COUNT(DISTINCT gm.intern_id)::int interns FROM mentor_assignments ma LEFT JOIN group_members gm ON gm.group_id=ma.group_id AND gm.active WHERE ma.mentor_id=$1 AND ma.active`,
        [m.id],
      )
    ).rows[0],
    gc = Number(
      (
        await q(
          "SELECT count(*) n FROM group_members WHERE group_id=$1 AND active",
          [g.id],
        )
      ).rows[0].n,
    );
  if (
    Number(load.groups) >= Number(m.max_groups) ||
    Number(load.interns) + gc > Number(m.max_interns)
  ) {
    if (old)
      await q("UPDATE mentor_assignments SET active=true WHERE id=$1", [
        old.id,
      ]);
    return res
      .status(409)
      .json({ error: "Selected mentor does not have enough capacity" });
  }
  const x = (
    await q(
      "INSERT INTO mentor_assignments(mentor_id,group_id,domain_id,is_lead,active) VALUES($1,$2,$3,true,true) RETURNING *",
      [m.id, g.id, domainId || null],
    )
  ).rows[0];
  await q("UPDATE groups SET lead_mentor_id=$1 WHERE id=$2", [m.id, g.id]);
  await audit(req, "MENTOR_REASSIGNED", "group", g.id, old, { ...x, reason });
  await notifyMentorAssigned(m.id, g.id);
  res.status(201).json(x);
});
r.post("/questions/ai-generate", async (req, res) => {
  try {
    const {
      domainId,
      topic,
      difficulty = "MEDIUM",
      count = 5,
      types = ["MCQ"],
      marks = 1,
    } = req.body;
    const n = Math.max(1, Math.min(20, Number(count) || 5));
    const domain = domainId
      ? (
          await q("SELECT name FROM domains WHERE id=$1 AND active=true", [
            domainId,
          ])
        ).rows[0]
      : null;
    if (domainId && !domain)
      return res.status(400).json({ error: "Select an active domain" });
    const allowed = [
      "MCQ",
      "MULTI_SELECT",
      "TRUE_FALSE",
      "SHORT_TEXT",
      "DESCRIPTIVE",
    ];
    const selected = (Array.isArray(types) ? types : [])
      .map((x) => String(x).toUpperCase())
      .filter((x) => allowed.includes(x));
    if (!selected.length)
      return res
        .status(400)
        .json({ error: "Select at least one valid question type" });
    const generated = await generateQuestions({
      domain: domain?.name || "Common",
      topic: String(topic || "").trim(),
      difficulty: String(difficulty).toUpperCase(),
      count: n,
      types: selected,
      marks: Number(marks) || 1,
    });
    const saved = [];
    for (const g of generated) {
      const type = allowed.includes(String(g.type || "").toUpperCase())
        ? String(g.type).toUpperCase()
        : selected[0];
      const x = (
        await q(
          `INSERT INTO question_bank(domain_id,topic,difficulty,type,question,options,correct_answer,marking_guide,marks,explanation,status,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'DRAFT','AI') RETURNING *`,
          [
            domainId || null,
            String(topic || "").trim() || null,
            String(difficulty).toUpperCase(),
            type,
            String(g.question || "").trim(),
            g.options || null,
            g.correctAnswer ?? null,
            g.markingGuide || null,
            Number(g.marks || marks || 1),
            g.explanation || null,
          ],
        )
      ).rows[0];
      if (x.question) saved.push(x);
    }
    await audit(
      req,
      "AI_QUESTIONS_GENERATED",
      "question_bank_batch",
      null,
      null,
      {
        count: saved.length,
        domainId: domainId || null,
        topic,
        difficulty,
        types: selected,
      },
    );
    res.status(201).json(saved);
  } catch (e) {
    res
      .status(e.status || 500)
      .json({ error: e.message || "AI generation failed" });
  }
});
r.post("/questions/:id/review", async (req, res) => {
  const { decision, reason, changes = {} } = req.body;
  if (!["APPROVE", "REJECT"].includes(decision))
    return res.status(400).json({ error: "Invalid review decision" });
  const before = (
    await q("SELECT * FROM question_bank WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before) return res.status(404).json({ error: "Question not found" });
  if (before.source !== "AI")
    return res.status(409).json({
      error: "Review workflow is only required for AI-generated questions",
    });
  if (before.status !== "DRAFT")
    return res
      .status(409)
      .json({ error: "Only draft AI questions can be reviewed" });
  if (decision === "REJECT" && !String(reason || "").trim())
    return res.status(400).json({ error: "Rejection reason is required" });
  let x;
  if (decision === "APPROVE") {
    x = (
      await q(
        `UPDATE question_bank SET domain_id=COALESCE($1,domain_id),topic=COALESCE($2,topic),difficulty=COALESCE($3,difficulty),type=COALESCE($4,type),question=COALESCE($5,question),options=COALESCE($6,options),correct_answer=COALESCE($7,correct_answer),marking_guide=COALESCE($8,marking_guide),marks=COALESCE($9,marks),explanation=COALESCE($10,explanation),status='ACTIVE' WHERE id=$11 AND source='AI' AND status='DRAFT' RETURNING *`,
        [
          changes.domainId || null,
          changes.topic || null,
          changes.difficulty || null,
          changes.type || null,
          changes.question || null,
          changes.options || null,
          changes.correctAnswer ?? null,
          changes.markingGuide || null,
          changes.marks || null,
          changes.explanation || null,
          req.params.id,
        ],
      )
    ).rows[0];
  } else {
    x = (
      await q(
        "UPDATE question_bank SET status='INACTIVE',explanation=CASE WHEN $2<>'' THEN COALESCE(explanation,'')||E'\\nAI review rejection: '||$2 ELSE explanation END WHERE id=$1 AND source='AI' AND status='DRAFT' RETURNING *",
        [req.params.id, String(reason || "").trim()],
      )
    ).rows[0];
  }
  if (!x)
    return res
      .status(409)
      .json({ error: "Question review state changed; reload and retry" });
  await audit(req, "AI_QUESTION_" + decision, "question_bank", x.id, before, {
    ...x,
    reviewReason: reason || null,
  });
  res.json(x);
});
r.post("/questions", async (req, res) => {
  const b = req.body;
  const type = String(b.type || "MCQ").toUpperCase(),
    difficulty = String(b.difficulty || "MEDIUM").toUpperCase(),
    status = String(b.status || "DRAFT").toUpperCase();
  if (!String(b.question || "").trim())
    return res.status(400).json({ error: "Question is required" });
  if (
    ![
      "MCQ",
      "MULTI_SELECT",
      "TRUE_FALSE",
      "SHORT_TEXT",
      "DESCRIPTIVE",
    ].includes(type)
  )
    return res.status(400).json({ error: "Invalid question type" });
  if (!["EASY", "MEDIUM", "HARD"].includes(difficulty))
    return res.status(400).json({ error: "Invalid difficulty" });
  if (!["DRAFT", "ACTIVE", "INACTIVE"].includes(status))
    return res.status(400).json({ error: "Invalid question status" });
  if (Number(b.marks) <= 0)
    return res.status(400).json({ error: "Marks must be greater than zero" });
  if (
    ["MCQ", "MULTI_SELECT"].includes(type) &&
    (!Array.isArray(b.options) || b.options.filter(Boolean).length < 2)
  )
    return res
      .status(400)
      .json({ error: "MCQ questions require at least two options" });
  if (
    ["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(type) &&
    (b.correctAnswer === undefined ||
      b.correctAnswer === null ||
      b.correctAnswer === "")
  )
    return res
      .status(400)
      .json({ error: "Correct answer is required for objective questions" });
  const x = (
    await q(
      `INSERT INTO question_bank(domain_id,topic,difficulty,type,question,options,correct_answer,marking_guide,marks,explanation,status,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        b.domainId || null,
        String(b.topic || "").trim() || null,
        difficulty,
        type,
        b.question.trim(),
        b.options || null,
        b.correctAnswer ?? null,
        b.markingGuide || null,
        Number(b.marks || 1),
        b.explanation || null,
        status,
        b.source || "MANUAL",
      ],
    )
  ).rows[0];
  await audit(req, "QUESTION_CREATE", "question_bank", x.id, null, x);
  res.status(201).json(x);
});
r.patch("/questions/:id", async (req, res) => {
  const before = (
    await q("SELECT * FROM question_bank WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before) return res.status(404).json({ error: "Question not found" });
  const b = { ...before, ...req.body };
  if (
    before.source === "AI" &&
    before.status === "DRAFT" &&
    String(b.status).toUpperCase() === "ACTIVE"
  )
    return res
      .status(409)
      .json({
        error: "AI questions require explicit Admin review before activation",
      });
  const x = (
    await q(
      `UPDATE question_bank SET domain_id=$1,topic=$2,difficulty=$3,type=$4,question=$5,options=$6,correct_answer=$7,marking_guide=$8,marks=$9,explanation=$10,status=$11 WHERE id=$12 RETURNING *`,
      [
        b.domainId ?? b.domain_id ?? null,
        b.topic || null,
        b.difficulty,
        b.type,
        b.question,
        b.options || null,
        b.correctAnswer ?? b.correct_answer ?? null,
        b.markingGuide ?? b.marking_guide ?? null,
        Number(b.marks || 1),
        b.explanation || null,
        b.status,
        req.params.id,
      ],
    )
  ).rows[0];
  await audit(req, "QUESTION_UPDATE", "question_bank", x.id, before, x);
  res.json(x);
});
r.post("/questions/:id/status", async (req, res) => {
  const status = String(req.body.status || "").toUpperCase();
  if (!["DRAFT", "ACTIVE", "INACTIVE"].includes(status))
    return res.status(400).json({ error: "Invalid status" });
  const before = (
    await q("SELECT * FROM question_bank WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before) return res.status(404).json({ error: "Question not found" });
  if (
    before.source === "AI" &&
    before.status === "DRAFT" &&
    status === "ACTIVE"
  )
    return res
      .status(409)
      .json({
        error: "AI questions require explicit Admin review before activation",
      });
  const x = (
    await q("UPDATE question_bank SET status=$1 WHERE id=$2 RETURNING *", [
      status,
      req.params.id,
    ])
  ).rows[0];
  await audit(req, "QUESTION_STATUS", "question_bank", x.id, before, x);
  res.json(x);
});
r.get("/rubrics", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT r.*,COALESCE(json_agg(rc ORDER BY rc.name) FILTER(WHERE rc.id IS NOT NULL),'[]') criteria FROM rubrics r LEFT JOIN rubric_criteria rc ON rc.rubric_id=r.id GROUP BY r.id ORDER BY r.name`,
      )
    ).rows,
  ),
);
r.post("/rubrics", async (req, res) => {
  const { domainId, name, criteria = [] } = req.body;
  if (!String(name || "").trim() || !criteria.length)
    return res
      .status(400)
      .json({ error: "Rubric name and criteria are required" });
  const total = criteria.reduce((n, c) => n + Number(c.weight || 0), 0);
  if (Math.abs(total - 100) > 0.01)
    return res
      .status(400)
      .json({ error: "Rubric criterion weights must total 100%" });
  const x = await tx(async (c) => {
    const rb = (
      await c.query(
        "INSERT INTO rubrics(domain_id,name,active) VALUES($1,$2,true) RETURNING *",
        [domainId || null, name.trim()],
      )
    ).rows[0];
    for (const cr of criteria) {
      if (Number(cr.maxMarks) <= 0 || Number(cr.weight) <= 0)
        throw new Error(
          "Each criterion requires positive max marks and weight",
        );
      await c.query(
        "INSERT INTO rubric_criteria(rubric_id,name,max_marks,weight,kind) VALUES($1,$2,$3,$4,$5)",
        [
          rb.id,
          cr.name,
          Number(cr.maxMarks),
          Number(cr.weight),
          cr.kind || "DOMAIN",
        ],
      );
    }
    return rb;
  });
  await audit(req, "RUBRIC_CREATE", "rubric", x.id, null, { ...x, criteria });
  res.status(201).json(x);
});
r.get("/assessments/:id", async (req, res) => {
  const x = (
    await q(
      `SELECT a.*,b.name batch_name FROM assessments a JOIN batches b ON b.id=a.batch_id WHERE a.id=$1`,
      [req.params.id],
    )
  ).rows[0];
  if (!x) return res.status(404).json({ error: "Assessment not found" });
  x.sections = (
    await q(
      "SELECT * FROM assessment_sections WHERE assessment_id=$1 ORDER BY id",
      [x.id],
    )
  ).rows;
  res.json(x);
});
r.post("/assessments", async (req, res) => {
  const b = req.body;
  if (!b.batchId || !String(b.name || "").trim())
    return res
      .status(400)
      .json({ error: "Batch and assessment name are required" });
  if (Number(b.durationMinutes) < 1)
    return res
      .status(400)
      .json({ error: "Duration must be at least 1 minute" });
  if (
    b.windowStart &&
    b.windowEnd &&
    new Date(b.windowEnd) <= new Date(b.windowStart)
  )
    return res
      .status(400)
      .json({ error: "Assessment end must be after start" });
  if (
    !Number.isInteger(Number(b.attemptCount ?? 1)) ||
    Number(b.attemptCount ?? 1) < 1
  )
    return res
      .status(400)
      .json({ error: "Attempt count must be a positive integer" });
  if (
    (b.windowStart && Number.isNaN(Date.parse(b.windowStart))) ||
    (b.windowEnd && Number.isNaN(Date.parse(b.windowEnd)))
  )
    return res.status(400).json({ error: "Invalid assessment window date" });
  if (
    !["DRAFT", "PUBLISHED", "ACTIVE", "CLOSED"].includes(
      String(b.status || "DRAFT").toUpperCase(),
    )
  )
    return res.status(400).json({ error: "Invalid assessment status" });
  const sections = Array.isArray(b.sections) ? b.sections : [];
  if (!sections.length)
    return res
      .status(400)
      .json({ error: "Add at least one assessment section" });
  if (
    sections.some(
      (section) =>
        !Array.isArray(section.questionIds) ||
        !section.questionIds.length ||
        !Number.isFinite(Number(section.passScore ?? 50)) ||
        Number(section.passScore ?? 50) < 0 ||
        Number(section.passScore ?? 50) > 100,
    )
  )
    return res
      .status(400)
      .json({
        error: "Each section requires questions and a pass score from 0 to 100",
      });
  if (
    sections.some(
      (section) =>
        new Set(section.questionIds).size !== section.questionIds.length,
    )
  )
    return res
      .status(400)
      .json({ error: "Duplicate questions within a section are not allowed" });
  const allIds = sections.flatMap((s) => s.questionIds || []);
  if (!allIds.length)
    return res.status(400).json({ error: "Select at least one question" });
  const valid = (
    await q(
      "SELECT id FROM question_bank WHERE id=ANY($1::uuid[]) AND status='ACTIVE'",
      [allIds],
    )
  ).rows.map((x) => x.id);
  if (valid.length !== new Set(allIds).size)
    return res
      .status(400)
      .json({ error: "Every selected question must be active" });
  const x = await tx(async (c) => {
    const assessment = (
      await c.query(
        `INSERT INTO assessments(batch_id,name,window_start,window_end,duration_minutes,attempt_count,randomize,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          b.batchId,
          b.name.trim(),
          b.windowStart || null,
          b.windowEnd || null,
          Number(b.durationMinutes || 60),
          Number(b.attemptCount || 1),
          b.randomize !== false,
          b.status || "DRAFT",
        ],
      )
    ).rows[0];
    for (const s of sections)
      await c.query(
        "INSERT INTO assessment_sections(assessment_id,domain_id,name,pass_score,question_ids,rubric_id) VALUES($1,$2,$3,$4,$5,$6)",
        [
          assessment.id,
          s.domainId || null,
          s.name || "Assessment Section",
          Number(s.passScore || 50),
          JSON.stringify(s.questionIds || []),
          s.rubricId || null,
        ],
      );
    return assessment;
  });
  await audit(req, "ASSESSMENT_CREATE", "assessment", x.id, null, {
    ...x,
    sections,
  });
  res.status(201).json(x);
});
r.patch("/assessments/:id/status", async (req, res) => {
  const status = String(req.body.status || "").toUpperCase();
  if (!["DRAFT", "PUBLISHED", "ACTIVE", "CLOSED"].includes(status))
    return res.status(400).json({ error: "Invalid assessment status" });
  const before = (
    await q("SELECT * FROM assessments WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before) return res.status(404).json({ error: "Assessment not found" });
  const x = (
    await q("UPDATE assessments SET status=$1 WHERE id=$2 RETURNING *", [
      status,
      req.params.id,
    ])
  ).rows[0];
  await audit(req, "ASSESSMENT_STATUS", "assessment", x.id, before, x);
  res.json(x);
});
r.get("/assessment-submissions", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT aa.id attempt_id,aa.status,aa.total_score,aa.started_at,aa.submitted_at,a.name assessment_name,ip.full_name,COUNT(ans.id) FILTER(WHERE qb.type IN ('SHORT_TEXT','DESCRIPTIVE') AND ans.manual_score IS NULL) pending_manual FROM assessment_attempts aa JOIN assessments a ON a.id=aa.assessment_id JOIN intern_profiles ip ON ip.id=aa.intern_id LEFT JOIN assessment_answers ans ON ans.attempt_id=aa.id LEFT JOIN question_bank qb ON qb.id=ans.question_id GROUP BY aa.id,a.name,ip.full_name ORDER BY aa.submitted_at DESC NULLS LAST`,
      )
    ).rows,
  ),
);
r.get("/assessment-submissions/:attemptId", async (req, res) => {
  const at = (
    await q(
      `SELECT aa.*,a.name assessment_name,ip.full_name FROM assessment_attempts aa JOIN assessments a ON a.id=aa.assessment_id JOIN intern_profiles ip ON ip.id=aa.intern_id WHERE aa.id=$1`,
      [req.params.attemptId],
    )
  ).rows[0];
  if (!at) return res.status(404).json({ error: "Attempt not found" });
  at.answers = (
    await q(
      `SELECT ans.*,qb.question,qb.type,qb.marks,qb.marking_guide,qb.correct_answer FROM assessment_answers ans JOIN question_bank qb ON qb.id=ans.question_id WHERE ans.attempt_id=$1`,
      [at.id],
    )
  ).rows;
  res.json(at);
});
r.post("/assessment-answers/:answerId/evaluate", async (req, res) => {
  const { score, feedback } = req.body;
  const before = (
    await q(
      `SELECT ans.*,qb.marks,qb.type FROM assessment_answers ans JOIN question_bank qb ON qb.id=ans.question_id WHERE ans.id=$1`,
      [req.params.answerId],
    )
  ).rows[0];
  if (!before) return res.status(404).json({ error: "Answer not found" });
  if (!["SHORT_TEXT", "DESCRIPTIVE"].includes(before.type))
    return res
      .status(409)
      .json({ error: "Only written answers require manual evaluation" });
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0 || n > Number(before.marks))
    return res
      .status(400)
      .json({ error: "Score must be between 0 and " + before.marks });
  const x = (
    await q(
      "UPDATE assessment_answers SET manual_score=$1,feedback=$2,status='EVALUATED',evaluator_id=$3 WHERE id=$4 RETURNING *",
      [n, feedback || null, req.user.id, req.params.answerId],
    )
  ).rows[0];
  await q(
    `UPDATE assessment_attempts aa SET total_score=(SELECT COALESCE(SUM(COALESCE(manual_score,auto_score,0)),0) FROM assessment_answers WHERE attempt_id=aa.id),status=CASE WHEN NOT EXISTS(SELECT 1 FROM assessment_answers ans JOIN question_bank qb ON qb.id=ans.question_id WHERE ans.attempt_id=aa.id AND qb.type IN ('SHORT_TEXT','DESCRIPTIVE') AND ans.manual_score IS NULL) THEN 'EVALUATED' ELSE aa.status END WHERE aa.id=$1`,
    [x.attempt_id],
  );
  await audit(
    req,
    "ASSESSMENT_ANSWER_EVALUATED",
    "assessment_answer",
    x.id,
    before,
    x,
  );
  res.json(x);
});
r.get("/group-proposals/:batchId", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT g.*,d.name domain_name,COUNT(gm.intern_id)::int member_count,COALESCE(json_agg(json_build_object('internId',ip.id,'name',ip.full_name,'domainId',gm.domain_id) ORDER BY ip.full_name) FILTER(WHERE ip.id IS NOT NULL),'[]') members FROM groups g LEFT JOIN group_members gm ON gm.group_id=g.id AND gm.active LEFT JOIN intern_profiles ip ON ip.id=gm.intern_id LEFT JOIN domains d ON d.id=gm.domain_id WHERE g.batch_id=$1 AND g.status='SYSTEM_DRAFT' GROUP BY g.id,d.name ORDER BY g.created_at DESC`,
        [req.params.batchId],
      )
    ).rows,
  ),
);
r.post("/group-proposals/:batchId/generate", async (req, res) => {
  const batch = (
    await q("SELECT * FROM batches WHERE id=$1", [req.params.batchId])
  ).rows[0];
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  const size = Math.max(
    2,
    Math.min(20, Number(req.body.groupSize || batch.group_size || 5)),
  );
  const composition =
    req.body.composition || batch.group_composition || "SINGLE_DOMAIN";
  if (!["SINGLE_DOMAIN", "CROSS_FUNCTIONAL"].includes(composition))
    return res.status(400).json({ error: "Invalid group composition" });
  const students = (
    await q(
      `SELECT ip.id,ip.full_name,ip.final_domain_id,d.name domain_name,COALESCE(bd.capacity,d.default_capacity,25) domain_capacity,COALESCE(sc.score,0) score FROM batch_allocations ba JOIN intern_profiles ip ON ip.id=ba.intern_id JOIN domains d ON d.id=ip.final_domain_id LEFT JOIN batch_domains bd ON bd.batch_id=ba.batch_id AND bd.domain_id=ip.final_domain_id JOIN users u ON u.id=ip.user_id AND u.is_active AND u.status<>'DELETED' LEFT JOIN LATERAL(SELECT max(aa.total_score) score FROM assessment_attempts aa JOIN assessments a ON a.id=aa.assessment_id WHERE aa.intern_id=ip.id AND a.batch_id=$1) sc ON true WHERE ba.batch_id=$1 AND ip.final_domain_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM group_members gm JOIN groups gx ON gx.id=gm.group_id WHERE gm.intern_id=ip.id AND gm.active AND gx.batch_id=$1 AND gx.status='ACTIVE') AND NOT EXISTS(SELECT 1 FROM exit_records ex WHERE ex.intern_id=ip.id) ORDER BY d.name,sc.score DESC NULLS LAST,ip.full_name`,
      [batch.id],
    )
  ).rows;
  if (!students.length)
    return res.status(409).json({
      error: "No eligible interns with confirmed domains are available",
    });
  const by = {};
  for (const st of students) (by[st.final_domain_id] ??= []).push(st);
  const created = await tx(async (c) => {
    await c.query(
      "DELETE FROM groups WHERE batch_id=$1 AND status='SYSTEM_DRAFT'",
      [batch.id],
    );
    const out = [];
    for (const list of Object.values(by)) {
      const cap = Number(list[0].domain_capacity || 25);
      if (list.length > cap)
        throw Object.assign(
          new Error(
            list[0].domain_name +
              " exceeds configured batch/domain capacity (" +
              list.length +
              "/" +
              cap +
              ")",
          ),
          { status: 409 },
        );
    }
    // Lists are ranked by assessment score, so dealing in turn balances ability across teams.
    const deal = (ranked, count) => {
      const teams = Array.from({ length: count }, () => []);
      ranked.forEach((st, i) => teams[i % count].push(st));
      return teams;
    };
    const plans =
      composition === "CROSS_FUNCTIONAL"
        ? deal(
            Object.values(by).flat(),
            Math.max(1, Math.ceil(students.length / size)),
          ).map((members, i) => ({
            name: batch.name + " - Team " + (i + 1),
            type: "CROSS_FUNCTIONAL",
            members,
          }))
        : Object.values(by).flatMap((list) =>
            deal(list, Math.max(1, Math.ceil(list.length / size))).map(
              (members, i) => ({
                name: list[0].domain_name + " - Group " + (i + 1),
                type: "SINGLE_DOMAIN",
                members,
                domainName: list[0].domain_name,
              }),
            ),
          );
    for (const plan of plans) {
      const g = (
        await c.query(
          "INSERT INTO groups(batch_id,name,type,status) VALUES($1,$2,$3,'SYSTEM_DRAFT') RETURNING *",
          [batch.id, plan.name, plan.type],
        )
      ).rows[0];
      for (const st of plan.members)
        await c.query(
          "INSERT INTO group_members(group_id,intern_id,domain_id) VALUES($1,$2,$3)",
          [g.id, st.id, st.final_domain_id],
        );
      out.push({ ...g, domainName: plan.domainName, members: plan.members });
    }
    return out;
  });
  await audit(req, "GROUP_PROPOSALS_GENERATED", "batch", batch.id, null, {
    groupSize: size,
    composition,
    count: created.length,
  });
  res.status(201).json(created);
});
r.patch("/group-proposals/:groupId", async (req, res) => {
  const g = (
    await q("SELECT * FROM groups WHERE id=$1 AND status='SYSTEM_DRAFT'", [
      req.params.groupId,
    ])
  ).rows[0];
  if (!g) return res.status(404).json({ error: "Draft proposal not found" });
  const ids = [...new Set(req.body.internIds || [])];
  if (!ids.length)
    return res
      .status(400)
      .json({ error: "A group requires at least one intern" });
  await tx(async (c) => {
    await c.query("UPDATE groups SET name=COALESCE($2,name) WHERE id=$1", [
      g.id,
      req.body.name || null,
    ]);
    await c.query("DELETE FROM group_members WHERE group_id=$1", [g.id]);
    const domains = new Set();
    await c.query(
      "INSERT INTO group_history(group_id,batch_id,actor_id,action,details) VALUES($1,$2,$3,'PROPOSAL_EDITED',$4)",
      [g.id, g.batch_id, req.user.id, JSON.stringify({ internIds: ids })],
    );
    for (const id of ids) {
      const st = (
        await c.query(
          "SELECT ip.final_domain_id FROM intern_profiles ip JOIN batch_allocations ba ON ba.intern_id=ip.id AND ba.batch_id=$2 WHERE ip.id=$1",
          [id, g.batch_id],
        )
      ).rows[0];
      if (!st)
        throw Object.assign(
          new Error("Every group member must belong to this batch"),
          { status: 409 },
        );
      if (!st?.final_domain_id)
        throw Object.assign(
          new Error("Every group member must have a confirmed domain"),
          { status: 409 },
        );
      domains.add(st.final_domain_id);
      if (g.type === "SINGLE_DOMAIN" && domains.size > 1)
        throw Object.assign(
          new Error("Single-domain groups cannot mix confirmed domains"),
          { status: 409 },
        );
      await c.query(
        "INSERT INTO group_members(group_id,intern_id,domain_id) VALUES($1,$2,$3)",
        [g.id, id, st.final_domain_id],
      );
    }
  });
  await audit(req, "GROUP_PROPOSAL_EDIT", "group", g.id, null, {
    internIds: ids,
  });
  res.json({ ok: true });
});
r.post("/group-proposals/:groupId/approve", async (req, res) => {
  const before = (
    await q("SELECT * FROM groups WHERE id=$1 AND status='SYSTEM_DRAFT'", [
      req.params.groupId,
    ])
  ).rows[0];
  if (!before)
    return res
      .status(409)
      .json({ error: "Only system draft groups can be approved" });
  const x = (
    await q("UPDATE groups SET status='ACTIVE' WHERE id=$1 RETURNING *", [
      before.id,
    ])
  ).rows[0];
  await audit(req, "GROUP_PROPOSAL_APPROVED", "group", x.id, before, x);
  await q(
    "INSERT INTO group_history(group_id,batch_id,actor_id,action) VALUES($1,$2,$3,'APPROVED')",
    [x.id, x.batch_id, req.user.id],
  );
  await notifyGroup(
    x.id,
    "GROUP_ASSIGNED",
    "Project group assigned",
    "You have been added to " + x.name + ".",
    "/intern",
  );
  res.json(x);
});
r.post("/groups", async (req, res) => {
  const b = req.body;
  const g = (
    await q(
      "INSERT INTO groups(batch_id,name,type,status) VALUES($1,$2,$3,'SYSTEM_DRAFT') RETURNING *",
      [b.batchId, b.name, b.type || "SINGLE_DOMAIN"],
    )
  ).rows[0];
  await audit(req, "GROUP_CREATED", "group", g.id, null, g);
  for (const internId of b.internIds || [])
    await q(
      "INSERT INTO group_members(group_id,intern_id,domain_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [g.id, internId, b.domainId || null],
    );
  res.status(201).json(g);
});
r.post("/mentor-assignments", async (req, res) => {
  const b = req.body;
  const x = (
    await q(
      "INSERT INTO mentor_assignments(mentor_id,group_id,domain_id,is_lead) VALUES($1,$2,$3,$4) RETURNING *",
      [b.mentorId, b.groupId, b.domainId || null, b.isLead !== false],
    )
  ).rows[0];
  if (x.is_lead)
    await q("UPDATE groups SET lead_mentor_id=$1 WHERE id=$2", [
      b.mentorId,
      b.groupId,
    ]);
  await audit(req, "MENTOR_ASSIGNED", "group", b.groupId, null, x);
  await notifyMentorAssigned(b.mentorId, b.groupId);
  res.status(201).json(x);
});
r.post("/projects", async (req, res) => {
  const b = req.body;
  if (!String(b.title || "").trim())
    return res.status(400).json({ error: "Project title is required" });
  if (!Array.isArray(b.domainIds) || !b.domainIds.length)
    return res
      .status(400)
      .json({ error: "Select at least one project domain" });
  if (!Array.isArray(b.milestones) || !b.milestones.length)
    return res.status(400).json({ error: "Add at least one milestone" });
  if (!Array.isArray(b.deliverableTypes) || !b.deliverableTypes.length)
    return res.status(400).json({ error: "Add at least one deliverable type" });
  const x = (
    await q(
      "INSERT INTO projects(title,description,domain_ids,milestones,tools_methods,resources,duration_suitability,deliverable_types,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [
        b.title.trim(),
        b.description || null,
        JSON.stringify(b.domainIds),
        JSON.stringify(b.milestones),
        b.toolsMethods || null,
        b.resources || null,
        b.durationSuitability || null,
        JSON.stringify(b.deliverableTypes),
        b.status || "ACTIVE",
      ],
    )
  ).rows[0];
  await audit(req, "PROJECT_CREATE", "project", x.id, null, x);
  res.status(201).json(x);
});
r.patch("/projects/:id", async (req, res) => {
  const before = (
    await q("SELECT * FROM projects WHERE id=$1", [req.params.id])
  ).rows[0];
  if (!before) return res.status(404).json({ error: "Project not found" });
  const b = req.body,
    x = (
      await q(
        "UPDATE projects SET title=$1,description=$2,domain_ids=$3,milestones=$4,tools_methods=$5,resources=$6,duration_suitability=$7,deliverable_types=$8,status=$9 WHERE id=$10 RETURNING *",
        [
          b.title ?? before.title,
          b.description ?? before.description,
          JSON.stringify(b.domainIds ?? before.domain_ids),
          JSON.stringify(b.milestones ?? before.milestones),
          b.toolsMethods ?? before.tools_methods,
          b.resources ?? before.resources,
          b.durationSuitability ?? before.duration_suitability,
          JSON.stringify(b.deliverableTypes ?? before.deliverable_types),
          b.status ?? before.status,
          req.params.id,
        ],
      )
    ).rows[0];
  await audit(req, "PROJECT_UPDATE", "project", x.id, before, x);
  res.json(x);
});
r.get("/project-assignments", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT pa.*,p.title project_title,g.name group_name,g.batch_id FROM project_assignments pa JOIN projects p ON p.id=pa.project_id JOIN groups g ON g.id=pa.group_id ORDER BY p.title,g.name`,
      )
    ).rows,
  ),
);
r.post("/project-assignments", async (req, res) => {
  const b = req.body;
  const p = (
      await q("SELECT * FROM projects WHERE id=$1 AND status='ACTIVE'", [
        b.projectId,
      ])
    ).rows[0],
    g = (
      await q("SELECT * FROM groups WHERE id=$1 AND status='ACTIVE'", [
        b.groupId,
      ])
    ).rows[0];
  if (!p || !g)
    return res
      .status(404)
      .json({ error: "Active project and active group are required" });
  const domains = (
    await q(
      "SELECT DISTINCT domain_id FROM group_members WHERE group_id=$1 AND active",
      [g.id],
    )
  ).rows
    .map((x) => x.domain_id)
    .filter(Boolean);
  if (
    domains.length &&
    !domains.every((id) => (p.domain_ids || []).includes(id))
  )
    return res
      .status(409)
      .json({ error: "Project domains do not match the group domain" });
  await q(
    "UPDATE project_assignments SET status='REPLACED' WHERE group_id=$1 AND status='ASSIGNED'",
    [g.id],
  );
  const x = (
    await q(
      "INSERT INTO project_assignments(project_id,group_id,assigned_by,status) VALUES($1,$2,$3,'ASSIGNED') ON CONFLICT(project_id,group_id) DO UPDATE SET status='ASSIGNED',assigned_by=EXCLUDED.assigned_by RETURNING *",
      [p.id, g.id, req.user.id],
    )
  ).rows[0];
  await audit(req, "PROJECT_ASSIGNED", "group", g.id, null, {
    projectId: p.id,
  });
  res.status(201).json(x);
});
r.post("/tasks", async (req, res) => {
  const b = req.body;
  if (!b.batchId || !String(b.title || "").trim())
    return res.status(400).json({ error: "Batch and task title are required" });
  if (!b.releaseAt)
    return res
      .status(400)
      .json({ error: "Scheduled release date/time is required" });
  if (b.dueAt && new Date(b.dueAt) <= new Date(b.releaseAt))
    return res
      .status(400)
      .json({ error: "Due time must be after release time" });
  const allowed = [
      "TEXT",
      "LINK",
      "REPOSITORY",
      "DOCUMENT",
      "PRESENTATION",
      "VIDEO",
      "FILE",
    ],
    types = (b.submissionTypes || []).filter((x) => allowed.includes(x));
  if (!types.length)
    return res
      .status(400)
      .json({ error: "Select at least one submission type" });
  const release = new Date(b.releaseAt);
  if (
    Number.isNaN(release.getTime()) ||
    (b.dueAt && Number.isNaN(new Date(b.dueAt).getTime()))
  )
    return res
      .status(400)
      .json({ error: "Release and due dates must be valid" });
  if (
    !Number.isFinite(Number(b.marks ?? 100)) ||
    Number(b.marks ?? 100) <= 0 ||
    Number(b.marks ?? 100) > 1000
  )
    return res
      .status(400)
      .json({ error: "Task marks must be between 1 and 1000" });
  if (b.groupId) {
    const group = (
      await q("SELECT 1 FROM groups WHERE id=$1 AND batch_id=$2", [
        b.groupId,
        b.batchId,
      ])
    ).rowCount;
    if (!group)
      return res
        .status(400)
        .json({ error: "Selected group does not belong to the task batch" });
  }
  if (b.rubricId) {
    const rubric = (await q("SELECT 1 FROM rubrics WHERE id=$1", [b.rubricId]))
      .rowCount;
    if (!rubric)
      return res.status(400).json({ error: "Selected rubric does not exist" });
  }
  const x = (
    await q(
      `INSERT INTO weekly_tasks(batch_id,domain_id,group_id,title,description,expected_output,submission_types,resources,release_at,due_at,marks,rubric_id,status,release_weekday,release_time,release_timezone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'SCHEDULED',$13,$14,'Asia/Kolkata') RETURNING *`,
      [
        b.batchId,
        b.domainId || null,
        b.groupId || null,
        b.title.trim(),
        b.description || null,
        b.expectedOutput || null,
        JSON.stringify(types),
        b.resources || null,
        b.releaseAt,
        b.dueAt || null,
        b.marks || 100,
        b.rubricId || null,
        release.getDay(),
        String(b.releaseAt).slice(11, 16) || null,
      ],
    )
  ).rows[0];
  await audit(req, "TASK_SCHEDULED", "weekly_task", x.id, null, x);
  res.status(201).json(x);
});
r.get("/reviews", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT fr.*,g.name group_name FROM fortnight_reviews fr JOIN groups g ON g.id=fr.group_id ORDER BY fr.review_date DESC`,
      )
    ).rows,
  ),
);
r.get("/completions", async (req, res) =>
  res.json(
    (
      await q(
        `SELECT ip.id intern_id,ip.user_id,ip.full_name,d.name domain_name,fe.group_marks,fe.individual_marks,fe.mentor_feedback,ca.status completion_status,ca.reason,ex.type exit_type,ex.exit_date,c.id certificate_db_id,c.certificate_id,c.status certificate_status,c.mode certificate_mode FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.role='INTERN' AND u.status<>'DELETED' LEFT JOIN domains d ON d.id=ip.final_domain_id LEFT JOIN LATERAL (SELECT * FROM final_evaluations x WHERE x.intern_id=ip.id ORDER BY x.created_at DESC LIMIT 1) fe ON true LEFT JOIN LATERAL (SELECT * FROM completion_approvals x WHERE x.intern_id=ip.id ORDER BY x.approved_at DESC LIMIT 1) ca ON true LEFT JOIN LATERAL (SELECT type,exit_date FROM exit_records x WHERE x.intern_id=ip.id ORDER BY x.created_at DESC LIMIT 1) ex ON true LEFT JOIN certificates c ON c.intern_id=ip.id ORDER BY ip.full_name`,
      )
    ).rows,
  ),
);
r.post("/completions/:internId/exit", async (req, res) => {
  const { type, reason, exitDate } = req.body || {};
  if (!["WITHDRAWN", "TERMINATED"].includes(type))
    return res.status(400).json({ error: "Invalid exit type" });
  if (!String(reason || "").trim())
    return res.status(400).json({ error: "Exit reason is required" });
  if (
    exitDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(exitDate) ||
      Number.isNaN(Date.parse(exitDate)))
  )
    return res.status(400).json({ error: "Invalid exit date" });
  const p = (
    await q("SELECT user_id FROM intern_profiles WHERE id=$1", [
      req.params.internId,
    ])
  ).rows[0];
  if (!p) return res.status(404).json({ error: "Intern not found" });
  const certificate = (
    await q(
      "SELECT 1 FROM certificates WHERE intern_id=$1 AND status='ISSUED' LIMIT 1",
      [req.params.internId],
    )
  ).rowCount;
  if (certificate)
    return res
      .status(409)
      .json({ error: "Cannot record an exit after certificate issuance" });
  const existing = (
    await q(
      "SELECT 1 FROM exit_records WHERE intern_id=$1 AND type IN ('WITHDRAWN','TERMINATED') LIMIT 1",
      [req.params.internId],
    )
  ).rowCount;
  if (existing)
    return res.status(409).json({ error: "An exit has already been recorded" });
  const x = (
    await q(
      "INSERT INTO exit_records(intern_id,type,exit_date,reason,approved_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [
        req.params.internId,
        type,
        exitDate || new Date().toISOString().slice(0, 10),
        String(reason).trim(),
        req.user.id,
      ],
    )
  ).rows[0];
  await audit(req, "INTERN_" + type, "intern", req.params.internId, null, x);
  await notify(
    p.user_id,
    "INTERNSHIP_" + type,
    "Internship status updated",
    "Your internship status has been updated to " + type + ".",
    "/intern",
    "EXIT:" + x.id,
  );
  res.status(201).json(x);
});
r.get("/certificates/:id/file", async (req, res) => {
  const x = (
    await q("SELECT * FROM certificates WHERE id=$1 AND status='ISSUED'", [
      req.params.id,
    ])
  ).rows[0];
  if (!x?.file_path || !fs.existsSync(x.file_path))
    return res.status(404).json({ error: "Certificate file not found" });
  res.download(path.resolve(x.file_path), x.certificate_id + ".pdf");
});
r.get("/reports", async (req, res) => {
  const rows = (
    await q(
      `SELECT ip.id intern_id,ip.full_name,ip.roll_number,ip.program,ip.branch,c.name college_name,b.name batch_name,d.name domain_name,ba.intern_start,ba.intern_end,cp.reference_number allotment_reference,COALESCE(att.pct,0) attendance_percent,COALESCE(ts.avg_marks,0) task_avg,COALESCE(rv.avg_marks,0) review_avg,fe.group_marks,fe.individual_marks,fe.mentor_feedback,fe.recommendation,ca.status completion_status,ccr.id completion_report_id,ccr.status completion_report_status,cert.certificate_id FROM intern_profiles ip JOIN users visible_user ON visible_user.id=ip.user_id AND visible_user.status<>'DELETED' LEFT JOIN colleges c ON c.id=ip.college_id LEFT JOIN LATERAL(SELECT * FROM batch_allocations x WHERE x.intern_id=ip.id ORDER BY x.intern_start DESC LIMIT 1)ba ON true LEFT JOIN batches b ON b.id=ba.batch_id LEFT JOIN domains d ON d.id=ip.final_domain_id LEFT JOIN LATERAL(SELECT reference_number FROM college_proofs x WHERE x.intern_id=ip.id AND x.status='VERIFIED' ORDER BY x.created_at DESC LIMIT 1)cp ON true LEFT JOIN LATERAL(SELECT z.attendance_percent pct FROM attendance_summary z JOIN batch_allocations za ON za.id=z.allocation_id WHERE z.intern_id=ip.id ORDER BY za.intern_start DESC NULLS LAST LIMIT 1)att ON true LEFT JOIN LATERAL(SELECT round(avg(te.marks),1) avg_marks FROM task_submissions ts JOIN task_evaluations te ON te.submission_id=ts.id WHERE ts.intern_id=ip.id AND te.decision='APPROVED')ts ON true LEFT JOIN LATERAL(SELECT round(avg(rim.marks),1) avg_marks FROM review_individual_marks rim JOIN fortnight_reviews fr ON fr.id=rim.review_id WHERE rim.intern_id=ip.id AND fr.status='PUBLISHED')rv ON true LEFT JOIN LATERAL(SELECT * FROM final_evaluations x WHERE x.intern_id=ip.id ORDER BY x.created_at DESC LIMIT 1)fe ON true LEFT JOIN LATERAL(SELECT * FROM completion_approvals x WHERE x.intern_id=ip.id ORDER BY x.approved_at DESC LIMIT 1)ca ON true LEFT JOIN LATERAL(SELECT * FROM college_completion_reports x WHERE x.intern_id=ip.id ORDER BY x.created_at DESC LIMIT 1)ccr ON true LEFT JOIN LATERAL(SELECT * FROM certificates x WHERE x.intern_id=ip.id AND x.status='ISSUED' ORDER BY x.created_at DESC LIMIT 1)cert ON true ORDER BY ip.full_name`,
    )
  ).rows;
  res.json(rows);
});
r.post("/reports/:internId/completion", async (req, res) => {
  const x = (
    await q(
      `SELECT ip.id,ip.full_name,ip.roll_number,ip.program,ip.branch,c.name college_name,b.name batch_name,d.name domain_name,ba.intern_start,ba.intern_end,cp.reference_number allotment_reference,COALESCE(att.pct,0) attendance_percent,COALESCE(ts.avg_marks,0) task_avg,COALESCE(rv.avg_marks,0) review_avg,fe.group_marks,fe.individual_marks,fe.mentor_feedback,fe.recommendation,ca.status completion_status FROM intern_profiles ip JOIN users visible_user ON visible_user.id=ip.user_id AND visible_user.status<>'DELETED' LEFT JOIN colleges c ON c.id=ip.college_id LEFT JOIN LATERAL(SELECT * FROM batch_allocations z WHERE z.intern_id=ip.id ORDER BY z.intern_start DESC LIMIT 1)ba ON true LEFT JOIN batches b ON b.id=ba.batch_id LEFT JOIN domains d ON d.id=ip.final_domain_id LEFT JOIN LATERAL(SELECT reference_number FROM college_proofs z WHERE z.intern_id=ip.id AND z.status='VERIFIED' ORDER BY z.created_at DESC LIMIT 1)cp ON true LEFT JOIN LATERAL(SELECT z.attendance_percent pct FROM attendance_summary z JOIN batch_allocations za ON za.id=z.allocation_id WHERE z.intern_id=ip.id ORDER BY za.intern_start DESC NULLS LAST LIMIT 1)att ON true LEFT JOIN LATERAL(SELECT round(avg(te.marks),1) avg_marks FROM task_submissions ts JOIN task_evaluations te ON te.submission_id=ts.id WHERE ts.intern_id=ip.id AND te.decision='APPROVED')ts ON true LEFT JOIN LATERAL(SELECT round(avg(rim.marks),1) avg_marks FROM review_individual_marks rim JOIN fortnight_reviews fr ON fr.id=rim.review_id WHERE rim.intern_id=ip.id AND fr.status='PUBLISHED')rv ON true LEFT JOIN LATERAL(SELECT * FROM final_evaluations z WHERE z.intern_id=ip.id ORDER BY z.created_at DESC LIMIT 1)fe ON true LEFT JOIN LATERAL(SELECT * FROM completion_approvals z WHERE z.intern_id=ip.id ORDER BY z.approved_at DESC,z.id DESC LIMIT 1)ca ON true WHERE ip.id=$1`,
      [req.params.internId],
    )
  ).rows[0];
  if (!x) return res.status(404).json({ error: "Intern not found" });
  if (x.completion_status !== "APPROVED")
    return res
      .status(409)
      .json({
        error: "Completion approval required before generating college report",
      });
  const period =
      x.intern_start && x.intern_end
        ? String(x.intern_start).slice(0, 10) +
          " to " +
          String(x.intern_end).slice(0, 10)
        : "",
    file = await generateCompletionReport({
      internId: x.id,
      name: x.full_name,
      roll: x.roll_number,
      college: x.college_name,
      program: x.program,
      branch: x.branch,
      batch: x.batch_name,
      domain: x.domain_name,
      period,
      allotmentReference: x.allotment_reference,
      attendancePercent: x.attendance_percent,
      taskAvg: x.task_avg,
      reviewAvg: x.review_avg,
      groupMarks: x.group_marks,
      individualMarks: x.individual_marks,
      recommendation: x.recommendation,
      mentorRemarks: x.mentor_feedback,
    });
  const report = (
    await q(
      "INSERT INTO college_completion_reports(intern_id,allotment_reference,attendance_percent,marks_summary,mentor_remarks,status,file_path) VALUES($1,$2,$3,$4,$5,'GENERATED',$6) RETURNING *",
      [
        x.id,
        x.allotment_reference || null,
        x.attendance_percent,
        {
          taskAverage: x.task_avg,
          reviewAverage: x.review_avg,
          groupMarks: x.group_marks,
          individualMarks: x.individual_marks,
          recommendation: x.recommendation,
        },
        x.mentor_feedback || null,
        file,
      ],
    )
  ).rows[0];
  await audit(
    req,
    "COLLEGE_COMPLETION_REPORT_GENERATED",
    "college_completion_report",
    report.id,
    null,
    report,
  );
  res.status(201).json(report);
});
r.get("/reports/completion/:id/file", async (req, res) => {
  const x = (
    await q(
      "SELECT * FROM college_completion_reports WHERE id=$1 AND status='GENERATED'",
      [req.params.id],
    )
  ).rows[0];
  if (!x?.file_path || !fs.existsSync(x.file_path))
    return res.status(404).json({ error: "Report file not found" });
  res.download(path.resolve(x.file_path), "college-completion-report.pdf");
});
r.get("/reports/export.csv", async (req, res) => {
  const rows = (
    await q(
      `SELECT ip.full_name,ip.roll_number,c.name college,b.name batch,d.name domain,COALESCE(att.pct,0) attendance_percent,COALESCE(ts.avg_marks,0) task_average,COALESCE(rv.avg_marks,0) review_average,fe.individual_marks final_individual_marks,fe.recommendation,ca.status completion_status,cert.certificate_id FROM intern_profiles ip JOIN users visible_user ON visible_user.id=ip.user_id AND visible_user.status<>'DELETED' LEFT JOIN colleges c ON c.id=ip.college_id LEFT JOIN LATERAL(SELECT * FROM batch_allocations z WHERE z.intern_id=ip.id ORDER BY z.intern_start DESC LIMIT 1)ba ON true LEFT JOIN batches b ON b.id=ba.batch_id LEFT JOIN domains d ON d.id=ip.final_domain_id LEFT JOIN LATERAL(SELECT z.attendance_percent pct FROM attendance_summary z JOIN batch_allocations za ON za.id=z.allocation_id WHERE z.intern_id=ip.id ORDER BY za.intern_start DESC NULLS LAST LIMIT 1)att ON true LEFT JOIN LATERAL(SELECT round(avg(te.marks),1) avg_marks FROM task_submissions ts JOIN task_evaluations te ON te.submission_id=ts.id WHERE ts.intern_id=ip.id AND te.decision='APPROVED')ts ON true LEFT JOIN LATERAL(SELECT round(avg(rim.marks),1) avg_marks FROM review_individual_marks rim JOIN fortnight_reviews fr ON fr.id=rim.review_id WHERE rim.intern_id=ip.id AND fr.status='PUBLISHED')rv ON true LEFT JOIN LATERAL(SELECT * FROM final_evaluations z WHERE z.intern_id=ip.id ORDER BY z.created_at DESC LIMIT 1)fe ON true LEFT JOIN LATERAL(SELECT * FROM completion_approvals z WHERE z.intern_id=ip.id ORDER BY z.approved_at DESC LIMIT 1)ca ON true LEFT JOIN LATERAL(SELECT * FROM certificates z WHERE z.intern_id=ip.id AND z.status='ISSUED' ORDER BY z.created_at DESC LIMIT 1)cert ON true ORDER BY ip.full_name`,
    )
  ).rows;
  const esc = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
  const keys = Object.keys(
    rows[0] || {
      full_name: "",
      roll_number: "",
      college: "",
      batch: "",
      domain: "",
      attendance_percent: "",
      task_average: "",
      review_average: "",
      final_individual_marks: "",
      recommendation: "",
      completion_status: "",
      certificate_id: "",
    },
  );
  const csv = [
    keys.join(","),
    ...rows.map((x) => keys.map((k) => esc(x[k])).join(",")),
  ].join("\n");
  await audit(
    req,
    "REPORT_EXPORT_CSV",
    "report_export",
    "intern_performance",
    null,
    { rowCount: rows.length },
  );
  res
    .type("text/csv")
    .set(
      "Content-Disposition",
      'attachment; filename="gaint-intern-report.csv"',
    )
    .send(csv);
});
r.get("/audit", async (req, res) =>
  res.json(
    (await q("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500"))
      .rows,
  ),
);
export default r;

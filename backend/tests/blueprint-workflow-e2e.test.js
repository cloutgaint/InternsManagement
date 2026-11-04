import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createApp } from "../src/app.js";
import { pool, q } from "../src/common/database/index.js";

// Walks Blueprint v1.2 Section 4 over HTTP against PostgreSQL, using the same calls the UI makes.
const enabled = process.env.RUN_DB_E2E === "1";
const pdf = (label) => new Blob([Buffer.from("%PDF-1.4\n" + label + crypto.randomUUID())], { type: "application/pdf" });
const iso = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const CHECKLIST = { nameMatch: true, rollMatch: true, collegeMatch: true, datesValid: true, signatureSeal: true, referenceMatch: true, duplicateChecked: true };

test("Blueprint v1.2 lifecycle from registration to certificate", { skip: !enabled }, async (t) => {
  assert.ok(process.env.DATABASE_URL?.includes("intern_test"), "Use an isolated intern_test database");
  process.env.JWT_SECRET ||= "ci-only-assessment-test-secret";
  process.env.FILE_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");

  let verifierResult = { matchScore: 0.2, livenessScore: 0.9, challengePass: true };
  const verifier = http.createServer(async (req, res) => {
    for await (const _ of req);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(verifierResult));
  });
  await new Promise((resolve) => verifier.listen(0, "127.0.0.1", resolve));
  process.env.BIOMETRIC_VERIFY_URL = "http://127.0.0.1:" + verifier.address().port;
  process.env.BIOMETRIC_VERIFY_TOKEN = "t";

  const server = createApp().listen(0);
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  const suffix = Date.now().toString(36);
  const one = async (sql, args = []) => (await q(sql, args)).rows[0];

  const call = async (token, method, path, body) => {
    const isForm = body instanceof FormData;
    const response = await fetch(base + path, {
      method,
      headers: { ...(isForm ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data };
  };
  const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result.data)); return result.data; };

  let staffCount = 0;
  const staff = async (role) => {
    const u = await one("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,$2,$3,'ACTIVE',true) RETURNING id", [role.toLowerCase() + ++staffCount + "+" + suffix + "@example.test", "x", role]);
    return { id: u.id, token: jwt.sign({ id: u.id, role, mfa: true }, process.env.JWT_SECRET) };
  };
  const superAdmin = await staff("SUPER_ADMIN");
  const admin = await staff("ADMIN");
  const A = (method, path, body) => call(admin.token, method, "/admin" + path, body);
  const SA = (method, path, body) => call(superAdmin.token, method, "/admin" + path, body);

  const college = ok(await A("POST", "/colleges", { name: "Blueprint College " + suffix, code: "BC" + suffix, university: "Test University", college_type: "University", state: "TS", city: "Hyd", address: "Campus" }), 201);
  const domainA = await one("INSERT INTO domains(name,code,category,active) VALUES($1,$2,'Technology',true) RETURNING *", ["Backend " + suffix, "BE" + suffix]);
  const domainB = await one("INSERT INTO domains(name,code,category,active) VALUES($1,$2,'Business',true) RETURNING *", ["Marketing " + suffix, "MK" + suffix]);
  const domainC = await one("INSERT INTO domains(name,code,category,active) VALUES($1,$2,'Design',true) RETURNING *", ["Design " + suffix, "DS" + suffix]);
  const password = "Str0ng!Passw0rd";

  const registration = (n, extra = {}) => {
    const form = new FormData();
    const fields = {
      email: "student" + n + "+" + suffix + "@example.test", password, fullName: "Student " + n, mobile: "9000000000", dob: "2004-01-01", address: "Hostel",
      collegeId: college.id, university: "Test University", program: "B.Tech", branch: "CSE", yearSemester: "3/5", rollNumber: "ROLL" + n + suffix,
      preferredDomains: JSON.stringify([domainA.name]), consentGenuine: "true", consentStorage: "true", ...extra,
    };
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    return form;
  };
  const proofFields = (n) => ({ proofType: "College Allotment Order", issuingAuthority: "Principal", referenceNumber: "REF" + n + suffix, issueDate: iso(-5), approvedFrom: iso(-60), approvedTo: iso(120), coordinatorName: "Dr Coord", coordinatorDesignation: "HoD", coordinatorEmail: "coord@example.test", coordinatorPhone: "9000000001" });
  const proofForm = (n, label = "letter") => { const f = registration(n, proofFields(n)); f.append("proofFiles", pdf(label), "letter.pdf"); return f; };
  const internCall = (login) => (method, path, body) => call(login.token, method, "/intern" + path, body);

  try {
    await t.test("malformed ids are a 400 and do not stop the API", async () => {
      ok(await A("GET", "/proofs/not-a-uuid/file"), 400);
      ok(await call(null, "GET", "/health"));
    });

    // Steps 1-3
    let first, firstUser;
    await t.test("registration: proof is required, photo and resume are optional, files are encrypted", async () => {
      ok(await call(null, "POST", "/auth/register", registration(1)), 400);
      first = ok(await call(null, "POST", "/auth/register", proofForm(1)), 201);
      assert.equal(first.status, "PROOF_UNDER_REVIEW");
      firstUser = first.id;
      ok(await call(null, "POST", "/auth/register", proofForm(1)), 409);
      const stored = await one("SELECT file_path,file_hash FROM college_proofs WHERE intern_id=$1", [first.internId]);
      const onDisk = fs.readFileSync(JSON.parse(stored.file_path)[0]);
      assert.equal(onDisk.subarray(0, 9).toString(), "GAINTENC1", "proof must be encrypted at rest");
      const blocked = await call(null, "POST", "/auth/login", { email: "student1+" + suffix + "@example.test", password });
      assert.equal(blocked.status, 403);
    });

    await t.test("proof review: override is Super Admin only; re-upload works without login", async () => {
      const proof = ok(await A("GET", "/proofs")).find((x) => x.intern_id === first.internId);
      assert.ok(proof.file_names.length === 1);
      ok(await A("POST", "/interns/" + firstUser + "/approve", {}), 409);
      ok(await A("POST", "/proofs/" + proof.id + "/verify", { outcome: "OVERRIDE", reason: "x" }), 403);
      ok(await A("POST", "/proofs/" + proof.id + "/verify", { outcome: "VERIFIED", checklist: { nameMatch: true } }), 400);
      ok(await A("POST", "/proofs/" + proof.id + "/verify", { outcome: "REUPLOAD_REQUESTED", reason: "Signature missing" }));
      const creds = { email: "student1+" + suffix + "@example.test", password };
      const status = ok(await call(null, "POST", "/auth/application-status", creds));
      assert.equal(status.canReupload, true);
      assert.equal(status.proof.reason, "Signature missing");
      ok(await call(null, "POST", "/auth/application-status", { ...creds, password: "wrong" }), 401);
      const form = new FormData();
      Object.entries({ ...creds, ...proofFields("1b") }).forEach(([k, v]) => form.append(k, v));
      form.append("proofFiles", pdf("second"), "second.pdf");
      form.append("proofFiles", pdf("annex"), "annex.pdf");
      ok(await call(null, "POST", "/auth/proof-reupload", form), 201);
      const latest = ok(await A("GET", "/proofs")).filter((x) => x.intern_id === first.internId);
      assert.equal(latest.length, 2, "the previous proof stays in history");
      const current = latest.find((x) => x.status === "UPLOADED");
      assert.equal(current.version, 2);
      const second = await call(admin.token, "GET", "/admin/proofs/" + current.id + "/file?index=1");
      assert.equal(second.status, 200);
      assert.match(String(second.data), /^%PDF-/, "both uploaded files can be read and decrypted");
      const viewed = await one("SELECT count(*)::int n FROM audit_logs WHERE action='PROOF_FILE_VIEWED' AND entity_id=$1", [current.id]);
      assert.equal(viewed.n, 1, "proof views are audited");
      ok(await A("POST", "/proofs/" + current.id + "/verify", { outcome: "VERIFIED", checklist: CHECKLIST }));
    });

    let token1;
    await t.test("account decision: request correction, fix, approve, sign in", async () => {
      ok(await A("POST", "/interns/" + firstUser + "/request-correction", {}), 400);
      ok(await A("POST", "/interns/" + firstUser + "/request-correction", { reason: "Name spelling" }));
      const creds = { email: "student1+" + suffix + "@example.test", password };
      ok(await call(null, "POST", "/auth/application-correction", { ...creds, fullName: "Student One" }));
      ok(await A("POST", "/interns/" + firstUser + "/approve", {}));
      const login = ok(await call(null, "POST", "/auth/login", creds));
      token1 = login.token;
      assert.ok(token1);
    });
    const I1 = (method, path, body) => call(token1, method, "/intern" + path, body);

    // Steps 4-5
    let batch, allocation;
    await t.test("batch: configuration is editable and default dates allocate", async () => {
      batch = ok(await A("POST", "/batches", { collegeId: college.id, name: "Batch " + suffix, code: "B" + suffix, startDate: iso(-30), endDate: iso(60), mode: "ONSITE" }), 201);
      assert.equal(batch.start_date, iso(-30), "DATE columns must serialize as YYYY-MM-DD");
      batch = ok(await A("PATCH", "/batches/" + batch.id, { workingDays: [0, 1, 2, 3, 4, 5, 6], lateAfter: "23:59", minAttendance: 0, status: "ACTIVE", groupComposition: "CROSS_FUNCTIONAL", groupSize: 2 }));
      ok(await A("PATCH", "/batches/" + batch.id, { groupWeight: 70, individualWeight: 40 }), 400);
      allocation = ok(await A("POST", "/allocate", { batchId: batch.id, internId: first.internId }), 201);
      assert.equal(allocation.intern_start, iso(-30));
      assert.equal(allocation.status, "ALLOTMENT_VERIFIED");
      ok(await A("PUT", "/batches/" + batch.id + "/domains/" + domainA.id, { capacity: 10 }));
      ok(await A("PUT", "/batches/" + batch.id + "/domains/" + domainB.id, { capacity: 10 }));
    });

    let second;
    await t.test("bulk allotment order covers a listed student without an upload", async () => {
      const form = new FormData();
      Object.entries({ batchId: batch.id, referenceNumber: "ORDER" + suffix, issuingAuthority: "Dean", issueDate: iso(-5), approvedFrom: iso(-60), approvedTo: iso(120) }).forEach(([k, v]) => form.append(k, v));
      form.append("file", pdf("order"), "order.pdf");
      const order = ok(await A("POST", "/batch-allotment-orders", form), 201);
      ok(await A("POST", "/batch-allotment-orders/" + order.id + "/students", { rollNumbers: ["ROLL2" + suffix] }), 409);
      ok(await A("POST", "/batch-allotment-orders/" + order.id + "/verify", { outcome: "VERIFIED" }));
      const linked = ok(await A("POST", "/batch-allotment-orders/" + order.id + "/students", { rollNumbers: ["ROLL2" + suffix, "ROLL9" + suffix] }));
      assert.equal(linked.linked, 2);
      second = ok(await call(null, "POST", "/auth/register", registration(2, { preferredDomains: JSON.stringify([domainB.name]) })), 201);
      assert.equal(second.coveredByBatchOrder, true);
      const unapproved = await A("POST", "/allocate", { batchId: batch.id, internId: second.internId });
      assert.equal(unapproved.status, 409);
      assert.match(unapproved.data.error, /not been approved/);
      assert.equal((await A("POST", "/allocate", { batchId: second.internId, internId: second.internId })).data.error, "Batch not found");
      ok(await A("POST", "/interns/" + second.id + "/approve", {}));
      ok(await A("POST", "/allocate", { batchId: batch.id, internId: second.internId }), 201);
    });
    const login2 = await call(null, "POST", "/auth/login", { email: "student2+" + suffix + "@example.test", password });
    const I2 = (method, path, body) => call(login2.data.token, method, "/intern" + path, body);

    // Step 6
    await t.test("offer letter: Draft, Previewed, Approved, Issued, Reissued, Revoked", async () => {
      const template = ok(await A("POST", "/offer-letter-templates", { name: "T" + suffix, body: "Dear {{student_name}}, from {{from_date}} to {{to_date}}.", signatory: "CEO" }), 201);
      const draft = ok(await A("POST", "/offer-letters", { allocationId: allocation.id, templateId: template.id }), 201);
      ok(await A("POST", "/offer-letters", { allocationId: allocation.id, templateId: template.id }), 409);
      ok(await A("POST", "/offer-letters/" + draft.id + "/approve"), 409);
      ok(await A("POST", "/offer-letters/" + draft.id + "/mark-previewed"));
      ok(await A("POST", "/offer-letters/" + draft.id + "/approve"));
      ok(await A("POST", "/offer-letters/" + draft.id + "/issue", {}), 400);
      const issued = ok(await A("POST", "/offer-letters/" + draft.id + "/issue", { issueAt: new Date().toISOString() }));
      assert.equal(issued.status, "ISSUED");
      assert.match(issued.issued_snapshot.rendered_body, new RegExp("from " + iso(-30)), "letter must show ISO dates");
      assert.equal(issued.student_name_snapshot, "Student One");
      const view = ok(await I1("GET", "/offer-letters/" + draft.id + "/view"));
      assert.match(view.rendered_body, /Student One/);
      ok(await A("POST", "/offer-letters/" + draft.id + "/reissue", {}), 400);
      ok(await A("POST", "/offer-letters/" + draft.id + "/reissue", { reason: "Date fix" }));
      ok(await A("POST", "/offer-letters/" + draft.id + "/mark-previewed"));
      ok(await A("POST", "/offer-letters/" + draft.id + "/approve"));
      const reissued = ok(await A("POST", "/offer-letters/" + draft.id + "/issue", { issueAt: new Date().toISOString() }));
      assert.equal(reissued.status, "REISSUED");
      const list = ok(await I1("GET", "/offer-letters"));
      assert.equal(list[0].status, "REISSUED");
      const pdfFile = await call(token1, "GET", "/intern/offer-letters/" + draft.id + "/pdf");
      assert.equal(pdfFile.status, 200);
      ok(await A("POST", "/offer-letters/" + draft.id + "/revoke", { reason: "Withdrawn offer test" }));
      ok(await A("POST", "/offer-letters/" + draft.id + "/reissue", { reason: "Restored" }));
    });

    // Steps 7-11
    await t.test("assessment: common + preferred sections, no key leak, manual marks, recommendation is advisory", async () => {
      const question = async (domainId, type, extra) => (await one("INSERT INTO question_bank(domain_id,type,question,correct_answer,marks,status,options) VALUES($1,$2,$3,$4,$5,'ACTIVE',$6) RETURNING id", [domainId, type, "Q " + type, extra.answer ? JSON.stringify(extra.answer) : null, 10, extra.options ? JSON.stringify(extra.options) : null])).id;
      const common = await question(null, "MCQ", { answer: "a", options: ["a", "b"] });
      const qA = await question(domainA.id, "DESCRIPTIVE", {});
      const qB = await question(domainB.id, "MCQ", { answer: "x", options: ["x", "y"] });
      const created = ok(await A("POST", "/assessments", {
        batchId: batch.id, name: "Pre-joining " + suffix, durationMinutes: 60, attemptCount: 1, randomize: true,
        sections: [
          { name: "Common", domainId: null, passScore: 1, questionIds: [common] },
          { name: "Backend", domainId: domainA.id, passScore: 1, questionIds: [qA] },
          { name: "Marketing", domainId: domainB.id, passScore: 1, questionIds: [qB] },
        ],
      }), 201);
      ok(await A("PATCH", "/assessments/" + created.id + "/status", { status: "PUBLISHED" }));
      const attempt = ok(await I1("POST", "/assessments/" + created.id + "/start", {}), 201);
      const resumed = ok(await I1("POST", "/assessments/" + created.id + "/start", {}));
      assert.equal(resumed.id, attempt.id, "starting again resumes the open attempt");
      const paper = ok(await I1("GET", "/assessments/" + created.id + "/questions"));
      const ids = paper.questions.map((x) => x.id).sort();
      assert.deepEqual(ids, [common, qA].sort(), "intern sees the common section and preferred domain only");
      assert.ok(!JSON.stringify(paper).includes("correct_answer"), "answer keys are never sent to interns");
      ok(await I1("POST", "/assessments/" + created.id + "/tab-switch", {}));
      ok(await I1("POST", "/assessments/" + created.id + "/submit", { attemptId: attempt.id, answers: [{ questionId: qB, answer: "x" }] }), 400);
      const submitted = ok(await I1("POST", "/assessments/" + created.id + "/submit", { attemptId: attempt.id, answers: [{ questionId: common, answer: "a" }, { questionId: qA, answer: "essay" }] }), 201);
      assert.equal(submitted.status, "PENDING_EVALUATION");
      assert.equal((await one("SELECT tab_switches FROM assessment_attempts WHERE id=$1", [attempt.id])).tab_switches, 1);
      ok(await A("POST", "/domain-recommendations/" + first.internId + "/calculate", { batchId: batch.id }), 409);
      const manual = await one("SELECT id FROM assessment_answers WHERE attempt_id=$1 AND question_id=$2", [attempt.id, qA]);
      ok(await A("POST", "/assessment-answers/" + manual.id + "/evaluate", { score: 8, marks: 8, manualScore: 8, feedback: "Good" }), 200);
      const rec = ok(await A("POST", "/domain-recommendations/" + first.internId + "/calculate", { batchId: batch.id }));
      assert.equal(rec.recommendations[0].domainId, domainA.id);
      ok(await A("POST", "/domain-confirm", { internId: first.internId, batchId: batch.id, domainId: domainC.id, reason: "Not offered" }), 409);
      ok(await A("POST", "/domain-confirm", { internId: first.internId, batchId: batch.id, domainId: domainB.id }), 400);
      ok(await A("POST", "/domain-confirm", { internId: first.internId, batchId: batch.id, domainId: domainB.id, reason: "Capacity balance" }));
      ok(await A("POST", "/domain-confirm", { internId: first.internId, batchId: batch.id, domainId: domainA.id, reason: "Reverted after review" }));
      ok(await A("POST", "/domain-confirm", { internId: first.internId, batchId: batch.id, domainId: domainA.id }), 409);
      assert.equal((await one("SELECT final_domain_id FROM intern_profiles WHERE id=$1", [first.internId])).final_domain_id, domainA.id);
      // Second intern: objective paper only, confirmed directly on the recommendation.
      const a2 = ok(await I2("POST", "/assessments/" + created.id + "/start", {}), 201);
      ok(await I2("POST", "/assessments/" + created.id + "/submit", { attemptId: a2.id, answers: [{ questionId: common, answer: "a" }, { questionId: qB, answer: "x" }] }), 201);
      ok(await A("POST", "/domain-recommendations/" + second.internId + "/calculate", { batchId: batch.id }));
      ok(await A("POST", "/domain-confirm", { internId: second.internId, batchId: batch.id, domainId: domainB.id }));
    });

    // Steps 12-15
    let group, mentor, mentorToken, project;
    const M = (method, path, body) => call(mentorToken, method, "/mentor" + path, body);
    await t.test("groups and mentor: cross-functional proposal, regroup history, real mentor account", async () => {
      const proposals = ok(await A("POST", "/group-proposals/" + batch.id + "/generate", {}), 201);
      assert.equal(proposals.length, 1);
      group = proposals[0];
      assert.equal(group.type, "CROSS_FUNCTIONAL");
      assert.equal(group.members.length, 2);
      ok(await A("POST", "/group-proposals/" + group.id + "/approve"));
      const notes = ok(await call(token1, "GET", "/notifications"));
      assert.ok(notes.some((x) => x.type === "GROUP_ASSIGNED"));
      const unread = ok(await call(token1, "GET", "/notifications/unread-count"));
      assert.ok(unread.unread > 0);
      assert.ok(ok(await A("GET", "/groups/" + group.id + "/history")).some((x) => x.action === "APPROVED"));
      mentor = ok(await A("POST", "/mentors", { fullName: "Mentor " + suffix, email: "mentor+" + suffix + "@example.test", password: "Str0ng!Passw0rd12", maxGroups: 3, maxInterns: 10, expertise: [domainA.name] }), 201);
      mentorToken = jwt.sign({ id: mentor.user_id, role: "MENTOR", mfa: true }, process.env.JWT_SECRET);
      ok(await A("POST", "/groups/" + group.id + "/mentor", { mentorId: mentor.id, domainId: domainA.id, isLead: true }), 201);
      project = ok(await A("POST", "/projects", { title: "Project " + suffix, description: "Real work", domainIds: [domainA.id, domainB.id], milestones: ["M1"], deliverableTypes: ["REPOSITORY"], toolsMethods: "Git", resources: "Docs", durationSuitability: "1 month" }), 201);
      assert.deepEqual(project.domain_ids, [domainA.id, domainB.id]);
      ok(await A("POST", "/project-assignments", { projectId: project.id, groupId: group.id }), 201);
      const mine = ok(await I1("GET", "/group"));
      assert.equal(mine.members.length, 2);
      assert.equal(mine.project_title, project.title);
    });

    // Steps 16, 18
    await t.test("face and attendance: approval gate, retry before exception, correction changes the record", async () => {
      const image = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(12000, 7)]).toString("base64");
      ok(await I1("POST", "/attendance/verify", { eventType: "CHECK_IN", imageData: image, baselineImageData: image, challengeType: "TURN_LEFT" }), 409);
      const enrollment = ok(await I1("POST", "/face-enrollment", { consent: true, imageData: image }), 201);
      assert.equal(fs.readFileSync(enrollment.raw_image_path).subarray(0, 9).toString(), "GAINTENC1", "face image must be encrypted at rest");
      ok(await I1("POST", "/face-enrollment", { consent: true, imageData: image }), 409);
      const pending = ok(await A("GET", "/face-enrollments")).find((x) => x.id === enrollment.id);
      assert.equal(pending.status, "PENDING_ADMIN_APPROVAL");
      assert.equal((await call(admin.token, "GET", "/admin/face-enrollments/" + enrollment.id + "/image")).status, 200);
      ok(await A("POST", "/face-enrollments/" + enrollment.id + "/decision", { status: "APPROVED" }));
      const attempt = () => I1("POST", "/attendance/verify", { eventType: "CHECK_IN", imageData: image, baselineImageData: image, challengeType: "TURN_LEFT" });
      const fail1 = await attempt();
      assert.equal(fail1.status, 422);
      assert.equal(fail1.data.retriesLeft, 2);
      assert.equal((await one("SELECT count(*)::int n FROM attendance_exceptions WHERE intern_id=$1", [first.internId])).n, 0, "first failure only asks for a retry");
      await attempt();
      const fail3 = await attempt();
      assert.equal(fail3.data.retriesLeft, 0);
      assert.ok(fail3.data.exception);
      const exception = ok(await A("GET", "/attendance-exceptions")).find((x) => x.intern_id === first.internId);
      ok(await A("POST", "/attendance-exceptions/" + exception.id + "/decision", { status: "APPROVED" }), 400);
      ok(await A("POST", "/attendance-exceptions/" + exception.id + "/decision", { status: "APPROVED", reason: "Verified on call" }));
      const stored = await one("SELECT reason,decision_reason FROM attendance_exceptions WHERE id=$1", [exception.id]);
      assert.match(stored.reason, /match threshold/, "the original reason is preserved");
      assert.equal(stored.decision_reason, "Verified on call");
      const today = await one("SELECT status,source,corrected_by FROM attendance_daily WHERE intern_id=$1 AND day=current_date", [first.internId]);
      assert.equal(today.status, "PRESENT");
      assert.equal(today.source, "MANUAL");
      assert.equal(today.corrected_by, admin.id);
      verifierResult = { matchScore: 0.95, livenessScore: 0.95, challengePass: true };
      ok(await I1("POST", "/attendance/verify", { eventType: "CHECK_OUT", imageData: image, baselineImageData: image, challengeType: "TURN_LEFT" }), 409);
      ok(await I1("POST", "/attendance/verify", { eventType: "CHECK_IN", imageData: image, baselineImageData: image, challengeType: "TURN_LEFT" }), 201);
      ok(await I1("POST", "/attendance/verify", { eventType: "CHECK_IN", imageData: image, baselineImageData: image, challengeType: "TURN_LEFT" }), 409);
      ok(await I1("POST", "/attendance/verify", { eventType: "CHECK_OUT", imageData: image, baselineImageData: image, challengeType: "TURN_LEFT" }), 201);
      // Earlier days without a record are absences, and a request can correct them.
      const status = ok(await I1("GET", "/attendance/status"));
      assert.equal(status.summary.absent_days, 30);
      assert.equal(status.summary.present_days, 1);
      assert.equal(Number(status.summary.attendance_percent), 3.2);
      const correction = ok(await I1("POST", "/attendance/correction", { day: iso(-1), requestedStatus: "PRESENT", reason: "Camera broke" }), 201);
      ok(await I1("POST", "/attendance/correction", { day: iso(-1), reason: "Again" }), 409);
      ok(await I1("POST", "/attendance/correction", { day: iso(5), reason: "Future" }), 409);
      ok(await M("POST", "/attendance-exceptions/" + correction.id + "/decision", { status: "APPROVED", reason: "Mentor confirmed" }));
      assert.equal(ok(await I1("GET", "/attendance/status")).summary.present_days, 2);
      // Holidays leave the denominator.
      ok(await A("POST", "/holidays", { batchId: batch.id, day: iso(-2), name: "Festival" }), 201);
      const records = ok(await A("GET", "/attendance-records?batchId=" + batch.id + "&status=HOLIDAY"));
      assert.equal(records.filter((x) => x.intern_id === first.internId).length, 1);
      assert.equal(ok(await I1("GET", "/attendance/status")).summary.holiday_days, 1);
    });

    // Step 19 and leave
    await t.test("daily reports accept proof links; mentors decide leave for their own interns", async () => {
      ok(await I1("POST", "/daily-report", { phase: "EVENING", completedTasks: "x" }), 409);
      ok(await I1("POST", "/daily-report", { phase: "MORNING", plannedTasks: "Plan" }));
      const evening = ok(await I1("POST", "/daily-report", { phase: "EVENING", completedTasks: "Done", pendingBlockers: "None", proofLinks: ["https://example.test/pr/1"] }));
      assert.deepEqual(evening.proof_links, ["https://example.test/pr/1"]);
      assert.ok(ok(await A("GET", "/daily-reports?batchId=" + batch.id)).some((x) => x.intern_id === first.internId));
      await q("UPDATE batches SET leave_limit_days=5 WHERE id=$1", [batch.id]);
      const leave = ok(await I1("POST", "/leave", { fromDate: iso(2), toDate: iso(2), reason: "Family" }), 201);
      const other = await staff("MENTOR");
      const outsider = await one("INSERT INTO mentors(user_id,full_name) VALUES($1,'Outsider') RETURNING id", [other.id]);
      assert.ok(outsider.id);
      ok(await call(other.token, "POST", "/mentor/leave-requests/" + leave.id + "/decision", { status: "APPROVED" }), 403);
      ok(await M("POST", "/leave-requests/" + leave.id + "/decision", { status: "APPROVED" }));
      assert.ok(ok(await call(token1, "GET", "/notifications")).some((x) => x.type === "LEAVE_APPROVED"));
      const dashboard = ok(await A("GET", "/dashboard"));
      assert.ok("proof_overrides" in dashboard);
    });

    // Steps 20-21
    await t.test("tasks: domain scoping, pause/publish control, rubric-free evaluation and rework", async () => {
      const forA = ok(await A("POST", "/tasks", { batchId: batch.id, domainId: domainA.id, title: "Backend task", submissionTypes: ["LINK", "REPOSITORY"], releaseAt: new Date(Date.now() + 864e5).toISOString(), dueAt: new Date(Date.now() + 3 * 864e5).toISOString(), marks: 50 }), 201);
      assert.deepEqual(forA.submission_types, ["LINK", "REPOSITORY"]);
      ok(await A("POST", "/tasks/" + forA.id + "/pause"));
      ok(await A("POST", "/tasks/" + forA.id + "/pause"), 409);
      ok(await A("POST", "/tasks/" + forA.id + "/resume"));
      ok(await A("PATCH", "/tasks/" + forA.id, { releaseAt: new Date(Date.now() + 2 * 864e5).toISOString() }));
      const published = ok(await A("POST", "/tasks/" + forA.id + "/publish"));
      assert.equal(published.status, "RELEASED");
      ok(await A("PATCH", "/tasks/" + forA.id, { releaseAt: new Date().toISOString() }), 409);
      assert.ok(ok(await I1("GET", "/dashboard")).tasks.some((x) => x.id === forA.id));
      assert.ok(!ok(await I2("GET", "/dashboard")).tasks.some((x) => x.id === forA.id), "tasks stay within the confirmed domain");
      const submit = (caller, content) => { const f = new FormData(); f.append("content", JSON.stringify(content)); return caller("POST", "/tasks/" + forA.id + "/submit", f); };
      ok(await submit(I2, { link: "https://example.test/x" }), 403);
      ok(await submit(I1, { text: "not allowed" }), 400);
      const submission = ok(await submit(I1, { repositoryUrl: "https://example.test/repo" }), 201);
      ok(await submit(I1, { repositoryUrl: "https://example.test/repo2" }), 409);
      ok(await M("POST", "/submissions/" + submission.id + "/evaluate", { decision: "REWORK_REQUIRED", marks: 10, feedback: "Needs tests", reworkInstructions: "Add tests", reworkDueAt: new Date(Date.now() + 864e5).toISOString() }), 201);
      const again = ok(await submit(I1, { repositoryUrl: "https://example.test/repo3" }), 201);
      assert.equal(again.attempt, 2);
      ok(await M("POST", "/submissions/" + again.id + "/evaluate", { decision: "APPROVED", marks: 45, feedback: "Good" }), 201);
      const template = ok(await A("POST", "/task-templates", { domainId: domainB.id, weekNo: 1, title: "Campaign plan " + suffix, submissionTypes: ["DOCUMENT"], marks: 20 }), 201);
      const series = ok(await A("POST", "/batches/" + batch.id + "/schedule-tasks", { weekday: 1, time: "09:00" }), 201);
      assert.ok(series.some((x) => x.title === template.title));
      ok(await A("POST", "/batches/" + batch.id + "/schedule-tasks", { weekday: 9, time: "09:00" }), 400);
    });

    // Step 22
    await t.test("fortnight review moves forward and interns see it once published", async () => {
      const created = ok(await A("POST", "/batches/" + batch.id + "/schedule-reviews", { everyDays: 14 }), 201);
      assert.ok(created.created >= 1);
      const review = await one("SELECT id FROM fortnight_reviews WHERE group_id=$1 AND period_no=1", [group.id]);
      ok(await M("PATCH", "/reviews/" + review.id, { status: "CONDUCTED", progress: "M1 complete", domainReview: "Solid" }));
      ok(await M("PATCH", "/reviews/" + review.id, { status: "SCHEDULED" }), 409);
      ok(await M("PATCH", "/reviews/" + review.id, { status: "PUBLISHED", groupMarks: 80 }), 409);
      const marks = [{ internId: first.internId, marks: 75, note: "Led API" }, { internId: second.internId, marks: 65, note: "Docs" }];
      ok(await M("PATCH", "/reviews/" + review.id, { status: "MARKS_ENTERED", groupMarks: 80, feedback: "Good", individualMarks: marks }));
      assert.equal(ok(await I1("GET", "/reviews")).find((x) => x.id === review.id), undefined, "marks stay hidden until published");
      const pub = ok(await M("PATCH", "/reviews/" + review.id, { status: "PUBLISHED" }));
      assert.equal(pub.status, "PUBLISHED");
      const mine = ok(await I1("GET", "/reviews")).find((x) => x.id === review.id);
      assert.equal(Number(mine.individual_marks), 75);
      ok(await M("PATCH", "/reviews/" + review.id, { feedback: "Changed" }), 409);
    });

    // Steps 24-25
    await t.test("documents and chat: Admin publishes by audience and moderates", async () => {
      const form = new FormData();
      form.append("title", "Guidelines");
      form.append("visibility", "BATCH");
      form.append("batchId", batch.id);
      form.append("externalUrl", "https://example.test/guide");
      const doc = ok(await A("POST", "/documents", form), 201);
      assert.ok(ok(await I1("GET", "/collaboration")).documents.some((x) => x.id === doc.id));
      const sent = ok(await A("POST", "/announcements", { title: "Welcome", body: "Hello", batchId: batch.id }), 201);
      assert.ok(sent.recipients >= 2);
      const message = ok(await I1("POST", "/chat", { message: "hello team" }), 201);
      assert.ok(ok(await A("GET", "/groups/" + group.id + "/chat")).some((x) => x.id === message.id));
      const moderated = ok(await A("DELETE", "/chat/" + message.id));
      assert.equal(moderated.message, "[Removed by Admin]");
      ok(await M("GET", "/groups/" + group.id + "/collaboration"));
    });

    // Steps 26-28
    await t.test("completion: gates, Extended and Incomplete outcomes, certificates, reports", async () => {
      assert.equal(ok(await I1("GET", "/completion")).approval, undefined, "completion endpoint must work before any decision");
      const noEval = await A("POST", "/completions/" + first.internId + "/decision", { status: "APPROVED" });
      assert.equal(noEval.status, 409);
      const finalSubmission = ok(await I1("POST", "/final-project-submission", { repositoryUrl: "https://example.test/final" }), 201);
      ok(await M("POST", "/final-project-submissions/" + finalSubmission.id + "/review", { status: "ACCEPTED", feedback: "Accepted" }));
      await q("UPDATE batches SET individual_pass_mark=70,min_attendance=0 WHERE id=$1", [batch.id]);
      ok(await M("POST", "/final-evaluations", { internId: first.internId, groupId: group.id, groupMarks: 90, individualMarks: 40, mentorFeedback: "Team carried", recommendation: "COMPLETED" }), 201);
      const lowIndividual = await A("POST", "/completions/" + first.internId + "/decision", { status: "APPROVED" });
      assert.equal(lowIndividual.status, 409);
      assert.match(lowIndividual.data.error, /Individual marks/, "group marks cannot carry a low contributor");
      ok(await M("POST", "/final-evaluations", { internId: first.internId, groupId: group.id, groupMarks: 90, individualMarks: 85, mentorFeedback: "Strong", recommendation: "COMPLETED" }), 201);
      await q("UPDATE batches SET min_attendance=75 WHERE id=$1", [batch.id]);
      const lowAttendance = await A("POST", "/completions/" + first.internId + "/decision", { status: "APPROVED" });
      assert.equal(lowAttendance.status, 409);
      assert.match(lowAttendance.data.error, /Attendance/);
      ok(await A("POST", "/completions/" + first.internId + "/decision", { status: "EXTENDED", reason: "Attendance recovery" }), 400);
      ok(await A("POST", "/completions/" + first.internId + "/decision", { status: "EXTENDED", reason: "Attendance recovery", extendedTo: iso(70) }), 201);
      assert.equal((await one("SELECT intern_end FROM batch_allocations WHERE id=$1", [allocation.id])).intern_end, iso(70));
      ok(await A("POST", "/certificates/" + first.internId + "/issue", {}), 409);
      await q("UPDATE batches SET min_attendance=0 WHERE id=$1", [batch.id]);
      ok(await A("POST", "/completions/" + first.internId + "/decision", { status: "APPROVED" }), 201);
      ok(await A("POST", "/certificates/" + first.internId + "/issue", { mode: "OFFLINE" }), 400);
      const cert = ok(await A("POST", "/certificates/" + first.internId + "/issue", { mode: "IN_APP" }), 201);
      ok(await A("POST", "/certificates/" + first.internId + "/issue", { mode: "IN_APP" }), 409);
      assert.equal(cert.domain_snapshot, domainA.name);
      const verified = ok(await call(null, "GET", "/public/certificates/" + cert.certificate_id));
      assert.equal(verified.valid, true);
      assert.equal(verified.name, "Student One");
      ok(await call(null, "GET", "/public/certificates/NOPE"), 404);
      const report = ok(await A("POST", "/reports/" + first.internId + "/completion"), 201);
      assert.ok(report.id);
      const completion = ok(await I1("GET", "/completion"));
      assert.equal(completion.approval.status, "APPROVED");
      assert.equal(completion.certificate.status, "ISSUED");
      // Second intern: withdrawn interns are ineligible.
      ok(await A("POST", "/completions/" + second.internId + "/exit", { type: "WITHDRAWN", reason: "Left for placement" }), 201);
      ok(await A("POST", "/completions/" + second.internId + "/decision", { status: "APPROVED" }), 409);
      ok(await A("GET", "/performance"));
      const operations = ok(await A("GET", "/reports/operations"));
      assert.ok(operations.outcomes.some((x) => x.outcome === "WITHDRAWN"));
      assert.equal((await call(admin.token, "GET", "/admin/reports/export.pdf")).status, 200);
      assert.equal((await call(admin.token, "GET", "/admin/reports/export.csv")).status, 200);
    });

    await t.test("access control: password, deactivation and role boundaries", async () => {
      ok(await call(token1, "GET", "/admin/proofs"), 403);
      ok(await call(mentorToken, "GET", "/admin/proofs"), 403);
      ok(await call(token1, "POST", "/auth/password/change", { currentPassword: "wrong", password: "An0ther!Passw0rd" }), 401);
      ok(await call(token1, "POST", "/auth/password/change", { currentPassword: password, password: "short" }), 400);
      await new Promise((resolve) => setTimeout(resolve, 2100));
      const changed = ok(await call(token1, "POST", "/auth/password/change", { currentPassword: password, password: "An0ther!Passw0rd" }));
      ok(await I1("GET", "/dashboard"), 401);
      ok(await call(changed.token, "GET", "/intern/dashboard"));
      ok(await call(null, "POST", "/auth/password/forgot", { email: "nobody@example.test" }));
      const rawToken = crypto.randomBytes(32).toString("base64url");
      await q("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '5 minutes')", [firstUser, crypto.createHash("sha256").update(rawToken).digest("hex")]);
      ok(await call(null, "POST", "/auth/password/reset", { token: rawToken, password: "Th1rd!Passw0rdX" }));
      ok(await call(null, "POST", "/auth/password/reset", { token: rawToken, password: "Th1rd!Passw0rdX" }), 400);
      assert.ok(await bcrypt.compare("Th1rd!Passw0rdX", (await one("SELECT password_hash FROM users WHERE id=$1", [firstUser])).password_hash));
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const session = ok(await call(null, "POST", "/auth/login", { email: "student1+" + suffix + "@example.test", password: "Th1rd!Passw0rdX" }));
      ok(await A("DELETE", "/interns/" + firstUser));
      ok(await call(session.token, "GET", "/intern/dashboard"), 401);
    });
  } finally {
    const uploaded = (await q(
      `SELECT file_path FROM college_proofs cp JOIN intern_profiles ip ON ip.id=cp.intern_id JOIN users u ON u.id=ip.user_id WHERE u.email LIKE $1
       UNION ALL SELECT raw_image_path FROM face_enrollments fe JOIN intern_profiles ip ON ip.id=fe.intern_id JOIN users u ON u.id=ip.user_id WHERE u.email LIKE $1
       UNION ALL SELECT o.file_path FROM batch_allotment_orders o WHERE o.reference_number LIKE $2
       UNION ALL SELECT ae.capture_path FROM attendance_events ae JOIN intern_profiles ip ON ip.id=ae.intern_id JOIN users u ON u.id=ip.user_id WHERE u.email LIKE $1
       UNION ALL SELECT c.file_path FROM certificates c JOIN intern_profiles ip ON ip.id=c.intern_id JOIN users u ON u.id=ip.user_id WHERE u.email LIKE $1
       UNION ALL SELECT r.file_path FROM college_completion_reports r JOIN intern_profiles ip ON ip.id=r.intern_id JOIN users u ON u.id=ip.user_id WHERE u.email LIKE $1`,
      ["%+" + suffix + "@example.test", "%" + suffix],
    )).rows;
    for (const { file_path } of uploaded) {
      if (!file_path) continue;
      let paths = [file_path];
      try { paths = [].concat(JSON.parse(file_path)); } catch {}
      for (const file of paths) fs.rmSync(file, { force: true });
    }
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => verifier.close(resolve));
    delete process.env.FILE_ENCRYPTION_KEY;
    delete process.env.BIOMETRIC_VERIFY_URL;
    delete process.env.BIOMETRIC_VERIFY_TOKEN;
    await pool.end();
  }
});

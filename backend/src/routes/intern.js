import { Router } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";import {documentUpload,validExternalDocumentUrl,validateUploadedDocument} from "../services/collaborationService.js";import {notify,notifyGroup,notifyAdmins} from "../common/notifications/notification.service.js";
import { q, tx } from "../common/database/index.js";
import { sendOfferPdf } from "../services/offerLetterPdfService.js";
import { verifyAttendanceBiometrics } from "../services/attendanceBiometricVerifier.js";
import { auth, permit } from "../common/security/auth.middleware.js";
import { audit } from "../common/audit/audit.service.js";
import { writeSecureFile } from "../common/storage/secureFiles.js";
import { attendanceDayState, notifyGroupMentors } from "../services/attendanceService.js";
import { latestProof, sendProofFile, storeProofFiles, validateProofDetails } from "../services/proofService.js";
const r = Router();
const submissionDir = path.resolve("uploads/task-submissions");
fs.mkdirSync(submissionDir, { recursive: true });
const taskUpload = multer({
  dest: submissionDir,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [
      "application/pdf",
      "application/zip",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "video/mp4",
      "text/plain",
      "image/png",
      "image/jpeg",
    ].includes(file.mimetype);
    cb(ok ? null : new Error("Unsupported task submission file type"), ok);
  },
});
r.use(auth, permit("INTERN"));
const shuffled = (items) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
// An assessment is the common section plus sections for the intern's preferred domains (Section 6.5).
async function sectionsForIntern(assessmentId, profile) {
  const prefs = (Array.isArray(profile.preferred_domains) ? profile.preferred_domains : []).map((x) => String(x).toLowerCase());
  const rows = (await q("SELECT s.*,d.name domain_name FROM assessment_sections s LEFT JOIN domains d ON d.id=s.domain_id WHERE s.assessment_id=$1 ORDER BY s.id", [assessmentId])).rows;
  if (!prefs.length) return rows;
  const matched = rows.filter((s) => !s.domain_id || prefs.includes(String(s.domain_id).toLowerCase()) || prefs.includes(String(s.domain_name).toLowerCase()));
  return matched.length ? matched : rows;
}
async function me(uid) {
  return (await q("SELECT * FROM intern_profiles WHERE user_id=$1", [uid]))
    .rows[0];
}
r.get("/collaboration",async(req,res)=>{const p=await me(req.user.id);const g=(await q("SELECT g.* FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE gm.intern_id=$1 AND gm.active LIMIT 1",[p.id])).rows[0];if(!g)return res.json({group:null,documents:(await q("SELECT id,kind,title,external_url,original_name,mime_type,size_bytes,created_at,owner_user_id FROM documents WHERE active AND (visibility='ALL' OR owner_user_id=$1 OR (visibility='BATCH' AND batch_id IN (SELECT batch_id FROM batch_allocations WHERE intern_id=$2))) ORDER BY created_at DESC",[req.user.id,p.id])).rows,messages:[]});const documents=(await q("SELECT id,kind,title,external_url,original_name,mime_type,size_bytes,created_at,owner_user_id FROM documents WHERE active AND (visibility='ALL' OR group_id=$1 OR owner_user_id=$2 OR (visibility='BATCH' AND batch_id IN (SELECT batch_id FROM batch_allocations WHERE intern_id=$3))) ORDER BY created_at DESC",[g.id,req.user.id,p.id])).rows;const messages=(await q(`SELECT cm.*,u.email sender_email,COALESCE(ip.full_name,m.full_name,'Admin') sender_name,d.title attachment_title,d.original_name attachment_name FROM chat_messages cm JOIN users u ON u.id=cm.sender_id LEFT JOIN intern_profiles ip ON ip.user_id=u.id LEFT JOIN mentors m ON m.user_id=u.id LEFT JOIN documents d ON d.id=cm.attachment_id WHERE cm.group_id=$1 ORDER BY cm.created_at DESC LIMIT 100`,[g.id])).rows.reverse();res.json({group:g,documents,messages})});
r.post("/documents",documentUpload.single("file"),async(req,res)=>{const p=await me(req.user.id),g=(await q("SELECT group_id FROM group_members WHERE intern_id=$1 AND active LIMIT 1",[p.id])).rows[0];if(!g){if(req.file)fs.unlinkSync(req.file.path);return res.status(409).json({error:"Active group required"})}if(req.file&&!validateUploadedDocument(req.file)){fs.unlinkSync(req.file.path);return res.status(400).json({error:"Uploaded file content does not match its declared type"});}if(req.body.externalUrl&&!validExternalDocumentUrl(req.body.externalUrl)){if(req.file)fs.unlinkSync(req.file.path);return res.status(400).json({error:"External document URL must be a valid HTTP(S) link"});}if(!req.file&&!req.body.externalUrl)return res.status(400).json({error:"Upload a document or provide an external URL"});const x=(await q("INSERT INTO documents(owner_user_id,group_id,kind,title,file_path,external_url,visibility,uploaded_by_role,mime_type,original_name,size_bytes) VALUES($1,$2,$3,$4,$5,$6,'GROUP','INTERN',$7,$8,$9) RETURNING *",[req.user.id,g.group_id,req.body.kind||"WORK",req.body.title||req.file?.originalname||"Document",req.file?.path||null,req.body.externalUrl||null,req.file?.mimetype||null,req.file?.originalname||null,req.file?.size||null])).rows[0];await notifyGroup(g.group_id,"DOCUMENT_SHARED","Document shared",p.full_name+" shared "+x.title,"/intern/collaboration","DOC:"+x.id,req.user.id);res.status(201).json(x)});
r.get("/documents/:id/file",async(req,res)=>{const p=await me(req.user.id);const d=(await q(`SELECT d.* FROM documents d LEFT JOIN group_members gm ON gm.group_id=d.group_id AND gm.intern_id=$1 AND gm.active WHERE d.id=$2 AND d.active AND (d.visibility='ALL' OR d.owner_user_id=$3 OR gm.intern_id IS NOT NULL OR (d.visibility='BATCH' AND d.batch_id IN (SELECT batch_id FROM batch_allocations WHERE intern_id=$1)))`,[p.id,req.params.id,req.user.id])).rows[0];if(!d?.file_path||!fs.existsSync(d.file_path))return res.status(404).json({error:"File not found"});res.download(path.resolve(d.file_path),d.original_name||path.basename(d.file_path))});
r.post("/chat",async(req,res)=>{const p=await me(req.user.id),g=(await q("SELECT group_id FROM group_members WHERE intern_id=$1 AND active LIMIT 1",[p.id])).rows[0];const message=String(req.body.message||"").trim();if(!g)return res.status(409).json({error:"Active group required"});if(!message&&!req.body.attachmentId)return res.status(400).json({error:"Message or attachment is required"});if(req.body.attachmentId){const ok=(await q("SELECT 1 FROM documents WHERE id=$1 AND active AND group_id=$2",[req.body.attachmentId,g.group_id])).rowCount;if(!ok)return res.status(403).json({error:"Attachment is not available to this group"})}const x=(await q("INSERT INTO chat_messages(group_id,sender_id,message,attachment_id) VALUES($1,$2,$3,$4) RETURNING *",[g.group_id,req.user.id,message,req.body.attachmentId||null])).rows[0];await notifyGroup(g.group_id,"GROUP_CHAT","New group message",p.full_name+": "+(message.slice(0,120)||"shared an attachment"),"/intern/collaboration","CHAT:"+x.id,req.user.id);res.status(201).json(x)});
r.get("/notifications",async(req,res)=>res.json((await q("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[req.user.id])).rows));
r.post("/notifications/:id/read",async(req,res)=>{const x=(await q("UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING *",[req.params.id,req.user.id])).rows[0];if(!x)return res.status(404).json({error:"Notification not found"});res.json(x)});
r.post("/notifications/read-all",async(req,res)=>{await q("UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1",[req.user.id]);res.json({ok:true})});
r.get("/profile-photo",async(req,res)=>{const profile=await me(req.user.id);if(!profile?.photo_url)return res.status(404).json({error:"Profile photo not found"});const uploadRoot=path.resolve("uploads");const file=path.isAbsolute(profile.photo_url)?path.resolve(profile.photo_url):path.resolve("uploads/registration",path.basename(profile.photo_url));if(!file.startsWith(uploadRoot+path.sep)||!fs.existsSync(file))return res.status(404).json({error:"Profile photo not found"});const ext=path.extname(file).toLowerCase();if(![".jpg",".jpeg",".png"].includes(ext))return res.status(415).json({error:"Unsupported profile photo"});res.type(ext===".png"?"image/png":"image/jpeg");res.set("Cache-Control","private, max-age=300");res.sendFile(file);});
r.get("/dashboard", async (req, res) => {
  const p = await me(req.user.id);
  const [alloc, offer, face, att, tasks, notes] = await Promise.all([
    q(
      `SELECT ba.*,b.name batch_name,b.start_date,b.end_date,d.name domain_name FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id LEFT JOIN domains d ON d.id=$2 WHERE ba.intern_id=$1 ORDER BY b.start_date DESC LIMIT 1`,
      [p.id, p.final_domain_id],
    ),
    q(
      `SELECT ol.* FROM offer_letters ol JOIN batch_allocations ba ON ba.id=ol.allocation_id WHERE ba.intern_id=$1 ORDER BY ol.created_at DESC LIMIT 1`,
      [p.id],
    ),
    q(
      "SELECT * FROM face_enrollments WHERE intern_id=$1 AND status<>'DELETED' ORDER BY created_at DESC LIMIT 1",
      [p.id],
    ),
    q(
      "SELECT * FROM attendance_daily WHERE intern_id=$1 ORDER BY day DESC LIMIT 31",
      [p.id],
    ),
    q(
      `SELECT wt.* FROM weekly_tasks wt JOIN batch_allocations ba ON ba.batch_id=wt.batch_id WHERE ba.intern_id=$1 AND wt.status IN ('RELEASED','IN_PROGRESS') AND (wt.domain_id IS NULL OR wt.domain_id=$2) AND (wt.group_id IS NULL OR EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=wt.group_id AND gm.intern_id=$1 AND gm.active)) ORDER BY wt.due_at`,
      [p.id, p.final_domain_id],
    ),
    q(
      "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20",
      [req.user.id],
    ),
  ]);
  res.json({
    profile: p,
    allocation: alloc.rows[0],
    offerLetter: offer.rows[0],
    face: face.rows[0],
    attendance: att.rows,
    tasks: tasks.rows,
    notifications: notes.rows,
  });
});
const proofUpload = multer({ dest: path.resolve("uploads/registration"), limits: { fileSize: 5 * 1024 * 1024, files: 2 } });
r.get("/proofs", async (req, res) => {
  const p = await me(req.user.id);
  res.json((await q(
    "SELECT id,proof_type,issuing_authority,reference_number,issue_date,approved_from,approved_to,status,reason,version,override_due_date,batch_order_id,file_names,created_at FROM college_proofs WHERE intern_id=$1 ORDER BY created_at DESC,id DESC",
    [p.id],
  )).rows);
});
r.get("/proofs/:id/file", async (req, res) => {
  const p = await me(req.user.id);
  const proof = (await q("SELECT id,file_path FROM college_proofs WHERE id=$1 AND intern_id=$2", [req.params.id, p.id])).rows[0];
  if (!proof) return res.status(404).json({ error: "Proof not found" });
  await audit(req, "PROOF_FILE_VIEWED", "college_proof", proof.id, null, { index: Number(req.query.index) || 0 });
  sendProofFile(res, proof, req.query.index);
});
// Active interns only reach this while an override is waiting for the real document.
r.post("/proofs", proofUpload.array("proofFiles", 2), async (req, res) => {
  const p = await me(req.user.id);
  const files = req.files || [];
  const discard = () => files.forEach((file) => fs.unlink(file.path, () => {}));
  try {
    const previous = await latestProof(p.id);
    if (previous?.status !== "OVERRIDE") {
      discard();
      return res.status(409).json({ error: "Your college proof cannot be changed at this stage" });
    }
    validateProofDetails(req.body);
    const stored = await storeProofFiles(files);
    const x = (await q(
      "INSERT INTO college_proofs(intern_id,proof_type,issuing_authority,reference_number,issue_date,approved_from,approved_to,coordinator_id,file_path,file_hash,file_names,version,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'UPLOADED') RETURNING id,status,version",
      [p.id, req.body.proofType, req.body.issuingAuthority, req.body.referenceNumber, req.body.issueDate, req.body.approvedFrom, req.body.approvedTo, previous.coordinator_id, stored.filePaths, stored.fileHash, stored.fileNames, Number(previous.version || 0) + 1],
    )).rows[0];
    await notifyAdmins("PROOF_UPLOADED", "College proof submitted", p.full_name + " submitted the outstanding college proof.", "/admin/verification");
    res.status(201).json(x);
  } catch (error) {
    discard();
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  }
});
r.post("/face-enrollment", async (req, res) => {
  const p = await me(req.user.id);
  const { consent, imageData } = req.body;
  if (!consent)
    return res.status(400).json({ error: "Biometric consent required" });
  if (!/^data:image\/(jpeg|jpg|png);base64,/.test(String(imageData || "")))
    return res
      .status(400)
      .json({ error: "A camera-captured JPEG/PNG image is required" });
  const latest = (
    await q(
      "SELECT * FROM face_enrollments WHERE intern_id=$1 AND status<>'DELETED' ORDER BY created_at DESC LIMIT 1",
      [p.id],
    )
  ).rows[0];
  if (latest && ["PENDING_ADMIN_APPROVAL", "APPROVED"].includes(latest.status))
    return res
      .status(409)
      .json({
        error:
          latest.status === "APPROVED"
            ? "Face enrollment is already approved"
            : "Face enrollment is already awaiting Admin approval",
      });
  const [, type, b64] =
    String(imageData).match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/) || [];
  const buf = Buffer.from(b64 || "", "base64");
  if (buf.length < 10000 || buf.length > 5 * 1024 * 1024)
    return res
      .status(400)
      .json({
        error:
          "Captured image quality/size is invalid. Retake the photo in good lighting.",
      });
  const dir = path.resolve("uploads/face-enrollment");
  fs.mkdirSync(dir, { recursive: true });
  const ext = type === "png" ? "png" : "jpg",
    file = path.join(dir, p.id + "-" + Date.now() + "." + ext);
  writeSecureFile(file, buf);
  // A superseded rejected/re-enrollment capture has no further purpose (Blueprint 19).
  const superseded = (await q("SELECT id,raw_image_path FROM face_enrollments WHERE intern_id=$1 AND status IN ('REJECTED','REENROLLMENT_REQUIRED') AND raw_image_path IS NOT NULL", [p.id])).rows;
  for (const old of superseded) {
    fs.unlink(old.raw_image_path, () => {});
    await q("UPDATE face_enrollments SET raw_image_path=NULL WHERE id=$1", [old.id]);
  }
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const x = (
    await q(
      `INSERT INTO face_enrollments(intern_id,template_ref,raw_image_path,status,consent_at,quality_score) VALUES($1,$2,$3,'PENDING_ADMIN_APPROVAL',now(),$4) RETURNING *`,
      [p.id, "capture:" + hash, file, Number(req.body.qualityScore || 1)],
    )
  ).rows[0];
  await notifyAdmins("FACE_ENROLLMENT_SUBMITTED", "Face enrollment submitted", p.full_name + " submitted a face enrollment for approval.", "/admin/attendance");
  res.status(201).json(x);
});
r.get("/attendance/status", async (req, res) => {
  const p = await me(req.user.id);
  const face = (
    await q(
      "SELECT id,status,decision_reason,approved_at FROM face_enrollments WHERE intern_id=$1 AND status<>'DELETED' ORDER BY created_at DESC LIMIT 1",
      [p.id],
    )
  ).rows[0];
  const today = (
    await q(
      "SELECT * FROM attendance_daily WHERE intern_id=$1 AND day=current_date",
      [p.id],
    )
  ).rows[0];
  const [allocation, summary, history, exceptions, dayState] = await Promise.all([
    q("SELECT ba.id,ba.batch_id,ba.intern_start,ba.intern_end,b.name batch_name,b.mode,b.min_attendance,b.late_after FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id WHERE ba.intern_id=$1 ORDER BY ba.intern_start DESC NULLS LAST LIMIT 1", [p.id]),
    q("SELECT s.* FROM attendance_summary s JOIN batch_allocations ba ON ba.id=s.allocation_id WHERE s.intern_id=$1 ORDER BY ba.intern_start DESC NULLS LAST LIMIT 1", [p.id]),
    q("SELECT day,status,check_in,check_out,working_minutes,source,holiday_name FROM attendance_calendar WHERE intern_id=$1 ORDER BY day DESC LIMIT 60", [p.id]),
    q("SELECT id,day,kind,reason,status,decision_reason,requested_value,created_at,decided_at FROM attendance_exceptions WHERE intern_id=$1 ORDER BY created_at DESC LIMIT 30", [p.id]),
    attendanceDayState(p.id),
  ]);
  res.json({ face, today, allocation: allocation.rows[0] || null, summary: summary.rows[0] || null, history: history.rows, exceptions: exceptions.rows, dayState });
});
r.post("/attendance/correction", async (req, res) => {
  const p = await me(req.user.id);
  const { day, requestedStatus = "PRESENT", checkIn, checkOut, reason } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || "")) || !String(reason || "").trim())
    return res.status(400).json({ error: "Date and reason are required" });
  if (!["PRESENT", "LATE"].includes(requestedStatus))
    return res.status(400).json({ error: "Correction can request Present or Late" });
  const allowed = (await q("SELECT 1 FROM batch_allocations WHERE intern_id=$1 AND $2::date BETWEEN intern_start AND LEAST(intern_end,current_date) LIMIT 1", [p.id, day])).rowCount;
  if (!allowed) return res.status(409).json({ error: "Choose a past or current day within your internship" });
  const open = (await q("SELECT 1 FROM attendance_exceptions WHERE intern_id=$1 AND day=$2 AND kind='CORRECTION_REQUEST' AND status='REQUESTED'", [p.id, day])).rowCount;
  if (open) return res.status(409).json({ error: "A correction request for this date is already pending" });
  const x = (await q(
    "INSERT INTO attendance_exceptions(intern_id,day,kind,reason,status,requested_value) VALUES($1,$2,'CORRECTION_REQUEST',$3,'REQUESTED',$4) RETURNING *",
    [p.id, day, String(reason).trim(), { requestedStatus, checkIn: checkIn || null, checkOut: checkOut || null }],
  )).rows[0];
  await notifyAdmins("ATTENDANCE_CORRECTION_REQUESTED", "Attendance correction requested", p.full_name + " requested a correction for " + day + ".", "/admin/attendance");
  res.status(201).json(x);
});
r.post("/attendance/verify", async (req, res) => {
  const p = await me(req.user.id);
  const f = (
    await q(
      "SELECT * FROM face_enrollments WHERE intern_id=$1 AND status='APPROVED' AND id=(SELECT id FROM face_enrollments WHERE intern_id=$1 AND status<>'DELETED' ORDER BY created_at DESC LIMIT 1)",
      [p.id],
    )
  ).rows[0];
  if (!f)
    return res.status(409).json({ error: "Approved face enrollment required" });
  const { eventType, imageData, baselineImageData, challengeType } = req.body;
  if (!["CHECK_IN", "CHECK_OUT"].includes(eventType))
    return res.status(400).json({ error: "Invalid attendance event" });
  if (!["TURN_LEFT", "TURN_RIGHT"].includes(challengeType))
    return res.status(400).json({ error: "Invalid liveness challenge" });
  if (!/^data:image\/(jpeg|jpg|png);base64,/.test(String(imageData || "")))
    return res.status(400).json({ error: "Live camera capture is required" });
  const buf = Buffer.from(String(imageData).split(",")[1] || "", "base64");
  if (buf.length < 10000 || buf.length > 5 * 1024 * 1024)
    return res.status(400).json({ error: "Invalid camera capture" });
  if (!/^data:image\/(jpeg|jpg|png);base64,/.test(String(baselineImageData || ""))) return res.status(400).json({ error: "Initial live face capture is required" });
  // Reject impossible events before running (and logging failures from) the biometric check.
  const alloc = (
    await q(
      "SELECT * FROM batch_allocations WHERE intern_id=$1 AND current_date BETWEEN intern_start AND intern_end ORDER BY intern_start DESC LIMIT 1",
      [p.id],
    )
  ).rows[0];
  if (!alloc)
    return res
      .status(409)
      .json({ error: "No active internship allocation for today" });
  const dayState = await attendanceDayState(p.id);
  if (dayState.blocked) return res.status(409).json({ error: dayState.message });
  const current = (await q("SELECT check_in,check_out FROM attendance_daily WHERE intern_id=$1 AND day=current_date", [p.id])).rows[0];
  if (eventType === "CHECK_IN" && current?.check_in) return res.status(409).json({ error: "Already checked in today" });
  if (eventType === "CHECK_OUT" && !current?.check_in) return res.status(409).json({ error: "Check in before checking out" });
  if (eventType === "CHECK_OUT" && current?.check_out) return res.status(409).json({ error: "Already checked out today" });
  const verified = await verifyAttendanceBiometrics({ imageData, baselineImageData, enrollment: f, challengeType });
  if (verified.unavailable) return res.status(503).json({ error: verified.reason });
  if (verified.rejected) return res.status(422).json({ error: verified.reason });
  const { matchScore, livenessScore, challengePass } = verified;
  if (!verified.ok) {
    // Retry first; only an unresolved failure becomes an exception (Blueprint 9.1).
    await q(
      "INSERT INTO attendance_events(intern_id,batch_id,event_type,match_score,liveness_pass,liveness_score,challenge_type,challenge_pass,status,failure_reason) VALUES($1,$2,$3,$4,false,$5,$6,$7,'FAILED',$8)",
      [p.id, alloc.batch_id, eventType, Number(matchScore), Number(livenessScore), challengeType, challengePass, verified.reason],
    );
    const failures = (await q("SELECT count(*)::int n FROM attendance_events WHERE intern_id=$1 AND event_type=$2 AND status='FAILED' AND event_time::date=current_date", [p.id, eventType])).rows[0].n;
    const maxRetries = Number(process.env.ATTENDANCE_MAX_RETRIES || 3);
    if (failures < maxRetries)
      return res.status(422).json({ error: "Face match failed. Please retry.", retriesLeft: maxRetries - failures });
    let ex = (await q("SELECT * FROM attendance_exceptions WHERE intern_id=$1 AND day=current_date AND kind='FAILED_MATCH' AND status='DETECTED' LIMIT 1", [p.id])).rows[0];
    if (!ex) {
      ex = (await q(
        "INSERT INTO attendance_exceptions(intern_id,day,kind,reason,status,requested_value) VALUES($1,current_date,'FAILED_MATCH','Live face did not meet the configured match threshold after retries','DETECTED',$2) RETURNING *",
        [p.id, { eventType, requestedStatus: "PRESENT", attempts: failures, matchScore: Number(matchScore), livenessScore: Number(livenessScore), challengeType, challengePass }],
      )).rows[0];
      await notifyAdmins("ATTENDANCE_EXCEPTION", "Attendance exception", p.full_name + " could not be verified after " + failures + " attempts.", "/admin/attendance", "ATT-EX:" + ex.id);
    }
    return res.status(422).json({
      error: "Face match failed. Attendance was not recorded; a correction request was sent to Admin.",
      exception: ex,
      retriesLeft: 0,
    });
  }
  const dir = path.resolve("uploads/attendance-evidence");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, p.id + "-" + Date.now() + ".jpg");
  writeSecureFile(file, buf);
  const outcome = await tx(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [p.id + ":attendance:" + new Date().toISOString().slice(0,10)]);
    const today = (await client.query(
      "SELECT * FROM attendance_daily WHERE intern_id=$1 AND day=current_date FOR UPDATE", [p.id],
    )).rows[0];
    if (eventType === "CHECK_IN" && today?.check_in) return { error: "Already checked in today" };
    if (eventType === "CHECK_OUT" && !today?.check_in) return { error: "Check in before checking out" };
    if (eventType === "CHECK_OUT" && today?.check_out) return { error: "Already checked out today" };
    const daily = eventType === "CHECK_IN"
      ? (await client.query(
        `INSERT INTO attendance_daily(intern_id,batch_id,day,check_in,status)
         SELECT $1,b.id,current_date,now(),CASE WHEN (now() AT TIME ZONE b.timezone)::time>b.late_after THEN 'LATE' ELSE 'PRESENT' END FROM batches b WHERE b.id=$2
         ON CONFLICT(intern_id,day) DO UPDATE SET check_in=COALESCE(attendance_daily.check_in,EXCLUDED.check_in),status=EXCLUDED.status RETURNING *`,
        [p.id, alloc.batch_id],
      )).rows[0]
      : (await client.query(
        "UPDATE attendance_daily SET check_out=now(),working_minutes=GREATEST(0,extract(epoch from(now()-check_in))/60)::int WHERE intern_id=$1 AND day=current_date AND check_in IS NOT NULL AND check_out IS NULL RETURNING *",
        [p.id],
      )).rows[0];
    if (!daily) throw new Error("Attendance daily record could not be updated");
    const ev = (await client.query(
      "INSERT INTO attendance_events(intern_id,batch_id,event_type,match_score,liveness_pass,evidence_ref,liveness_score,challenge_type,challenge_pass,capture_path) VALUES($1,$2,$3,$4,true,$5,$6,$7,$8,$9) RETURNING *",
      [p.id, alloc.batch_id, eventType, Number(matchScore), file, Number(livenessScore), challengeType, challengePass, file],
    )).rows[0];
    return { event: ev, daily };
  });
  if (outcome.error) return res.status(409).json({ error: outcome.error });
  res.status(201).json(outcome);
});
r.get("/work-log", async (req, res) => {
  const p = await me(req.user.id);
  const [reports, leaves, holidays, allocation] = await Promise.all([
    q(
      "SELECT * FROM daily_reports WHERE intern_id=$1 ORDER BY day DESC LIMIT 90",
      [p.id],
    ),
    q(
      "SELECT * FROM leave_requests WHERE intern_id=$1 ORDER BY created_at DESC",
      [p.id],
    ),
    q(
      `SELECT h.* FROM holidays h JOIN batch_allocations ba ON ba.batch_id=h.batch_id WHERE ba.intern_id=$1 AND h.day BETWEEN ba.intern_start AND ba.intern_end ORDER BY h.day`,
      [p.id],
    ),
    q(
      "SELECT ba.*,b.leave_limit_days,b.name batch_name FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id WHERE ba.intern_id=$1 ORDER BY ba.intern_start DESC LIMIT 1",
      [p.id],
    ),
  ]);
  const used = leaves.rows
    .filter((x) => x.status === "APPROVED")
    .reduce((n, x) => n + Number(x.requested_days || 0), 0);
  res.json({
    reports: reports.rows,
    leaves: leaves.rows,
    holidays: holidays.rows,
    allocation: allocation.rows[0] || null,
    approvedLeaveDays: used,
    remainingLeaveDays: Math.max(
      0,
      Number(allocation.rows[0]?.leave_limit_days || 0) - used,
    ),
  });
});
r.post("/daily-report", async (req, res) => {
  const p = await me(req.user.id);
  const {
    plannedTasks,
    completedTasks,
    pendingBlockers,
    proofLinks = [],
    phase,
  } = req.body;
  if (!["MORNING", "EVENING"].includes(phase))
    return res.status(400).json({ error: "Invalid report phase" });
  if (phase === "MORNING" && !String(plannedTasks || "").trim())
    return res.status(400).json({ error: "Planned tasks are required" });
  if (phase === "EVENING" && !String(completedTasks || "").trim())
    return res.status(400).json({ error: "Completed work is required" });
  if (!Array.isArray(proofLinks) || proofLinks.length > 10)
    return res
      .status(400)
      .json({ error: "Proof links must be a list of up to 10 links" });
  const bad = proofLinks.find((x) => {
    try {
      const u = new URL(x);
      return !["http:", "https:"].includes(u.protocol);
    } catch {
      return true;
    }
  });
  if (bad)
    return res
      .status(400)
      .json({ error: "Every proof link must be a valid http/https URL" });
  const existing = (
    await q(
      "SELECT * FROM daily_reports WHERE intern_id=$1 AND day=current_date",
      [p.id],
    )
  ).rows[0];
  if (phase === "MORNING" && existing?.morning_at)
    return res
      .status(409)
      .json({ error: "Morning plan already submitted today" });
  if (phase === "EVENING" && !existing?.morning_at)
    return res
      .status(409)
      .json({ error: "Submit the morning plan before the evening report" });
  if (phase === "EVENING" && existing?.evening_at)
    return res
      .status(409)
      .json({ error: "Evening report already submitted today" });
  const x = (
    await q(
      `INSERT INTO daily_reports(intern_id,day,planned_tasks,completed_tasks,pending_blockers,proof_links,morning_at,evening_at) VALUES($1,current_date,$2,$3,$4,$5,CASE WHEN $6='MORNING' THEN now() END,CASE WHEN $6='EVENING' THEN now() END) ON CONFLICT(intern_id,day) DO UPDATE SET planned_tasks=COALESCE(EXCLUDED.planned_tasks,daily_reports.planned_tasks),completed_tasks=COALESCE(EXCLUDED.completed_tasks,daily_reports.completed_tasks),pending_blockers=COALESCE(EXCLUDED.pending_blockers,daily_reports.pending_blockers),proof_links=CASE WHEN EXCLUDED.proof_links='[]'::jsonb THEN daily_reports.proof_links ELSE EXCLUDED.proof_links END,morning_at=COALESCE(EXCLUDED.morning_at,daily_reports.morning_at),evening_at=COALESCE(EXCLUDED.evening_at,daily_reports.evening_at) RETURNING *`,
      [
        p.id,
        plannedTasks || null,
        completedTasks || null,
        pendingBlockers || null,
        JSON.stringify(proofLinks),
        phase,
      ],
    )
  ).rows[0];
  res.json(x);
});
r.post("/leave", async (req, res) => {
  const p = await me(req.user.id);
  const { fromDate, toDate, reason } = req.body;
  if (!fromDate || !toDate || !String(reason || "").trim())
    return res
      .status(400)
      .json({ error: "From date, to date and reason are required" });
  if (new Date(toDate) < new Date(fromDate))
    return res
      .status(400)
      .json({ error: "Leave end date cannot be before start date" });
  const alloc = (
    await q(
      "SELECT ba.*,b.leave_limit_days,b.working_days FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id WHERE ba.intern_id=$1 AND $2::date BETWEEN ba.intern_start AND ba.intern_end AND $3::date BETWEEN ba.intern_start AND ba.intern_end ORDER BY ba.intern_start DESC LIMIT 1",
      [p.id, fromDate, toDate],
    )
  ).rows[0];
  if (!alloc)
    return res
      .status(409)
      .json({ error: "Leave dates must be inside your internship allocation" });
  const days = (
    await q(
      `SELECT count(*)::int n FROM generate_series($1::date,$2::date,'1 day') d WHERE $4::jsonb @> to_jsonb(extract(dow from d)::int) AND NOT EXISTS(SELECT 1 FROM holidays h WHERE h.batch_id=$3 AND h.day=d::date)`,
      [fromDate, toDate, alloc.batch_id, JSON.stringify(alloc.working_days)],
    )
  ).rows[0].n;
  if (!days)
    return res
      .status(400)
      .json({ error: "The selected range contains no working days" });
  const overlap = (
    await q(
      "SELECT 1 FROM leave_requests WHERE intern_id=$1 AND status IN('REQUESTED','APPROVED') AND daterange(from_date,to_date,'[]') && daterange($2::date,$3::date,'[]') LIMIT 1",
      [p.id, fromDate, toDate],
    )
  ).rows[0];
  if (overlap)
    return res
      .status(409)
      .json({ error: "An active leave request already overlaps these dates" });
  const used = Number(
    (
      await q(
        "SELECT COALESCE(sum(requested_days),0) n FROM leave_requests WHERE intern_id=$1 AND status='APPROVED'",
        [p.id],
      )
    ).rows[0].n,
  );
  if (used + Number(days) > Number(alloc.leave_limit_days || 0))
    return res
      .status(409)
      .json({
        error:
          "Leave limit exceeded. Remaining allowance: " +
          Math.max(0, Number(alloc.leave_limit_days || 0) - used) +
          " working day(s)",
      });
  const x = (
    await q(
      "INSERT INTO leave_requests(intern_id,from_date,to_date,reason,status,requested_days) VALUES($1,$2,$3,$4,'REQUESTED',$5) RETURNING *",
      [p.id, fromDate, toDate, reason.trim(), days],
    )
  ).rows[0];
  await notifyAdmins("LEAVE_REQUESTED", "Leave requested", p.full_name + " requested leave from " + fromDate + " to " + toDate + ".", "/admin/leave");
  await notifyGroupMentors(p.id, "LEAVE_REQUESTED", "Leave requested", p.full_name + " requested leave from " + fromDate + " to " + toDate + ".", "/mentor/operations");
  res.status(201).json(x);
});
r.get("/tasks/:id/submissions", async (req, res) => {
  const p = await me(req.user.id);
  res.json(
    (
      await q(
        "SELECT ts.id,ts.content,ts.file_name,ts.mime_type,ts.status,ts.submitted_at,ts.is_late,ts.attempt,ts.mentor_feedback,ts.rework_due_at,te.marks,te.rework_instructions FROM task_submissions ts LEFT JOIN LATERAL(SELECT marks,rework_instructions FROM task_evaluations e WHERE e.submission_id=ts.id ORDER BY e.created_at DESC LIMIT 1) te ON true WHERE ts.task_id=$1 AND ts.intern_id=$2 ORDER BY ts.attempt DESC",
        [req.params.id, p.id],
      )
    ).rows,
  );
});
r.post("/tasks/:id/submit", taskUpload.single("file"), async (req, res) => {
  const p = await me(req.user.id);
  const t = (
    await q("SELECT * FROM weekly_tasks WHERE id=$1 AND status='RELEASED'", [
      req.params.id,
    ])
  ).rows[0];
  if (!t) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: "Released task not found" });
  }
  const alloc = (
    await q(
      "SELECT 1 FROM batch_allocations ba LEFT JOIN group_members gm ON gm.intern_id=ba.intern_id AND gm.active WHERE ba.intern_id=$1 AND ba.batch_id=$2 AND ($3::uuid IS NULL OR gm.group_id=$3) AND ($4::uuid IS NULL OR $4=$5::uuid) LIMIT 1",
      [p.id, t.batch_id, t.group_id, t.domain_id, p.final_domain_id],
    )
  ).rowCount;
  if (!alloc) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: "Task is not assigned to you" });
  }
  let content = {};
  try {
    content = JSON.parse(req.body.content || "{}");
  } catch {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Invalid submission content" });
  }
  const allowed = t.submission_types || [];
  const rejectContent = (message) => {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: message });
  };
  if (content.repositoryUrl && !allowed.includes("REPOSITORY"))
    return rejectContent("Repository submission is not enabled for this task");
  if (content.videoUrl && !allowed.includes("VIDEO"))
    return rejectContent("Video link submission is not enabled for this task");
  if (content.link && !allowed.includes("LINK"))
    return rejectContent("Link submission is not enabled for this task");
  if (content.text && !allowed.includes("TEXT"))
    return rejectContent("Text submission is not enabled for this task");
  if (
    req.file &&
    !["FILE", "DOCUMENT", "PRESENTATION", "VIDEO"].some((x) =>
      allowed.includes(x),
    )
  ) {
    fs.unlinkSync(req.file.path);
    return res
      .status(400)
      .json({ error: "File submission is not enabled for this task" });
  }
  for (const u of [
    content.repositoryUrl,
    content.videoUrl,
    content.link,
  ].filter(Boolean)) {
    try {
      const x = new URL(u);
      if (!["http:", "https:"].includes(x.protocol)) throw 0;
    } catch {
      return rejectContent("Submission URLs must be valid http/https links");
    }
  }
  if (!req.file && !Object.values(content).some(Boolean))
    return res
      .status(400)
      .json({ error: "Provide at least one required submission item" });
  const previous = (
      await q(
        "SELECT * FROM task_submissions WHERE task_id=$1 AND intern_id=$2 ORDER BY attempt DESC LIMIT 1",
        [t.id, p.id],
      )
    ).rows[0],
    prev = Number(previous?.attempt || 0);
  if (previous && previous.status !== "REWORK_REQUIRED") {
    if (req.file) fs.unlinkSync(req.file.path);
    return res
      .status(409)
      .json({
        error: "A new attempt is allowed only after Mentor requests rework",
      });
  }
  if (previous && !t.resubmission_allowed) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(409).json({ error: "Resubmission is not allowed" });
  }
  const deadline = previous?.rework_due_at || t.due_at;
  const x = (
    await q(
      "INSERT INTO task_submissions(task_id,intern_id,content,file_path,file_name,mime_type,is_late,attempt,status) VALUES($1,$2,$3,$4,$5,$6,now()>$7,$8,$9) RETURNING *",
      [
        t.id,
        p.id,
        content,
        req.file?.path || null,
        req.file?.originalname || null,
        req.file?.mimetype || null,
        deadline,
        prev + 1,
        prev ? "RESUBMITTED" : "SUBMITTED",
      ],
    )
  ).rows[0];
  await notifyGroupMentors(p.id, "TASK_SUBMITTED", "Task submitted", p.full_name + " submitted " + t.title + ".", "/mentor");
  res.status(201).json(x);
});
r.get("/assessments", async (req, res) => {
  const p = await me(req.user.id);
  res.json(
    (
      await q(
        `SELECT a.*,aa.id attempt_id,aa.status attempt_status,aa.total_score,aa.started_at,aa.submitted_at FROM assessments a JOIN batch_allocations ba ON ba.batch_id=a.batch_id AND ba.intern_id=$1 LEFT JOIN LATERAL (SELECT * FROM assessment_attempts x WHERE x.assessment_id=a.id AND x.intern_id=$1 ORDER BY x.started_at DESC LIMIT 1) aa ON true WHERE a.status IN ('PUBLISHED','ACTIVE') ORDER BY a.window_start NULLS FIRST`,
        [p.id],
      )
    ).rows,
  );
});
r.post("/assessments/:id/start", async (req, res) => {
  const p = await me(req.user.id);
  const a = (
    await q(
      `SELECT a.* FROM assessments a JOIN batch_allocations ba ON ba.batch_id=a.batch_id WHERE a.id=$1 AND ba.intern_id=$2 AND a.status IN ('PUBLISHED','ACTIVE')`,
      [req.params.id, p.id],
    )
  ).rows[0];
  if (!a) return res.status(404).json({ error: "Assessment not available" });
  const now = new Date();
  if (a.window_start && now < new Date(a.window_start))
    return res.status(409).json({ error: "Assessment has not opened yet" });
  if (a.window_end && now > new Date(a.window_end))
    return res.status(409).json({ error: "Assessment window has closed" });
  const active = (await q("SELECT * FROM assessment_attempts WHERE assessment_id=$1 AND intern_id=$2 AND status='IN_PROGRESS' ORDER BY started_at DESC LIMIT 1", [a.id, p.id])).rows[0];
  if (active) return res.json(active);
  const count = Number(
    (
      await q(
        "SELECT count(*) n FROM assessment_attempts WHERE assessment_id=$1 AND intern_id=$2",
        [a.id, p.id],
      )
    ).rows[0].n,
  );
  if (count >= Number(a.attempt_count || 1))
    return res
      .status(409)
      .json({ error: "Maximum assessment attempts reached" });
  const at = (
    await q(
      "INSERT INTO assessment_attempts(assessment_id,intern_id,status,started_at) VALUES($1,$2,'IN_PROGRESS',now()) RETURNING *",
      [a.id, p.id],
    )
  ).rows[0];
  res.status(201).json(at);
});
r.get("/assessments/:id/questions", async (req, res) => {
  const p = await me(req.user.id);
  const at = (
    await q(
      `SELECT aa.*,a.duration_minutes,a.randomize,a.window_end FROM assessment_attempts aa JOIN assessments a ON a.id=aa.assessment_id WHERE aa.assessment_id=$1 AND aa.intern_id=$2 AND aa.status='IN_PROGRESS' ORDER BY aa.started_at DESC LIMIT 1`,
      [req.params.id, p.id],
    )
  ).rows[0];
  if (!at) return res.status(409).json({ error: "Start the assessment first" });
  const deadline = new Date(
    new Date(at.started_at).getTime() +
      Number(at.duration_minutes || 60) * 60000,
  );
  if (at.window_end && new Date(at.window_end) < deadline)
    deadline.setTime(new Date(at.window_end).getTime());
  const sec = await sectionsForIntern(req.params.id, p);
  const ids = sec.flatMap((x) => x.question_ids || []);
  let qs = ids.length
    ? (
        await q(
          "SELECT id,topic,difficulty,type,question,options,marks FROM question_bank WHERE id=ANY($1::uuid[])",
          [ids],
        )
      ).rows
    : [];
  const order = new Map(ids.map((id, i) => [id, i]));
  qs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  if (at.randomize) {
    qs = shuffled(qs).map((x) => (Array.isArray(x.options) ? { ...x, options: shuffled(x.options) } : x));
  }
  res.json({
    attemptId: at.id,
    startedAt: at.started_at,
    deadline: deadline.toISOString(),
    sections: sec.map(({ id, name, domain_id, question_ids }) => ({ id, name, domain_id, question_ids })),
    questions: qs,
  });
});
r.post("/assessments/:id/tab-switch", async (req, res) => {
  const p = await me(req.user.id);
  const x = (await q("UPDATE assessment_attempts SET tab_switches=tab_switches+1 WHERE assessment_id=$1 AND intern_id=$2 AND status='IN_PROGRESS' RETURNING tab_switches", [req.params.id, p.id])).rows[0];
  if (!x) return res.status(409).json({ error: "No active assessment attempt" });
  res.json(x);
});
r.post("/assessments/:id/submit", async (req, res) => {
  const p = await me(req.user.id);
  const { attemptId, answers = [] } = req.body;
  if (!Array.isArray(answers)) return res.status(400).json({ error: "Answers must be an array" });
  const ids = answers.map((answer) => answer?.questionId);
  if (ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length)
    return res.status(400).json({ error: "Each question can be answered only once" });
  try {
    const result = await tx(async (client) => {
      const at = (await client.query(
        "SELECT aa.*,a.duration_minutes,a.window_end FROM assessment_attempts aa JOIN assessments a ON a.id=aa.assessment_id WHERE aa.id=$1 AND aa.assessment_id=$2 AND aa.intern_id=$3 FOR UPDATE OF aa",
        [attemptId, req.params.id, p.id],
      )).rows[0];
      if (!at || at.status !== "IN_PROGRESS") return { error: "No active assessment attempt", code: 409 };
      const deadline = new Date(new Date(at.started_at).getTime() + Number(at.duration_minutes || 60) * 60000);
      if (at.window_end && new Date(at.window_end) < deadline) deadline.setTime(new Date(at.window_end).getTime());
      if (Date.now() > deadline.getTime()+5000) return { error: "Assessment submission deadline has passed", code: 409 };
      const sections = await sectionsForIntern(req.params.id, p);
      const validIds = new Set(sections.flatMap((section) => section.question_ids || []));
      if (ids.some((id) => !validIds.has(id))) return { error: "Submitted answer contains an invalid question", code: 400 };
      const questions = ids.length ? (await client.query(
        "SELECT id,correct_answer,marks,type FROM question_bank WHERE id=ANY($1::uuid[])", [ids],
      )).rows : [];
      const questionMap = new Map(questions.map((question) => [question.id, question]));
      if (questionMap.size !== ids.length) return { error: "Assessment question unavailable", code: 409 };
      const allQuestions=validIds.size?(await client.query("SELECT id,type FROM question_bank WHERE id=ANY($1::uuid[])",[[...validIds]])).rows:[];
      const submittedIds=new Set(ids);
      let total=0,manualPending=allQuestions.some(question=>["SHORT_TEXT","DESCRIPTIVE"].includes(question.type)&&!submittedIds.has(question.id));
      for (const answer of answers) {
        const question = questionMap.get(answer.questionId);
        let score = null;
        if (["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(question.type)) {
          const norm = (value) => Array.isArray(value) ? value.map((v) => String(v).trim().toLowerCase()).sort() : String(value ?? "").trim().toLowerCase();
          score = JSON.stringify(norm(question.correct_answer)) === JSON.stringify(norm(answer.answer)) ? Number(question.marks || 0) : 0;
          total += score;
        } else manualPending = true;
        await client.query(
          "INSERT INTO assessment_answers(attempt_id,question_id,answer,auto_score,status) VALUES($1,$2,$3,$4,'SUBMITTED')",
          [at.id, answer.questionId, answer.answer === undefined ? null : JSON.stringify(answer.answer), score],
        );
      }
      const updated = (await client.query(
        "UPDATE assessment_attempts SET total_score=$1,status=$2,submitted_at=now() WHERE id=$3 AND status='IN_PROGRESS' RETURNING *",
        [total, manualPending ? "PENDING_EVALUATION" : "EVALUATED", at.id],
      )).rows[0];
      if (!updated) throw new Error("Assessment state changed during submission");
      return { attempt: updated, manualPending };
    });
    if (result.error) return res.status(result.code).json({ error: result.error });
    res.status(201).json({ ...result.attempt, manualEvaluationPending: result.manualPending });
  } catch (error) {
    res.status(500).json({ error: "Assessment submission failed; no answers were saved" });
  }
});
r.get("/group", async (req, res) => {
  const p = await me(req.user.id);
  const g = (
    await q(
      `SELECT g.*,pa.project_id,pr.title project_title,pr.description project_description FROM group_members gm JOIN groups g ON g.id=gm.group_id LEFT JOIN project_assignments pa ON pa.group_id=g.id AND pa.status='ASSIGNED' LEFT JOIN projects pr ON pr.id=pa.project_id WHERE gm.intern_id=$1 AND gm.active ORDER BY g.created_at DESC LIMIT 1`,
      [p.id],
    )
  ).rows[0];
  if (!g) return res.json(null);
  g.members = (
    await q(
      "SELECT ip.id,ip.full_name,ip.program,ip.branch FROM group_members gm JOIN intern_profiles ip ON ip.id=gm.intern_id WHERE gm.group_id=$1 AND gm.active",
      [g.id],
    )
  ).rows;
  g.mentors = (
    await q(
      "SELECT m.full_name,ma.is_lead FROM mentor_assignments ma JOIN mentors m ON m.id=ma.mentor_id WHERE ma.group_id=$1 AND ma.active",
      [g.id],
    )
  ).rows;
  res.json(g);
});
r.get("/reviews", async (req, res) => {
  const p = await me(req.user.id);
  res.json(
    (
      await q(
        `SELECT fr.id,fr.group_id,fr.period_no,fr.review_date,fr.status,fr.progress,fr.domain_review,fr.presentation_review,fr.group_marks,fr.feedback,fr.action_items,fr.next_expectations,fr.published_at,fr.rubric_scores,rim.marks individual_marks,rim.contribution_note FROM fortnight_reviews fr JOIN group_members gm ON gm.group_id=fr.group_id LEFT JOIN review_individual_marks rim ON rim.review_id=fr.id AND rim.intern_id=gm.intern_id WHERE gm.intern_id=$1 AND gm.active AND (fr.status='PUBLISHED' OR fr.status='SCHEDULED') ORDER BY fr.review_date DESC`,
        [p.id],
      )
    ).rows,
  );
});
r.get("/offer-letters", async (req, res) => {
  const p = await me(req.user.id);
  res.json(
    (
      await q(
        `SELECT ol.id,ol.student_name_snapshot,ol.college_snapshot,ol.batch_snapshot,ol.from_date,ol.to_date,ol.duration_text,ol.issue_at,ol.reference_number,ol.status,ol.reason,olt.body template_body,olt.signatory FROM offer_letters ol JOIN batch_allocations ba ON ba.id=ol.allocation_id LEFT JOIN offer_letter_templates olt ON olt.id=ol.template_id WHERE ba.intern_id=$1 AND ol.status IN ('ISSUED','REISSUED','REVOKED') ORDER BY ol.created_at DESC`,
        [p.id],
      )
    ).rows,
  );
});
r.get("/offer-letters/:id/view", async (req, res) => {
  const p = await me(req.user.id);
  const x = (
    await q(
      `SELECT ol.*,olt.body template_body,olt.signatory FROM offer_letters ol JOIN batch_allocations ba ON ba.id=ol.allocation_id LEFT JOIN offer_letter_templates olt ON olt.id=ol.template_id WHERE ol.id=$1 AND ba.intern_id=$2 AND ol.status IN ('ISSUED','REISSUED','REVOKED')`,
      [req.params.id, p.id],
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
  let body = x.template_body || "";
  for (const [k, v] of Object.entries(values))
    body = body.replaceAll("{{" + k + "}}", v || "");
  res.json({ ...x, rendered_body: x.issued_snapshot?.rendered_body ?? body, signatory: x.issued_snapshot?.signatory ?? x.signatory });
});
r.get("/offer-letters/:id/pdf", async (req, res) => {
  const p = await me(req.user.id);
  const offer = (await q(
    "SELECT ol.*,olt.body template_body,olt.signatory FROM offer_letters ol JOIN batch_allocations ba ON ba.id=ol.allocation_id LEFT JOIN offer_letter_templates olt ON olt.id=ol.template_id WHERE ol.id=$1 AND ba.intern_id=$2 AND ol.status IN ('ISSUED','REISSUED')",
    [req.params.id, p.id],
  )).rows[0];
  if (!offer) return res.status(404).json({ error: "Issued offer letter not found" });
  sendOfferPdf(res, offer);
});
r.get("/certificate/file",async(req,res)=>{const p=await me(req.user.id);const x=(await q("SELECT * FROM certificates WHERE intern_id=$1 AND status='ISSUED' ORDER BY created_at DESC LIMIT 1",[p.id])).rows[0];if(!x?.file_path||!fs.existsSync(x.file_path))return res.status(404).json({error:"Certificate is not available"});res.download(path.resolve(x.file_path),x.certificate_id+".pdf")});
r.get("/completion", async (req, res) => {
  const p = await me(req.user.id);
  const evaluation = (
    await q(
      "SELECT * FROM final_evaluations WHERE intern_id=$1 ORDER BY created_at DESC LIMIT 1",
      [p.id],
    )
  ).rows[0];
  const approval = (
    await q(
      "SELECT * FROM completion_approvals WHERE intern_id=$1 ORDER BY approved_at DESC LIMIT 1",
      [p.id],
    )
  ).rows[0];
  const certificate = (
    await q(
      "SELECT * FROM certificates WHERE intern_id=$1 AND status<>'DELETED' ORDER BY created_at DESC LIMIT 1",
      [p.id],
    )
  ).rows[0];
  const exit = (await q("SELECT type,exit_date,reason FROM exit_records WHERE intern_id=$1 ORDER BY created_at DESC LIMIT 1", [p.id])).rows[0];
  const report = (await q("SELECT id,status,created_at FROM college_completion_reports WHERE intern_id=$1 ORDER BY created_at DESC LIMIT 1", [p.id])).rows[0];
  res.json({ evaluation, approval, certificate, exit, collegeReport: report || null });
});

r.get("/final-project-submission",async(req,res)=>{
 const p=await me(req.user.id);
 if(!p)return res.status(404).json({error:"Intern profile not found"});
 const group=(await q("SELECT gm.group_id,g.name group_name,pa.project_id,pr.title project_title FROM group_members gm JOIN groups g ON g.id=gm.group_id JOIN project_assignments pa ON pa.group_id=gm.group_id AND pa.status='ASSIGNED' JOIN projects pr ON pr.id=pa.project_id WHERE gm.intern_id=$1 AND gm.active ORDER BY pa.id LIMIT 1",[p.id])).rows[0];
 if(!group)return res.json({group:null,submission:null});
 const submission=(await q("SELECT id,group_id,project_id,document_id,repository_url,demo_url,notes,status,mentor_feedback,reviewed_at,created_at,updated_at FROM final_project_submissions WHERE group_id=$1 AND project_id=$2",[group.group_id,group.project_id])).rows[0]||null;
 res.json({group,submission});
});
r.post("/final-project-submission",async(req,res)=>{
 const p=await me(req.user.id);
 if(!p)return res.status(404).json({error:"Intern profile not found"});
 const group=(await q("SELECT gm.group_id,pa.project_id FROM group_members gm JOIN project_assignments pa ON pa.group_id=gm.group_id AND pa.status='ASSIGNED' WHERE gm.intern_id=$1 AND gm.active ORDER BY pa.id LIMIT 1",[p.id])).rows[0];
 if(!group)return res.status(409).json({error:"An active group with an assigned project is required"});
 const {documentId=null,repositoryUrl=null,demoUrl=null,notes=""}=req.body||{};
 if((repositoryUrl&&!validExternalDocumentUrl(repositoryUrl))||(demoUrl&&!validExternalDocumentUrl(demoUrl)))return res.status(400).json({error:"Repository and demo links must be valid HTTP(S) URLs"});
 if(!documentId&&!repositoryUrl&&!demoUrl)return res.status(400).json({error:"Provide a shared document, repository URL or demo URL"});
 if(typeof notes!=="string"||notes.length>5000)return res.status(400).json({error:"Notes must be at most 5000 characters"});
 if(documentId){
  const owned=(await q("SELECT 1 FROM documents WHERE id=$1 AND group_id=$2 AND active",[documentId,group.group_id])).rowCount;
  if(!owned)return res.status(403).json({error:"Document is not shared with your group"});
 }
 const approved=(await q("SELECT 1 FROM completion_approvals ca JOIN group_members gm ON gm.intern_id=ca.intern_id WHERE gm.group_id=$1 AND gm.active AND ca.status='APPROVED'",[group.group_id])).rowCount;
 if(approved)return res.status(409).json({error:"Final submission is locked after completion approval"});
 const x=(await q(`INSERT INTO final_project_submissions(group_id,project_id,submitted_by,document_id,repository_url,demo_url,notes) VALUES($1,$2,$3,$4,$5,$6,$7)
 ON CONFLICT(group_id,project_id) DO UPDATE SET submitted_by=EXCLUDED.submitted_by,document_id=EXCLUDED.document_id,repository_url=EXCLUDED.repository_url,demo_url=EXCLUDED.demo_url,notes=EXCLUDED.notes,status='SUBMITTED',mentor_feedback=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
 RETURNING *`,[group.group_id,group.project_id,req.user.id,documentId,repositoryUrl,demoUrl,notes])).rows[0];
 res.status(201).json(x);
});
export default r;

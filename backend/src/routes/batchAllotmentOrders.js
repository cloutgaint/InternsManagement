import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { q, tx } from "../common/database/index.js";
import { audit } from "../common/audit/audit.service.js";
import { acceptUpload, detectFileType, readSecureFile } from "../common/storage/secureFiles.js";
import { notifyWithEmail } from "../common/notifications/notification.service.js";
import { linkInternToOrder } from "../services/proofService.js";
const router = Router();
const dir = path.resolve("uploads/batch-allotments");
fs.mkdirSync(dir, { recursive: true });
const upload = multer({ dest: dir, limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
router.get("/batch-allotment-orders", async (_req, res) => {
  const rows = (await q("SELECT o.*,b.name batch_name,b.code batch_code FROM batch_allotment_orders o JOIN batches b ON b.id=o.batch_id ORDER BY o.created_at DESC")).rows;
  res.json(rows.map(({ file_path, ...order }) => order));
});
router.post("/batch-allotment-orders", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Maximum file size is 5 MB" : err.message });
    next();
  });
}, async (req, res) => {
  const file = req.file;
  let saved = false;
  try {
    const { batchId, referenceNumber, issueDate, issuingAuthority, approvedFrom, approvedTo } = req.body;
    if (!file) return res.status(400).json({ error: "Allotment document is required" });
    if (!batchId || !String(referenceNumber || "").trim() || !String(issuingAuthority || "").trim() || !validDate(issueDate) || !validDate(approvedFrom) || !validDate(approvedTo) || approvedTo < approvedFrom || issueDate > new Date().toISOString().slice(0, 10))
      return res.status(400).json({ error: "Valid reference, authority, issue date and approved period are required" });
    const batch = (await q("SELECT id,start_date,end_date FROM batches WHERE id=$1", [batchId])).rows[0];
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    const { hash } = await acceptUpload(file);
    const duplicate = (await q("SELECT id FROM batch_allotment_orders WHERE file_hash=$1 OR lower(reference_number)=lower($2) LIMIT 1", [hash, referenceNumber.trim()])).rows[0];
    if (duplicate) return res.status(409).json({ error: "Duplicate document or reference number" });
    const order = (await q("INSERT INTO batch_allotment_orders(batch_id,reference_number,issue_date,issuing_authority,file_path,file_hash,approved_from,approved_to,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'UPLOADED') RETURNING *", [batchId,referenceNumber.trim(),issueDate,issuingAuthority.trim(),file.path,hash,approvedFrom,approvedTo])).rows[0];
    saved = true;
    await audit(req, "BATCH_ALLOTMENT_UPLOADED", "batch_allotment_order", order.id, null, { ...order, file_path: undefined });
    res.status(201).json({ ...order, file_path: undefined });
  } catch (error) {
    if (!res.headersSent) {
      if (error.code === "23505") res.status(409).json({ error: "Allotment reference already exists" });
      else res.status(error.status || 500).json({ error: error.status ? error.message : "Unable to save allotment order" });
    }
  } finally {
    if (file && !saved) fs.unlink(file.path, () => {});
  }
});
router.post("/batch-allotment-orders/:id/verify", async (req, res) => {
  const { outcome, reason } = req.body;
  if (!["VERIFIED","REJECTED"].includes(outcome)) return res.status(400).json({ error: "Invalid verification outcome" });
  if (outcome === "REJECTED" && !String(reason || "").trim()) return res.status(400).json({ error: "Rejection reason required" });
  const before = (await q("SELECT * FROM batch_allotment_orders WHERE id=$1", [req.params.id])).rows[0];
  if (!before) return res.status(404).json({ error: "Allotment order not found" });
  if (before.status !== "UPLOADED") return res.status(409).json({ error: "Allotment order already reviewed" });
  const order = (await q("UPDATE batch_allotment_orders SET status=$2,verification_reason=$3,verified_by=$4,verified_at=now() WHERE id=$1 AND status='UPLOADED' RETURNING *", [req.params.id,outcome,String(reason || "").trim() || null,req.user.id])).rows[0];
  if (!order) return res.status(409).json({ error: "Review state changed; reload" });
  await audit(req, "BATCH_ALLOTMENT_" + outcome, "batch_allotment_order", order.id, before, { ...order, file_path: undefined });
  res.json({ ...order, file_path: undefined });
});
router.get("/batch-allotment-orders/:id/file", async (req, res) => {
  const order = (await q("SELECT file_path FROM batch_allotment_orders WHERE id=$1", [req.params.id])).rows[0];
  if (!order?.file_path || !fs.existsSync(order.file_path)) return res.status(404).json({ error: "Document unavailable" });
  const bytes = readSecureFile(order.file_path);
  const type = detectFileType(bytes);
  await audit(req, "BATCH_ALLOTMENT_FILE_VIEWED", "batch_allotment_order", req.params.id);
  res.set("Content-Type", type?.mime || "application/octet-stream");
  res.set("Cache-Control", "private, no-store");
  res.set("Content-Disposition", "attachment; filename=\"batch-allotment-document" + (type?.ext || "") + "\"");
  res.send(bytes);
});
router.get("/batch-allotment-orders/:id/students", async (req, res) => {
  res.json((await q(
    `SELECT bos.id,bos.roll_number,bos.intern_id,ip.full_name,u.status account_status FROM batch_order_students bos
     LEFT JOIN intern_profiles ip ON ip.id=bos.intern_id LEFT JOIN users u ON u.id=ip.user_id WHERE bos.order_id=$1 ORDER BY bos.roll_number`,
    [req.params.id],
  )).rows);
});
// Links listed roll numbers. Students already registered are moved past individual proof review;
// the rest are covered automatically when they register.
router.post("/batch-allotment-orders/:id/students", async (req, res) => {
  const rolls = [...new Set((Array.isArray(req.body.rollNumbers) ? req.body.rollNumbers : []).map((x) => String(x).trim()).filter(Boolean))];
  if (!rolls.length) return res.status(400).json({ error: "Provide at least one roll number" });
  if (rolls.length > 2000) return res.status(400).json({ error: "Link at most 2000 roll numbers at a time" });
  const order = (await q("SELECT o.*,b.college_id FROM batch_allotment_orders o JOIN batches b ON b.id=o.batch_id WHERE o.id=$1", [req.params.id])).rows[0];
  if (!order) return res.status(404).json({ error: "Allotment order not found" });
  if (order.status !== "VERIFIED") return res.status(409).json({ error: "Verify the allotment order before linking students" });
  const linked = await tx(async (client) => {
    const run = client.query.bind(client);
    const out = [];
    for (const roll of rolls) {
      const link = (await run(
        "INSERT INTO batch_order_students(order_id,roll_number,linked_by) VALUES($1,$2,$3) ON CONFLICT(order_id,lower(btrim(roll_number))) DO UPDATE SET roll_number=EXCLUDED.roll_number RETURNING id",
        [order.id, roll, req.user.id],
      )).rows[0];
      const student = (await run(
        `SELECT ip.id,ip.user_id,u.status,u.is_active,cp.status proof_status FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED'
         LEFT JOIN LATERAL(SELECT status FROM college_proofs p WHERE p.intern_id=ip.id ORDER BY p.created_at DESC,p.id DESC LIMIT 1) cp ON true
         WHERE ip.college_id=$1 AND lower(btrim(ip.roll_number))=lower($2) LIMIT 1`,
        [order.college_id, roll],
      )).rows[0];
      if (!student) { out.push({ rollNumber: roll, registered: false }); continue; }
      if (student.proof_status !== "VERIFIED") {
        await linkInternToOrder(run, { ...order, link_id: link.id }, student.id);
        if (!student.is_active) await run("UPDATE users SET status='PENDING_APPROVAL',status_reason=NULL WHERE id=$1", [student.user_id]);
      } else await run("UPDATE batch_order_students SET intern_id=$1 WHERE id=$2", [student.id, link.id]);
      out.push({ rollNumber: roll, registered: true, userId: student.user_id, wasActive: student.is_active });
    }
    return out;
  });
  for (const x of linked.filter((y) => y.registered && !y.wasActive))
    await notifyWithEmail(x.userId, "PROOF_VERIFIED", "Covered by batch allotment order", "Your college's batch allotment order " + order.reference_number + " covers your internship. Your account is awaiting Admin approval.");
  await audit(req, "BATCH_ALLOTMENT_STUDENTS_LINKED", "batch_allotment_order", order.id, null, { rollNumbers: rolls });
  res.json({ linked: linked.length, registered: linked.filter((x) => x.registered).length, students: linked.map(({ userId, wasActive, ...x }) => x) });
});
export default router;

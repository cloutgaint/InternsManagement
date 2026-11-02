import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { q } from "../common/database/index.js";
import { audit } from "../common/audit/audit.service.js";
const router = Router();
const dir = path.resolve("uploads/batch-allotments");
fs.mkdirSync(dir, { recursive: true });
const upload = multer({ dest: dir, limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function allowedFile(file) {
  const data = fs.readFileSync(file.path);
  const pdf = data.subarray(0, 5).toString() === "%PDF-";
  const jpg = data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  return pdf || jpg || png;
}
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
  try {
    const { batchId, referenceNumber, issueDate, issuingAuthority, approvedFrom, approvedTo } = req.body;
    if (!file) return res.status(400).json({ error: "Allotment document is required" });
    if (!allowedFile(file)) return res.status(400).json({ error: "Only PDF, JPG or PNG content is allowed" });
    if (!batchId || !String(referenceNumber || "").trim() || !String(issuingAuthority || "").trim() || !validDate(issueDate) || !validDate(approvedFrom) || !validDate(approvedTo) || approvedTo < approvedFrom || issueDate > new Date().toISOString().slice(0, 10))
      return res.status(400).json({ error: "Valid reference, authority, issue date and approved period are required" });
    const batch = (await q("SELECT id,start_date,end_date FROM batches WHERE id=$1", [batchId])).rows[0];
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    const hash = crypto.createHash("sha256").update(fs.readFileSync(file.path)).digest("hex");
    const duplicate = (await q("SELECT id FROM batch_allotment_orders WHERE file_hash=$1 OR lower(reference_number)=lower($2) LIMIT 1", [hash, referenceNumber.trim()])).rows[0];
    if (duplicate) return res.status(409).json({ error: "Duplicate document or reference number" });
    const order = (await q("INSERT INTO batch_allotment_orders(batch_id,reference_number,issue_date,issuing_authority,file_path,file_hash,approved_from,approved_to,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'UPLOADED') RETURNING *", [batchId,referenceNumber.trim(),issueDate,issuingAuthority.trim(),file.path,hash,approvedFrom,approvedTo])).rows[0];
    await audit(req, "BATCH_ALLOTMENT_UPLOADED", "batch_allotment_order", order.id, null, { ...order, file_path: undefined });
    res.status(201).json({ ...order, file_path: undefined });
  } catch (error) {
    if (!res.headersSent) {
      if (error.code === "23505") res.status(409).json({ error: "Allotment reference already exists" });
      else throw error;
    }
  } finally {
    if (file && !res.headersSent) fs.unlink(file.path, () => {});
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
  res.download(path.resolve(order.file_path), "batch-allotment-document");
});
export default router;

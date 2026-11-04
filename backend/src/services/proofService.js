import fs from "fs";
import path from "path";
import { q } from "../common/database/index.js";
import { acceptUpload, detectFileType, readSecureFile } from "../common/storage/secureFiles.js";

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && !Number.isNaN(Date.parse(value));
export const PROOF_TYPES = ["College Allotment Order", "No Objection Certificate (NOC)", "Internship Permission / Recommendation Letter", "Bonafide Certificate with internship permission", "Other"];

export function validateProofDetails(input) {
  for (const [key, label] of [["proofType", "Proof type"], ["issuingAuthority", "Issuing authority"], ["referenceNumber", "Letter / reference number"]])
    if (!String(input[key] || "").trim()) throw badRequest(label + " is required");
  if (!validDate(input.issueDate) || !validDate(input.approvedFrom) || !validDate(input.approvedTo))
    throw badRequest("Valid issue date and college-approved period are required");
  if (new Date(input.issueDate) > new Date()) throw badRequest("Issue date cannot be in the future");
  if (input.approvedTo < input.approvedFrom) throw badRequest("College-approved To date cannot be before From date");
}

// Encrypts accepted proof files and returns the storage fields shared by registration and re-upload.
export async function storeProofFiles(files) {
  if (!files.length || files.length > 2) throw badRequest("Upload one or two proof files");
  const accepted = [];
  for (const file of files) accepted.push(await acceptUpload(file));
  return {
    filePaths: JSON.stringify(files.map((file) => file.path)),
    fileNames: JSON.stringify(files.map((file) => path.basename(file.originalname || file.path))),
    fileHash: accepted.map((x) => x.hash).join(":"),
  };
}

export function proofFiles(proof) {
  if (!proof?.file_path) return [];
  try {
    const parsed = JSON.parse(proof.file_path);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [proof.file_path];
  }
}

export function sendProofFile(res, proof, index = 0) {
  const stored = proofFiles(proof)[Number(index) || 0];
  if (!stored || !fs.existsSync(path.resolve(stored)))
    return res.status(404).json({ error: "Proof file is missing from storage" });
  const data = readSecureFile(path.resolve(stored));
  const type = detectFileType(data);
  res.set("Content-Type", type?.mime || "application/octet-stream");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Cache-Control", "private, no-store");
  res.send(data);
}

// A verified bulk order naming this roll number replaces an individual upload (Blueprint 5.5).
export async function findCoveringOrder(run, collegeId, rollNumber) {
  return (await run(
    `SELECT o.*,bos.id link_id FROM batch_order_students bos JOIN batch_allotment_orders o ON o.id=bos.order_id JOIN batches b ON b.id=o.batch_id
     WHERE o.status='VERIFIED' AND b.college_id=$1 AND lower(btrim(bos.roll_number))=lower(btrim($2)) ORDER BY o.created_at DESC LIMIT 1`,
    [collegeId, rollNumber],
  )).rows[0];
}

export async function linkInternToOrder(run, order, internId) {
  await run("UPDATE batch_order_students SET intern_id=$1 WHERE id=$2", [internId, order.link_id]);
  return (await run(
    `INSERT INTO college_proofs(intern_id,proof_type,issuing_authority,reference_number,issue_date,approved_from,approved_to,file_path,file_hash,status,batch_order_id,file_names)
     VALUES($1,'Batch Allotment Order',$2,$3,$4,$5,$6,$7,$8,'VERIFIED',$9,'[]') RETURNING id,status`,
    [internId, order.issuing_authority, order.reference_number, order.issue_date, order.approved_from, order.approved_to, JSON.stringify([order.file_path]), order.file_hash, order.id],
  )).rows[0];
}

export async function latestProof(internId) {
  return (await q("SELECT * FROM college_proofs WHERE intern_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1", [internId])).rows[0];
}

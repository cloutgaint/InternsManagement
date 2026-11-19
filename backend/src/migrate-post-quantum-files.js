import { pool, q } from "./common/database/index.js";
import crypto from "node:crypto";
import {
  encryptionEnvelopeVersion,
  openBuffer,
  sealBuffer,
} from "./common/storage/secureFiles.js";
import {
  readStoredBuffer,
  replaceStoredBuffer,
} from "./common/storage/storage.service.js";

const sources = [
  ["intern_profiles", "photo_url"],
  ["college_proofs", "file_path"],
  ["batch_allotment_orders", "file_path"],
  ["face_enrollments", "raw_image_path"],
  ["documents", "file_path"],
  ["certificates", "file_path"],
  ["college_completion_reports", "file_path"],
  ["attendance_events", "capture_path"],
  ["task_submissions", "file_path"],
];

function references(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return [value];
}

const all = new Set();
const dryRun = process.argv.includes("--dry-run");
try {
  if (!process.env.FILE_ENCRYPTION_KEY)
    throw new Error(
      "FILE_ENCRYPTION_KEY must be configured before migrating stored files",
    );
  for (const [table, column] of sources) {
    const rows = (await q(
      `SELECT ${column} value FROM ${table} WHERE ${column} IS NOT NULL`,
    )).rows;
    for (const row of rows)
      for (const reference of references(row.value)) all.add(reference);
  }

  let migrated = 0;
  let current = 0;
  let missing = 0;
  for (const reference of all) {
    try {
      const stored = await readStoredBuffer(reference);
      if (encryptionEnvelopeVersion(stored) === 3) {
        current += 1;
        continue;
      }
      const plain = openBuffer(stored);
      const upgraded = sealBuffer(plain);
      if (encryptionEnvelopeVersion(upgraded) !== 3)
        throw new Error("GAINTENC3 encryption is not configured");
      const verified = openBuffer(upgraded);
      if (
        !crypto.timingSafeEqual(
          crypto.createHash("sha512").update(plain).digest(),
          crypto.createHash("sha512").update(verified).digest(),
        )
      )
        throw new Error("Post-quantum re-encryption verification failed");
      if (!dryRun) await replaceStoredBuffer(reference, upgraded);
      migrated += 1;
    } catch (error) {
      if (
        error?.code === "ENOENT" ||
        error?.name === "NoSuchKey" ||
        error?.$metadata?.httpStatusCode === 404
      ) {
        missing += 1;
        continue;
      }
      throw Object.assign(
        new Error(`Failed to migrate ${reference}: ${error.message}`),
        { cause: error },
      );
    }
  }
  console.log(
    JSON.stringify(
      {
        dryRun,
        scanned: all.size,
        [dryRun ? "wouldMigrate" : "migrated"]: migrated,
        alreadyPostQuantum: current,
        missing,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isS3Reference,
  readSecureStoredBuffer,
  readStoredBuffer,
  removeStoredObject,
  storedObjectExists,
  writeSecureStoredBuffer,
  writeStoredBuffer,
} from "../src/common/storage/storage.service.js";
import { encryptionEnvelopeVersion } from "../src/common/storage/secureFiles.js";

test("local storage adapter writes, reads, checks and removes objects", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "gaint-storage-"));
  const previous = { driver: process.env.STORAGE_DRIVER, root: process.env.UPLOAD_ROOT };
  process.env.STORAGE_DRIVER = "local";
  process.env.UPLOAD_ROOT = root;
  try {
    const reference = await writeStoredBuffer(Buffer.from("private document"), { prefix: "documents", filename: "sample.pdf" });
    assert.equal(isS3Reference(reference), false);
    assert.equal(reference.startsWith(path.join(root, "documents")), true);
    assert.deepEqual(await readStoredBuffer(reference), Buffer.from("private document"));
    assert.equal(await storedObjectExists(reference), true);
    await removeStoredObject(reference);
    assert.equal(await storedObjectExists(reference), false);
  } finally {
    if (previous.driver === undefined) delete process.env.STORAGE_DRIVER; else process.env.STORAGE_DRIVER = previous.driver;
    if (previous.root === undefined) delete process.env.UPLOAD_ROOT; else process.env.UPLOAD_ROOT = previous.root;
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test("secure storage adapter encrypts bytes at rest and restores them", async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "gaint-secure-storage-"));
  const previous = { driver: process.env.STORAGE_DRIVER, root: process.env.UPLOAD_ROOT, key: process.env.FILE_ENCRYPTION_KEY };
  process.env.STORAGE_DRIVER = "local";
  process.env.UPLOAD_ROOT = root;
  process.env.FILE_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  try {
    const plain = Buffer.from("biometric evidence");
    const reference = await writeSecureStoredBuffer(plain, { prefix: "attendance-evidence", filename: "capture.jpg" });
    const stored = await readStoredBuffer(reference);
    assert.notDeepEqual(stored, plain);
    assert.equal(encryptionEnvelopeVersion(stored), 3);
    assert.deepEqual(await readSecureStoredBuffer(reference), plain);
  } finally {
    if (previous.driver === undefined) delete process.env.STORAGE_DRIVER; else process.env.STORAGE_DRIVER = previous.driver;
    if (previous.root === undefined) delete process.env.UPLOAD_ROOT; else process.env.UPLOAD_ROOT = previous.root;
    if (previous.key === undefined) delete process.env.FILE_ENCRYPTION_KEY; else process.env.FILE_ENCRYPTION_KEY = previous.key;
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});

test("S3 references are recognized without exposing public URLs", () => {
  assert.equal(isS3Reference("s3://private-bucket/documents/object.pdf"), true);
  assert.equal(isS3Reference("https://private-bucket.s3.amazonaws.com/object.pdf"), false);
});

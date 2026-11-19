import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "../src/common/security/password.js";
import { signToken, verifyToken } from "../src/common/security/tokens.js";
import { openBuffer, sealBuffer } from "../src/common/storage/secureFiles.js";

test("new passwords use Argon2id while legacy bcrypt hashes still verify", async () => {
  const encoded = await hashPassword("Correct-Horse-7!");
  assert.match(encoded, /^\$argon2id\$/);
  assert.deepEqual(await verifyPassword("Correct-Horse-7!", encoded), {
    valid: true,
    needsRehash: false,
  });
  const legacy = await bcrypt.hash("Correct-Horse-7!", 4);
  assert.deepEqual(await verifyPassword("Correct-Horse-7!", legacy), {
    valid: true,
    needsRehash: true,
  });
  assert.equal((await verifyPassword("wrong", encoded)).valid, false);
});

test("authentication tokens require valid HS256 and ML-DSA-65 signatures", () => {
  const before = {
    current: process.env.JWT_SECRET,
    previous: process.env.JWT_PREVIOUS_SECRETS,
  };
  const oldSecret = crypto.randomBytes(64).toString("base64url");
  const newSecret = crypto.randomBytes(64).toString("base64url");
  process.env.JWT_SECRET = oldSecret;
  delete process.env.JWT_PREVIOUS_SECRETS;
  try {
    const rotatedHybrid = signToken({ id: "rotated" }, { expiresIn: "1m" });
    process.env.JWT_SECRET = newSecret;
    process.env.JWT_PREVIOUS_SECRETS = oldSecret;
    const current = signToken({ id: "current" }, { expiresIn: "1m" });
    assert.match(current, /~PQ1~/);
    assert.equal(verifyToken(current).id, "current");
    const [jwtPart, pqPart] = current.split("~PQ1~");
    assert.throws(() => verifyToken(`${jwtPart}~PQ1~${pqPart.slice(0, -1)}A`));
    assert.equal(verifyToken(rotatedHybrid).id, "rotated");
    const old = jwt.sign({ id: "old" }, oldSecret, { algorithm: "HS256" });
    assert.equal(verifyToken(old).id, "old");
    const wrongAlgorithm = jwt.sign({ id: "bad" }, oldSecret, { algorithm: "HS384" });
    assert.throws(() => verifyToken(wrongAlgorithm));
  } finally {
    if (before.current === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = before.current;
    if (before.previous === undefined) delete process.env.JWT_PREVIOUS_SECRETS; else process.env.JWT_PREVIOUS_SECRETS = before.previous;
  }
});

test("ML-KEM-768 + AES-GCM files remain readable after key rotation", () => {
  const before = {
    key: process.env.FILE_ENCRYPTION_KEY,
    id: process.env.FILE_ENCRYPTION_KEY_ID,
    previous: process.env.FILE_ENCRYPTION_PREVIOUS_KEYS,
  };
  const oldKey = crypto.randomBytes(32).toString("base64");
  const newKey = crypto.randomBytes(32).toString("base64");
  try {
    process.env.FILE_ENCRYPTION_KEY = oldKey;
    process.env.FILE_ENCRYPTION_KEY_ID = "old-key";
    delete process.env.FILE_ENCRYPTION_PREVIOUS_KEYS;
    const encrypted = sealBuffer(Buffer.from("retained evidence"));
    process.env.FILE_ENCRYPTION_KEY = newKey;
    process.env.FILE_ENCRYPTION_KEY_ID = "new-key";
    process.env.FILE_ENCRYPTION_PREVIOUS_KEYS = JSON.stringify({ "old-key": oldKey });
    assert.deepEqual(openBuffer(encrypted), Buffer.from("retained evidence"));
    assert.match(encrypted.subarray(0, 9).toString(), /^GAINTENC3$/);
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] ^= 1;
    assert.throws(() => openBuffer(tampered));
  } finally {
    if (before.key === undefined) delete process.env.FILE_ENCRYPTION_KEY; else process.env.FILE_ENCRYPTION_KEY = before.key;
    if (before.id === undefined) delete process.env.FILE_ENCRYPTION_KEY_ID; else process.env.FILE_ENCRYPTION_KEY_ID = before.id;
    if (before.previous === undefined) delete process.env.FILE_ENCRYPTION_PREVIOUS_KEYS; else process.env.FILE_ENCRYPTION_PREVIOUS_KEYS = before.previous;
  }
});

test("legacy GAINTENC1 AES-GCM files remain readable", () => {
  const before = {
    key: process.env.FILE_ENCRYPTION_KEY,
    id: process.env.FILE_ENCRYPTION_KEY_ID,
    previous: process.env.FILE_ENCRYPTION_PREVIOUS_KEYS,
  };
  const secret = crypto.randomBytes(32);
  try {
    process.env.FILE_ENCRYPTION_KEY = secret.toString("base64");
    process.env.FILE_ENCRYPTION_KEY_ID = "current";
    delete process.env.FILE_ENCRYPTION_PREVIOUS_KEYS;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", secret, iv);
    const body = Buffer.concat([cipher.update("legacy evidence"), cipher.final()]);
    const legacy = Buffer.concat([
      Buffer.from("GAINTENC1"), iv, cipher.getAuthTag(), body,
    ]);
    assert.deepEqual(openBuffer(legacy), Buffer.from("legacy evidence"));
  } finally {
    if (before.key === undefined) delete process.env.FILE_ENCRYPTION_KEY; else process.env.FILE_ENCRYPTION_KEY = before.key;
    if (before.id === undefined) delete process.env.FILE_ENCRYPTION_KEY_ID; else process.env.FILE_ENCRYPTION_KEY_ID = before.id;
    if (before.previous === undefined) delete process.env.FILE_ENCRYPTION_PREVIOUS_KEYS; else process.env.FILE_ENCRYPTION_PREVIOUS_KEYS = before.previous;
  }
});

test("legacy GAINTENC2 AES-GCM files remain readable", () => {
  const before = {
    key: process.env.FILE_ENCRYPTION_KEY,
    id: process.env.FILE_ENCRYPTION_KEY_ID,
    previous: process.env.FILE_ENCRYPTION_PREVIOUS_KEYS,
  };
  const secret = crypto.randomBytes(32);
  try {
    process.env.FILE_ENCRYPTION_KEY = secret.toString("base64");
    process.env.FILE_ENCRYPTION_KEY_ID = "legacy-v2";
    delete process.env.FILE_ENCRYPTION_PREVIOUS_KEYS;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", secret, iv);
    const body = Buffer.concat([cipher.update("legacy v2 evidence"), cipher.final()]);
    const id = Buffer.from("legacy-v2");
    const legacy = Buffer.concat([
      Buffer.from("GAINTENC2"),
      Buffer.from([id.length]),
      id,
      iv,
      cipher.getAuthTag(),
      body,
    ]);
    assert.deepEqual(openBuffer(legacy), Buffer.from("legacy v2 evidence"));
  } finally {
    if (before.key === undefined) delete process.env.FILE_ENCRYPTION_KEY; else process.env.FILE_ENCRYPTION_KEY = before.key;
    if (before.id === undefined) delete process.env.FILE_ENCRYPTION_KEY_ID; else process.env.FILE_ENCRYPTION_KEY_ID = before.id;
    if (before.previous === undefined) delete process.env.FILE_ENCRYPTION_PREVIOUS_KEYS; else process.env.FILE_ENCRYPTION_PREVIOUS_KEYS = before.previous;
  }
});

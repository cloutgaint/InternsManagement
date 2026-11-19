import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { verifyAttendanceBiometrics } from "../src/services/attendanceBiometricVerifier.js";
test("attendance fails closed without a trusted biometric provider", async () => {
  const prevUrl = process.env.BIOMETRIC_VERIFY_URL, prevToken = process.env.BIOMETRIC_VERIFY_TOKEN;
  delete process.env.BIOMETRIC_VERIFY_URL; delete process.env.BIOMETRIC_VERIFY_TOKEN;
  try {
    const result = await verifyAttendanceBiometrics({ imageData: "fake", enrollment: { template_ref: "capture:test" }, challengeType: "BLINK" });
    assert.equal(result.ok, false);
    assert.equal(result.unavailable, true);
  } finally {
    if (prevUrl === undefined) delete process.env.BIOMETRIC_VERIFY_URL; else process.env.BIOMETRIC_VERIFY_URL = prevUrl;
    if (prevToken === undefined) delete process.env.BIOMETRIC_VERIFY_TOKEN; else process.env.BIOMETRIC_VERIFY_TOKEN = prevToken;
  }
});
test("attendance route does not use user-supplied match and liveness scores", () => {
  const source = fs.readFileSync(new URL("../src/routes/intern/intern.routes.js", import.meta.url), "utf8");
  const route = source.split('r.post("/attendance/verify"')[1]?.split('r.get("/work-log"')[0];
  assert.ok(route);
  assert.match(route, /await verifyAttendanceBiometrics/);
  assert.doesNotMatch(route, /const \{[^}]*matchScore[^}]*\} = req\.body/);
  assert.match(route, /if \(verified\.unavailable\)/);
});

// Runs one verification against a fake verifier that returns the given scores.
async function verifyWith({ matchScore, livenessScore }, env = {}) {
  const http = await import("node:http");
  const os = await import("node:os");
  const path = await import("node:path");
  const crypto = await import("node:crypto");
  const { writeSecureStoredBuffer } = await import("../src/common/storage/storage.service.js");
  const keys = ["BIOMETRIC_VERIFY_URL", "BIOMETRIC_VERIFY_TOKEN", "BIOMETRIC_ANTISPOOF_THRESHOLD", "STORAGE_DRIVER", "UPLOAD_ROOT", "FILE_ENCRYPTION_KEY"];
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "gaint-antispoof-"));
  const server = http.createServer(async (req, res) => {
    for await (const _ of req);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ matchScore, livenessScore, challengePass: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    Object.assign(process.env, {
      BIOMETRIC_VERIFY_URL: "http://127.0.0.1:" + server.address().port + "/verify",
      BIOMETRIC_VERIFY_TOKEN: "t",
      STORAGE_DRIVER: "local",
      UPLOAD_ROOT: root,
      FILE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
    });
    delete process.env.BIOMETRIC_ANTISPOOF_THRESHOLD;
    Object.assign(process.env, env);
    const raw_image_path = await writeSecureStoredBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { prefix: "face", filename: "enrollment.jpg" });
    return await verifyAttendanceBiometrics({ imageData: "data:image/jpeg;base64,AA==", enrollment: { raw_image_path }, challengeType: "FACE_ONLY" });
  } finally {
    server.close();
    for (const [k, v] of Object.entries(previous)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    await fs.promises.rm(root, { recursive: true, force: true });
  }
}

test("anti-spoof score is recorded but not enforced without a threshold", async () => {
  const result = await verifyWith({ matchScore: 0.9, livenessScore: 0.2 });
  assert.equal(result.ok, true);
  assert.equal(result.livenessScore, 0.2);
});

test("a configured anti-spoof threshold rejects likely photo or screen captures", async () => {
  const rejected = await verifyWith({ matchScore: 0.9, livenessScore: 0.4 }, { BIOMETRIC_ANTISPOOF_THRESHOLD: "0.6" });
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /photo or screen/);
  const accepted = await verifyWith({ matchScore: 0.9, livenessScore: 0.7 }, { BIOMETRIC_ANTISPOOF_THRESHOLD: "0.6" });
  assert.equal(accepted.ok, true);
});

test("face mismatch is still rejected when anti-spoof is not enforced", async () => {
  const result = await verifyWith({ matchScore: 0.3, livenessScore: 0.99 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /did not match/);
});

test("an invalid anti-spoof threshold fails closed", async () => {
  const result = await verifyWith({ matchScore: 0.9, livenessScore: 0.9 }, { BIOMETRIC_ANTISPOOF_THRESHOLD: "high" });
  assert.equal(result.ok, false);
});

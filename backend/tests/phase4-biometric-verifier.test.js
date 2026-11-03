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
  const source = fs.readFileSync(new URL("../src/routes/intern.js", import.meta.url), "utf8");
  const route = source.split('r.post("/attendance/verify"')[1]?.split('r.get("/work-log"')[0];
  assert.ok(route);
  assert.match(route, /await verifyAttendanceBiometrics/);
  assert.doesNotMatch(route, /const \{[^}]*matchScore[^}]*\} = req\.body/);
  assert.match(route, /if \(verified\.unavailable\)/);
});

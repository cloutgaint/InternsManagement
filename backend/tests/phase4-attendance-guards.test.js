import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const admin = fs.readFileSync(new URL("../src/routes/admin.js", import.meta.url), "utf8");
test("face enrollment review only transitions pending enrollments", () => {
  const route = admin.split('r.post("/face-enrollments/:id/decision"')[1]?.split('r.get("/attendance-exceptions"')[0];
  assert.ok(route);
  assert.match(route, /before.status !== "PENDING_ADMIN_APPROVAL"/);
  assert.match(route, /AND status='PENDING_ADMIN_APPROVAL' RETURNING/);
  assert.match(route, /Enrollment decision changed/);
});
test("attendance exception decisions require reason and pending status", () => {
  const route = fs.readFileSync(new URL("../src/services/attendanceService.js", import.meta.url), "utf8");
  assert.match(route, /\["APPROVED", "REJECTED"\]/);
  assert.match(route, /String\(reason \|\| ""\)\.trim\(\)/);
  assert.match(route, /\["DETECTED", "REQUESTED"\]/);
  assert.match(route, /ATTENDANCE_EXCEPTION_/);
});

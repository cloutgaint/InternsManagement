import test from "node:test";
import assert from "node:assert/strict";
import { validateManualAttendance } from "../src/routes/admin/manual-attendance.routes.js";

const valid = { internId: "123e4567-e89b-42d3-a456-426614174000", day: "2026-11-19", checkIn: "09:00", checkOut: "16:00", reason: "Biometric camera unavailable; verified by admin." };
test("valid manual attendance input", () => {
  assert.deepEqual(validateManualAttendance(valid), valid);
});
for (const [name, patch] of [
  ["invalid intern", { internId: "not-an-id" }],
  ["invalid calendar date", { day: "2026-02-30" }],
  ["overnight interval", { checkIn: "17:00", checkOut: "09:00" }],
  ["zero duration", { checkIn: "09:00", checkOut: "09:00" }],
  ["missing reason", { reason: "" }],
  ["short reason", { reason: "broken" }],
]) test(name + " rejected", () => {
  assert.throws(() => validateManualAttendance({ ...valid, ...patch }), { status: 400 });
});

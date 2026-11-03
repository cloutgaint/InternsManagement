import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../src/routes/intern.js", import.meta.url), "utf8");
const verify = source.split('r.post("/attendance/verify"')[1]?.split('r.get("/work-log"')[0];
test("attendance writes daily records and events in the same transaction", () => {
  assert.ok(verify);
  assert.match(verify, /await tx\(async \(client\) =>/);
  assert.match(verify, /pg_advisory_xact_lock/);
  assert.match(verify, /FOR UPDATE/);
  assert.match(verify, /client\.query\(\s*"INSERT INTO attendance_events/);
  assert.match(verify, /check_out IS NULL RETURNING/);
});
test("attendance checks existing check-in and check-out before writing", () => {
  assert.match(verify, /Already checked in today/);
  assert.match(verify, /Check in before checking out/);
  assert.match(verify, /Already checked out today/);
});

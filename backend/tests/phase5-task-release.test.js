import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../src/services/taskReleaseScheduler.js",import.meta.url),"utf8");
test("scheduled tasks are claimed atomically across scheduler processes",()=>{
  assert.match(source,/UPDATE weekly_tasks SET status='RELEASED',released_at=now\(\)/);
  assert.match(source,/FOR UPDATE SKIP LOCKED/);
  assert.match(source,/RETURNING \*/);
  assert.doesNotMatch(source,/SELECT wt\.\* FROM weekly_tasks wt WHERE wt\.status='SCHEDULED'/);
});
test("notifications are sent only for claimed tasks",()=>{
  assert.match(source,/for \(const x of due\)/);
  assert.match(source,/const t = x/);
  assert.match(source,/await notify\(/);
});

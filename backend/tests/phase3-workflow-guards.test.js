import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const intern = fs.readFileSync(new URL("../src/routes/intern.js", import.meta.url), "utf8");
const admin = fs.readFileSync(new URL("../src/routes/admin.js", import.meta.url), "utf8");
const submit = intern.split('r.post("/assessments/:id/submit"')[1]?.split('r.get("/group"')[0];
test("assessment submission uses one transaction and locks the attempt", () => {
  assert.ok(submit, "submission route exists");
  assert.match(submit, /await tx\(async \(client\) =>/);
  assert.match(submit, /FOR UPDATE OF aa/);
  assert.match(submit, /client\.query\(\s*"INSERT INTO assessment_answers/);
  assert.match(submit, /client\.query\(\s*"UPDATE assessment_attempts/);
  assert.match(submit, /Assessment submission deadline has passed/);
});
test("assessment submission guards duplicate and unassigned questions", () => {
  assert.match(submit, /new Set\(ids\)\.size !== ids\.length/);
  assert.match(submit, /!validIds\.has\(id\)/);
  assert.match(submit, /at\.status !== "IN_PROGRESS"/);
});
test("Admin domain confirmation updates decision and profile atomically", () => {
  const confirm = admin.split('r.post("/domain-confirm"')[1]?.split('r.post("/groups/:id/approve"')[0];
  assert.ok(confirm);
  assert.match(confirm, /await tx\(async \(client\) =>/);
  assert.match(confirm, /confirmed_domain_id IS NULL/);
  assert.match(confirm, /UPDATE intern_profiles SET final_domain_id/);
});

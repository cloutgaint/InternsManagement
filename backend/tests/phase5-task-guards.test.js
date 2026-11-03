import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const mentor=fs.readFileSync(new URL("../src/routes/mentor.js",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/routes/admin.js",import.meta.url),"utf8");
test("mentor grading locks submission and writes evaluation and status atomically",()=>{
 const route=mentor.split('r.post("/submissions/:id/evaluate"')[1]?.split('r.get("/assessment-evaluations"')[0];
 assert.ok(route);assert.match(route,/await tx\(async \(client\) =>/);
 assert.match(route,/FOR UPDATE/);assert.match(route,/Submission has already been evaluated/);
 assert.match(route,/INSERT INTO task_evaluations/);assert.match(route,/UPDATE task_submissions SET status/);
});
test("task creation validates dates, marks, group scope and rubric",()=>{
 const route=admin.split('r.post("/tasks"')[1]?.split('r.get("/reviews"')[0];
 assert.ok(route);assert.match(route,/Number\.isNaN\(release\.getTime\(\)\)/);
 assert.match(route,/Task marks must be between 1 and 1000/);
 assert.match(route,/Selected group does not belong to the task batch/);
 assert.match(route,/Selected rubric does not exist/);
});

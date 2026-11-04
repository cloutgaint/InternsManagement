import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const mentor=readFileSync(new URL("../src/routes/mentor.js",import.meta.url),"utf8");
const intern=readFileSync(new URL("../src/routes/intern.js",import.meta.url),"utf8");
const admin=readFileSync(new URL("../src/routes/adminWorkflow.js",import.meta.url),"utf8");
test("submission acceptance is a prerequisite to final evaluation",()=>{
 const route=mentor.slice(mentor.indexOf('r.post("/final-evaluations"'),mentor.indexOf('r.get("/final-project-submissions"'));
 assert.match(route,/final_project_submissions WHERE group_id=\$1 AND status='ACCEPTED'/);
 assert.match(route,/status\(409\)/);
});
test("final submission is locked after completion approval",()=>{
 const route=intern.slice(intern.indexOf('r.post("/final-project-submission"'));
 assert.match(route,/completion_approvals/);
 assert.match(route,/status='APPROVED'/);
});
test("completion approval requires mentor final evaluation",()=>{
 const route=admin.slice(admin.indexOf('r.post("/completions/:internId/decision"'),admin.indexOf('r.post("/certificates/:internId/issue"'));
 assert.match(route,/Mentor final evaluation is required/);
});

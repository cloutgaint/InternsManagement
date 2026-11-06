import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const intern=readFileSync(new URL("../src/routes/intern.js",import.meta.url),"utf8");
const mentor=readFileSync(new URL("../src/routes/mentor.js",import.meta.url),"utf8");
const schema=readFileSync(new URL("../migrations/001_init.sql",import.meta.url),"utf8");
test("final submissions require assigned project and group-scoped evidence",()=>{
 const route=intern.slice(intern.indexOf('r.post("/final-project-submission"'));
 assert.match(route,/gm\.active/);assert.match(route,/pa\.status='ASSIGNED'/);
 assert.match(route,/group_id=\$2 AND active/);assert.match(route,/validExternalDocumentUrl/);
 assert.match(route,/completion_approvals/);
});
test("mentor reviews require active assignment and explicit feedback",()=>{
 const route=mentor.slice(mentor.indexOf('r.post("/final-project-submissions/:id/review"'));
 assert.match(route,/REVISION_REQUESTED/);assert.match(route,/ACCEPTED/);
 assert.match(route,/mentorHasInternInGroup\("fps\.group_id","\$2::uuid"\)/);
 assert.match(route,/feedback\.trim\(\)/);
});
test("schema restricts final submission states and one row per project group",()=>{
 assert.match(schema,/CREATE TABLE IF NOT EXISTS final_project_submissions/);
 assert.match(schema,/UNIQUE INDEX IF NOT EXISTS final_project_submissions_group_project_uq/);
 assert.match(schema,/CHECK\(status IN \('SUBMITTED','REVISION_REQUESTED','ACCEPTED'\)\)/);
});

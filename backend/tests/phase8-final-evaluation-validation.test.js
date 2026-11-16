import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const mentor=readFileSync(new URL("../src/routes/mentor/mentor.routes.js",import.meta.url),"utf8");
test("final evaluations require both marks and restrict range",()=>{
 const route=mentor.slice(mentor.indexOf('r.post("/final-evaluations"'),mentor.indexOf('export default r;'));
 assert.match(route,/b\.groupMarks\s*===\s*""\s*\|\|\s*b\.groupMarks\s*==\s*null/);
 assert.match(route,/b\.individualMarks\s*===\s*""\s*\|\|\s*b\.individualMarks\s*==\s*null/);
 assert.match(route,/groupMarks > 100/);
 assert.match(route,/individualMarks > 100/);
 assert.match(route,/FINAL_EVALUATION_SUBMITTED/);
});

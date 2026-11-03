import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const admin=readFileSync(new URL("../src/routes/admin.js",import.meta.url),"utf8");
test("admin completion approval requires mentor recommendation",()=>{
 const route=admin.slice(admin.indexOf('r.post("/completions/:internId/decision"'),admin.indexOf('r.post("/certificates/:internId/issue"'));
 assert.match(route,/evaluation\?\.recommendation!=="COMPLETED"/);
 assert.match(route,/Mentor final evaluation is required/);
});
test("certificate issuance checks latest approval rather than any historical approval",()=>{
 const route=admin.slice(admin.indexOf('r.post("/certificates/:internId/issue"'),admin.indexOf('r.get("/certificates/:id/file"'));
 assert.match(route,/SELECT status FROM completion_approvals WHERE intern_id=\$1 ORDER BY approved_at DESC,id DESC LIMIT 1/);
 assert.match(route,/latest WHERE status='APPROVED'/);
});

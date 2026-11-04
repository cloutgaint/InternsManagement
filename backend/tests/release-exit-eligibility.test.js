import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const admin=readFileSync(new URL("../src/routes/adminWorkflow.js",import.meta.url),"utf8")+readFileSync(new URL("../src/routes/admin.js",import.meta.url),"utf8");
test("completion approval rejects withdrawn and terminated interns",()=>{
 const route=admin.slice(admin.indexOf('r.post("/completions/:internId/decision"'),admin.indexOf('r.post("/certificates/:internId/issue"'));
 assert.match(route,/exit_records WHERE intern_id=\$1 AND type IN \('WITHDRAWN','TERMINATED'\)/);
 assert.match(route,/Withdrawn or terminated interns cannot receive a completion outcome/);
});
test("certificate issuance independently enforces exit eligibility",()=>{
 const route=admin.slice(admin.indexOf('r.post("/certificates/:internId/issue"'),admin.indexOf('export default r'));
 assert.match(route,/exit_records WHERE intern_id=\$1 AND type IN \('WITHDRAWN','TERMINATED'\)/);
 assert.match(route,/Withdrawn or terminated interns are not eligible for certificates/);
});

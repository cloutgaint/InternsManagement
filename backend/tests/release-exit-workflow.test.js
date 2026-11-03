import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const admin=readFileSync(new URL("../src/routes/admin.js",import.meta.url),"utf8");
const page=readFileSync(new URL("../../frontend/modules/certificates/AdminCompletionPage.js",import.meta.url),"utf8");
test("exit endpoint validates type and reason, records audit and notifies",()=>{
 const route=admin.slice(admin.indexOf('r.post("/completions/:internId/exit"'),admin.indexOf('r.post("/completions/:internId/decision"'));
 assert.match(route,/\["WITHDRAWN","TERMINATED"\]/);
 assert.match(route,/Exit reason is required/);
 assert.match(route,/INSERT INTO exit_records/);
 assert.match(route,/await audit\(/);
 assert.match(route,/await notify\(/);
 assert.match(route,/Cannot record an exit after certificate issuance/);
});
test("admin completion UI supports exit and suppresses approval after exit",()=>{
 assert.match(page,/recordExit\(x,"WITHDRAWN"\)/);
 assert.match(page,/recordExit\(x,"TERMINATED"\)/);
 assert.match(page,/!x.exit_type && x.individual_marks/);
 assert.match(page,/!x.exit_type && x.completion_status/);
});

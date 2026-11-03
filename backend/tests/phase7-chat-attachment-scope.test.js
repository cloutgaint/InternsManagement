import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const mentor=readFileSync(new URL("../src/routes/mentor.js",import.meta.url),"utf8");
const intern=readFileSync(new URL("../src/routes/intern.js",import.meta.url),"utf8");
test("mentor chat validates attachments belong to the target group",()=>{
 const route=mentor.slice(mentor.indexOf('r.post("/groups/:id/chat"'),mentor.indexOf('r.get("/notifications"'));
 assert.match(route,/if \(req\.body\.attachmentId\)/);
 assert.match(route,/SELECT 1 FROM documents WHERE id=\$1 AND group_id=\$2 AND active/);
 assert.match(route,/res\.status\(403\)/);
});
test("intern chat validates attachments belong to the active group",()=>{
 const route=intern.slice(intern.indexOf('r.post("/chat"'),intern.indexOf('r.get("/notifications"'));
 assert.match(route,/SELECT 1 FROM documents WHERE id=\$1 AND active AND group_id=\$2/);
});

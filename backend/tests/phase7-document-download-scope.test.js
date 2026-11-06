import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const intern=readFileSync(new URL("../src/routes/intern.js",import.meta.url),"utf8");
const mentor=readFileSync(new URL("../src/routes/mentor.js",import.meta.url),"utf8");
test("intern document downloads require active group membership",()=>{
 const route=intern.slice(intern.indexOf('r.get("/documents/:id/file"'),intern.indexOf('r.post("/chat"'));
 assert.match(route,/gm\.intern_id=\$1 AND gm\.active/);
 assert.match(route,/d\.id=\$2 AND d\.active/);
 assert.match(route,/d\.owner_user_id=\$3/);
});
test("mentor document downloads require active group assignment",()=>{
 const route=mentor.slice(mentor.indexOf('r.get("/documents/:id/file"'),mentor.indexOf('r.post("/groups/:id/chat"'));
 assert.match(route,/mentorHasInternInGroup\("d\.group_id", "\$1"\)/);
 assert.match(route,/d\.id=\$2 AND d\.active/);
});

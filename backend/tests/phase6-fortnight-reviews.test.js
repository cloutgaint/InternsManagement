import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const mentor=fs.readFileSync(new URL("../src/routes/mentor.js",import.meta.url),"utf8");
const route=mentor.split('r.post("/reviews"')[1]?.split('r.get("/reviews/:id/report"')[0];
test("fortnight review validates group membership and marks",()=>{
 assert.ok(route);assert.match(route,/Individual marks can only be given to your own interns in this group/);
 assert.match(route,/Individual marks must be unique and between 0 and 100/);
 assert.match(route,/Group marks must be between 0 and 100/);
});
test("fortnight review and individual marks commit in one transaction",()=>{
 assert.match(route,/await tx\(async client =>/);
 assert.match(route,/client\.query\("INSERT INTO review_individual_marks/);
 assert.match(route,/INSERT INTO fortnight_reviews/);
});

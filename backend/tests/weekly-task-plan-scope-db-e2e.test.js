import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { q, pool } from "../src/common/database/index.js";

test("weekly plans and task grading follow the intern's mentor", { skip: process.env.RUN_DB_E2E !== "1" }, async (t) => {
  assert.ok(process.env.DATABASE_URL?.includes("intern_test"), "Use isolated intern_test database");
  process.env.JWT_SECRET ||= "ci-only-task-plan-secret";
  const suffix = Date.now().toString(36);
  const one = async (sql, args = []) => (await q(sql, args)).rows[0];
  const server = createApp().listen(0);
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  t.after(async () => { server.close(); await pool.end(); });

  const user = async (name, role) => one("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,'x',$2,'ACTIVE',true) RETURNING id", [name + suffix + "@example.test", role]);
  const tokenFor = (u, role) => jwt.sign({ id: u.id, role, mfa: true }, process.env.JWT_SECRET);
  const call = async (token, method, path, body) => {
    const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  const mentor = async (name) => {
    const u = await user(name, "MENTOR");
    const m = await one("INSERT INTO mentors(user_id,full_name) VALUES($1,$2) RETURNING id", [u.id, name]);
    return { userId: u.id, id: m.id, token: tokenFor(u, "MENTOR") };
  };
  const intern = async (name) => {
    const u = await user(name, "INTERN");
    const p = await one("INSERT INTO intern_profiles(user_id,full_name) VALUES($1,$2) RETURNING id", [u.id, name]);
    await q("INSERT INTO batch_allocations(batch_id,intern_id,status,intern_start,intern_end) VALUES($1,$2,'ALLOTTED',$3,$4)", [batch.id, p.id, start, end]);
    return { userId: u.id, id: p.id, token: tokenFor(u, "INTERN") };
  };
  const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const start = day(-5), end = day(30);
  const batch = await one("INSERT INTO batches(name,code,start_date,end_date) VALUES($1,$2,$3,$4) RETURNING id", ["Scope " + suffix, "S" + suffix, start, end]);
  const [mine, other, groupMentor] = [await mentor("mine"), await mentor("other"), await mentor("groupm")];
  const [assigned, grouped] = [await intern("assigned"), await intern("grouped")];
  await q("INSERT INTO intern_mentor_assignments(intern_id,mentor_id,active) VALUES($1,$2,true)", [assigned.id, mine.id]);
  const group = await one("INSERT INTO groups(batch_id,name,status) VALUES($1,$2,'ACTIVE') RETURNING id", [batch.id, "G" + suffix]);
  await q("INSERT INTO group_members(group_id,intern_id,active) VALUES($1,$2,true)", [group.id, grouped.id]);
  await q("INSERT INTO mentor_assignments(mentor_id,group_id,active) VALUES($1,$2,true)", [groupMentor.id, group.id]);

  const week = (over = {}) => ({ week: 1, title: "Week one", description: "Do it", releaseAt: new Date(Date.now() + 86400000).toISOString(), marks: 100, submissionTypes: ["LINK"], ...over });

  await t.test("mentors only see and plan for their own interns", async () => {
    const ids = async (m) => (await call(m.token, "GET", "/mentor/task-plans/interns")).data.map((x) => x.id);
    assert.deepEqual(await ids(mine), [assigned.id]);
    assert.deepEqual(await ids(groupMentor), [grouped.id]);
    assert.deepEqual(await ids(other), []);
    assert.equal((await call(other.token, "POST", "/mentor/task-plans", { internId: assigned.id })).status, 400);
    assert.equal((await call(other.token, "POST", "/mentor/assigned-tasks", { internId: assigned.id, title: "x", description: "y" })).status, 400);
  });

  let plan;
  await t.test("creating twice reopens the same plan", async () => {
    const first = await call(mine.token, "POST", "/mentor/task-plans", { internId: assigned.id });
    assert.equal(first.status, 201);
    plan = first.data;
    const second = await call(mine.token, "POST", "/mentor/task-plans", { internId: assigned.id });
    assert.equal(second.status, 200);
    assert.equal(second.data.id, plan.id);
  });

  await t.test("a refused save keeps the saved weeks, and dates must fall inside the internship", async () => {
    const path = "/mentor/task-plans/" + plan.id + "/weeks";
    assert.equal((await call(mine.token, "PUT", path, { weeks: [week()] })).status, 200);
    assert.equal((await call(mine.token, "PUT", path, { weeks: [week({ submissionTypes: ["NOPE"] })] })).status, 400);
    assert.equal((await one("SELECT count(*)::int c FROM weekly_tasks WHERE task_plan_id=$1", [plan.id])).c, 1);
    const late = new Date(Date.now() + 60 * 86400000).toISOString();
    assert.equal((await call(mine.token, "PUT", path, { weeks: [week({ releaseAt: late })] })).status, 400);
    assert.equal((await one("SELECT count(*)::int c FROM weekly_tasks WHERE task_plan_id=$1", [plan.id])).c, 1);
  });

  await t.test("the per-intern mentor is notified and grades a submission with no deadline", async () => {
    assert.equal((await call(mine.token, "POST", "/mentor/task-plans/" + plan.id + "/confirm", {})).status, 200);
    const task = await one("UPDATE weekly_tasks SET status='RELEASED',released_at=now() WHERE task_plan_id=$1 RETURNING id", [plan.id]);
    const form = new FormData();
    form.append("content", JSON.stringify({ link: "https://example.test/work" }));
    const sent = await fetch(base + "/intern/tasks/" + task.id + "/submit", { method: "POST", headers: { Authorization: "Bearer " + assigned.token }, body: form });
    const submission = await sent.json();
    assert.equal(sent.status, 201, JSON.stringify(submission));
    assert.equal(submission.is_late, false);
    assert.equal((await one("SELECT count(*)::int c FROM notifications WHERE user_id=$1 AND type='TASK_SUBMITTED'", [mine.userId])).c, 1);
    assert.equal((await call(other.token, "GET", "/mentor/submissions/" + submission.id)).status, 403);
    assert.equal((await call(mine.token, "GET", "/mentor/submissions/" + submission.id)).status, 200);
  });

  await t.test("a group mentor can grade a batch task when the intern has no personal mentor", async () => {
    const task = await one("INSERT INTO weekly_tasks(batch_id,group_id,title,status,submission_types,marks) VALUES($1,$2,'Group task','RELEASED','[\"LINK\"]',100) RETURNING id", [batch.id, group.id]);
    const form = new FormData();
    form.append("content", JSON.stringify({ link: "https://example.test/group" }));
    const sent = await fetch(base + "/intern/tasks/" + task.id + "/submit", { method: "POST", headers: { Authorization: "Bearer " + grouped.token }, body: form });
    const submission = await sent.json();
    assert.equal(sent.status, 201, JSON.stringify(submission));
    assert.equal((await call(groupMentor.token, "GET", "/mentor/submissions/" + submission.id)).status, 200);
    assert.equal((await call(mine.token, "GET", "/mentor/submissions/" + submission.id)).status, 403);
  });

  await t.test("two mentors sharing a group each see only their own interns", async () => {
    const team = await one("INSERT INTO groups(batch_id,name,status) VALUES($1,$2,'ACTIVE') RETURNING id", [batch.id, "Shared" + suffix]);
    const [ours, theirs] = [await intern("ours"), await intern("theirs")];
    await q("INSERT INTO group_members(group_id,intern_id,active) VALUES($1,$2,true),($1,$3,true)", [team.id, ours.id, theirs.id]);
    await q("INSERT INTO intern_mentor_assignments(intern_id,mentor_id,active) VALUES($1,$2,true),($3,$4,true)", [ours.id, other.id, theirs.id, groupMentor.id]);
    await q("INSERT INTO leave_requests(intern_id,from_date,to_date,reason) VALUES($1,$3,$3,'mine'),($2,$3,$3,'theirs')", [ours.id, theirs.id, day(1)]);
    const operations = (await call(other.token, "GET", "/mentor/operations")).data;
    assert.deepEqual(operations.interns.map((x) => x.id), [ours.id]);
    assert.deepEqual(operations.leave.map((x) => x.intern_id), [ours.id]);
    assert.deepEqual(operations.groups.map((x) => x.id), [team.id]);
    assert.deepEqual((await call(other.token, "GET", "/mentor/groups/" + team.id + "/members")).data.map((x) => x.id), [ours.id]);
    assert.equal((await call(mine.token, "GET", "/mentor/groups/" + team.id + "/members")).status, 403);
    const review = await call(other.token, "POST", "/mentor/reviews", { groupId: team.id, periodNo: 1, reviewDate: day(1), individualMarks: [{ internId: theirs.id, marks: 5 }] });
    assert.equal(review.status, 400, JSON.stringify(review.data));
    assert.match(review.data.error, /your own interns/);
  });

  await t.test("an intern has one batch and one active group", async () => {
    const otherBatch = await one("INSERT INTO batches(name,code,start_date,end_date) VALUES($1,$2,$3,$4) RETURNING id", ["Second " + suffix, "T" + suffix, start, end]);
    await assert.rejects(q("INSERT INTO batch_allocations(batch_id,intern_id,status,intern_start,intern_end) VALUES($1,$2,'ALLOTTED',$3,$4)", [otherBatch.id, grouped.id, start, end]), /uq_batch_allocation_one_per_intern/);
    const another = await one("INSERT INTO groups(batch_id,name,status) VALUES($1,$2,'ACTIVE') RETURNING id", [batch.id, "Other" + suffix]);
    await assert.rejects(q("INSERT INTO group_members(group_id,intern_id,active) VALUES($1,$2,true)", [another.id, grouped.id]), /uq_group_member_one_active_per_intern/);
    const adminUser = await user("admin", "SUPER_ADMIN");
    const admin = tokenFor(adminUser, "SUPER_ADMIN");
    const blocked = await call(admin, "POST", "/admin/groups", { batchId: batch.id, name: "Dup" + suffix, internIds: [grouped.id] });
    assert.equal(blocked.status, 409, JSON.stringify(blocked.data));
    assert.match(blocked.data.error, /only be in one group/);
    const allocation = await one("SELECT id FROM batch_allocations WHERE intern_id=$1", [grouped.id]);
    const moved = await call(admin, "PATCH", "/admin/allocations/" + allocation.id + "/batch", { batchId: otherBatch.id });
    assert.equal(moved.status, 409, JSON.stringify(moved.data));
    const free = await intern("free");
    const draft = await call(admin, "POST", "/admin/groups", { batchId: batch.id, name: "Draft" + suffix, internIds: [free.id] });
    assert.equal(draft.status, 201, JSON.stringify(draft.data));
    await call(admin, "POST", "/admin/groups", { batchId: batch.id, name: "Draft2" + suffix, internIds: [free.id] });
    assert.equal((await one("SELECT count(*)::int c FROM group_members WHERE intern_id=$1 AND active", [free.id])).c, 1);
  });

  await t.test("an intern sees their per-intern mentor on their group", async () => {
    const team = await one("INSERT INTO groups(batch_id,name,status) VALUES($1,$2,'ACTIVE') RETURNING id", [batch.id, "Mine" + suffix]);
    await q("INSERT INTO group_members(group_id,intern_id,active) VALUES($1,$2,true)", [team.id, assigned.id]);
    const seen = await call(assigned.token, "GET", "/intern/group");
    assert.deepEqual(seen.data.mentors.map((x) => x.full_name), ["mine"]);
  });
});

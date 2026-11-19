import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../migrations/1013_fullstack_subdomain_assignments.sql", import.meta.url),
  "utf8",
);
const admin = readFileSync(
  new URL("../src/routes/admin/admin.routes.js", import.meta.url),
  "utf8",
);
const intern = readFileSync(
  new URL("../src/routes/intern/intern.routes.js", import.meta.url),
  "utf8",
);
const scheduler = readFileSync(
  new URL("../src/services/taskReleaseScheduler.js", import.meta.url),
  "utf8",
);
const assignmentPage = readFileSync(
  new URL("../../frontend/modules/domains/AdminDomainsPage.js", import.meta.url),
  "utf8",
);

test("Full Stack migration creates the two assignable subdomains and assignment columns", () => {
  assert.match(migration, /'Frontend','FRONTEND'/);
  assert.match(migration, /'Backend','BACKEND'/);
  for (const column of [
    "intern_profiles ADD COLUMN IF NOT EXISTS final_subdomain_id",
    "domain_decisions ADD COLUMN IF NOT EXISTS confirmed_subdomain_id",
    "group_members ADD COLUMN IF NOT EXISTS subdomain_id",
    "task_templates ADD COLUMN IF NOT EXISTS subdomain_id",
    "weekly_tasks ADD COLUMN IF NOT EXISTS subdomain_id",
  ]) assert.ok(migration.includes(column), `missing migration column: ${column}`);
});

test("admin assignment validates and persists an intern subdomain", () => {
  const route = admin.slice(
    admin.indexOf('r.post("/domain-confirm"'),
    admin.indexOf('r.get("/leave-requests"'),
  );
  assert.match(route, /Select an active sub-domain/);
  assert.match(route, /confirmed_subdomain_id/);
  assert.match(route, /final_subdomain_id=\$2/);
  assert.match(route, /UPDATE group_members SET domain_id=\$1,subdomain_id=\$2/);
  assert.match(assignmentPage, /Select sub-domain/);
  assert.match(assignmentPage, /subdomainId: subdomain\?\.id/);
});

test("shared tasks are scoped to the intern's assigned subdomain", () => {
  assert.match(intern, /wt\.subdomain_id IS NULL OR wt\.subdomain_id=\$3/);
  assert.match(scheduler, /ip\.final_subdomain_id=\$3/);
  assert.match(scheduler, /wt\.subdomain_id=ip\.final_subdomain_id/);
});

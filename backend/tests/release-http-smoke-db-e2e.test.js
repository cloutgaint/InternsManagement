import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { pool } from "../src/common/database/index.js";

// Safe HTTP release smoke tests. Read-only requests only; requires disposable CI database.
// The database name assertion prevents accidental execution against production.
test("release smoke: health and unauthenticated role isolation", { skip: process.env.RUN_DB_E2E !== "1" }, async () => {
  const url = new URL(process.env.DATABASE_URL || "");
  assert.equal(url.pathname, "/intern_test", "Release smoke tests require isolated intern_test database");
  const server = createApp().listen(0, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => {
      if (server.listening) return resolve();
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(origin + "/api/health");
    assert.equal(health.status, 200, "PostgreSQL-backed health endpoint must succeed");
    const healthBody = await health.json();
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.database, "up");

    const protectedPaths = [
      "/api/admin/dashboard",
      "/api/intern/dashboard",
      "/api/mentor/dashboard",
      "/api/college-coordinator/dashboard",
      "/api/college-coordinator/accounts",
    ];
    for (const path of protectedPaths) {
      const response = await fetch(origin + path);
      assert.equal(response.status, 401, `Unauthenticated GET ${path} must return 401`);
      const badToken = await fetch(origin + path, { headers: { Authorization: "Bearer invalid-token" } });
      assert.equal(badToken.status, 401, `Invalid bearer token on ${path} must return 401`);
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});

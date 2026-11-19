import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const seed = readFileSync(new URL("../src/seed.js", import.meta.url), "utf8");
const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");

test("admin bootstrap requires a supplied secret and does not contain a fallback password", () => {
  assert.match(seed, /process\.env\.INITIAL_ADMIN_PASSWORD;/);
  assert.doesNotMatch(seed, /INITIAL_ADMIN_PASSWORD\s*\|\|/);
  assert.match(seed, /if \(!adminPassword \|\| adminPassword\.length < 12/);
  assert.match(seed, /if \(!existingAdmin\.rowCount\)/);
});

test("development environment template does not publish an admin password", () => {
  assert.match(example, /^INITIAL_ADMIN_PASSWORD=\s*$/m);
});

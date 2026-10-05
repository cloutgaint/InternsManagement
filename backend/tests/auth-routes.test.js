import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../src/modules/auth/auth.routes.js", import.meta.url),
  "utf8",
);
const routeSurface = [...source.matchAll(/router\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)]
  .map((match) => `${match[1].toUpperCase()} ${match[2]}`);

test("auth module preserves the public endpoint surface", () => {
  assert.deepEqual(routeSurface, [
    "GET /colleges",
    "POST /register",
    "POST /login",
    "POST /mfa/setup",
    "POST /mfa/verify",
    "GET /me",
  ]);
});

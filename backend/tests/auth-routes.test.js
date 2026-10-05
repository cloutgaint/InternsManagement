import test from "node:test";
import assert from "node:assert/strict";
import authRoutes from "../src/modules/auth/auth.routes.js";

const routeSurface = authRoutes.stack
  .filter((layer) => layer.route)
  .flatMap((layer) =>
    Object.keys(layer.route.methods).map(
      (method) => `${method.toUpperCase()} ${layer.route.path}`,
    ),
  );

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

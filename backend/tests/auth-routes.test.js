import test from "node:test";
import assert from "node:assert/strict";
import authRoutes from "../src/modules/auth/auth.routes.js";
import { authenticator } from "otplib";
import "../src/modules/auth/auth.service.js";

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
    "POST /application-status",
    "POST /application-correction",
    "POST /proof-reupload",
    "POST /password/forgot",
    "POST /password/reset",
    "POST /password/change",
    "POST /login",
    "POST /mfa/setup",
    "POST /mfa/verify",
    "GET /me",
  ]);
});

test("MFA codes tolerate one adjacent time step and no more", () => {
  const secret = authenticator.generateSecret();
  const codeAt = (offsetMs) => authenticator.clone({ epoch: Date.now() + offsetMs }).generate(secret);
  assert.equal(authenticator.check(codeAt(0), secret), true);
  assert.equal(authenticator.check(codeAt(-30000), secret), true);
  assert.equal(authenticator.check(codeAt(30000), secret), true);
  assert.equal(authenticator.check(codeAt(-90000), secret), false);
  assert.equal(authenticator.check(codeAt(90000), secret), false);
});

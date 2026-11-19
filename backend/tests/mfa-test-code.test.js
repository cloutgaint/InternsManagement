import test from "node:test";
import assert from "node:assert/strict";
import { testMfaCodeAllowed } from "../src/modules/auth/auth.service.js";

function withEnv(env, fn) {
  const keys = ["NODE_ENV", "ALLOW_DEV_MFA_CODE", "ALLOW_TEST_MFA_CODE"];
  const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, env);
    return fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

test("test MFA code is off unless explicitly enabled", () => {
  assert.equal(withEnv({ NODE_ENV: "production" }, testMfaCodeAllowed), false);
  assert.equal(withEnv({ NODE_ENV: "development" }, testMfaCodeAllowed), false);
});

test("ALLOW_DEV_MFA_CODE only works in development", () => {
  assert.equal(withEnv({ NODE_ENV: "development", ALLOW_DEV_MFA_CODE: "true" }, testMfaCodeAllowed), true);
  assert.equal(withEnv({ NODE_ENV: "production", ALLOW_DEV_MFA_CODE: "true" }, testMfaCodeAllowed), false);
});

test("ALLOW_TEST_MFA_CODE enables the test code on a deployed server", () => {
  assert.equal(withEnv({ NODE_ENV: "production", ALLOW_TEST_MFA_CODE: "true" }, testMfaCodeAllowed), true);
  assert.equal(withEnv({ NODE_ENV: "production", ALLOW_TEST_MFA_CODE: "false" }, testMfaCodeAllowed), false);
});

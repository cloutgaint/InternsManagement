import test from "node:test";
import assert from "node:assert/strict";

import {
  pool as commonPool,
  q as commonQuery,
  tx as commonTransaction,
} from "../src/common/database/index.js";
import {
  pool as legacyPool,
  q as legacyQuery,
  tx as legacyTransaction,
} from "../src/config/db.js";
import {
  auth as commonAuth,
  permit as commonPermit,
} from "../src/common/security/auth.middleware.js";
import {
  auth as legacyAuth,
  permit as legacyPermit,
} from "../src/middleware/auth.js";
import { errorHandler as commonErrorHandler } from "../src/common/middleware/error-handler.js";
import { errorHandler as legacyErrorHandler } from "../src/middleware/error.js";
import { audit as commonAudit } from "../src/common/audit/audit.service.js";
import { audit as legacyAudit } from "../src/utils/audit.js";

test("legacy backend infrastructure paths delegate to canonical exports", () => {
  assert.equal(legacyPool, commonPool);
  assert.equal(legacyQuery, commonQuery);
  assert.equal(legacyTransaction, commonTransaction);
  assert.equal(legacyAuth, commonAuth);
  assert.equal(legacyPermit, commonPermit);
  assert.equal(legacyErrorHandler, commonErrorHandler);
  assert.equal(legacyAudit, commonAudit);
});

test("authentication still rejects a missing bearer token", () => {
  const req = { headers: {} };
  let status;
  let body;
  const res = {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };

  commonAuth(req, res, () => assert.fail("next must not be called"));

  assert.equal(status, 401);
  assert.deepEqual(body, { error: "Authentication required" });
});

test("role middleware keeps allowed and forbidden behavior", () => {
  let nextCalled = false;
  commonPermit("ADMIN")(
    { user: { role: "ADMIN" } },
    {},
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, true);

  let status;
  let body;
  const res = {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };
  commonPermit("ADMIN")({ user: { role: "INTERN" } }, res, () => {});
  assert.equal(status, 403);
  assert.deepEqual(body, { error: "Forbidden" });
});

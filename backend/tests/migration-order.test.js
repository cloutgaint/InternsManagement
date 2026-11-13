import test from "node:test";
import assert from "node:assert/strict";
import { compareMigrations } from "../src/services/migrationOrder.js";

test("migrations are ordered by numeric prefix", () => {
  const names = [
    "1006_one_batch_one_group_per_intern.sql",
    "006_blueprint_v12_alignment.sql",
    "1000_assessment_retry_requests.sql",
    "999_assessment_result_snapshots.sql",
  ];
  assert.deepEqual(names.sort(compareMigrations), [
    "006_blueprint_v12_alignment.sql",
    "999_assessment_result_snapshots.sql",
    "1000_assessment_retry_requests.sql",
    "1006_one_batch_one_group_per_intern.sql",
  ]);
});

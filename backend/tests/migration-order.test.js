import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("replayed attendance view migration removes the dependent newer view first", () => {
  const sql = readFileSync(
    new URL("../migrations/006_blueprint_v12_alignment.sql", import.meta.url),
    "utf8",
  );
  const summaryDrop = sql.indexOf("DROP VIEW IF EXISTS attendance_summary");
  const calendarDrop = sql.indexOf("DROP VIEW IF EXISTS attendance_calendar");
  const calendarCreate = sql.indexOf("CREATE OR REPLACE VIEW attendance_calendar");
  assert.ok(summaryDrop >= 0);
  assert.ok(summaryDrop < calendarDrop);
  assert.ok(calendarDrop < calendarCreate);
});

test("replayed letterhead constraints retain all supported offer assets", () => {
  const sql = readFileSync(
    new URL("../migrations/1012_offer_letterhead_asset_constraints.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /'offer_signature'/);
  assert.match(sql, /'offer_watermark'/);
});

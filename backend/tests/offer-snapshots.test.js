import test from "node:test";
import assert from "node:assert/strict";
import { offerSnapshot, renderOfferLetter, issuedSnapshot } from "../src/services/offerLetterSnapshot.js";
const offer = {
  student_name_snapshot: "Student A", college_snapshot: "GAINT College",
  batch_snapshot: "Batch 1", from_date: "2026-11-01", to_date: "2026-12-01",
  duration_text: "31 days", reference_number: "GAINT-2026-001",
  template_version: 1, issue_at: "2026-11-01T00:00:00.000Z",
  template_body: "Dear {{student_name}}, welcome to {{batch}} at {{college}}.",
  signatory: "Director",
};
test("issued snapshot renders and freezes letter content", () => {
  const frozen = offerSnapshot(offer);
  assert.equal(frozen.rendered_body, "Dear Student A, welcome to Batch 1 at GAINT College.");
  assert.equal(frozen.signatory, "Director");
  assert.match(frozen.content_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(issuedSnapshot({ ...offer, issued_snapshot: frozen }), frozen);
  assert.equal(issuedSnapshot({ ...offer, issued_snapshot: frozen, template_body: "Changed" }).rendered_body, frozen.rendered_body);
});
test("snapshots have stable digest for identical content", () => {
  assert.deepEqual(offerSnapshot(offer), offerSnapshot({ ...offer }));
  assert.notEqual(offerSnapshot({ ...offer, signatory: "Other" }).content_sha256, offerSnapshot(offer).content_sha256);
});
test("draft renderer interpolates known placeholders", () => {
  assert.equal(renderOfferLetter(offer).rendered_body.includes("{{"), false);
});

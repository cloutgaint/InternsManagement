import crypto from "crypto";
export function renderOfferLetter(offer) {
  const values = {
    student_name: offer.student_name_snapshot, college: offer.college_snapshot,
    batch: offer.batch_snapshot, from_date: String(offer.from_date).slice(0, 10),
    to_date: String(offer.to_date).slice(0, 10), duration: offer.duration_text,
    reference_number: offer.reference_number,
  };
  let body = offer.template_body || "";
  for (const [key, value] of Object.entries(values)) body = body.replaceAll("{{" + key + "}}", String(value ?? ""));
  return { rendered_body: body, signatory: offer.signatory || "Authorized Signatory" };
}
export function offerSnapshot(offer) {
  const rendered = renderOfferLetter(offer);
  const snapshot = {
    reference_number: offer.reference_number, student_name_snapshot: offer.student_name_snapshot,
    college_snapshot: offer.college_snapshot, batch_snapshot: offer.batch_snapshot,
    from_date: String(offer.from_date).slice(0, 10), to_date: String(offer.to_date).slice(0, 10),
    duration_text: offer.duration_text, template_version: offer.template_version,
    issue_at: offer.issue_at ? new Date(offer.issue_at).toISOString() : null,
    rendered_body: rendered.rendered_body, signatory: rendered.signatory,
  };
  return { ...snapshot, content_sha256: crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
}
export function issuedSnapshot(offer) {
  if (offer.issued_snapshot) return offer.issued_snapshot;
  return offerSnapshot(offer);
}

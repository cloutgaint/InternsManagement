import PDFDocument from "pdfkit";
export function sendOfferPdf(res, offer) {
  const values = {
    student_name: offer.student_name_snapshot, college: offer.college_snapshot,
    batch: offer.batch_snapshot, from_date: String(offer.from_date).slice(0, 10),
    to_date: String(offer.to_date).slice(0, 10), duration: offer.duration_text,
    reference_number: offer.reference_number,
  };
  let body = offer.template_body || "";
  for (const [key, value] of Object.entries(values))
    body = body.replaceAll("{{" + key + "}}", String(value || ""));
  const pdf = new PDFDocument({ size: "A4", margin: 54 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="GAINT-Internship-Offer.pdf"');
  pdf.pipe(res);
  pdf.fontSize(16).text("GAINT CLOUT TECHNOLOGIES", { align: "center" });
  pdf.moveDown().fontSize(13).text("Internship Offer Letter", { align: "center" });
  pdf.moveDown().fontSize(10).text("Reference: " + offer.reference_number);
  pdf.moveDown().fontSize(11).text(body, { lineGap: 5 });
  pdf.moveDown(2).text(offer.signatory || "Authorized Signatory");
  pdf.end();
}

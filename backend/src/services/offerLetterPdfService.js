import PDFDocument from "pdfkit";
import { inflateRawSync } from "node:zlib";
import { q } from "../common/database/index.js";

// Extract the embedded GAINT logo from a DOCX without executing document macros.
function docxLogo(bytes) {
  let pos = 0;
  while (pos + 30 < bytes.length) {
    if (bytes.readUInt32LE(pos) !== 0x04034b50) { pos++; continue; }
    const method = bytes.readUInt16LE(pos + 8);
    const size = bytes.readUInt32LE(pos + 18);
    const nameLength = bytes.readUInt16LE(pos + 26);
    const extraLength = bytes.readUInt16LE(pos + 28);
    const name = bytes.subarray(pos + 30, pos + 30 + nameLength).toString();
    const start = pos + 30 + nameLength + extraLength;
    if (start + size > bytes.length) break;
    if (/^word\/media\/[^/]+\.(png|jpe?g)$/i.test(name)) {
      const data = bytes.subarray(start, start + size);
      return method === 8 ? inflateRawSync(data) : method === 0 ? data : null;
    }
    pos = start + size;
  }
  return null;
}

function drawLetterhead(pdf, asset) {
  if (!asset) return false;
  const { width, height } = pdf.page;
  const mime = asset.mime_type;
  if (mime === "image/png" || mime === "image/jpeg") {
    pdf.image(asset.image_data, 0, 0, { width, height });
    return true;
  }
  if (mime !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return false;
  const logo = docxLogo(asset.image_data);
  if (!logo) return false;
  // GAINT's uploaded DOCX has the company logo at the top, a gold right rule,
  // and company contact details at the bottom. Keep the centre clear for the letter.
  pdf.image(logo, 92, 30, { fit: [210, 72] });
  pdf.save().lineWidth(4).strokeColor("#ffc400").moveTo(width - 20, 0).lineTo(width - 20, height).stroke();
  pdf.lineWidth(2).moveTo(24, 118).lineTo(width - 20, 118).stroke();
  pdf.moveTo(310, height - 112).lineTo(width - 20, height - 112).stroke();
  pdf.restore();
  pdf.font("Helvetica").fontSize(8.5).fillColor("#171717");
  pdf.text("Gaint Clout Technologies Pvt Ltd,", 82, height - 91);
  pdf.text("Awfis Elite #4th floor, Orbit, Knowledge City,", 82, height - 78);
  pdf.text("Raidurg, Hyderabad, Telangana 500081", 82, height - 65);
  pdf.text("CIN: U62013TS2024PTC186957", 82, height - 52);
  pdf.text("+91 88972 38849", 360, height - 78);
  pdf.text("info@gaintclout.com", 360, height - 65);
  pdf.text("https://gaintclout.com/", 360, height - 52);
  return true;
}

export async function sendOfferPdf(res, offer, { disposition = "attachment" } = {}) {
  const values = {
    student_name: offer.student_name_snapshot, college: offer.college_snapshot,
    batch: offer.batch_snapshot, from_date: String(offer.from_date).slice(0, 10),
    to_date: String(offer.to_date).slice(0, 10), duration: offer.duration_text,
    reference_number: offer.reference_number,
  };
  let body = offer.issued_snapshot?.rendered_body || offer.template_body || "";
  if (!offer.issued_snapshot) for (const [key, value] of Object.entries(values))
    body = body.replaceAll("{{" + key + "}}", String(value || ""));
  const asset = (await q("SELECT mime_type,image_data FROM report_brand_assets WHERE asset_key='offer_letterhead' AND owner_user_id IS NULL")).rows[0];
  const pdf = new PDFDocument({ size: "A4", margin: 54, autoFirstPage: false });
  pdf.addPage({ size: "A4", margin: 54 });
  const hasLetterhead = drawLetterhead(pdf, asset);
  const top = hasLetterhead ? 151 : 60;
  const bottom = hasLetterhead ? 140 : 60;
  const contentHeight = pdf.page.height - top - bottom;
  const signatory = offer.issued_snapshot?.signatory || offer.signatory || "Authorized Signatory";
  const title = "Internship Offer Letter";
  const headerHeight = 65;
  let fontSize = 11;
  const textWidth = pdf.page.width - 108;
  while (fontSize > 8 && pdf.heightOfString(body, { width: textWidth, lineGap: 3, fontSize }) + headerHeight + 42 > contentHeight) fontSize -= 0.5;
  if (pdf.heightOfString(body, { width: textWidth, lineGap: 3, fontSize }) + headerHeight + 42 > contentHeight)
    throw Object.assign(new Error("Offer letter exceeds one A4 page; shorten the template"), { status: 422 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", disposition + '; filename="GAINT-Internship-Offer.pdf"');
  pdf.pipe(res);
  pdf.fillColor("#111111").font("Helvetica-Bold").fontSize(15).text(title, 54, top, { width: textWidth, align: "center" });
  pdf.font("Helvetica").fontSize(9).text("Reference: " + offer.reference_number, 54, top + 36, { width: textWidth });
  pdf.fontSize(fontSize).text(body, 54, top + headerHeight, { width: textWidth, lineGap: 3 });
  pdf.moveDown(1.5).font("Helvetica-Bold").fontSize(10).text(signatory, { width: textWidth });
  pdf.end();
}

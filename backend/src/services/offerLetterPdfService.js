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
  pdf.image(logo, 68, 23, { fit: [282, 91] });
  pdf.save().lineWidth(5).strokeColor("#ffbf00").moveTo(width - 16, 0).lineTo(width - 16, height).stroke();
  pdf.lineWidth(3).moveTo(0, 126).lineTo(width - 16, 126).stroke();
  pdf.moveTo(0, height - 111).lineTo(width - 16, height - 111).stroke();
  pdf.lineWidth(1.5).moveTo(335,height-95).lineTo(335,height-17).stroke();
  pdf.restore();
  pdf.font("Helvetica").fontSize(8.5).fillColor("#171717");
  const footer = (text, x, y, width) => pdf.text(text, x, y, { width, height: 12, lineBreak: false, ellipsis: true });
  footer("Gaint Clout Technologies Pvt Ltd,", 82, height - 91, 265);
  footer("Awfis Elite #4th floor, Orbit, Knowledge City,", 82, height - 78, 265);
  footer("Raidurg, Hyderabad, Telangana 500081", 82, height - 65, 265);
  footer("CIN: U62013TS2024PTC186957", 82, height - 52, 265);
  footer("+91 88972 38849", 360, height - 78, 190);
  footer("info@gaintclout.com", 360, height - 65, 190);
  footer("https://gaintclout.com/", 360, height - 52, 190);
  return true;
}


function formattedDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function watermark(pdf) {
  const cx = 300, cy = 417, nodes = [
    [-151,-131],[-37,-161],[104,-135],[177,-37],[150,115],[46,177],[-115,143],[-178,18],
    [-46,-39],[68,-40],[33,65],[-80,59]
  ];
  const pastel=["#f5d9d2","#f8e2c4","#f1edc6","#e2f1d8","#d9eaf5","#e3e5f8"];
  pdf.save().opacity(0.64).lineWidth(1.3);
  nodes.forEach(([x,y],i) => {
    for (const j of [(i+1)%nodes.length,(i+3)%nodes.length,(i+7)%nodes.length]) {
      pdf.strokeColor(pastel[(i+j)%pastel.length]).moveTo(cx+x,cy+y).lineTo(cx+nodes[j][0],cy+nodes[j][1]).stroke();
    }
  });
  nodes.forEach(([x,y],i) => pdf.fillColor(pastel[i%pastel.length]).circle(cx+x,cy+y,i<8?19:14).fill());
  pdf.restore();
}

function write(pdf, value, x, y, width, fontSize = 10, bold = false, opts = {}) {
  pdf.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize).fillColor("#171717");
  pdf.text(String(value || ""), x, y, { width, lineBreak: false, ...opts });
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
  const assets = (await q("SELECT asset_key,mime_type,image_data FROM report_brand_assets WHERE owner_user_id IS NULL AND asset_key IN ('offer_letterhead','company_stamp','offer_signature')")).rows;
  const letterhead = assets.find(x => x.asset_key === "offer_letterhead");
  const stamp = assets.find(x => x.asset_key === "company_stamp" && ["image/png","image/jpeg"].includes(x.mime_type));
  const signature = assets.find(x => x.asset_key === "offer_signature" && ["image/png","image/jpeg"].includes(x.mime_type));
  const pdf = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, bufferPages: true });
  pdf.addPage({ size: "A4", margin: 0 });
  const { width, height } = pdf.page;
  const branded = drawLetterhead(pdf, letterhead);
  if (!branded) {
    pdf.save().strokeColor("#ffc400").lineWidth(4).moveTo(width-20,0).lineTo(width-20,height).stroke();
    pdf.moveTo(30,122).lineTo(width-20,122).stroke();
    pdf.moveTo(30,height-112).lineTo(width-20,height-112).stroke();
    pdf.restore();
    write(pdf,"GAINT",62,48,260,31,true);
    write(pdf,"CLOUT TECHNOLOGIES PVT. LTD.",64,90,300,10,true);
    write(pdf,"Gaint Clout Technologies Pvt Ltd | Hyderabad | info@gaintclout.com",54,height-73,width-108,8);
  }
  watermark(pdf);
  const left = 66, right = width - 66, textWidth = right - left;
  const top = 143;
  pdf.font("Helvetica-Bold").fontSize(16).fillColor("#141414")
    .text("Internship Offer Letter", left, top, { width: textWidth, align: "center", lineBreak: false });
  pdf.save().strokeColor("#171717").lineWidth(0.7).moveTo(width/2-89,top+22).lineTo(width/2+89,top+22).stroke().restore();
  write(pdf, "Date: " + formattedDate(offer.issue_at || offer.issued_at || offer.created_at), left, top+49, textWidth, 10);
  write(pdf, "Reference: " + (offer.reference_number || "—"), left, top+68, textWidth, 9);
  write(pdf, "Subject: Internship Offer Letter", left, top+96, textWidth, 10, true);
  write(pdf, "Dear " + (values.student_name || "Intern") + ",", left, top+125, textWidth, 11, true);

  // Keep the issued template's wording intact. The formal layout, not the approved
  // offer terms, is what changes here.
  const cleanBody = body.trim().replace(/^Dear[^\n]*,\s*/i, "").replace(/\n\s*Regards,?[\s\S]*$/i, "").trim();
  const bodyTop = top + 158;
  const bottomLimit = height - 225;
  const signatory = offer.issued_snapshot?.signatory || offer.signatory || "Authorized Signatory";
  const maxBodyHeight = bottomLimit - bodyTop;
  let fontSize = 11;
  let bodyHeight = 0;
  for (; fontSize >= 8.5; fontSize -= 0.5) {
    pdf.font("Helvetica").fontSize(fontSize);
    bodyHeight = pdf.heightOfString(cleanBody, { width: textWidth, lineGap: 5, paragraphGap: 9 });
    if (bodyHeight <= maxBodyHeight) break;
  }
  if (bodyHeight > maxBodyHeight) {
    throw Object.assign(new Error("Offer text is too long for one A4 page; shorten the approved template."), { status: 422 });
  }
  pdf.font("Helvetica").fontSize(fontSize).fillColor("#171717")
    .text(cleanBody, left, bodyTop, { width: textWidth, lineGap: 5, paragraphGap: 9, height: maxBodyHeight });
  const closingY = Math.max(bodyTop + bodyHeight + 23, height - 256);
  write(pdf, "With best wishes,", left, closingY, textWidth, 10);
  if (signature) {
    try { pdf.image(signature.image_data, left-4, closingY+16, { fit: [192, 70] }); }
    catch { /* Invalid image must not break the issued document. */ }
  }
  if (stamp) {
    try { pdf.image(stamp.image_data, left+196, closingY+22, { fit: [94, 88] }); }
    catch { /* Invalid historic stamp must not prevent offer download. */ }
  }
  write(pdf, signatory, left, closingY+103, textWidth, 10, true, { height: 24, ellipsis: true });
  write(pdf, "For Gaint Clout Technologies Pvt. Ltd.", left, closingY+119, textWidth, 9);
  if (pdf.bufferedPageRange().count !== 1) throw new Error("Offer PDF pagination error");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", disposition + '; filename="GAINT-Internship-Offer.pdf"');
  pdf.pipe(res);
  pdf.end();
}

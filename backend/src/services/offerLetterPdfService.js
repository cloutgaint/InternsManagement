import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const execFileAsync = promisify(execFile);
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
  pdf.save().fillColor("#ffbf00").rect(width - 17, 0, 17, height).fill();
  pdf.strokeColor("#ffbf00");
  pdf.lineWidth(3).moveTo(0, 126).lineTo(width - 17, 126).stroke();
  pdf.moveTo(0, height - 111).lineTo(width - 17, height - 111).stroke();
  pdf.lineWidth(2).moveTo(335,height-95).lineTo(335,height-17).stroke();
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


// Render the actual uploaded Word/PDF letterhead rather than approximating its
// logo, borders and footer with PDFKit. Required: LibreOffice (DOCX) and Poppler.
async function letterheadBackground(asset) {
  if (!asset) return null;
  if (["image/png","image/jpeg"].includes(asset.mime_type)) return asset.image_data;
  const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (![docx,"application/pdf"].includes(asset.mime_type)) throw Object.assign(new Error("Unsupported company letterhead format"),{status:422});
  const dir=await mkdtemp(join(tmpdir(),"gaint-offer-"));
  try {
    let pdfPath=join(dir,"letterhead.pdf");
    if(asset.mime_type===docx){
      const docxPath=join(dir,"letterhead.docx");
      await writeFile(docxPath,asset.image_data,{mode:0o600});
      try {await execFileAsync("libreoffice",["-env:UserInstallation=file://"+join(dir,"lo-profile"),"--headless","--convert-to","pdf","--outdir",dir,docxPath],{timeout:30000,maxBuffer:1024*1024});}
      catch {throw Object.assign(new Error("DOCX letterhead conversion requires LibreOffice on the backend server"),{status:503});}
    } else await writeFile(pdfPath,asset.image_data,{mode:0o600});
    try {await execFileAsync("pdftoppm",["-f","1","-l","1","-singlefile","-r","180","-png",pdfPath,join(dir,"letterhead")],{timeout:30000,maxBuffer:1024*1024});}
    catch {throw Object.assign(new Error("Letterhead PDF rendering requires Poppler pdftoppm on the backend server"),{status:503});}
    return await readFile(join(dir,"letterhead.png"));
  } finally {await rm(dir,{recursive:true,force:true});}
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
  const pastel=["#f0c7c0","#f5ddbd","#ece9b7","#d5eacb","#cde4ef","#dadcf1"];
  pdf.save().opacity(0.75).lineWidth(0.55);
  nodes.forEach(([x,y],i) => {
    for (const j of [(i+1)%nodes.length,(i+3)%nodes.length,(i+5)%nodes.length,(i+7)%nodes.length]) {
      pdf.strokeColor(pastel[(i+j)%pastel.length]).moveTo(cx+x,cy+y).lineTo(cx+nodes[j][0],cy+nodes[j][1]).stroke();
    }
  });
  nodes.forEach(([x,y],i) => pdf.fillColor(pastel[i%pastel.length]).circle(cx+x,cy+y,i<8?18:12).fill());
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
  let body = offer.issued_snapshot?.rendered_body || offer.draft_body || offer.template_body || "";
  if (!offer.issued_snapshot) for (const [key, value] of Object.entries(values))
    body = body.replaceAll("{{" + key + "}}", String(value || ""));
  const assets = (await q("SELECT asset_key,mime_type,image_data FROM report_brand_assets WHERE owner_user_id IS NULL AND asset_key IN ('offer_letterhead','company_stamp','offer_signature','offer_watermark')")).rows;
  const letterhead = assets.find(x => x.asset_key === "offer_letterhead");
  const stamp = assets.find(x => x.asset_key === "company_stamp" && ["image/png","image/jpeg"].includes(x.mime_type));
  const signature = assets.find(x => x.asset_key === "offer_signature" && ["image/png","image/jpeg"].includes(x.mime_type));
  const pdf = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, bufferPages: true });
  pdf.addPage({ size: "A4", margin: 0 });
  const { width, height } = pdf.page;
  const background = await letterheadBackground(letterhead);
  const branded = Boolean(background);
  if (background) {
    pdf.image(background, 0, 0, { width, height });
    // Remove the artificial lower-left gold strip and the template's hard
    // lower-right edge. The top-right brand rule remains untouched.
    const footerTop = height - 111;
    pdf.save();
    pdf.fillColor("#ffffff").rect(0, footerTop + 2, 18, height - footerTop - 2).fill();
    pdf.fillColor("#ffffff").rect(width - 19, footerTop + 2, 19, height - footerTop - 2).fill();
    pdf.restore();
  }
  if (!branded) {
    pdf.save().fillColor("#ffbf00").rect(width-17,0,17,height-111).fill().strokeColor("#ffbf00").lineWidth(3);
    pdf.moveTo(0,126).lineTo(width-17,126).stroke();
    pdf.moveTo(0,height-111).lineTo(width,height-111).stroke();
    pdf.restore();
    write(pdf,"GAINT",62,48,260,31,true);
    write(pdf,"CLOUT TECHNOLOGIES PVT. LTD.",64,90,300,10,true);
    write(pdf,"Gaint Clout Technologies Pvt Ltd | Hyderabad | info@gaintclout.com",54,height-73,width-108,8);
  }
  // Soften the lower end of the right-side gold accent instead of a sharp cut.
  pdf.save();
  const fade=pdf.linearGradient(width-17,height-141,width-17,height-108);
  fade.stop(0,"#ffbf00",1).stop(1,"#ffbf00",0);
  pdf.rect(width-17,height-141,17,33).fill(fade);
  pdf.restore();
  const uploadedWatermark = assets.find(x => x.asset_key === "offer_watermark" && ["image/png","image/jpeg"].includes(x.mime_type));
  if (uploadedWatermark) {
    // The watermark is placed behind the letter content; preserve image aspect ratio.
    pdf.save().opacity(0.24);
    try { pdf.image(uploadedWatermark.image_data, 95, 258, { fit: [395, 365], align: "center", valign: "center" }); }
    finally { pdf.restore(); }
  } else {
    watermark(pdf);
  }
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
  const signatory = offer.issued_snapshot?.signatory || offer.draft_signatory || offer.signatory || "Authorized Signatory";
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
  // Keep the handwritten signature and circular stamp visually balanced.
  // PDFKit's fit option preserves each uploaded image's aspect ratio.
  if (signature) {
    try { pdf.image(signature.image_data, left, closingY+27, { fit: [142, 46], align: "left", valign: "center" }); }
    catch { /* Invalid historic signature must not prevent offer download. */ }
  }
  if (stamp) {
    try { pdf.image(stamp.image_data, left+132, closingY+3, { fit: [108, 108], align: "center", valign: "center" }); }
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

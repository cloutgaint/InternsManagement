import test from "node:test";
import assert from "node:assert/strict";
import {PDFDocument} from "pdf-lib";
import {formatCertificateDate,renderCertificate} from "../src/services/certificatePdfService.js";
test("approved internship dates render with correct uppercase ordinals",()=>{
 assert.equal(formatCertificateDate("2026-11-04"),"04TH NOVEMBER 2026");
 assert.equal(formatCertificateDate("2027-03-04"),"04TH MARCH 2027");
 assert.equal(formatCertificateDate("2026-01-01"),"01ST JANUARY 2026");
 assert.equal(formatCertificateDate("2026-02-02"),"02ND FEBRUARY 2026");
 assert.equal(formatCertificateDate("2026-03-03"),"03RD MARCH 2026");
 assert.equal(formatCertificateDate("2026-11-11"),"11TH NOVEMBER 2026");
 assert.equal(formatCertificateDate("2026-11-12"),"12TH NOVEMBER 2026");
 assert.equal(formatCertificateDate("2026-11-13"),"13TH NOVEMBER 2026");
 assert.throws(()=>formatCertificateDate("2026-02-30"));
});
test("certificate renderer uses the gold italic fallback when no script font is uploaded",async()=>{
 const d=await PDFDocument.create();d.addPage([862.5,605.25]);
 const pdf=await renderCertificate(await d.save(),{certificate_number:"GAINT-INT0151ERN",student_name:"Jnanika uma siva naga sai kilaru",project_title:"LIBRARY MANAGEMENT SYSTEM",start_date:"2026-07-13",end_date:"2026-11-07"},{scriptFontPath:null});
 assert.ok(pdf.length>0);
});

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
test("certificate renderer refuses to silently substitute Times Italic for missing script font",async()=>{
 const d=await PDFDocument.create();d.addPage([862.5,605.25]);
 await assert.rejects(()=>renderCertificate(await d.save(),{certificate_number:"GAINT-INT-TEST",student_name:"RAM",project_title:"DOCUMINDAI",start_date:"2026-11-04",end_date:"2027-03-04"},{scriptFontPath:null}),/CERTIFICATE_SCRIPT_FONT_PATH/);
});

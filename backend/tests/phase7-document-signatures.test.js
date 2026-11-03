import test from "node:test";
import assert from "node:assert/strict";
import {documentSignatureMatches} from "../src/services/collaborationService.js";
test("accepts supported document signatures",()=>{
 for(const [mime,hex] of [["application/pdf","255044462d312e37"],["image/png","89504e470d0a1a0a"],["image/jpeg","ffd8ffe0"],["application/zip","504b03040000"],["application/vnd.openxmlformats-officedocument.wordprocessingml.document","504b03040000"]])assert.equal(documentSignatureMatches(mime,Buffer.from(hex,"hex")),true,mime);
 assert.equal(documentSignatureMatches("text/plain",Buffer.from("Meeting notes")),true);
});
test("rejects mismatched or invalid document content",()=>{
 assert.equal(documentSignatureMatches("application/pdf",Buffer.from("fake PDF")),false);
 assert.equal(documentSignatureMatches("image/png",Buffer.from("ffd8ffe0","hex")),false);
 assert.equal(documentSignatureMatches("text/plain",Buffer.from([0xff,0x00])),false);
 assert.equal(documentSignatureMatches("application/zip",Buffer.alloc(0)),false);
});

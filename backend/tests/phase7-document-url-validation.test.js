import test from "node:test";
import assert from "node:assert/strict";
import {validExternalDocumentUrl} from "../src/services/collaborationService.js";
test("accepts ordinary HTTP(S) document links",()=>{
 assert.equal(validExternalDocumentUrl("https://example.org/report.pdf"),true);
 assert.equal(validExternalDocumentUrl("http://example.org/file"),true);
});
test("rejects dangerous, malformed and credential-bearing links",()=>{
 for(const value of ["javascript:alert(1)","data:text/html,hi","file:///etc/passwd","ftp://example.org/a","https://user:pass@example.org/file","not a url","",null])assert.equal(validExternalDocumentUrl(value),false);
});

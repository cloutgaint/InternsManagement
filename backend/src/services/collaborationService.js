import fs from "fs";import path from "path";import multer from "multer";import {q} from "../common/database/index.js";import {notify,notifyGroup} from "../common/notifications/notification.service.js";
const dir=path.resolve("uploads/documents");fs.mkdirSync(dir,{recursive:true});
export const documentUpload=multer({dest:dir,limits:{fileSize:25*1024*1024},fileFilter:(req,file,cb)=>{const ok=["application/pdf","application/zip","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.presentationml.presentation","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","image/png","image/jpeg","text/plain"].includes(file.mimetype);cb(ok?null:new Error("Unsupported document type"),ok)}});
export {notify,notifyGroup};
export async function groupForUser(user){if(user.role==="INTERN")return (await q("SELECT gm.group_id FROM group_members gm JOIN intern_profiles ip ON ip.id=gm.intern_id WHERE ip.user_id=$1 AND gm.active LIMIT 1",[user.id])).rows[0]?.group_id;if(user.role==="MENTOR")return null;return null}

export function validExternalDocumentUrl(value){
  if(typeof value!=="string"||!value.trim()||value.length>2048)return false;
  try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}
}

export function documentSignatureMatches(mime,bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length)return false;
 const starts=(hex)=>bytes.length>=hex.length/2&&bytes.subarray(0,hex.length/2).toString("hex")===hex;
 if(mime==="application/pdf")return starts("255044462d");
 if(mime==="image/png")return starts("89504e470d0a1a0a");
 if(mime==="image/jpeg")return starts("ffd8ff");
 if(mime==="application/zip"||mime.startsWith("application/vnd.openxmlformats-officedocument."))return starts("504b0304");
 if(mime==="text/plain"){try{new TextDecoder("utf-8",{fatal:true}).decode(bytes);return !bytes.includes(0);}catch{return false;}}
 return false;
}
export function validateUploadedDocument(file){
 if(!file)return true;
 try{const bytes=fs.readFileSync(file.path);return documentSignatureMatches(file.mimetype,bytes);}catch{return false;}
}

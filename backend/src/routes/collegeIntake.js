import {Router} from "express";
import multer from "multer";
import crypto from "crypto";
import {q,tx} from "../common/database/index.js";
import {auth,permit} from "../common/security/auth.middleware.js";
import {audit} from "../common/audit/audit.service.js";
import {scanBuffer} from "../common/storage/secureFiles.js";
import {writeSecureStoredBuffer,readSecureStoredBuffer,removeStoredObject} from "../common/storage/storage.service.js";
const r=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{files:5,fileSize:10*1024*1024}});
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""));
const types={".pdf":"application/pdf",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",".docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",".csv":"text/csv",".txt":"text/plain"};
const ext=name=>String(name||"").toLowerCase().match(/\.[a-z0-9]+$/)?.[0]||"";
function validFile(file){
 const e=ext(file.originalname),b=file.buffer;
 if(!types[e]||b.length===0)return false;
 if(e===".pdf")return b.subarray(0,5).toString()==="%PDF-";
 if(e===".png")return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(e===".jpg"||e===".jpeg")return b[0]===255&&b[1]===216&&b[2]===255;
 if(e===".xlsx"||e===".docx")return b.subarray(0,4).equals(Buffer.from([80,75,3,4]));
 return !b.includes(0);
}
async function college(req,res,next){
 try{
  const x=(await q("SELECT cca.college_id FROM college_coordinator_accounts cca JOIN users u ON u.id=cca.user_id WHERE cca.user_id=$1 AND u.is_active AND u.status='ACTIVE'",[req.user.id])).rows[0];
  if(!x)return res.status(403).json({error:"Coordinator access is inactive"});
  req.collegeId=x.college_id;next();
 }catch(e){next(e);}
}
const safeName=n=>String(n||"document").replace(/[\\/\r\n"<>]/g,"_").slice(0,180);
r.use(auth);
r.get("/college-coordinator/intake",permit("COLLEGE_COORDINATOR"),college,async(req,res)=>{
 const page=Math.max(1,Math.min(10000,Number(req.query.page)||1));
 const count=(await q("SELECT count(*)::int total FROM college_intake_requests WHERE college_id=$1",[req.collegeId])).rows[0].total;
 const rows=(await q("SELECT i.*,COALESCE((SELECT json_agg(json_build_object('id',a.id,'filename',a.filename,'size',a.size_bytes)) FROM college_intake_attachments a WHERE a.request_id=i.id),'[]'::json) attachments FROM college_intake_requests i WHERE i.college_id=$1 ORDER BY i.created_at DESC LIMIT 20 OFFSET $2",[req.collegeId,(page-1)*20])).rows;
 res.json({rows,total:count,page});
});
r.post("/college-coordinator/intake",permit("COLLEGE_COORDINATOR"),college,upload.array("files",5),async(req,res)=>{
 const {academicYear,department,semester,studentCount,proposedStart,proposedEnd,remarks}=req.body;
 const count=Number(studentCount),start=proposedStart||null,end=proposedEnd||null;
 if(!/^20\d{2}-20\d{2}$/.test(String(academicYear||""))||!String(department||"").trim()||!String(semester||"").trim()||!Number.isInteger(count)||count<1||count>10000||String(remarks||"").length>2000||((start||end)&&(!/^\d{4}-\d{2}-\d{2}$/.test(start||"")||!/^\d{4}-\d{2}-\d{2}$/.test(end||"")||start>end)))return res.status(400).json({error:"Provide academic year, department, semester, valid student count and valid proposed dates"});
 const files=req.files||[];
 if(files.some(f=>!validFile(f)))return res.status(400).json({error:"Unsupported or invalid file. Use PDF, image, XLSX, DOCX, CSV or TXT (10 MB maximum each)."});
 for(const f of files){const scan=await scanBuffer(f.buffer);if(!scan.clean||process.env.NODE_ENV==="production"&&!scan.scanned)return res.status(422).json({error:"Files must pass antivirus scanning before upload"});}
 const refs=[];
 try{
  for(const f of files)refs.push(await writeSecureStoredBuffer(f.buffer,{prefix:"college-intake",filename:safeName(f.originalname)}));
  const result=await tx(async client=>{
   const request=(await client.query("INSERT INTO college_intake_requests(college_id,coordinator_id,academic_year,department,semester,student_count,proposed_start,proposed_end,remarks) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",[req.collegeId,req.user.id,academicYear,department.trim(),semester.trim(),count,start,end,String(remarks||"").trim()])).rows[0];
   for(let i=0;i<files.length;i++)await client.query("INSERT INTO college_intake_attachments(request_id,filename,mime_type,size_bytes,storage_ref) VALUES($1,$2,$3,$4,$5)",[request.id,safeName(files[i].originalname),types[ext(files[i].originalname)],files[i].size,refs[i]]);
   return request;
  });
  await audit(req,"COLLEGE_INTAKE_SUBMITTED","college_intake",result.id,null,{collegeId:req.collegeId,studentCount:count});
  res.status(201).json(result);
 }catch(e){await Promise.all(refs.map(ref=>removeStoredObject(ref).catch(()=>{})));throw e;}
});
r.get("/admin/college-intake",permit("ADMIN","SUPER_ADMIN"),async(req,res)=>{
 const page=Math.max(1,Number(req.query.page)||1),status=String(req.query.status||"");
 if(status&&!["PENDING","APPROVED","REJECTED","CORRECTION_REQUESTED"].includes(status))return res.status(400).json({error:"Invalid status"});
 const params=status?[status]:[];
 const where=status?"WHERE i.status=$1":"";
 const total=(await q("SELECT count(*)::int total FROM college_intake_requests i "+where,params)).rows[0].total;
 const rows=(await q("SELECT i.*,c.name college_name,cca.full_name coordinator_name,COALESCE((SELECT json_agg(json_build_object('id',a.id,'filename',a.filename,'size',a.size_bytes)) FROM college_intake_attachments a WHERE a.request_id=i.id),'[]'::json) attachments FROM college_intake_requests i JOIN colleges c ON c.id=i.college_id JOIN college_coordinator_accounts cca ON cca.user_id=i.coordinator_id "+where+" ORDER BY i.created_at DESC LIMIT 20 OFFSET $"+(params.length+1),[...params,(page-1)*20])).rows;
 res.json({rows,total,page});
});
r.patch("/admin/college-intake/:id/review",permit("ADMIN","SUPER_ADMIN"),async(req,res)=>{
 const {status,comment}=req.body;
 if(!uuid(req.params.id)||!["APPROVED","REJECTED","CORRECTION_REQUESTED"].includes(status)||String(comment||"").trim().length<5)return res.status(400).json({error:"Valid request, decision and review comment (at least 5 characters) are required"});
 const updated=await tx(async client=>{
  const old=(await client.query("SELECT * FROM college_intake_requests WHERE id=$1 FOR UPDATE",[req.params.id])).rows[0];
  if(!old)return null;
  if(!["PENDING","CORRECTION_REQUESTED"].includes(old.status))return {conflict:true};
  const row=(await client.query("UPDATE college_intake_requests SET status=$2,review_comment=$3,reviewed_by=$4,reviewed_at=now(),updated_at=now() WHERE id=$1 RETURNING *",[old.id,status,comment.trim(),req.user.id])).rows[0];
  await client.query("INSERT INTO college_intake_reviews(request_id,reviewer_id,old_status,new_status,comment) VALUES($1,$2,$3,$4,$5)",[old.id,req.user.id,old.status,status,comment.trim()]);
  return row;
 });
 if(!updated)return res.status(404).json({error:"Request not found"});
 if(updated.conflict)return res.status(409).json({error:"This request has already been finalized"});
 await audit(req,"COLLEGE_INTAKE_REVIEWED","college_intake",updated.id,null,{status,comment});
 res.json(updated);
});
r.get("/college-intake/attachments/:id",async(req,res)=>{
 if(!uuid(req.params.id))return res.status(400).json({error:"Invalid attachment"});
 const admin=["ADMIN","SUPER_ADMIN"].includes(req.user.role);
 if(!admin&&req.user.role!=="COLLEGE_COORDINATOR")return res.status(403).json({error:"Forbidden"});
 const x=(await q("SELECT a.*,i.college_id FROM college_intake_attachments a JOIN college_intake_requests i ON i.id=a.request_id WHERE a.id=$1",[req.params.id])).rows[0];
 if(!x)return res.status(404).json({error:"Attachment not found"});
 if(!admin){const scope=(await q("SELECT 1 FROM college_coordinator_accounts WHERE user_id=$1 AND college_id=$2",[req.user.id,x.college_id])).rowCount;if(!scope)return res.status(403).json({error:"Forbidden"});}
 const data=await readSecureStoredBuffer(x.storage_ref);
 res.set("Content-Type",x.mime_type);res.set("Content-Disposition",'attachment; filename="'+safeName(x.filename)+'"');res.set("X-Content-Type-Options","nosniff");res.send(data);
});
export default r;

import {Router} from "express";
import {q} from "../common/database/index.js";
import {auth,permit} from "../common/security/auth.middleware.js";
import {audit} from "../common/audit/audit.service.js";
import {mentorHasInternInGroup} from "../services/mentorScope.js";
const r=Router();
r.use(auth,permit("ADMIN","SUPER_ADMIN","MENTOR"));
const admin=req=>["ADMIN","SUPER_ADMIN"].includes(req.user.role);
const klu=name=>/koneru lakshmaiah|\\bklu\\b/i.test(name||"");
const fmt=d=>d.toISOString().slice(0,10);
const add=(s,n)=>{const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return fmt(d);};
const between=(a,b,c)=>a>=b&&a<=c;
async function scope(req,internId){
 const row=(await q(`SELECT ip.id,ip.full_name,ip.roll_number,ip.branch,ip.program,ip.college_id,c.name college_name,
 (SELECT ba.intern_start FROM batch_allocations ba WHERE ba.intern_id=ip.id ORDER BY ba.intern_start DESC LIMIT 1) intern_start,
 (SELECT ba.intern_end FROM batch_allocations ba WHERE ba.intern_id=ip.id ORDER BY ba.intern_start DESC LIMIT 1) intern_end,
 (SELECT ba.batch_id FROM batch_allocations ba WHERE ba.intern_id=ip.id ORDER BY ba.intern_start DESC LIMIT 1) batch_id,
 (SELECT pr.title FROM group_members gm JOIN project_assignments pa ON pa.group_id=gm.group_id AND pa.status='ASSIGNED' JOIN projects pr ON pr.id=pa.project_id WHERE gm.intern_id=ip.id AND gm.active LIMIT 1) project_title,
 (SELECT m.full_name FROM intern_mentor_assignments ima JOIN mentors m ON m.id=ima.mentor_id WHERE ima.intern_id=ip.id AND ima.active LIMIT 1) company_guide,
 (SELECT g.id FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.intern_id=ip.id AND gm.active LIMIT 1) group_id
 FROM intern_profiles ip JOIN colleges c ON c.id=ip.college_id WHERE ip.id=$1`,[internId])).rows[0];
 if(!row||!klu(row.college_name))return null;
 if(admin(req))return row;
 const mentor=(await q("SELECT id FROM mentors WHERE user_id=$1",[req.user.id])).rows[0]?.id;
 if(!mentor||!row.group_id)return null;
 const access=(await q("SELECT 1 WHERE "+mentorHasInternInGroup("$1::uuid","$2::uuid"),[row.group_id,mentor])).rowCount;
 return access?row:null;
}
function dates(profile,no){if(!Number.isInteger(no)||no<1||no>52||!profile.intern_start||!profile.intern_end)return null;const from=add(profile.intern_start,(no-1)*14),to=add(from,13);if(from>profile.intern_end)return null;return {from,to:to>profile.intern_end?profile.intern_end:to};}
async function attendance(profile,period){
 const start=profile.intern_start,end=period.to;
 const [daily,holidays,leaves]=(await Promise.all([
 q("SELECT day,status FROM attendance_daily WHERE intern_id=$1 AND day BETWEEN $2 AND $3",[profile.id,start,end]),
 q("SELECT day FROM holidays WHERE batch_id=$1 AND day BETWEEN $2 AND $3",[profile.batch_id,start,end]),
 q("SELECT from_date,to_date FROM leave_requests WHERE intern_id=$1 AND status='APPROVED' AND from_date<=$3 AND to_date>=$2",[profile.id,start,end])
 ])).map(x=>x.rows);
 const holidaySet=new Set(holidays.map(x=>x.day));
 const isWork=day=>{const wd=new Date(day+"T12:00:00Z").getUTCDay();return wd!==0&&wd!==6&&!holidaySet.has(day);};
 const summary=(from,to)=>{let working=0,present=0,leave=0,unrecorded=0;const byDay=new Map(daily.map(x=>[x.day,String(x.status).toUpperCase()]));for(let day=from;day<=to;day=add(day,1)){if(!isWork(day))continue;working++;const status=byDay.get(day);if(["PRESENT","HALF_DAY","LATE"].includes(status))present+=status==="HALF_DAY"?0.5:1;else if(leaves.some(x=>between(day,x.from_date,x.to_date)))leave++;else if(!status)unrecorded++;}return {working,present,leave,unrecorded};};
 const cutoff=fmt(new Date());const through=to=>to>cutoff?cutoff:to;
 return {fortnight:period.from>cutoff?{working:0,present:0,leave:0,unrecorded:0}:summary(period.from,through(period.to)),tillDate:summary(start,through(end))};
}
r.get("/interns",async(req,res)=>{
 const rows=(await q(`SELECT ip.id,ip.full_name,ip.roll_number,c.name college_name,g.id group_id FROM intern_profiles ip JOIN colleges c ON c.id=ip.college_id LEFT JOIN group_members gm ON gm.intern_id=ip.id AND gm.active LEFT JOIN groups g ON g.id=gm.group_id WHERE (c.name ILIKE '%KLU%' OR c.name ILIKE '%Koneru Lakshmaiah%') ORDER BY ip.full_name`)).rows;
 const accessible=[];for(const x of rows)if(await scope(req,x.id))accessible.push(x);
 res.json(accessible);
});
r.get("/interns/:id/preview",async(req,res)=>{
 const p=await scope(req,req.params.id);if(!p)return res.status(403).json({error:"KLU intern not accessible"});
 const no=Number(req.query.fortnight||1),period=dates(p,no);if(!period)return res.status(400).json({error:"Fortnight outside internship dates"});
 res.json({profile:p,fortnightNo:no,...period,attendance:await attendance(p,period)});
});
r.get("/reports",async(req,res)=>{
 const rows=(await q("SELECT f.*,ip.full_name FROM klu_fortnight_reports f JOIN intern_profiles ip ON ip.id=f.intern_id ORDER BY f.updated_at DESC")).rows;
 const accessible=[];for(const x of rows)if(await scope(req,x.intern_id))accessible.push(x);
 res.json(accessible);
});
async function currentBrand(req){const stamp=(await q("SELECT mime_type,image_data FROM report_brand_assets WHERE asset_key='company_stamp' AND owner_user_id IS NULL")).rows[0];const signature=(await q("SELECT mime_type,image_data FROM report_brand_assets WHERE asset_key='mentor_signature' AND owner_user_id=$1",[req.user.id])).rows[0];const url=x=>x?"data:"+x.mime_type+";base64,"+x.image_data.toString("base64"):null;return {stamp:url(stamp),signature:url(signature)};}
r.get("/branding",async(req,res)=>res.json(await currentBrand(req)));
r.get("/reports/:id",async(req,res)=>{
 const x=(await q("SELECT * FROM klu_fortnight_reports WHERE id=$1",[req.params.id])).rows[0];if(!x)return res.status(404).json({error:"Report not found"});
 const p=await scope(req,x.intern_id);if(!p)return res.status(403).json({error:"Not authorized"});
 const brand=x.status==="FINALIZED"?{stamp:x.stamp_snapshot&&x.stamp_mime?"data:"+x.stamp_mime+";base64,"+x.stamp_snapshot.toString("base64"):null,signature:x.signature_snapshot&&x.signature_mime?"data:"+x.signature_mime+";base64,"+x.signature_snapshot.toString("base64"):null}:await currentBrand(req);
 delete x.stamp_snapshot;delete x.signature_snapshot;
 res.json({report:x,profile:p,attendance:await attendance(p,{from:x.from_date,to:x.to_date}),brand});
});
const fields=["achievements","next_plan","exceptions","company_comments","student_feedback"];
function payload(b){const x={};for(const f of fields)x[f]=String(b[f]||"").slice(0,12000);for(const [k,max] of [["company_marks",30],["university_marks",10]]){const v=b[k];if(v===""||v===null||v===undefined)x[k]=null;else if(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>max)return null;else x[k]=Number(v);}return x;}
r.post("/reports",async(req,res)=>{
 const b=req.body||{},p=await scope(req,b.internId);if(!p)return res.status(403).json({error:"Select an accessible KLU intern"});
 const no=Number(b.fortnightNo),period=dates(p,no),data=payload(b);if(!period||!data)return res.status(400).json({error:"Invalid fortnight or marks"});
 const existing=(await q("SELECT id FROM klu_fortnight_reports WHERE intern_id=$1 AND fortnight_no=$2",[p.id,no])).rows[0];if(existing)return res.status(409).json({error:"Report already exists. Open it to edit."});
 const x=(await q(`INSERT INTO klu_fortnight_reports(intern_id,fortnight_no,from_date,to_date,achievements,next_plan,exceptions,company_comments,company_marks,university_marks,student_feedback,next_from,next_to,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,[p.id,no,period.from,period.to,data.achievements,data.next_plan,data.exceptions,data.company_comments,data.company_marks,data.university_marks,data.student_feedback,add(period.to,1),add(period.to,14),req.user.id])).rows[0];
 await audit(req,"KLU_REPORT_CREATED","klu_fortnight_report",x.id,null,x);res.status(201).json(x);
});
r.patch("/reports/:id",async(req,res)=>{
 const before=(await q("SELECT * FROM klu_fortnight_reports WHERE id=$1",[req.params.id])).rows[0];if(!before)return res.status(404).json({error:"Report not found"});
 if(!await scope(req,before.intern_id))return res.status(403).json({error:"Not authorized"});
 if(before.status==="FINALIZED")return res.status(409).json({error:"Finalized report is locked"});
 const data=payload(req.body||{});if(!data)return res.status(400).json({error:"Marks must be within allowed ranges"});
 const finalize=req.body?.finalize===true;if(finalize&&(data.company_marks===null||!data.company_comments.trim()))return res.status(400).json({error:"Company Guide marks and comments required to finalize"});
 const assets=finalize?await Promise.all([q("SELECT mime_type,image_data FROM report_brand_assets WHERE asset_key='company_stamp' AND owner_user_id IS NULL"),q("SELECT rba.mime_type,rba.image_data FROM report_brand_assets rba WHERE rba.asset_key='mentor_signature' AND rba.owner_user_id=CASE WHEN $2 THEN (SELECT m.user_id FROM intern_mentor_assignments ima JOIN mentors m ON m.id=ima.mentor_id WHERE ima.intern_id=$1 AND ima.active LIMIT 1) ELSE $3 END",[before.intern_id,admin(req),req.user.id])]):null;
 if(finalize&&(!assets[0].rows[0]||!assets[1].rows[0]))return res.status(409).json({error:"Upload the official company stamp and your mentor signature before finalizing."});
 const x=(await q(`UPDATE klu_fortnight_reports SET achievements=$2,next_plan=$3,exceptions=$4,company_comments=$5,company_marks=$6,university_marks=$7,student_feedback=$8,status=$9,finalized_by=CASE WHEN $9='FINALIZED' THEN $10 ELSE NULL END,finalized_at=CASE WHEN $9='FINALIZED' THEN now() ELSE NULL END,updated_at=now(),stamp_snapshot=CASE WHEN $9='FINALIZED' THEN $11 ELSE stamp_snapshot END,stamp_mime=CASE WHEN $9='FINALIZED' THEN $12 ELSE stamp_mime END,signature_snapshot=CASE WHEN $9='FINALIZED' THEN $13 ELSE signature_snapshot END,signature_mime=CASE WHEN $9='FINALIZED' THEN $14 ELSE signature_mime END,finalized_mentor_id=CASE WHEN $9='FINALIZED' THEN $10 ELSE finalized_mentor_id END WHERE id=$1 AND status='DRAFT' RETURNING *`,[before.id,data.achievements,data.next_plan,data.exceptions,data.company_comments,data.company_marks,data.university_marks,data.student_feedback,finalize?"FINALIZED":"DRAFT",req.user.id,assets?.[0]?.rows[0]?.image_data||null,assets?.[0]?.rows[0]?.mime_type||null,assets?.[1]?.rows[0]?.image_data||null,assets?.[1]?.rows[0]?.mime_type||null])).rows[0];
 if(!x)return res.status(409).json({error:"Report already finalized"});await audit(req,finalize?"KLU_REPORT_FINALIZED":"KLU_REPORT_UPDATED","klu_fortnight_report",x.id,before,x);res.json(x);
});
r.delete("/reports/:id",async(req,res)=>{
 const before=(await q("SELECT * FROM klu_fortnight_reports WHERE id=$1",[req.params.id])).rows[0];if(!before)return res.status(404).json({error:"Report not found"});
 if(!await scope(req,before.intern_id))return res.status(403).json({error:"Not authorized"});
 if(before.status==="FINALIZED")return res.status(409).json({error:"Finalized reports cannot be deleted"});
 await q("DELETE FROM klu_fortnight_reports WHERE id=$1 AND status='DRAFT'",[before.id]);await audit(req,"KLU_REPORT_DELETED","klu_fortnight_report",before.id,before,null);res.json({deleted:true});
});
export default r;

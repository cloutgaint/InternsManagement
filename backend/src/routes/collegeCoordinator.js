import {Router} from "express";
import bcrypt from "bcryptjs";
import {q,tx} from "../common/database/index.js";
import {auth,permit} from "../common/security/auth.middleware.js";
import {audit} from "../common/audit/audit.service.js";
const r=Router();
r.use(auth);
r.get("/dashboard",permit("COLLEGE_COORDINATOR"),async(req,res)=>{
  const account=(await q("SELECT cca.college_id,cca.full_name,c.name college_name FROM college_coordinator_accounts cca JOIN colleges c ON c.id=cca.college_id JOIN users u ON u.id=cca.user_id WHERE cca.user_id=$1 AND u.is_active AND u.status='ACTIVE'",[req.user.id])).rows[0];
  if(!account)return res.status(403).json({error:"College coordinator access is inactive"});
  const batches=(await q("SELECT b.id,b.name,b.code,b.semester,b.start_date,b.end_date,b.status,COUNT(DISTINCT ip.id) FILTER (WHERE u.id IS NOT NULL)::int intern_count FROM batches b LEFT JOIN batch_allocations ba ON ba.batch_id=b.id LEFT JOIN intern_profiles ip ON ip.id=ba.intern_id AND ip.college_id=b.college_id LEFT JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED' WHERE b.college_id=$1 GROUP BY b.id ORDER BY b.start_date DESC",[account.college_id])).rows;
  const interns=(await q("SELECT ip.id,ip.full_name,ip.roll_number,ip.year_semester,u.status,ba.batch_id,b.name batch_name,b.semester FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.status<>'DELETED' LEFT JOIN LATERAL (SELECT a.batch_id FROM batch_allocations a JOIN batches bx ON bx.id=a.batch_id AND bx.college_id=ip.college_id WHERE a.intern_id=ip.id ORDER BY a.intern_start DESC LIMIT 1) ba ON true LEFT JOIN batches b ON b.id=ba.batch_id WHERE ip.college_id=$1 ORDER BY ip.full_name",[account.college_id])).rows;
  res.json({college:account,batches,interns,totalInterns:interns.length});
});
r.get("/accounts",permit("ADMIN","SUPER_ADMIN"),async(req,res)=>{
  res.json((await q("SELECT cca.user_id,cca.college_id,cca.full_name,u.email,u.is_active,c.name college_name FROM college_coordinator_accounts cca JOIN users u ON u.id=cca.user_id JOIN colleges c ON c.id=cca.college_id ORDER BY c.name,cca.full_name")).rows);
});
r.post("/accounts",permit("ADMIN","SUPER_ADMIN"),async(req,res)=>{
  const {collegeId,fullName,email,password}=req.body;
  if(!/^[0-9a-f-]{36}$/i.test(String(collegeId||""))||String(fullName||"").trim().length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||""))||String(password||"").length<12||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!(/[^A-Za-z0-9]/.test(password)))return res.status(400).json({error:"College, name, valid email and strong password (12+ characters, upper/lowercase, number, symbol) are required"});
  const college=(await q("SELECT id FROM colleges WHERE id=$1 AND active=true AND archived_at IS NULL",[collegeId])).rows[0];
  if(!college)return res.status(404).json({error:"Active college not found"});
  const normalized=email.trim().toLowerCase();
  if((await q("SELECT 1 FROM users WHERE lower(email)=$1",[normalized])).rowCount)return res.status(409).json({error:"Email is already registered"});
  const hash=await bcrypt.hash(password,12);
  const created=await tx(async(client)=>{
    const user=(await client.query("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,$2,'COLLEGE_COORDINATOR','ACTIVE',true) RETURNING id,email",[normalized,hash])).rows[0];
    await client.query("INSERT INTO college_coordinator_accounts(user_id,college_id,full_name) VALUES($1,$2,$3)",[user.id,collegeId,fullName.trim()]);
    return {id:user.id,email:user.email,collegeId,fullName:fullName.trim()};
  });
  await audit(req,"COLLEGE_COORDINATOR_CREATED","user",created.id,null,{email:created.email,collegeId});
  res.status(201).json(created);
});
r.patch("/accounts/:id",permit("ADMIN","SUPER_ADMIN"),async(req,res)=>{
  if(typeof req.body.active!=="boolean")return res.status(400).json({error:"Active boolean is required"});
  const x=(await q("UPDATE users SET is_active=$1,status=CASE WHEN $1 THEN 'ACTIVE' ELSE 'DISABLED' END WHERE id=$2 AND role='COLLEGE_COORDINATOR' AND EXISTS(SELECT 1 FROM college_coordinator_accounts WHERE user_id=$2) RETURNING id,is_active",[req.body.active,req.params.id])).rows[0];
  if(!x)return res.status(404).json({error:"Coordinator not found"});
  await audit(req,"COLLEGE_COORDINATOR_ACCESS_UPDATED","user",x.id,null,{active:x.is_active});
  res.json(x);
});
export default r;

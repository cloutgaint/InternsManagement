import {Router} from "express";
import {q,tx} from "../common/database/index.js";
import {audit} from "../common/audit/audit.service.js";
const r=Router();
const allowed=["TEXT","LINK","REPOSITORY","DOCUMENT","PRESENTATION","VIDEO","FILE"];
const isAdmin=req=>String(req.user.role).includes("ADMIN");
async function owner(req,planId,lock=false,db=q){
 const sql="SELECT p.*,ip.user_id intern_user_id,(SELECT co.name FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id JOIN colleges co ON co.id=COALESCE(ip.college_id,b.college_id) WHERE ba.intern_id=ip.id ORDER BY (ba.intern_end>=current_date) DESC,ba.intern_start DESC LIMIT 1) college_name,(SELECT b.name FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id WHERE ba.intern_id=ip.id ORDER BY (ba.intern_end>=current_date) DESC,ba.intern_start DESC LIMIT 1) batch_name,(SELECT string_agg(DISTINCT pr.title, ', ' ORDER BY pr.title) FROM group_members gm JOIN project_assignments pa ON pa.group_id=gm.group_id AND pa.status='ASSIGNED' JOIN projects pr ON pr.id=pa.project_id WHERE gm.intern_id=ip.id AND gm.active) project_name FROM weekly_task_plans p JOIN intern_profiles ip ON ip.id=p.intern_id WHERE p.id=$1"+(lock?" FOR UPDATE OF p":"");
 const x=(await db(sql,[planId])).rows[0];
 if(!x)return null;
 if(!isAdmin(req)&&x.created_by!==req.user.id)return false;
 return x;
}
r.get("/task-plans/interns",async(req,res)=>{
 res.json((await q("SELECT ip.id,ip.full_name,ba.batch_id,ba.intern_start,ba.intern_end,b.name batch_name,COALESCE(co.name,bc.name) college_name,(SELECT string_agg(DISTINCT pr.title, ', ' ORDER BY pr.title) FROM group_members gm JOIN project_assignments pa ON pa.group_id=gm.group_id AND pa.status='ASSIGNED' JOIN projects pr ON pr.id=pa.project_id WHERE gm.intern_id=ip.id AND gm.active) project_name FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.is_active AND u.status<>'DELETED' JOIN LATERAL(SELECT batch_id,intern_start,intern_end FROM batch_allocations WHERE intern_id=ip.id AND intern_end>=current_date ORDER BY intern_start DESC LIMIT 1) ba ON true JOIN batches b ON b.id=ba.batch_id LEFT JOIN colleges co ON co.id=ip.college_id LEFT JOIN colleges bc ON bc.id=b.college_id ORDER BY ip.full_name")).rows);
});
r.get("/task-plans",async(req,res)=>{
 const params=isAdmin(req)?[]:[req.user.id];
 const where=isAdmin(req)?"":"WHERE p.created_by=$1";
 res.json((await q("SELECT p.*,ip.full_name intern_name,(SELECT name FROM colleges WHERE id=ip.college_id) college_name,(SELECT b.name FROM batch_allocations ba JOIN batches b ON b.id=ba.batch_id WHERE ba.intern_id=ip.id AND ba.intern_end>=current_date ORDER BY ba.intern_start DESC LIMIT 1) batch_name,(SELECT string_agg(DISTINCT pr.title, ', ' ORDER BY pr.title) FROM group_members gm JOIN project_assignments pa ON pa.group_id=gm.group_id AND pa.status='ASSIGNED' JOIN projects pr ON pr.id=pa.project_id WHERE gm.intern_id=ip.id AND gm.active) project_name,(SELECT count(*)::int FROM weekly_tasks wt WHERE wt.task_plan_id=p.id) task_count FROM weekly_task_plans p JOIN intern_profiles ip ON ip.id=p.intern_id "+where+" ORDER BY p.created_at DESC",params)).rows);
});
r.post("/task-plans",async(req,res)=>{
 const intern=(await q("SELECT ip.id FROM intern_profiles ip JOIN users u ON u.id=ip.user_id AND u.is_active AND u.status<>'DELETED' JOIN batch_allocations ba ON ba.intern_id=ip.id WHERE ip.id=$1 AND ba.intern_end>=current_date LIMIT 1",[req.body?.internId||null])).rows[0];
 if(!intern)return res.status(400).json({error:"Select an intern with an upcoming or active internship"});
 const x=(await q("INSERT INTO weekly_task_plans(intern_id,created_by) VALUES($1,$2) RETURNING *",[intern.id,req.user.id])).rows[0];
 await audit(req,"TASK_PLAN_CREATED","weekly_task_plan",x.id,null,x);
 res.status(201).json(x);
});
r.get("/task-plans/:id",async(req,res)=>{
 const p=await owner(req,req.params.id);
 if(p===false)return res.status(403).json({error:"Not your task plan"});
 if(!p)return res.status(404).json({error:"Plan not found"});
 const tasks=(await q("SELECT * FROM weekly_tasks WHERE task_plan_id=$1 ORDER BY plan_week",[p.id])).rows;
 res.json({...p,tasks});
});
r.put("/task-plans/:id/weeks",async(req,res)=>{
 const weeks=req.body?.weeks;
 if(!Array.isArray(weeks)||!weeks.length||weeks.length>52)return res.status(400).json({error:"Provide 1 to 52 weekly tasks"});
 const numbers=new Set();
 for(const w of weeks){
  const week=Number(w.week),release=new Date(w.releaseAt);
  if(!Number.isInteger(week)||week<1||week>52||numbers.has(week)||!String(w.title||"").trim()||!String(w.description||"").trim()||!Number.isFinite(release.getTime())||!Number.isFinite(Number(w.marks??100))||Number(w.marks??100)<=0||Number(w.marks??100)>1000)return res.status(400).json({error:"Every week needs a unique number, title, instructions, valid release date and marks"});
  numbers.add(week);
 }
 const outcome=await tx(async(client)=>{
  const p=await owner(req,req.params.id,true,(sql,args)=>client.query(sql,args));
  if(p===false)return {code:403,error:"Not your task plan"};
  if(!p)return {code:404,error:"Plan not found"};
  if(p.status!=="DRAFT")return {code:409,error:"Confirmed plans cannot be edited"};
  const allocation=(await client.query("SELECT * FROM batch_allocations WHERE intern_id=$1 AND intern_end>=current_date ORDER BY intern_start DESC LIMIT 1",[p.intern_id])).rows[0];
  if(!allocation)return {code:409,error:"Internship allocation not found"};
  const start=new Date(new Date(allocation.intern_start).toISOString().slice(0,10)+"T00:00:00+05:30"),end=new Date(new Date(allocation.intern_end).toISOString().slice(0,10)+"T23:59:59+05:30");
  for(const w of weeks){if(new Date(w.releaseAt)<start)return {code:400,error:"Task dates must be within the Admin-approved internship dates"};}
  await client.query("DELETE FROM weekly_tasks WHERE task_plan_id=$1",[p.id]);
  const mentor=isAdmin(req)?null:(await client.query("SELECT id FROM mentors WHERE user_id=$1",[req.user.id])).rows[0]?.id;
  if(!isAdmin(req)&&!mentor)return {code:403,error:"Mentor profile not found"};
  for(const w of weeks){
   const types=Array.isArray(w.submissionTypes)?w.submissionTypes.filter(x=>allowed.includes(x)):["REPOSITORY"];
   if(!types.length)return {code:400,error:"Select a submission type for every week"};
   await client.query("INSERT INTO weekly_tasks(batch_id,title,description,expected_output,submission_types,release_at,due_at,marks,status,release_timezone,target_intern_id,assigning_mentor_id,task_plan_id,plan_week) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT','Asia/Kolkata',$9,$10,$11,$12)",[allocation.batch_id,String(w.title).trim(),String(w.description).trim(),w.expectedOutput||null,JSON.stringify(types),w.releaseAt,null,Number(w.marks??100),p.intern_id,mentor,p.id,Number(w.week)]);
  }
  return {count:weeks.length};
 });
 if(outcome.code)return res.status(outcome.code).json({error:outcome.error});
 await audit(req,"TASK_PLAN_UPDATED","weekly_task_plan",req.params.id,null,outcome);
 res.json(outcome);
});
r.post("/task-plans/:id/confirm",async(req,res)=>{
 const outcome=await tx(async(client)=>{
  const p=await owner(req,req.params.id,true,(sql,args)=>client.query(sql,args));
  if(p===false)return {code:403,error:"Not your task plan"};
  if(!p)return {code:404,error:"Plan not found"};
  if(p.status!=="DRAFT")return {code:409,error:"Plan already confirmed"};
  const tasks=(await client.query("SELECT * FROM weekly_tasks WHERE task_plan_id=$1 ORDER BY plan_week FOR UPDATE",[p.id])).rows;
  if(!tasks.length)return {code:400,error:"Add weekly tasks before confirmation"};
  const alloc=(await client.query("SELECT intern_start,intern_end FROM batch_allocations WHERE intern_id=$1 AND intern_end>=current_date ORDER BY intern_start DESC LIMIT 1",[p.intern_id])).rows[0];
  if(!alloc)return {code:409,error:"Internship allocation is no longer active"};
  const start=new Date(new Date(alloc.intern_start).toISOString().slice(0,10)+"T00:00:00+05:30"),end=new Date(new Date(alloc.intern_end).toISOString().slice(0,10)+"T23:59:59+05:30");
  if(tasks.some(t=>new Date(t.release_at)<start))return {code:409,error:"Task dates are outside internship dates"};
  await client.query("UPDATE weekly_tasks SET status='SCHEDULED' WHERE task_plan_id=$1",[p.id]);
  await client.query("UPDATE weekly_task_plans SET status='CONFIRMED',confirmed_by=$2,confirmed_at=now() WHERE id=$1",[p.id,req.user.id]);
  return {count:tasks.length};
 });
 if(outcome.code)return res.status(outcome.code).json({error:outcome.error});
 await audit(req,"TASK_PLAN_CONFIRMED","weekly_task_plan",req.params.id,null,outcome);
 res.json({confirmed:true,...outcome});
});
export default r;

import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {createApp} from "../src/app.js";
import {q,pool} from "../src/common/database/index.js";
test("fortnight review creates a report with scoped individual marks", {skip:process.env.RUN_DB_E2E!=="1"},async()=>{
 assert.ok(process.env.DATABASE_URL?.includes("intern_test"),"Use isolated intern_test database");
 process.env.JWT_SECRET ||= "ci-only-review-secret";
 const suffix=Date.now().toString(36);
 const one=async(sql,args=[]) => (await q(sql,args)).rows[0];
 const app=createApp(),server=app.listen(0),base="http://127.0.0.1:"+server.address().port;
 let mentorUser;
 const request=async(method,path,body)=>{
  const token=jwt.sign({id:mentorUser.id,role:"MENTOR"},process.env.JWT_SECRET);
  const res=await fetch(base+path,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:res.status,body:await res.json()};
 };
 try{
  const college=await one("INSERT INTO colleges(name) VALUES($1) RETURNING id",["Review College "+suffix]);
  mentorUser=await one("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,'test','MENTOR','ACTIVE',true) RETURNING id",["review-mentor-"+suffix+"@example.test"]);
  const internUser=await one("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,'test','INTERN','ACTIVE',true) RETURNING id",["review-intern-"+suffix+"@example.test"]);
  const outsiderUser=await one("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,'test','INTERN','ACTIVE',true) RETURNING id",["review-outsider-"+suffix+"@example.test"]);
  const mentor=await one("INSERT INTO mentors(user_id,full_name) VALUES($1,'Review Mentor') RETURNING id",[mentorUser.id]);
  const intern=await one("INSERT INTO intern_profiles(user_id,full_name,college_id) VALUES($1,$2,$3) RETURNING id",[internUser.id,"Review Intern "+suffix,college.id]);
  const outsider=await one("INSERT INTO intern_profiles(user_id,full_name,college_id) VALUES($1,$2,$3) RETURNING id",[outsiderUser.id,"Outside Intern "+suffix,college.id]);
  const batch=await one("INSERT INTO batches(college_id,name,code,start_date,end_date) VALUES($1,'Review Batch',$2,'2026-01-01','2027-12-31') RETURNING id",[college.id,"R6"+suffix]);
  const group=await one("INSERT INTO groups(batch_id,name) VALUES($1,'Review Group') RETURNING id",[batch.id]);
  await q("INSERT INTO group_members(group_id,intern_id) VALUES($1,$2)",[group.id,intern.id]);
  await q("INSERT INTO mentor_assignments(mentor_id,group_id) VALUES($1,$2)",[mentor.id,group.id]);
  const payload={groupId:group.id,periodNo:1,reviewDate:"2026-11-03",status:"PUBLISHED",groupMarks:85,feedback:"Good progress",individualMarks:[{internId:intern.id,marks:90,note:"Strong contribution"}]};
  const invalid=await request("POST","/api/mentor/reviews",{...payload,individualMarks:[{internId:outsider.id,marks:90}]});
  assert.equal(invalid.status,400,JSON.stringify(invalid.body));
  const created=await request("POST","/api/mentor/reviews",payload);
  assert.equal(created.status,201,JSON.stringify(created.body));
  const report=await request("GET","/api/mentor/reviews/"+created.body.id+"/report");
  assert.equal(report.status,200,JSON.stringify(report.body));
  assert.equal(report.body.review.id,created.body.id);
  assert.equal(report.body.members.length,1);
  assert.equal(Number(report.body.members[0].marks),90);
  assert.equal(report.body.members[0].contribution_note,"Strong contribution");
 }finally{
  await new Promise(resolve=>server.close(resolve));
  await pool.end();
 }
});

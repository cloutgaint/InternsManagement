import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {createApp} from "../src/app.js";
import {q,pool} from "../src/common/database/index.js";
test("Phase 6 PostgreSQL performance weights API and calculated dashboard", {skip:process.env.RUN_DB_E2E!=="1"}, async()=>{
 assert.ok(process.env.DATABASE_URL?.includes("intern_test"),"Use isolated intern_test database");
 process.env.JWT_SECRET ||= "ci-only-assessment-test-secret";
 const suffix=Date.now().toString(36);
 const one=async(sql,args=[]) => (await q(sql,args)).rows[0];
 const app=createApp(),server=app.listen(0),base="http://127.0.0.1:"+server.address().port;
 let admin;
 const request=async(method,path,body)=>{
  const token=jwt.sign({id:admin.id,role:"ADMIN"},process.env.JWT_SECRET);
  const res=await fetch(base+path,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:res.status,body:await res.json()};
 };
 try{
  const college=await one("INSERT INTO colleges(name) VALUES($1) RETURNING id",["Performance College "+suffix]);
  admin=await one("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,'test','ADMIN','ACTIVE',true) RETURNING id",["performance-admin-"+suffix+"@example.test"]);
  const intern=await one("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,'test','INTERN','ACTIVE',true) RETURNING id",["performance-intern-"+suffix+"@example.test"]);
  const profile=await one("INSERT INTO intern_profiles(user_id,full_name,college_id) VALUES($1,$2,$3) RETURNING id",[intern.id,"Performance Intern "+suffix,college.id]);
  const batch=await one("INSERT INTO batches(college_id,name,code,start_date,end_date) VALUES($1,'Performance Batch',$2,'2026-01-01','2027-12-31') RETURNING id",[college.id,"P6"+suffix]);
  await q("INSERT INTO batch_allocations(batch_id,intern_id,status) VALUES($1,$2,'ALLOTMENT_VERIFIED')",[batch.id,profile.id]);
  const weights={attendance:100,tasks:0,reviews:0,final:0};
  const invalid=await request("PUT","/api/admin/performance/weights",{batchId:batch.id,weights:{attendance:99,tasks:0,reviews:0,final:0}});
  assert.equal(invalid.status,400);
  const saved=await request("PUT","/api/admin/performance/weights",{batchId:batch.id,weights});
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  const repeated=await request("PUT","/api/admin/performance/weights",{batchId:batch.id,weights});
  assert.equal(repeated.status,200);
  const listed=await request("GET","/api/admin/performance/weights");
  assert.equal(listed.status,200);
  assert.ok(listed.body.some(x=>x.batch_id===batch.id));
  await q("INSERT INTO attendance_daily(intern_id,batch_id,day,status) VALUES($1,$2,current_date,'PRESENT')",[profile.id,batch.id]);
  const performance=await request("GET","/api/admin/performance");
  assert.equal(performance.status,200,JSON.stringify(performance.body));
  const row=performance.body.interns.find(x=>x.id===profile.id);
  assert.ok(row,"Intern must appear on performance dashboard");
  assert.equal(row.performance_score,100);
  assert.deepEqual(row.performance_weights,weights);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  await pool.end();
 }
});

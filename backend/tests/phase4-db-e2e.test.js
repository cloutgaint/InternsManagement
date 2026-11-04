import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { q, pool } from "../src/common/database/index.js";

test("Phase 4 PostgreSQL attendance concurrency, holidays, leave and trusted verifier contract", { skip: process.env.RUN_DB_E2E !== "1" }, async () => {
  assert.ok(process.env.DATABASE_URL?.includes("intern_test"), "Use isolated intern_test database");
  process.env.JWT_SECRET ||= "ci-only-assessment-test-secret";
  const suffix = Date.now().toString(36);
  const iso = (days) => new Date(Date.now()+days*864e5).toISOString().slice(0,10);
  const one = async (sql, args=[]) => (await q(sql,args)).rows[0];
  const verifier = http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString());
    if(req.headers.authorization !== "Bearer test-biometric-token" || !body.enrollmentImageData || !body.baselineImageData || !body.imageData) {res.writeHead(401).end();return;}
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify({matchScore:0.97,livenessScore:0.98,challengePass:true}));
  });
  await new Promise(resolve=>verifier.listen(0,"127.0.0.1",resolve));
  process.env.BIOMETRIC_VERIFY_URL="http://127.0.0.1:"+verifier.address().port;
  process.env.BIOMETRIC_VERIFY_TOKEN="test-biometric-token";
  const app=createApp(),server=app.listen(0);
  const base="http://127.0.0.1:"+server.address().port;
  const req=async(role,method,path,body)=>{
    const token=jwt.sign({id:role==="ADMIN"?admin.id:user.id,role},process.env.JWT_SECRET);
    const response=await fetch(base+path,{method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
  let admin,user;
  const enrollmentFile=path.join(os.tmpdir(),"phase4-enrollment-"+suffix+".jpg");
  fs.writeFileSync(enrollmentFile,Buffer.concat([Buffer.from([0xff,0xd8,0xff]),Buffer.alloc(100,1)]));
  try{
    const college=await one("INSERT INTO colleges(name) VALUES($1) RETURNING id",["Phase4 College "+suffix]);
    admin=await one("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,'test','ADMIN','ACTIVE',true) RETURNING id",["p4-admin-"+suffix+"@example.test"]);
    user=await one("INSERT INTO users(email,password_hash,role,status,is_active) VALUES($1,'test','INTERN','ACTIVE',true) RETURNING id",["p4-intern-"+suffix+"@example.test"]);
    const profile=await one("INSERT INTO intern_profiles(user_id,full_name,college_id) VALUES($1,'Phase4 Intern',$2) RETURNING id",[user.id,college.id]);
    const batch=await one("INSERT INTO batches(college_id,name,code,start_date,end_date,leave_limit_days,working_days) VALUES($1,'Phase4 Batch',$2,current_date-interval '10 days',current_date+interval '90 days',1,'[0,1,2,3,4,5,6]') RETURNING id",[college.id,"P4"+suffix]);
    await q("INSERT INTO batch_allocations(batch_id,intern_id,intern_start,intern_end) VALUES($1,$2,current_date-interval '10 days',current_date+interval '90 days')",[batch.id,profile.id]);
    await q("INSERT INTO face_enrollments(intern_id,template_ref,raw_image_path,status,approved_by,approved_at) VALUES($1,'capture:test',$3,'APPROVED',$2,now())",[profile.id,admin.id,enrollmentFile]);
    const imageData="data:image/jpeg;base64,"+Buffer.alloc(11000,42).toString("base64");
    const attendance=(eventType)=>req("INTERN","POST","/api/intern/attendance/verify",{eventType,imageData,baselineImageData:imageData,challengeType:"TURN_LEFT",matchScore:0,livenessScore:0,challengePass:false});
    const noProvider=process.env.BIOMETRIC_VERIFY_URL;delete process.env.BIOMETRIC_VERIFY_URL;
    try{const blocked=await attendance("CHECK_IN");assert.equal(blocked.status,503);}finally{process.env.BIOMETRIC_VERIFY_URL=noProvider;}
    const first=await Promise.all([attendance("CHECK_IN"),attendance("CHECK_IN")]);
    assert.deepEqual(first.map(x=>x.status).sort(),[201,409],JSON.stringify(first));
    const second=await Promise.all([attendance("CHECK_OUT"),attendance("CHECK_OUT")]);
    assert.deepEqual(second.map(x=>x.status).sort(),[201,409],JSON.stringify(second));
    const daily=await one("SELECT count(*)::int n,max(working_minutes) minutes FROM attendance_daily WHERE intern_id=$1 AND day=current_date",[profile.id]);
    const events=await one("SELECT count(*)::int n FROM attendance_events WHERE intern_id=$1",[profile.id]);
    assert.equal(daily.n,1);assert.equal(events.n,2);
    const holiday=await req("ADMIN","POST","/api/admin/holidays",{batchId:batch.id,day:iso(3),name:"E2E Holiday"});
    assert.equal(holiday.status,201,JSON.stringify(holiday));
    const holidayLeave=await req("INTERN","POST","/api/intern/leave",{fromDate:iso(3),toDate:iso(3),reason:"Holiday test"});
    assert.equal(holidayLeave.status,400);
    const leave=await req("INTERN","POST","/api/intern/leave",{fromDate:iso(4),toDate:iso(4),reason:"E2E leave"});
    assert.equal(leave.status,201,JSON.stringify(leave));
    const approved=await req("ADMIN","POST","/api/admin/leave-requests/"+leave.data.id+"/decision",{status:"APPROVED"});
    assert.equal(approved.status,200,JSON.stringify(approved));
    const repeat=await req("ADMIN","POST","/api/admin/leave-requests/"+leave.data.id+"/decision",{status:"APPROVED"});
    assert.equal(repeat.status,409);
    const overLimit=await req("INTERN","POST","/api/intern/leave",{fromDate:iso(5),toDate:iso(5),reason:"Exceeds limit"});
    assert.equal(overLimit.status,409,JSON.stringify(overLimit));
  }finally{
    fs.rmSync(enrollmentFile,{force:true});
    await new Promise(resolve=>server.close(resolve));
    await new Promise(resolve=>verifier.close(resolve));
    delete process.env.BIOMETRIC_VERIFY_URL;delete process.env.BIOMETRIC_VERIFY_TOKEN;
    await pool.end();
  }
});

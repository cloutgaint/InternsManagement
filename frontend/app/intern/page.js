"use client";
import {useEffect,useState} from 'react';
import {api} from '../../lib/api';

const fmt=d=>d?String(d).slice(0,10):'—';
export default function Page(){
 const [data,setData]=useState(null),[err,setErr]=useState('');
 useEffect(()=>{api('/intern/dashboard').then(setData).catch(e=>setErr(e.message))},[]);
 if(err)return <main className="wrap"><p className="error">{err}</p></main>;
 if(!data)return <main className="wrap"><p>Loading dashboard…</p></main>;
 const p=data.profile||{},a=data.allocation,o=data.offerLetter,f=data.face;
 const present=(data.attendance||[]).filter(x=>x.status==='PRESENT').length;
 return <main className="wrap">
  <div className="intern-head"><div><h1>Intern Dashboard</h1><p className="muted">Welcome back, {p.full_name||'Intern'}. Track your internship progress and required actions here.</p></div><span className="badge">{a?.batch_name||'Awaiting batch allocation'}</span></div>
  <div className="intern-summary">
   <div className="card"><span className="muted">Domain</span><h3>{a?.domain_name||'Not assigned'}</h3></div>
   <div className="card"><span className="muted">Internship Period</span><h3>{a?fmt(a.intern_start)+' to '+fmt(a.intern_end):'Not allocated'}</h3></div>
   <div className="card"><span className="muted">Attendance</span><h3>{present} present / {(data.attendance||[]).length} records</h3></div>
   <div className="card"><span className="muted">Active Tasks</span><h3>{(data.tasks||[]).length}</h3></div>
  </div>
  {!a&&<p className="intern-notice">Your account is active. Internship batch, dates and domain will appear after Admin completes allocation.</p>}
  <div className="intern-sections">
   <section className="card"><h2>My Profile</h2><div className="detail-grid"><div><b>Full Name</b><span>{p.full_name||'—'}</span></div><div><b>Mobile</b><span>{p.mobile||'—'}</span></div><div><b>Program / Branch</b><span>{p.program||'—'} / {p.branch||'—'}</span></div><div><b>Roll Number</b><span>{p.roll_number||'—'}</span></div><div><b>University</b><span>{p.university||'—'}</span></div><div><b>Year / Semester</b><span>{p.year_semester||'—'}</span></div></div></section>
   <section className="card"><h2>Onboarding</h2><div className="status-row"><span>Batch allocation</span><b>{a?'Completed':'Pending'}</b></div><div className="status-row"><span>Offer letter</span><b>{o?'Issued':'Pending'}</b></div><div className="status-row"><span>Face registration</span><b>{f?f.status:'Not submitted'}</b></div><div className="status-row"><span>Final domain</span><b>{a?.domain_name||'Pending'}</b></div></section>
   <section className="card"><h2>Attendance</h2>{(data.attendance||[]).length?<div className="mini-list">{data.attendance.slice(0,5).map(x=><div key={x.id||x.day}><span>{fmt(x.day)}</span><b>{x.status}</b></div>)}</div>:<p className="muted">No attendance records yet.</p>}</section>
   <section className="card"><h2>Tasks</h2>{(data.tasks||[]).length?<div className="mini-list">{data.tasks.map(t=><div key={t.id}><span>{t.title||'Task'}</span><b>{t.due_at?'Due '+fmt(t.due_at):t.status}</b></div>)}</div>:<p className="muted">No active tasks assigned yet.</p>}</section>
   <section className="card"><h2>Notifications</h2>{(data.notifications||[]).length?<div className="mini-list">{data.notifications.slice(0,5).map(n=><div key={n.id}><span>{n.title||n.message||'Notification'}</span></div>)}</div>:<p className="muted">No new notifications.</p>}</section>
  </div>
 </main>
}

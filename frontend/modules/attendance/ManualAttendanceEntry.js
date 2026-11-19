"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";

export default function ManualAttendanceEntry({ onSaved }) {
  const [interns,setInterns]=useState([]);
  const [form,setForm]=useState({internId:"",day:"",checkIn:"",checkOut:"",reason:""});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  useEffect(()=>{api("/admin/interns").then(rows=>setInterns(rows.filter(x=>x.batch_id && x.account_status!=="DELETED"))).catch(e=>setError(e.message));},[]);
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
  async function submit(e){
    e.preventDefault();setError("");setSuccess("");
    if(form.reason.trim().length<10)return setError("Enter a reason of at least 10 characters.");
    if(!form.checkIn||!form.checkOut||form.checkOut<=form.checkIn)return setError("Check-out must be after check-in.");
    setBusy(true);
    try{
      const record=await api("/admin/attendance/manual",{method:"POST",body:JSON.stringify(form)});
      setSuccess("Manual attendance saved: "+String(record.status||"").replaceAll("_"," ").toLowerCase()+".");
      setForm(f=>({...f,checkIn:"",checkOut:"",reason:""}));
      await onSaved?.();
    }catch(err){setError(err.message||"Unable to save attendance.");}
    finally{setBusy(false);}
  }
  return <section className="card workflow-section">
    <h2>Manual attendance entry</h2>
    <p className="muted">Admin-only fallback when an intern cannot sign in or face verification fails. Existing records cannot be overwritten here. Seven hours counts as a full day; four hours counts as a half day.</p>
    <form onSubmit={submit} className="form-grid">
      <label>Intern<select className="input" required value={form.internId} onChange={e=>change("internId",e.target.value)}><option value="">Select intern</option>{interns.map(x=><option key={x.id} value={x.id}>{x.full_name} — {x.roll_number||"No roll number"} — {x.batch_name||"Batch"}</option>)}</select></label>
      <label>Attendance date<input className="input" type="date" required value={form.day} onChange={e=>change("day",e.target.value)}/></label>
      <label>Check-in time<input className="input" type="time" required value={form.checkIn} onChange={e=>change("checkIn",e.target.value)}/></label>
      <label>Check-out time<input className="input" type="time" required value={form.checkOut} onChange={e=>change("checkOut",e.target.value)}/></label>
      <label style={{gridColumn:"1 / -1"}}>Reason for manual entry<textarea className="input" required minLength={10} maxLength={1000} rows={3} value={form.reason} onChange={e=>change("reason",e.target.value)} placeholder="Explain why the intern could not use normal attendance verification"/></label>
      <div style={{gridColumn:"1 / -1"}}>{error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success" role="status">{success}</p>}<button className="btn" type="submit" disabled={busy}>{busy?"Saving…":"Save manual attendance"}</button></div>
    </form>
  </section>;
}

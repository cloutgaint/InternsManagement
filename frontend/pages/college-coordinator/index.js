import {useEffect,useState} from "react";
import {useRouter} from "next/router";
import {api} from "@/shared/api/client";
export default function CollegeCoordinatorDashboard(){
  const router=useRouter();
  const [data,setData]=useState(null),[err,setErr]=useState(""),[batch,setBatch]=useState("");
  useEffect(()=>{if(sessionStorage.getItem("role")!=="COLLEGE_COORDINATOR"){router.replace("/login?role=college");return;}api("/college-coordinator/dashboard").then(setData).catch(e=>setErr(e.message));},[router]);
  const interns=(data?.interns||[]).filter(i=>!batch||i.batch_id===batch);
  return <main className="wrap"><div className="intern-head"><div><h1>College Coordinator Dashboard</h1><p className="muted">{data?.college?.college_name||"Your college"} · View-only internship monitoring</p></div></div>{err&&<p className="error">{err}</p>}{data&&<><section className="card"><h2>Total Interns: {data.totalInterns}</h2><div className="form-field"><label>Filter by semester batch</label><select className="input" value={batch} onChange={e=>setBatch(e.target.value)}><option value="">All batches</option>{data.batches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.semester||"Semester not set"} ({b.intern_count})</option>)}</select></div></section><section className="card workflow-section"><h2>Semester Batches</h2>{data.batches.map(b=><div className="workflow-row" key={b.id}><div><b>{b.name}</b><p className="muted">{b.code} · {b.semester||"—"} · {String(b.start_date).slice(0,10)} to {String(b.end_date).slice(0,10)}</p></div><strong>{b.intern_count} interns</strong></div>)}</section><section className="card workflow-section"><h2>College Interns ({interns.length})</h2>{interns.map(i=><div className="workflow-row" key={i.id}><div><b>{i.full_name}</b><p className="muted">{i.roll_number} · {i.year_semester} · {i.batch_name||"Not allotted"} · {i.status}</p></div></div>)}</section></>}</main>;
}

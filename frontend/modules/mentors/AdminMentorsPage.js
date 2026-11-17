"use client";
import {useEffect,useState} from "react";
import {api} from "@/shared/api/client";
export default function AdminMentorsPage(){
 const [form,setForm]=useState({fullName:"",email:"",password:"",expertise:""}),[mentors,setMentors]=useState([]),[interns,setInterns]=useState([]),[assignments,setAssignments]=useState([]),[batchId,setBatchId]=useState(""),[batches,setBatches]=useState([]),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState({message:"",error:"",area:""});
 async function load(){try{const [m,i,a,b]=await Promise.all(["mentors","interns","intern-mentor-assignments","batches"].map(x=>api("/admin/"+x)));setMentors(m);setInterns(i);setAssignments(a);setBatches(b);setBatchId(v=>v||b[0]?.id||"");}catch(e){setFeedback({error:e.message,area:"list"});}}
 useEffect(()=>{load();},[]);
 async function create(e){e.preventDefault();setBusy(true);setFeedback({area:"create"});try{await api("/admin/mentors",{method:"POST",body:JSON.stringify({...form,expertise:form.expertise.split(",").map(x=>x.trim()).filter(Boolean)})});setForm({fullName:"",email:"",password:"",expertise:""});setFeedback({message:"Mentor account created.",area:"create"});await load();}catch(e){setFeedback({error:e.message,area:"create"});}finally{setBusy(false);}}
 async function assign(internId,mentorId){setBusy(true);setFeedback({area:"list"});try{await api("/admin/interns/"+internId+"/mentor",{method:"PUT",body:JSON.stringify({mentorId:mentorId||null})});setFeedback({message:mentorId?"Mentor assigned to intern.":"Mentor unassigned.",area:"list"});await load();}catch(e){setFeedback({error:e.message,area:"list"});}finally{setBusy(false);}}
 const message=area=>feedback.area===area&&<>{feedback.error&&<p className="error" role="alert">{feedback.error}</p>}{feedback.message&&<p className="success" role="status">{feedback.message}</p>}</>;
 return <main className="wrap admin-mentors-page">
  <div className="intern-head"><div><h1>Intern Mentor Management</h1><p className="muted">Admin assigns mentors to individual interns. There is no maximum group or intern assignment limit. Reassign or unassign at any time.</p></div></div>
  <section className="card workflow-section"><h2>Create Mentor Login</h2>{message("create")}<form className="form-grid" onSubmit={create}><label>Mentor name<input className="input" required maxLength={150} value={form.fullName} onChange={e=>setForm(x=>({...x,fullName:e.target.value}))}/></label><label>Login email<input className="input" type="email" required value={form.email} onChange={e=>setForm(x=>({...x,email:e.target.value}))}/></label><label>Initial password<input className="input" type="password" minLength={12} required autoComplete="new-password" value={form.password} onChange={e=>setForm(x=>({...x,password:e.target.value}))}/><small>12+ characters, uppercase, lowercase, number and symbol.</small></label><label>Expertise (comma separated)<input className="input" value={form.expertise} onChange={e=>setForm(x=>({...x,expertise:e.target.value}))}/></label><div className="form-actions"><button className="btn" disabled={busy}>{busy?"Saving…":"Create Mentor Account"}</button></div></form></section>
  <section className="card workflow-section"><h2>Available Mentors</h2><div className="mentor-capacity-grid">{mentors.map(m=><div className="mentor-capacity" key={m.id}><b>{m.full_name}</b><small>{m.email}</small><span>{assignments.filter(a=>a.mentor_id===m.id).length} assigned intern(s) · No limit</span><small>Expertise: {(m.expertise||[]).join(", ")||"General"}</small></div>)}</div></section>
  <section className="card workflow-section"><h2>Assign Mentor to Intern</h2>{message("list")}<label>Internship batch<select className="input" value={batchId} onChange={e=>setBatchId(e.target.value)}><option value="">All batches</option>{batches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>{interns.filter(i=>!batchId||i.batch_id===batchId).map(i=><div className="workflow-row" key={i.id}><div><b>{i.full_name}</b><div className="muted">{i.batch_name||"No batch"} · {i.final_domain||"Domain pending"}</div></div><label>Assigned mentor<select aria-label={"Mentor for "+i.full_name} className="input" disabled={busy} value={assignments.find(a=>a.intern_id===i.id)?.mentor_id||""} onChange={e=>assign(i.id,e.target.value)}><option value="">No mentor assigned</option>{mentors.map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label></div>)}</section>
 <style jsx global>{`.admin-mentors-page{max-width:1240px;margin-inline:auto;padding:24px 28px 72px;color:#111}
.admin-mentors-page .intern-head{margin:16px 0 25px}
.admin-mentors-page .intern-head h1{font-size:clamp(28px,3vw,36px);font-weight:700;letter-spacing:-.035em;color:#111;margin:0 0 8px}
.admin-mentors-page .intern-head p{max-width:820px;font-size:15px;line-height:1.6;color:#525252;margin:0}
.admin-mentors-page>.card{background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:24px 26px;margin-bottom:17px;box-shadow:0 5px 20px rgba(15,23,42,.035)}
.admin-mentors-page h2{font-size:19px;font-weight:700;letter-spacing:-.02em;color:#111;margin:0 0 18px}
.admin-mentors-page .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 18px;align-items:end}
.admin-mentors-page .form-grid>label,.admin-mentors-page section>label{display:flex;flex-direction:column;gap:7px;min-width:0;font-size:12px;font-weight:650;color:#262626}
.admin-mentors-page .input{display:block;width:100%;min-width:0;height:44px;min-height:44px;margin:0;padding:10px 12px;box-sizing:border-box;border:1.5px solid #93b4ed;border-radius:9px;background:#fff;color:#111;font-size:14px}
.admin-mentors-page .input:hover{border-color:#2563eb}
.admin-mentors-page .input:focus{outline:0;border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe}
.admin-mentors-page .form-grid small{font-size:11px;line-height:1.5;color:#64748b;font-weight:400}
.admin-mentors-page .form-actions{grid-column:1/-1;display:flex;justify-content:flex-end;margin-top:4px}
.admin-mentors-page .btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 16px;border-radius:10px;background:#075b3b;border:1px solid #075b3b;color:#fff;font-size:13px;font-weight:650}
.admin-mentors-page .btn:hover:not(:disabled){background:#06472f;border-color:#06472f}
.admin-mentors-page .btn:disabled{opacity:.55;cursor:not-allowed}
.admin-mentors-page button:focus-visible,.admin-mentors-page input:focus-visible,.admin-mentors-page select:focus-visible{outline:3px solid #bfdbfe;outline-offset:2px}
.admin-mentors-page .mentor-capacity-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.admin-mentors-page .mentor-capacity{display:flex;flex-direction:column;gap:7px;min-width:0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#fafbfc}
.admin-mentors-page .mentor-capacity b{font-size:14px;font-weight:700;color:#111}
.admin-mentors-page .mentor-capacity small{font-size:12px;line-height:1.5;color:#525252;overflow-wrap:anywhere}
.admin-mentors-page .mentor-capacity span{align-self:flex-start;padding:6px 9px;border-radius:999px;background:#eaf5ee;color:#17633d;font-size:11px;font-weight:650}
.admin-mentors-page .workflow-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,300px);align-items:center;gap:16px;padding:16px 0;border-top:1px solid #edf0f4}
.admin-mentors-page .workflow-row b{font-size:14px;font-weight:650;color:#111}
.admin-mentors-page .workflow-row .muted{font-size:12px;line-height:1.5;color:#525252;margin-top:5px}
.admin-mentors-page .workflow-row label{display:flex;flex-direction:column;gap:7px;min-width:0;font-size:12px;font-weight:650;color:#262626}
@media(max-width:700px){.admin-mentors-page{padding:18px 14px 48px}.admin-mentors-page>.card{padding:20px 16px}.admin-mentors-page .form-grid{grid-template-columns:1fr}.admin-mentors-page .form-actions{justify-content:stretch}.admin-mentors-page .form-actions .btn{width:100%}.admin-mentors-page .workflow-row{grid-template-columns:1fr}.admin-mentors-page .mentor-capacity-grid{grid-template-columns:1fr}}`}</style></main>;
}

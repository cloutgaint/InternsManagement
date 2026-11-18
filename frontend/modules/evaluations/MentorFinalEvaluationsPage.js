"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/client";
export default function MentorFinalEvaluationsPage() {
  const [rows, setRows] = useState([]),
    [sel, setSel] = useState(null),
    [f, setF] = useState({
      groupMarks: "",
      individualMarks: "",
      mentorFeedback: "",
      recommendation: "COMPLETED",
    }),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[search,setSearch]=useState(""),[status,setStatus]=useState("ALL"),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(5);
  const load = async () => {setLoading(true);try{const data=await api("/mentor/final-evaluations/candidates");setRows(Array.isArray(data)?data:[]);setErr("");}catch(e){setErr(e.message);}finally{setLoading(false);}};
  useEffect(() => {
    load();
  }, []);
  function open(x) {
    setErr("");setMsg("");setSel(x);
    setF({
      groupMarks: x.group_marks ?? "",
      individualMarks: x.individual_marks ?? "",
      mentorFeedback: x.mentor_feedback || "",
      recommendation: x.recommendation || "COMPLETED",
    });
  }
  async function save() {
    if (f.groupMarks === "" || f.individualMarks === "" || !Number.isFinite(Number(f.groupMarks)) || !Number.isFinite(Number(f.individualMarks)) || Number(f.groupMarks) < 0 || Number(f.groupMarks) > 100 || Number(f.individualMarks) < 0 || Number(f.individualMarks) > 100) { setErr("Enter valid group and individual marks between 0 and 100."); return; }
    setSaving(true);setErr("");setMsg("");try {
      await api("/mentor/final-evaluations", {
        method: "POST",
        body: JSON.stringify({
          groupId: sel.group_id,
          internId: sel.intern_id,
          ...f,
          groupMarks: Number(f.groupMarks),
          individualMarks: Number(f.individualMarks),
        }),
      });
      setMsg("Final evaluation submitted for Admin completion approval.");
      setSel(null);
      load();
    } catch (e) {
      setErr(e.message);
    }finally{setSaving(false);}
  }
  const filtered=useMemo(()=>rows.filter(x=>(status==="ALL"||(status==="PENDING"?!x.evaluation_id:!!x.evaluation_id))&&(!search.trim()||[x.full_name,x.group_name,x.project_title].some(v=>String(v??"").toLowerCase().includes(search.trim().toLowerCase())))),[rows,status,search]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,totalPages),visible=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  return (
    <main className="wrap mentor-final-evaluations">
      <div className="intern-head">
        <div>
          <h1>Final evaluations</h1>
          <p className="muted">
            Review attendance, tasks, fortnight performance and project context
            before recommending completion.
          </p>
        </div>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <div className="mfe-stats"><div><span>Total interns</span><strong>{rows.length}</strong></div><div><span>Awaiting evaluation</span><strong>{rows.filter(x=>!x.evaluation_id).length}</strong></div><div><span>Evaluated</span><strong>{rows.filter(x=>!!x.evaluation_id).length}</strong></div></div>
      <section className="card mfe-panel"><div className="mfe-panel-heading"><div><h2>Intern evaluations</h2><p className="muted">Review performance and submit a recommendation.</p></div><span className="mfe-count">{filtered.length} results</span></div>
      <div className="mfe-filters"><label>Search interns<input className="input" type="search" placeholder="Name, project or group" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label><label>Evaluation status<select className="input" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="EVALUATED">Evaluated</option></select></label></div>
      {loading?<div className="mfe-empty">Loading evaluations…</div>:!visible.length?<div className="mfe-empty"><strong>{rows.length?"No matching interns":"No interns awaiting or assigned a final evaluation"}</strong><p className="muted">{rows.length?"Try changing the search or status filter.":"Eligible interns will appear here when available."}</p></div>:<div className="mfe-list">{visible.map(x=><article className="mfe-intern" key={x.intern_id}><div className="mfe-intern-top"><div><h3>{x.full_name}</h3><p>{x.group_name} · {x.project_title||"No project"}</p></div><span className={"mfe-status "+(x.evaluation_id?"mfe-done":"")}>{x.evaluation_id?(x.recommendation||"Evaluated").replaceAll("_"," "):"Pending"}</span></div><div className="mfe-metrics"><div><span>Attendance</span><strong>{x.attendance_pct??"—"}{x.attendance_pct!=null?"%":""}</strong></div><div><span>Task average</span><strong>{x.task_avg??"—"}</strong></div><div><span>Review average</span><strong>{x.review_avg??"—"}</strong></div></div><div className="mfe-intern-actions"><button type="button" className="btn" onClick={()=>open(x)}>{x.evaluation_id?"Update evaluation":"Evaluate intern"}</button></div></article>)}</div>}
      {filtered.length>0&&<nav className="mfe-pagination" aria-label="Evaluation pagination"><span>Showing {(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,filtered.length)} of {filtered.length}</span><div><label>Rows per page <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label><button className="btn secondary" type="button" disabled={currentPage===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button><span>Page {currentPage} of {totalPages}</span><button className="btn secondary" type="button" disabled={currentPage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button></div></nav>}</section>
      {sel && (
        <div className="modal-backdrop mfe-modal" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-label="Final evaluation">
            <div className="verification-title">
              <div>
                <h2>{sel.full_name}</h2>
                <p className="muted">
                  {sel.group_name} ·{" "}
                  {sel.project_title || "No project assigned"}
                </p>
              </div>
              <button type="button" className="icon-close" aria-label="Close evaluation" onClick={() => setSel(null)}>
                ×
              </button>
            </div>
            <div className="work-summary">
              <div>
                <span>Attendance</span>
                <b>{sel.attendance_pct}%</b>
              </div>
              <div>
                <span>Task Average</span>
                <b>{sel.task_avg}</b>
              </div>
              <div>
                <span>Review Average</span>
                <b>{sel.review_avg}</b>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Group Marks / 100
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  value={f.groupMarks}
                  onChange={(e) =>
                    setF((x) => ({ ...x, groupMarks: e.target.value }))
                  }
                />
              </label>
              <label>
                Individual Marks / 100
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  value={f.individualMarks}
                  onChange={(e) =>
                    setF((x) => ({ ...x, individualMarks: e.target.value }))
                  }
                />
              </label>
            </div>
            <label>
              Mentor Feedback
              <textarea
                className="input"
                value={f.mentorFeedback}
                onChange={(e) =>
                  setF((x) => ({ ...x, mentorFeedback: e.target.value }))
                }
              />
            </label>
            <label>
              Recommendation
              <select
                className="input"
                value={f.recommendation}
                onChange={(e) =>
                  setF((x) => ({ ...x, recommendation: e.target.value }))
                }
              >
                <option value="COMPLETED">Completed</option>
                <option value="NEEDS_WORK">Needs Work</option>
              </select>
            </label>
            <div className="form-actions">
              <button className="btn" disabled={saving} onClick={save}>
                {saving?"Saving…":"Submit final evaluation"}
              </button>
            </div>
          </section>
        </div>
      )}
      <style jsx global>{` .mentor-final-evaluations{max-width:1160px;margin:0 auto;padding:28px 20px 64px;color:#111;box-sizing:border-box}.mentor-final-evaluations h1{font-size:clamp(26px,3vw,34px);margin:0 0 8px}.mentor-final-evaluations .intern-head{margin-bottom:22px}.mentor-final-evaluations .intern-head p{font-size:14px;line-height:1.6}.mentor-final-evaluations .mfe-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}.mentor-final-evaluations .mfe-stats>div{background:#fff;border:1px solid #dce7e1;border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:8px}.mentor-final-evaluations .mfe-stats span,.mentor-final-evaluations .mfe-metrics span{font-size:13px;color:#475569}.mentor-final-evaluations .mfe-stats strong{font-size:27px}.mentor-final-evaluations .mfe-panel{border:1px solid #dce7e1;border-radius:20px;padding:24px}.mentor-final-evaluations .mfe-panel-heading,.mentor-final-evaluations .mfe-intern-top{display:flex;align-items:start;justify-content:space-between;gap:12px}.mentor-final-evaluations h2{font-size:21px;margin:0}.mentor-final-evaluations .mfe-count{background:#e9f5ee;color:#075e46;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;white-space:nowrap}.mentor-final-evaluations .mfe-filters{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin:22px 0}.mentor-final-evaluations .mfe-filters label{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:650}.mentor-final-evaluations .input{width:100%;min-height:44px;border:1.5px solid #79a6f9;border-radius:10px;color:#111;background:#fff;padding:10px 12px;box-sizing:border-box}.mentor-final-evaluations .input:focus{outline:0;border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe}.mentor-final-evaluations .mfe-list{display:grid;gap:14px}.mentor-final-evaluations .mfe-intern{border:1px solid #e2e8f0;border-radius:15px;padding:20px}.mentor-final-evaluations .mfe-intern h3{margin:0;font-size:17px}.mentor-final-evaluations .mfe-intern-top p{margin:5px 0 0;color:#475569;font-size:13px}.mentor-final-evaluations .mfe-status{font-size:12px;font-weight:700;padding:7px 12px;border-radius:999px;background:#fff4dd;color:#854d0e;white-space:nowrap}.mentor-final-evaluations .mfe-done{background:#e8f7ed;color:#166534}.mentor-final-evaluations .mfe-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:18px 0}.mentor-final-evaluations .mfe-metrics>div{background:#f7faf9;border:1px solid #e7efeb;border-radius:12px;padding:13px;display:flex;flex-direction:column;gap:7px}.mentor-final-evaluations .mfe-metrics strong{font-size:19px}.mentor-final-evaluations .mfe-intern-actions{display:flex;justify-content:flex-end}.mentor-final-evaluations .btn{min-height:44px;border-radius:999px!important}.mentor-final-evaluations .btn:not(.secondary){background:linear-gradient(110deg,#8b45ff,#5c8dfb);border:0;color:#fff}.mentor-final-evaluations .btn:hover:not(:disabled){color:#fff}.mentor-final-evaluations .btn.secondary:hover:not(:disabled){background:#075e46;color:#fff}.mentor-final-evaluations .mfe-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:20px;font-size:13px}.mentor-final-evaluations .mfe-pagination>div{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.mentor-final-evaluations .mfe-pagination label{display:flex;align-items:center;gap:7px}.mentor-final-evaluations .mfe-pagination select{border:1px solid #cbd5e1;border-radius:9px;padding:9px;color:#111;background:#fff}.mentor-final-evaluations .mfe-empty{text-align:center;padding:40px 12px}.mfe-modal .modal-card{max-width:660px;width:calc(100% - 32px);max-height:90vh;overflow-y:auto;border-radius:20px}.mfe-modal .modal-card label{display:block;font-weight:650;font-size:13px;margin-top:14px}.mfe-modal .modal-card .input{width:100%;min-height:44px;margin-top:7px;box-sizing:border-box;border:1.5px solid #79a6f9;border-radius:10px;color:#111;background:#fff}.mfe-modal .modal-card textarea.input{min-height:100px}.mfe-modal .modal-card .btn{border-radius:999px!important;min-height:44px;background:linear-gradient(110deg,#8b45ff,#5c8dfb);color:#fff;border:0}.mfe-modal .work-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.mfe-modal .work-summary>div{min-width:0}@media(max-width:650px){.mentor-final-evaluations{padding:20px 16px 48px}.mentor-final-evaluations .mfe-stats{gap:8px}.mentor-final-evaluations .mfe-stats>div{padding:12px}.mentor-final-evaluations .mfe-stats strong{font-size:22px}.mentor-final-evaluations .mfe-panel{padding:15px}.mentor-final-evaluations .mfe-filters{grid-template-columns:1fr}.mentor-final-evaluations .mfe-metrics{gap:7px}.mentor-final-evaluations .mfe-metrics>div{padding:10px}.mentor-final-evaluations .mfe-metrics strong{font-size:16px}.mentor-final-evaluations .mfe-intern{padding:14px}.mentor-final-evaluations .mfe-intern-top{flex-wrap:wrap}.mentor-final-evaluations .mfe-pagination{flex-direction:column;align-items:start}.mfe-modal .work-summary{grid-template-columns:1fr 1fr}} `}</style>
    </main>
  );
}

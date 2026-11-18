"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function MentorOperationsPage() {
  const [d, setD] = useState(null),
    [tab, setTab] = useState("attendance"),
    [q, setQ] = useState(""),
    [exceptions, setExceptions] = useState([]),
    [notes, setNotes] = useState({}),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(5),[statusFilter,setStatusFilter]=useState("ALL");
  const load = () =>
    Promise.all([api("/mentor/operations"), api("/mentor/attendance-exceptions")])
      .then(([o, e]) => {
        setD(o);
        setExceptions(e);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function decide(path, x, status) {
    setErr("");
    setMsg("");
    try {
      await api("/mentor/" + path + "/" + x.id + "/decision", { method: "POST", body: JSON.stringify({ status, reason: notes[x.id] || "" }) });
      setMsg("Decision recorded.");
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }
  const decisionControls = (path, x) => (
    <div className="action-row">
      <input className="input" aria-label={"Decision note for " + x.full_name} placeholder="Reason" value={notes[x.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [x.id]: e.target.value }))} />
      <button className="btn" onClick={() => decide(path, x, "APPROVED")}>Approve</button>
      <button className="btn danger" onClick={() => decide(path, x, "REJECTED")}>Reject</button>
    </div>
  );
  if (!d) return <main className="wrap">Loading operational workspace…</main>;
  const match = (x) =>
    (x.full_name + " " + (x.group_name || ""))
      .toLowerCase()
      .includes(q.toLowerCase());
  const sources={attendance:d.attendance||[],exceptions,leave:d.leave||[],reports:d.dailyReports||[],milestones:d.milestones||[]};
  const records=sources[tab].filter(x=>(tab==="milestones"?(String(x.group_name||"")+" "+String(x.title||"")).toLowerCase().includes(q.toLowerCase()):match(x))&&(statusFilter==="ALL"||String(x.status||"").toUpperCase()===statusFilter));
  const totalPages=Math.max(1,Math.ceil(records.length/pageSize));const currentPage=Math.min(page,totalPages);const visible=records.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const changeTab=x=>{setTab(x);setPage(1);setStatusFilter("ALL");};
  return (
    <main className="wrap mentor-ops">
      <div className="intern-head">
        <div>
          <h1>Intern operations</h1>
          <p className="muted">
            Attendance, leave, daily reporting and assigned-project milestones
            for your groups.
          </p>
        </div>
      </div>
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="ops-summary">{[["Attendance",(d.attendance||[]).length],["Exceptions",exceptions.length],["Leave",(d.leave||[]).length],["Daily reports",(d.dailyReports||[]).length],["Milestones",(d.milestones||[]).length]].map(([name,count])=><div key={name}><span>{name}</span><strong>{count}</strong></div>)}</div>
      <div className="tab-row" role="tablist" aria-label="Intern operations sections">
        {["attendance", "exceptions", "leave", "reports", "milestones"].map((x) => (
          <button
            className={"btn " + (tab === x ? "" : "secondary")}
            type="button" role="tab" aria-selected={tab===x} onClick={() => changeTab(x)}
            key={x}
          >
            {x[0].toUpperCase() + x.slice(1)}
          </button>
        ))}
      </div>
      <div className="ops-toolbar"><label>Search records<input className="input" type="search" placeholder="Search intern, project or group" value={q} onChange={(e)=>{setQ(e.target.value);setPage(1);}}/></label>{tab!=="milestones"&&<label>Status<select className="input" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1);}}><option value="ALL">All statuses</option>{[...new Set(sources[tab].map(x=>String(x.status||"").toUpperCase()).filter(Boolean))].sort().map(x=><option value={x} key={x}>{x.replaceAll("_"," ")}</option>)}</select></label>}</div>
      {tab === "attendance" && (
        <section className="card ops-list">
          <h2>Attendance</h2>
          {visible.map((x) => (
            <div className="workflow-row" key={x.id}>
              <div>
                <b>{x.full_name}</b>
                <small>
                  {x.group_name} · {String(x.day).slice(0, 10)}
                </small>
              </div>
              <span className="status-pill">{x.status}</span>
              <span aria-label={`Recorded working duration: ${x.working_minutes || 0} minutes`} style={{fontWeight:600,whiteSpace:"nowrap"}}>Worked: {Math.floor((Number(x.working_minutes)||0)/60)>0?`${Math.floor((Number(x.working_minutes)||0)/60)} hr `:""}{(Number(x.working_minutes)||0)%60} min</span>
            </div>
          ))}
        </section>
      )}
      {tab === "exceptions" && (
        <section className="card ops-list">
          <h2>Attendance Corrections</h2>
          {visible.map((x) => (
            <div className="workflow-row" key={x.id}>
              <div>
                <b>{x.full_name}</b>
                <small>{x.group_name} · {String(x.day).slice(0, 10)} · {x.kind === "FAILED_MATCH" ? "Failed face match" : "Correction request"}</small>
                <p>{x.reason}</p>
                {x.decision_reason && <p className="muted">Decision: {x.decision_reason}</p>}
              </div>
              <span className="status-pill">{x.status}</span>
              {["DETECTED", "REQUESTED"].includes(x.status) && decisionControls("attendance-exceptions", x)}
            </div>
          ))}
          
        </section>
      )}
      {tab === "leave" && (
        <section className="card ops-list">
          <h2>Leave Requests</h2>
          {visible.map((x) => (
            <div className="workflow-row" key={x.id}>
              <div>
                <b>{x.full_name}</b>
                <small>
                  {x.group_name} · {String(x.from_date).slice(0, 10)} to{" "}
                  {String(x.to_date).slice(0, 10)}
                </small>
                <p>{x.reason}</p>
              </div>
              <span className="status-pill">{x.status}</span>
              {x.status === "REQUESTED" && decisionControls("leave-requests", x)}
            </div>
          ))}
        </section>
      )}
      {tab === "reports" && (
        <section className="card ops-list">
          <h2>Daily Reports</h2>
          {visible.map((x) => (
            <article className="daily-review-card" key={x.id}>
              <div>
                <b>{x.full_name}</b>
                <small>
                  {x.group_name} · {String(x.day).slice(0, 10)}
                </small>
              </div>
              <p>
                <b>Plan:</b> {x.planned_tasks || "—"}
              </p>
              <p>
                <b>Completed:</b> {x.completed_tasks || "—"}
              </p>
              <p>
                <b>Blockers:</b> {x.pending_blockers || "None"}
              </p>
              {(x.proof_links || []).map((u) => (
                <a href={u} target="_blank" rel="noreferrer" key={u}>
                  {u}
                </a>
              ))}
            </article>
          ))}
        </section>
      )}
      {tab === "milestones" && (
        <section className="card ops-list">
          <h2>Project Milestones</h2>
          {visible.map((x) => (
            <article className="daily-review-card" key={x.group_id}>
              <b>
                {x.group_name} · {x.title || "Project not assigned"}
              </b>
              {Array.isArray(x.milestones) && x.milestones.length ? (
                x.milestones.map((m, i) => (
                  <div className="status-row" key={i}>
                    <span>
                      {typeof m === "string"
                        ? m
                        : m.title || m.name || "Milestone " + (i + 1)}
                    </span>
                    <b>
                      {typeof m === "object"
                        ? m.status || "Planned"
                        : "Planned"}
                    </b>
                  </div>
                ))
              ) : (
                <p className="muted">No milestones configured.</p>
              )}
            </article>
          ))}
        </section>
      )}
      {!records.length&&<div className="ops-empty">{q||statusFilter!=="ALL"?"No records match your filters.":"No records available in this section."}</div>}
      {records.length>0&&<nav className="ops-pagination" aria-label="Operations pagination"><span>Showing {(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,records.length)} of {records.length}</span><div><label>Rows per page <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label><button type="button" className="btn secondary" disabled={currentPage===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button><span>Page {currentPage} of {totalPages}</span><button type="button" className="btn secondary" disabled={currentPage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button></div></nav>}
      <style jsx global>{` .mentor-ops{max-width:1160px;margin:0 auto;padding:28px 20px 60px;color:#111}.mentor-ops .intern-head h1{font-size:clamp(26px,3vw,34px);margin:0 0 8px}.mentor-ops .intern-head p{line-height:1.6;font-size:14px}.mentor-ops .ops-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:22px 0}.mentor-ops .ops-summary>div{display:flex;flex-direction:column;gap:9px;background:#fff;border:1px solid #dce7e1;border-radius:15px;padding:16px;min-width:0}.mentor-ops .ops-summary span{color:#475569;font-size:12px}.mentor-ops .ops-summary strong{font-size:24px}.mentor-ops .tab-row{display:flex;flex-wrap:wrap;gap:9px;background:#f0f5f3;border-radius:16px;padding:9px;margin:18px 0}.mentor-ops .btn{border-radius:999px!important;min-height:40px}.mentor-ops .tab-row .btn:not(.secondary),.mentor-ops .action-row .btn:not(.danger):not(.secondary){background:linear-gradient(110deg,#8b45ff,#5c8dfb);border:0;color:#fff}.mentor-ops .btn:hover:not(:disabled){color:#fff}.mentor-ops .ops-toolbar{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin:18px 0}.mentor-ops .ops-toolbar label{display:flex;flex-direction:column;gap:7px;font-weight:650;font-size:13px}.mentor-ops .input{width:100%;min-height:44px;border:1.5px solid #79a6f9;border-radius:10px;background:#fff;color:#111;padding:10px 12px;box-sizing:border-box}.mentor-ops .input:focus{outline:0;border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe}.mentor-ops .ops-list{border:1px solid #dce7e1;border-radius:18px;padding:22px}.mentor-ops .ops-list h2{font-size:21px;margin:0 0 16px}.mentor-ops .workflow-row,.mentor-ops .daily-review-card{border:1px solid #e2e8f0;border-radius:13px;padding:17px;margin:10px 0;display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;background:#fff}.mentor-ops .workflow-row>div:first-child{flex:1 1 240px;min-width:0}.mentor-ops .workflow-row small,.mentor-ops .daily-review-card small{display:block;color:#64748b;margin:6px 0;font-size:12px}.mentor-ops .workflow-row p,.mentor-ops .daily-review-card p{line-height:1.5;overflow-wrap:anywhere}.mentor-ops .status-pill{border-radius:999px;padding:7px 12px;background:#eaf3ed;color:#075e46;font-size:12px;font-weight:700;white-space:nowrap}.mentor-ops .action-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;width:100%}.mentor-ops .action-row .input{flex:1 1 190px}.mentor-ops .ops-pagination{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin:20px 0;font-size:13px}.mentor-ops .ops-pagination>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.mentor-ops .ops-pagination label{display:flex;align-items:center;gap:7px}.mentor-ops .ops-pagination select{border:1px solid #cbd5e1;border-radius:9px;padding:9px;background:#fff;color:#111}.mentor-ops .ops-empty{border:1px dashed #cbd5e1;border-radius:14px;text-align:center;padding:28px;color:#475569;margin:16px 0}@media(max-width:720px){.mentor-ops{padding:18px 14px 48px}.mentor-ops .ops-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.mentor-ops .ops-summary>div{padding:12px}.mentor-ops .ops-toolbar{grid-template-columns:1fr}.mentor-ops .ops-list{padding:14px}.mentor-ops .ops-pagination{flex-direction:column;align-items:flex-start}.mentor-ops .tab-row{gap:6px}} `}</style>
    </main>
  );
}

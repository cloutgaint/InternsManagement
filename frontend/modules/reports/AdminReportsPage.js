"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
import OperationsReport from "./OperationsReport";
export default function AdminReportsPage() {
  const [rows, setRows] = useState([]),
    [q, setQ] = useState(""),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [status,setStatus]=useState("ALL"),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(10),[emailTarget,setEmailTarget]=useState(null),[emailAddress,setEmailAddress]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const load = () => {setLoading(true);return api("/admin/reports").then(setRows).catch((e) => setErr(e.message)).finally(()=>setLoading(false));};
  useEffect(() => {
    load();
  }, []);
  const filtered = rows.filter((x) => (status==="ALL" || (x.completion_status||"PENDING")===status) &&
    (
      x.full_name +
      " " +
      (x.roll_number || "") +
      " " +
      (x.college_name || "") +
      " " +
      (x.batch_name || "")
    )
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  async function generate(x) {
    try {
      await api("/admin/reports/" + x.intern_id + "/completion", {
        method: "POST",
        body: "{}",
      });
      setMsg("College completion report generated for " + x.full_name + ".");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function dl(id, name) {
    try {
      const b = await apiBlob("/admin/reports/completion/" + id + "/file"),
        u = URL.createObjectURL(b),
        a = document.createElement("a");
      a.href = u;
      a.download = "Completion-Report-" + name + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch (e) {
      setErr(e.message);
    }
  }
  async function emailReport(x,email) {
    try {
      setBusy(true);
      const r = await api("/admin/reports/completion/" + x.completion_report_id + "/email", { method: "POST", body: JSON.stringify({ email: email.trim() || undefined }) });
      setMsg("Report emailed to " + r.to + ".");setEmailTarget(null);setEmailAddress("");
    } catch (e) {setErr(e.message);} finally {setBusy(false);}
  }
  async function pdf() {
    try {
      const u = URL.createObjectURL(await apiBlob("/admin/reports/export.pdf")), a = document.createElement("a");
      a.href = u;
      a.download = "GAINT-Intern-Report.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch (e) {
      setErr(e.message);
    }
  }
  async function csv() {
    try {
      const b = await apiBlob("/admin/reports/export.csv"),
        u = URL.createObjectURL(b),
        a = document.createElement("a");
      a.href = u;
      a.download = "GAINT-Intern-Report.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch (e) {
      setErr(e.message);
    }
  }
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,pages),shown=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const statuses=["ALL",...new Set(rows.map(x=>x.completion_status||"PENDING"))];
  return (
    <main className="wrap admin-reports-modern">
      <div className="intern-head"><div><h1>Reports & Exports</h1><p className="muted">Choose a section below to manage reports or download consolidated data.</p></div></div><nav className="reports-section-links" aria-label="Report sections"><a href="#completion-reports">Completion reports</a><a href="#operational-reports">Operational reports</a><a href="#report-exports">Exports</a></nav>
      {err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}
      
      <section id="completion-reports" className="card reports-workspace">
        <div className="reports-heading"><div><h2>College completion reports</h2><p className="muted">Generate approved reports, download PDFs and email coordinators.</p></div><span className="reports-count">{filtered.length} results</span></div>
        <div className="reports-filters"><label>Search interns<input className="input" type="search" placeholder="Name, roll number, college or batch" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/></label><label>Completion status<select className="input" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}>{statuses.map(v=><option key={v} value={v}>{v==="ALL"?"All statuses":v.replaceAll("_"," ")}</option>)}</select></label></div>
        {loading?<p role="status" className="reports-empty">Loading reports…</p>:shown.length?<div className="reports-table-scroll"><table className="reports-data-table"><thead><tr><th scope="col">Intern</th><th scope="col">College / batch</th><th scope="col">Attendance</th><th scope="col">Performance</th><th scope="col">Completion</th><th scope="col">Actions</th></tr></thead><tbody>{shown.map(x=><tr key={x.intern_id}><td><strong>{x.full_name}</strong><small>{x.roll_number||"—"} · {x.domain_name||"No domain"}</small></td><td>{x.college_name||"—"}<small>{x.batch_name||"No batch"}</small></td><td>{x.attendance_percent??"—"}{x.attendance_percent==null?"":"%"}</td><td>Task: {x.task_avg??"—"}<small>Review: {x.review_avg??"—"} · Final: {x.individual_marks??"—"}</small></td><td><span className="reports-status">{x.completion_status||"PENDING"}</span></td><td><div className="reports-actions">{x.completion_report_id?<><button className="btn secondary" onClick={()=>dl(x.completion_report_id,x.full_name)}>Download PDF</button><button className="btn secondary" onClick={()=>{setEmailTarget(x);setEmailAddress("");setErr("");}}>Email coordinator</button></>:<button className="btn" disabled={x.completion_status!=="APPROVED"} title={x.completion_status!=="APPROVED"?"Completion must be approved first":undefined} onClick={()=>generate(x)}>Generate report</button>}</div></td></tr>)}</tbody></table></div>:<div className="reports-empty"><strong>{rows.length?"No matching reports":"No reports available"}</strong><p>{rows.length?"Change the search or status filter.":"Internship reports will appear here when available."}</p></div>}
        {filtered.length>0&&<div className="reports-pagination"><span>Showing {(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,filtered.length)} of {filtered.length}</span><div><label>Rows per page <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[5,10,20,50].map(n=><option key={n} value={n}>{n}</option>)}</select></label><button className="btn secondary" disabled={currentPage===1} onClick={()=>setPage(v=>Math.max(1,v-1))}>Previous</button><span>{currentPage} / {pages}</span><button className="btn secondary" disabled={currentPage===pages} onClick={()=>setPage(v=>Math.min(pages,v+1))}>Next</button></div></div>}
      </section><section id="operational-reports" className="card reports-workspace"><h2>Operational reports</h2><p className="muted">Review internship operations and performance.</p><OperationsReport/></section><section id="report-exports" className="card reports-workspace"><h2>Consolidated exports</h2><p className="muted">Download internship reporting data in your preferred format.</p><div className="action-row"><button className="btn" onClick={csv}>Export CSV</button><button className="btn secondary" onClick={pdf}>Export PDF</button></div></section>
      {emailTarget&&<div className="reports-modal-overlay" onClick={()=>!busy&&setEmailTarget(null)}><div className="reports-modal card" role="dialog" aria-modal="true" aria-labelledby="reports-email-title" onClick={e=>e.stopPropagation()}><h2 id="reports-email-title">Email completion report</h2><p>Send the report for <strong>{emailTarget.full_name}</strong> to the college coordinator.</p><form onSubmit={e=>{e.preventDefault();emailReport(emailTarget,emailAddress);}}><label htmlFor="reports-email">Coordinator email (optional)</label><input id="reports-email" className="input" type="email" placeholder="Leave blank to use the coordinator on file" value={emailAddress} onChange={e=>setEmailAddress(e.target.value)}/><div className="action-row"><button className="btn secondary" type="button" disabled={busy} onClick={()=>setEmailTarget(null)}>Cancel</button><button className="btn" type="submit" disabled={busy}>{busy?"Sending…":"Send report"}</button></div></form></div></div>}
      <style jsx global>{` .admin-reports-modern .reports-workspace{margin:20px 0;scroll-margin-top:95px}.admin-reports-modern .reports-section-links{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0 24px}.admin-reports-modern .reports-section-links a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 18px;border-radius:999px;background:#edf0fb;color:#242a47;font-size:13px;font-weight:700;border:1px solid #dce2f7}.admin-reports-modern .reports-section-links a:hover{background:#e0e5fa;color:#111}.admin-reports-modern .reports-section-links a:focus-visible{outline:3px solid #6e5bf7;outline-offset:2px} 
      .admin-reports-modern{color:#111}.admin-reports-modern .intern-head{align-items:center;gap:16px}.admin-reports-modern h1{font-size:clamp(25px,3vw,32px)}.admin-reports-modern .reports-tabs{display:flex;gap:8px;padding:6px;border:1px solid #e0e8e3;background:#edf3ef;border-radius:18px;margin:20px 0}.admin-reports-modern .reports-tabs button{border:0;background:transparent;color:#111;min-height:44px;padding:10px 18px;border-radius:999px;font-weight:700;cursor:pointer}.admin-reports-modern .reports-tabs button.active{background:linear-gradient(135deg,#8848f8,#577cf8);color:#fff}.admin-reports-modern .reports-workspace{padding:24px;border-radius:20px}.admin-reports-modern .reports-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.admin-reports-modern h2{margin:0 0 6px;font-size:21px}.admin-reports-modern .reports-heading p{margin:0;font-size:13px}.admin-reports-modern .reports-count{background:#eef1fb;padding:8px 13px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}.admin-reports-modern .reports-filters{display:grid;grid-template-columns:minmax(0,2fr) minmax(180px,1fr);gap:14px;margin:20px 0}.admin-reports-modern .reports-filters label{display:flex;flex-direction:column;gap:5px;font-size:12px}.admin-reports-modern .input{min-height:44px;margin:0;border:1.5px solid #7ea7ef;border-radius:10px;color:#111}.admin-reports-modern .reports-table-scroll{overflow-x:auto;border:1px solid #e1e8e4;border-radius:14px}.admin-reports-modern .reports-data-table{width:100%;min-width:900px;border-collapse:collapse;text-align:left;font-size:13px}.admin-reports-modern .reports-data-table th{padding:13px 12px;background:#f7f9f8;color:#374151;font-size:12px}.admin-reports-modern .reports-data-table td{padding:14px 12px;border-top:1px solid #e8eeea;vertical-align:middle}.admin-reports-modern .reports-data-table small{display:block;margin-top:5px;color:#4b5563;font-size:12px}.admin-reports-modern .reports-actions{display:flex;flex-wrap:wrap;gap:7px}.admin-reports-modern .reports-actions .btn{white-space:nowrap}.admin-reports-modern .reports-status{display:inline-block;padding:6px 10px;border-radius:999px;background:#eef2f7;font-size:11px;font-weight:700}.admin-reports-modern .reports-pagination{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:18px;font-size:12px}.admin-reports-modern .reports-pagination>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.admin-reports-modern .reports-pagination label{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;min-width:max-content}.admin-reports-modern .reports-pagination select{min-height:40px;border-radius:999px;padding:8px;border:1px solid #b9c9c1;background:#fff;color:#111}.admin-reports-modern .reports-empty{padding:36px 16px;text-align:center;border:1px dashed #cbd5d1;border-radius:14px}.admin-reports-modern .reports-empty p{font-size:13px;color:#4b5563}.reports-modal-overlay{position:fixed;inset:0;background:#11182788;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}.reports-modal{width:min(100%,460px);padding:24px;border-radius:20px}.reports-modal h2{font-size:21px;margin:0 0 10px}.reports-modal p{font-size:13px;line-height:1.6}.reports-modal label{display:block;margin:14px 0 8px}.reports-modal .input{margin:0 0 18px;min-height:44px}.reports-modal .action-row{justify-content:flex-end}
      @media(max-width:720px){.admin-reports-modern .intern-head{flex-direction:column;align-items:flex-start}.admin-reports-modern .reports-filters{grid-template-columns:1fr}.admin-reports-modern .reports-workspace{padding:16px}.admin-reports-modern .reports-heading{flex-direction:column}.admin-reports-modern .reports-tabs button{flex:1;padding:10px 12px}}
      `}</style>
    </main>
  );
}

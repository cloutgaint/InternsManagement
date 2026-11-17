"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
const displayLabel = (value) => String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
export default function AdminAttendancePage() {
  const [faces, setFaces] = useState([]),
    [exceptions, setExceptions] = useState([]),
    [records, setRecords] = useState([]),
    [tab, setTab] = useState("faces"),
    [reason, setReason] = useState({}),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [feedbackArea,setFeedbackArea]=useState("face"),
    [images,setImages] = useState({}),
    [preview,setPreview] = useState(null);
  const [filters, setFilters] = useState({ batchId: "", status: "", from: "", to: "" }),
    [batches, setBatches] = useState([]);
  useEffect(() => {
    api("/admin/batches").then(setBatches).catch((e) => setErr(e.message));
  }, []);
  const load = () =>
    Promise.all([
      api("/admin/face-enrollments"),
      api("/admin/attendance-exceptions"),
      api("/admin/attendance-records?" + new URLSearchParams(Object.entries(filters).filter(([, v]) => v))),
    ])
      .then(([f, e, r]) => {
        setFaces(f);
        setExceptions(e);
        setRecords(r);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, [filters]);
  useEffect(()=>{let cancelled=false;const urls=[];Promise.all(faces.map(async x=>{try{const blob=await apiBlob("/admin/face-enrollments/"+x.id+"/image");const url=URL.createObjectURL(blob);urls.push(url);if(!cancelled)setImages(prev=>({...prev,[x.id]:url}));}catch{/* Missing enrollment images use the existing unavailable state. */}}));return()=>{cancelled=true;urls.forEach(url=>URL.revokeObjectURL(url));};},[faces]);
  async function face(x, status) {setFeedbackArea("face");
    try {
      await api("/admin/face-enrollments/" + x.id + "/decision", {
        method: "POST",
        body: JSON.stringify({ status, reason: reason[x.id] || "" }),
      });
      setMsg("Face enrollment " + status.toLowerCase() + ".");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function requireReenrollment(x) {setFeedbackArea("requireReenrollment");
    if (!String(reason[x.id] || "").trim()) return setErr("Enter a reason for re-enrollment.");
    try {
      setErr("");
      await api("/admin/face-enrollments/" + x.id + "/require-reenrollment", { method: "POST", body: JSON.stringify({ reason: reason[x.id] }) });
      setMsg("Re-enrollment authorised. The intern has been notified.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function deleteFace(x) {setFeedbackArea("deleteFace");
    if(!window.confirm("Remove this face registration? The student may need to register again. Attendance history will be preserved."))return;
    try{
      setErr("");await api("/admin/face-enrollments/"+x.id,{method:"DELETE"});
      setPreview(null);setImages(prev=>{const next={...prev};delete next[x.id];return next;});
      setMsg("Face registration removed.");await load();
    }catch(e){setErr(e.message);}
  }
  async function exception(x, status) {setFeedbackArea("exception");
    try {
      await api("/admin/attendance-exceptions/" + x.id + "/decision", {
        method: "POST",
        body: JSON.stringify({ status, reason: reason[x.id] || "" }),
      });
      setMsg("Attendance exception " + status.toLowerCase() + ".");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap attendance-admin-page">
      <div className="intern-head">
        <div>
          <h1>Face & Attendance Control</h1>
          <p className="muted">
            Approve face registrations, review camera attendance and resolve
            verification exceptions.
          </p>
        </div>
      </div>
      <div className="tab-row">
        <button
          className={tab === "faces" ? "btn" : "btn secondary"}
          onClick={() => setTab("faces")}
        >
          Face Approval (
          {faces.filter((x) => x.status === "PENDING_ADMIN_APPROVAL").length})
        </button>
        <button
          className={tab === "attendance" ? "btn" : "btn secondary"}
          onClick={() => setTab("attendance")}
        >
          Attendance
        </button>
        <button
          className={tab === "exceptions" ? "btn" : "btn secondary"}
          onClick={() => setTab("exceptions")}
        >
          Exceptions (
          {
            exceptions.filter((x) =>
              ["DETECTED", "REQUESTED"].includes(x.status),
            ).length
          }
          )
        </button>
      </div>
      {tab === "faces" && (
        <section className="card workflow-section">{["face","requireReenrollment","deleteFace"].includes(feedbackArea)&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
          {faces.map((x) => (
            <div className="face-admin-row attendance-face-row" key={x.id}>
              <div className="face-admin-image">{images[x.id]?<img src={images[x.id]} alt={"Face enrollment of "+x.full_name}/>:<div className="face-admin-photo-fallback" role="img" aria-label="Enrollment image unavailable">Photo unavailable</div>}<button type="button" className="btn secondary" disabled={!images[x.id]} onClick={()=>setPreview({name:x.full_name,url:images[x.id]})}>View Image</button></div>
              <div>
                <b>{x.full_name}</b>
                <p className="muted">
                  {x.roll_number || ""} · {x.batch_name || "No batch"} ·{" "}
                  {x.status}
                </p>
                {x.decision_reason && <p>{x.decision_reason}</p>}
              </div>
              <button type="button" className="btn danger attendance-delete-btn" onClick={()=>deleteFace(x)}>Delete Record</button>
              {x.status === "APPROVED" && (
                <div className="action-row attendance-face-action-row">
                  <input className="input" aria-label={"Re-enrollment reason for " + x.full_name} placeholder="Reason for re-enrollment" value={reason[x.id] || ""} onChange={(e) => setReason((r) => ({ ...r, [x.id]: e.target.value }))} />
                  <button type="button" className="btn warning" onClick={() => requireReenrollment(x)}>Require Re-enrollment</button>
                </div>
              )}
              {x.status === "PENDING_ADMIN_APPROVAL" && (
                <div className="face-admin-actions">
                  <input
                    className="input"
                    placeholder="Reason for reject/retake"
                    value={reason[x.id] || ""}
                    onChange={(e) =>
                      setReason((r) => ({ ...r, [x.id]: e.target.value }))
                    }
                  />
                  <div className="action-row">
                    <button className="btn" onClick={() => face(x, "APPROVED")}>
                      Approve
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => face(x, "REENROLLMENT_REQUIRED")}
                    >
                      Request Retake
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => face(x, "REJECTED")}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      {preview&&<div className="face-preview-backdrop" role="presentation" onClick={()=>setPreview(null)}><section className="face-preview-modal" role="dialog" aria-modal="true" aria-label={"Face enrollment image for "+preview.name} onClick={e=>e.stopPropagation()}><div className="face-preview-header"><h2>{preview.name} — Face Registration</h2><button type="button" className="btn secondary" onClick={()=>setPreview(null)}>Close</button></div><img src={preview.url} alt={"Face enrollment capture for "+preview.name}/></section></div>}
      {tab === "attendance" && (
        <section className="card form-grid attendance-filter-card">
          <div className="form-field"><label>Batch</label><select className="input" value={filters.batchId} onChange={(e) => setFilters((x) => ({ ...x, batchId: e.target.value }))}><option value="">All batches</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div className="form-field"><label>Status</label><select className="input" value={filters.status} onChange={(e) => setFilters((x) => ({ ...x, status: e.target.value }))}><option value="">All statuses</option>{["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "HOLIDAY"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
          <div className="form-field"><label>From</label><input className="input" type="date" value={filters.from} onChange={(e) => setFilters((x) => ({ ...x, from: e.target.value }))} /></div>
          <div className="form-field"><label>To</label><input className="input" type="date" value={filters.to} onChange={(e) => setFilters((x) => ({ ...x, to: e.target.value }))} /></div>
        </section>
      )}
      {tab === "attendance" && (
        <section className="card attendance-record-card">
          <div className="attendance-table">
            <b>Date</b>
            <b>Intern</b>
            <b>Check In</b>
            <b>Check Out</b>
            <b>Minutes</b>
            <b>Status</b>
            {records.map((x) => (
              <>
                <span>{String(x.day).slice(0, 10)}</span>
                <span>{x.full_name}</span>
                <span>
                  {x.check_in ? new Date(x.check_in).toLocaleTimeString() : "—"}
                </span>
                <span>
                  {x.check_out
                    ? new Date(x.check_out).toLocaleTimeString()
                    : "—"}
                </span>
                <span>{x.working_minutes || 0}</span>
                <span>{String(x.status).replace("_", " ")}{x.source === "MANUAL" ? " (corrected)" : ""}</span>
              </>
            ))}
          </div>
        </section>
      )}
      {tab === "exceptions" && (
        <section className="card attendance-exceptions-panel">
          <div className="attendance-exceptions-heading">
            <div><h2>Attendance exceptions</h2><p className="muted">Review face matching issues and attendance correction requests.</p></div>
            <span className="attendance-exceptions-count">{exceptions.length} records</span>
          </div>
          {feedbackArea === "exception" && <>{err && <p className="error" role="alert">{err}</p>}{msg && <p className="success" role="status">{msg}</p>}</>}
          {!exceptions.length && <div className="attendance-exceptions-empty">No attendance exceptions to display.</div>}
          <div className="attendance-exceptions-list">
            {exceptions.map((x) => (
              <article className="attendance-exception-card" key={x.id}>
                <div className="attendance-exception-top">
                  <div className="attendance-exception-identity">
                    <h3>{x.full_name}</h3>
                    <span className="attendance-exception-type">{displayLabel(x.kind)}</span>
                  </div>
                  <span className={"attendance-exception-status " + (x.status === "CLOSED" ? "is-closed" : x.status === "REJECTED" ? "is-rejected" : "is-pending")}>{displayLabel(x.status)}</span>
                </div>
                <div className="attendance-exception-date">{String(x.day || "").slice(0, 10)}</div>
                <p className="attendance-exception-reason">{x.reason || "No additional details provided."}</p>
                {(x.requested_value?.requestedStatus || x.decision_reason) && <div className="attendance-exception-details">
                  {x.requested_value?.requestedStatus && <div><span>Requested attendance</span><strong>{displayLabel(x.requested_value.requestedStatus)}</strong></div>}
                  {x.decision_reason && <div><span>Admin decision</span><strong>{x.decision_reason}</strong></div>}
                </div>}
                {["DETECTED", "REQUESTED"].includes(x.status) && <div className="attendance-exception-review">
                  <label htmlFor={"exception-reason-" + x.id}>Admin note</label>
                  <input id={"exception-reason-" + x.id} className="input" placeholder="Enter a reason for your decision" value={reason[x.id] || ""} onChange={(e) => setReason((r) => ({ ...r, [x.id]: e.target.value }))} />
                  <div className="attendance-exception-buttons">
                    <button type="button" className="btn" onClick={() => exception(x, "CLOSED")}>Resolve</button>
                    <button type="button" className="btn secondary" onClick={() => exception(x, "REJECTED")}>Reject request</button>
                  </div>
                </div>}
              </article>
            ))}
          </div>
        </section>
      )}
      <style jsx global>{`
        .attendance-admin-page{max-width:1200px;margin-inline:auto;padding-bottom:72px}
        .attendance-admin-page .intern-head{margin:26px 0 24px}
        .attendance-admin-page .intern-head h1{font-size:clamp(28px,3vw,36px);font-weight:650;letter-spacing:-.025em;margin-bottom:10px}
        .attendance-admin-page .intern-head .muted{font-size:16px;line-height:1.6}
        .attendance-admin-page .tab-row{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 20px}
        .attendance-admin-page .tab-row .btn{border-radius:999px;min-height:44px;padding:10px 20px;font-size:14px;font-weight:600}
        .attendance-admin-page .card{border:1px solid #dce8e1;border-radius:20px;padding:24px;margin-bottom:16px;box-shadow:0 6px 22px rgba(16,57,36,.04)}
        .attendance-admin-page .attendance-face-row{display:grid;grid-template-columns:110px minmax(190px,1fr) auto;align-items:center;gap:16px 22px;padding:18px 0;border-bottom:1px solid #e1ebe5}
        .attendance-admin-page .attendance-face-row:last-child{border-bottom:0}
        .attendance-admin-page .face-admin-image{display:flex;flex-direction:column;align-items:center;gap:9px}
        .attendance-admin-page .face-admin-image img{width:90px;height:90px;object-fit:cover;border-radius:16px;border:1px solid #d8e7de}
        .attendance-admin-page .face-admin-image .btn{font-size:13px;min-height:34px}
        .attendance-admin-page .attendance-face-row>div:nth-child(2) b{font-size:18px;font-weight:650}
        .attendance-admin-page .attendance-face-row>div:nth-child(2) .muted{font-size:14px;line-height:1.6}
        .attendance-admin-page .attendance-face-row .attendance-delete-btn{justify-self:end}
        .attendance-admin-page .attendance-face-action-row,.attendance-admin-page .attendance-face-row>.face-admin-actions{grid-column:2 / -1;display:flex;align-items:center;gap:12px;flex-wrap:wrap;width:100%}
        .attendance-admin-page .attendance-face-action-row .input,.attendance-admin-page .face-admin-actions>.input{flex:1 1 240px;min-width:0}
        .attendance-admin-page .btn{border-radius:999px;min-height:42px;padding:10px 17px;font-size:14px;font-weight:600;white-space:normal}
        .attendance-admin-page .attendance-face-action-row .btn{min-width:190px}
        .attendance-admin-page .input{min-height:46px;border:1.5px solid #60a5fa;border-radius:10px;padding:10px 13px;font-size:15px}
        .attendance-admin-page .input:focus{outline:3px solid #dbeafe;outline-offset:1px;border-color:#2563eb}
        .attendance-admin-page .attendance-filter-card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
        .attendance-admin-page .attendance-filter-card .form-field{min-width:0;display:flex;flex-direction:column;gap:8px}
        .attendance-admin-page .attendance-filter-card label{font-size:14px;font-weight:600}
        .attendance-admin-page .attendance-record-card{overflow-x:auto}
        .attendance-admin-page .attendance-table{min-width:690px;column-gap:12px;row-gap:0;font-size:14px}
        .attendance-admin-page .attendance-table>b{font-size:14px;padding:13px 10px;background:#f1f7f3}
        .attendance-admin-page .attendance-table>span{padding:12px 10px;line-height:1.5;border-bottom:1px solid #e4eee8}
        .attendance-admin-page .attendance-exception-row{padding:20px 4px;border-bottom:1px solid #e1ebe5;display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
        .attendance-admin-page .attendance-exception-row:last-child{border-bottom:0}
        .attendance-admin-page .attendance-exception-row b{font-size:17px;font-weight:650}
        .attendance-admin-page .attendance-exception-row p{font-size:15px;line-height:1.6}
        .attendance-admin-page .attendance-exception-row .muted{font-size:14px}
        @media(max-width:700px){.attendance-admin-page .attendance-face-row{grid-template-columns:90px minmax(0,1fr)}.attendance-admin-page .attendance-face-row .attendance-delete-btn{grid-column:2;justify-self:start}.attendance-admin-page .attendance-face-action-row,.attendance-admin-page .attendance-face-row>.face-admin-actions{grid-column:1/-1}.attendance-admin-page .attendance-exception-row{flex-direction:column}.attendance-admin-page .attendance-filter-card{grid-template-columns:1fr}}

        .attendance-admin-page .attendance-exceptions-panel{padding:28px;background:#fff}
        .attendance-admin-page .attendance-exceptions-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:20px;border-bottom:1px solid #e4ece8}
        .attendance-admin-page .attendance-exceptions-heading h2{font-size:23px;font-weight:650;letter-spacing:-.02em;margin:0 0 7px}
        .attendance-admin-page .attendance-exceptions-heading p{font-size:15px;line-height:1.5;margin:0}
        .attendance-admin-page .attendance-exceptions-count{flex:none;padding:8px 13px;border-radius:999px;background:#edf5f0;color:#205a3d;font-size:13px;font-weight:600}
        .attendance-admin-page .attendance-exceptions-list{display:grid;gap:14px;padding-top:20px}
        .attendance-admin-page .attendance-exception-card{padding:22px 24px;border:1px solid #dce8e1;border-radius:16px;background:#fff;box-shadow:0 3px 12px rgba(16,57,36,.035)}
        .attendance-admin-page .attendance-exception-top{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}
        .attendance-admin-page .attendance-exception-identity{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .attendance-admin-page .attendance-exception-identity h3{font-size:18px;font-weight:650;letter-spacing:-.01em;margin:0}
        .attendance-admin-page .attendance-exception-type{font-size:13px;font-weight:600;padding:6px 11px;background:#eff6ff;color:#1d4ed8;border-radius:8px}
        .attendance-admin-page .attendance-exception-status{font-size:13px;font-weight:600;padding:7px 12px;border-radius:999px;background:#fef3c7;color:#92400e}
        .attendance-admin-page .attendance-exception-status.is-closed{background:#e7f5ec;color:#166534}
        .attendance-admin-page .attendance-exception-status.is-rejected{background:#fef0f0;color:#b42318}
        .attendance-admin-page .attendance-exception-date{font-size:14px;color:#667d70;margin-top:10px}
        .attendance-admin-page .attendance-exception-reason{font-size:15px;line-height:1.65;color:#2b4336;margin:16px 0}
        .attendance-admin-page .attendance-exception-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}
        .attendance-admin-page .attendance-exception-details>div{display:flex;flex-direction:column;gap:7px;padding:13px 15px;background:#f7faf8;border:1px solid #e8efe9;border-radius:10px;overflow-wrap:anywhere}
        .attendance-admin-page .attendance-exception-details span{font-size:13px;color:#667d70}
        .attendance-admin-page .attendance-exception-details strong{font-size:15px;font-weight:600}
        .attendance-admin-page .attendance-exception-review{border-top:1px solid #e4ece8;margin-top:20px;padding-top:18px;display:grid;gap:10px}
        .attendance-admin-page .attendance-exception-review label{font-size:14px;font-weight:600}
        .attendance-admin-page .attendance-exception-buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px}
        .attendance-admin-page .attendance-exceptions-empty{padding:36px 12px;text-align:center;color:#667d70;font-size:15px}
        @media(max-width:600px){.attendance-admin-page .attendance-exceptions-panel{padding:16px}.attendance-admin-page .attendance-exception-card{padding:17px}.attendance-admin-page .attendance-exception-details{grid-template-columns:1fr}.attendance-admin-page .attendance-exceptions-heading{flex-direction:column}}
      `}</style>
    </main>
  );
}

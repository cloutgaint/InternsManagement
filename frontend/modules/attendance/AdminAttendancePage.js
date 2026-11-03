"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
export default function AdminAttendancePage() {
  const [faces, setFaces] = useState([]),
    [exceptions, setExceptions] = useState([]),
    [records, setRecords] = useState([]),
    [tab, setTab] = useState("faces"),
    [reason, setReason] = useState({}),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [images,setImages] = useState({}),
    [preview,setPreview] = useState(null);
  const load = () =>
    Promise.all([
      api("/admin/face-enrollments"),
      api("/admin/attendance-exceptions"),
      api("/admin/attendance-records"),
    ])
      .then(([f, e, r]) => {
        setFaces(f);
        setExceptions(e);
        setRecords(r);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  useEffect(()=>{let cancelled=false;const urls=[];Promise.all(faces.map(async x=>{try{const blob=await apiBlob("/admin/face-enrollments/"+x.id+"/image");const url=URL.createObjectURL(blob);urls.push(url);if(!cancelled)setImages(prev=>({...prev,[x.id]:url}));}catch{}}));return()=>{cancelled=true;urls.forEach(url=>URL.revokeObjectURL(url));};},[faces]);
  async function face(x, status) {
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
  async function exception(x, status) {
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
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Face & Attendance Control</h1>
          <p className="muted">
            Approve face registrations, review camera attendance and resolve
            verification exceptions.
          </p>
        </div>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
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
        <section className="card workflow-section">
          {faces.map((x) => (
            <div className="face-admin-row" key={x.id}>
              <div className="face-admin-image">{images[x.id]?<img src={images[x.id]} alt={"Face enrollment of "+x.full_name}/>:<div className="face-admin-photo-fallback" role="img" aria-label="Enrollment image unavailable">Photo unavailable</div>}<button type="button" className="btn secondary" disabled={!images[x.id]} onClick={()=>setPreview({name:x.full_name,url:images[x.id]})}>View Image</button></div>
              <div>
                <b>{x.full_name}</b>
                <p className="muted">
                  {x.roll_number || ""} · {x.batch_name || "No batch"} ·{" "}
                  {x.status}
                </p>
                {x.decision_reason && <p>{x.decision_reason}</p>}
              </div>
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
                      onClick={() => face(x, "RETAKE_REQUIRED")}
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
        <section className="card">
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
                <span>{x.status}</span>
              </>
            ))}
          </div>
        </section>
      )}
      {tab === "exceptions" && (
        <section className="card workflow-section">
          {exceptions.map((x) => (
            <div className="workflow-row" key={x.id}>
              <div>
                <b>
                  {x.full_name} · {x.kind}
                </b>
                <div className="muted">
                  {String(x.day || "").slice(0, 10)} · {x.status}
                </div>
                <p>{x.reason}</p>
              </div>
              {["DETECTED", "REQUESTED"].includes(x.status) && (
                <div className="face-admin-actions">
                  <input
                    className="input"
                    placeholder="Admin decision reason"
                    value={reason[x.id] || ""}
                    onChange={(e) =>
                      setReason((r) => ({ ...r, [x.id]: e.target.value }))
                    }
                  />
                  <div className="action-row">
                    <button
                      className="btn"
                      onClick={() => exception(x, "CLOSED")}
                    >
                      Resolve
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => exception(x, "REJECTED")}
                    >
                      Reject Request
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/shared/api/client";
import BatchAllotmentOrders from "./BatchAllotmentOrders";
import BatchSettings from "./BatchSettings";
export default function AdminBatchesPage() {
  const [interns, setInterns] = useState([]),
    [batches, setBatches] = useState([]),
    [allocations, setAllocations] = useState([]),
    [colleges, setColleges] = useState([]),
    [form, setForm] = useState({
      collegeId: "",
      name: "",
      code: "",
      semester: "SEM1",
      startDate: "",
      endDate: "",
      mode: "ONSITE",
    }),
    [pick, setPick] = useState(null),
    [early, setEarly] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [feedbackArea,setFeedbackArea]=useState("batch"),
    [busy, setBusy] = useState(false);
  const load = () =>
    Promise.all([
      api("/admin/interns"),
      api("/admin/batches"),
      api("/admin/allocations"),
      api("/admin/colleges"),
    ])
      .then(([i, b, a, c]) => {
        setInterns(i);
        setBatches(b);
        setAllocations(a);
        setColleges(c.filter((x) => x.active));
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function createBatch(e) {
    e.preventDefault();setFeedbackArea("batch");setMsg("");
    setErr("");
    if (new Date(form.endDate) < new Date(form.startDate))
      return setErr("Batch end date cannot be before start date.");
    try {
      setBusy(true);
      await api("/admin/batches", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMsg("Batch created. You can now allot verified interns.");
      setForm({
        collegeId: "",
        name: "",
        code: "",
        semester: "SEM1",
        startDate: "",
        endDate: "",
        mode: "ONSITE",
      });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  function startAllocation(i) {setErr("");setMsg("");setFeedbackArea("allotment");
    const available = batches.filter(
      (b) => !b.college_id || b.college_id === i.college_id,
    );
    setPick({
      intern: i,
      batchId: available[0]?.id || "",
      internStart: available[0]?.start_date?.slice(0, 10) || "",
      internEnd: available[0]?.end_date?.slice(0, 10) || "",
      overrideReason: "",
    });
  }
  function chooseBatch(id) {
    const b = batches.find((x) => x.id === id);
    setPick((x) => ({
      ...x,
      batchId: id,
      internStart: b?.start_date?.slice(0, 10) || "",
      internEnd: b?.end_date?.slice(0, 10) || "",
      overrideReason: "",
    }));
  }
  async function submitEarlyEnd(e) {
    e.preventDefault();setFeedbackArea("early");setErr("");setMsg("");
    try{
      setBusy(true);
      await api("/admin/allocations/"+early.id+"/early-end",{method:"POST",body:JSON.stringify({endDate:early.endDate,reason:early.reason})});
      setMsg("Early end date recorded. Complete the final evaluation and approval workflow separately.");
      setEarly(null);await load();
    }catch(e){setErr(e.message);}finally{setBusy(false);}
  }
  async function allocate(e) {
    e.preventDefault();setFeedbackArea("allotment");
    setErr("");
    const b = batches.find((x) => x.id === pick.batchId);
    if (!b) return setErr("Select a batch.");
    try {
      setBusy(true);
      await api("/admin/allocate", {
        method: "POST",
        body: JSON.stringify({
          batchId: pick.batchId,
          internId: pick.intern.id,
          internStart: pick.internStart,
          internEnd: pick.internEnd,
          overrideReason: pick.overrideReason,
        }),
      });
      setMsg("Internship duration verified and allotted successfully.");
      setPick(null);
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Batch & Internship Duration</h1>
          <p className="muted">
            Create Admin-controlled batches, set individual internship dates and
            verify them against the student's college-approved period.
          </p>
        </div>
        <span className="badge">{allocations.length} allocations</span>
      </div>

      <BatchAllotmentOrders batches={batches} />
      <section className="card">
        <h2>Create Batch</h2>
        {feedbackArea==="batch"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        <form className="form-grid" onSubmit={createBatch}>
          <div className="form-field">
            <label>College</label>
            <select
              className="input"
              value={form.collegeId}
              onChange={(e) =>
                setForm((x) => ({ ...x, collegeId: e.target.value }))
              }
              required
            >
              <option value="">Select college</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field"><label>Semester</label><select className="input" value={form.semester} onChange={e=>setForm(x=>({...x,semester:e.target.value}))}>{Array.from({length:8},(_,i)=><option key={i+1} value={"SEM"+(i+1)}>Semester {i+1}</option>)}</select></div>
          <div className="form-field">
            <label>Batch Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))}
              placeholder="Example: KLU Batch-1"
              required
            />
          </div>
          <div className="form-field">
            <label>Batch Code</label>
            <input
              className="input"
              value={form.code}
              onChange={(e) =>
                setForm((x) => ({ ...x, code: e.target.value.toUpperCase() }))
              }
              required
            />
          </div>
          <div className="form-field">
            <label>Mode</label>
            <select
              className="input"
              value={form.mode}
              onChange={(e) => setForm((x) => ({ ...x, mode: e.target.value }))}
            >
              <option value="ONSITE">On-site</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>
          <div className="form-field">
            <label>Batch Start</label>
            <input
              className="input"
              type="date"
              value={form.startDate}
              onChange={(e) =>
                setForm((x) => ({ ...x, startDate: e.target.value }))
              }
              required
            />
          </div>
          <div className="form-field">
            <label>Batch End</label>
            <input
              className="input"
              type="date"
              min={form.startDate || undefined}
              value={form.endDate}
              onChange={(e) =>
                setForm((x) => ({ ...x, endDate: e.target.value }))
              }
              required
            />
          </div>
          <div className="form-actions">
            <button className="btn" disabled={busy}>
              Create Batch
            </button>
          </div>
        </form>
      </section>
      <section className="card workflow-section"><h2>Existing Semester Batches</h2>{batches.map(b=><div className="workflow-row" key={b.id}><div><b>{b.name}</b><p className="muted">{b.code} · {b.semester||"Semester not set"} · {String(b.start_date).slice(0,10)} to {String(b.end_date).slice(0,10)} · {b.status} · {b.mode}</p></div><BatchSettings batch={b} onSaved={load}/></div>)}</section>
      <section className="card workflow-section">
        <h2>Intern Allotment</h2>
        {feedbackArea==="allotment"&&!pick&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        {feedbackArea==="early"&&!early&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        <p className="muted">
          GAINT Admin controls internship dates. Batch dates are applied automatically. College-approved periods are checked by the backend.
        </p>
        {interns.map((i) => {
          const a = allocations.find((x) => x.intern_id === i.id);
          const eligible = i.is_active && i.account_status === "ACTIVE";
          return (
            <div className="workflow-row" key={i.id}>
              <div>
                <b>{i.full_name}</b>
                <div className="muted">
                  {i.college_name || "—"} · {i.roll_number || "—"}
                </div>
                {!eligible && (
                  <div className="muted">
                    Cannot be allotted until approved{i.proof_reason ? ". Admin note: " + i.proof_reason : "."}
                  </div>
                )}
                {a && (
                  <div className="allocation-summary">
                    {a.batch_name} · {String(a.intern_start).slice(0, 10)} →{" "}
                    {String(a.intern_end).slice(0, 10)}{" "}
                    <span
                      className={
                        "status-pill " +
                        (a.date_mismatch
                          ? "status-reupload_requested"
                          : "status-verified")
                      }
                    >
                      {a.date_mismatch ? "OVERRIDE" : "VERIFIED"}
                    </span>
                  </div>
                )}
              </div>
              <div className="action-row">{!eligible&&<><span className="status-pill status-reupload_requested">{i.proof_status==="REJECTED"?"PROOF REJECTED":"NOT APPROVED"}</span><Link className="btn secondary" href="/admin/verification">Open Student Verification</Link></>}{eligible&&<button className="btn secondary" onClick={()=>startAllocation(i)}>{a?"Review Allotment":"Allot Internship"}</button>}{eligible&&a&&<button className="btn secondary" onClick={()=>setEarly({id:a.id,name:i.full_name,startDate:String(a.intern_start).slice(0,10),currentEnd:String(a.intern_end).slice(0,10),endDate:String(a.intern_end).slice(0,10),reason:""})}>Early End</button>}</div>
            </div>
          );
        })}
      </section>
      {early&&<div className="modal-backdrop" onMouseDown={()=>setEarly(null)}><section className="modal-card" onMouseDown={e=>e.stopPropagation()}><h2>End Internship Early</h2>{feedbackArea==="early"&&err&&<p className="error" role="alert">{err}</p>}<p className="muted">{early.name} · Current end: {early.currentEnd}</p><p className="muted">This changes the scheduled end date only. It does not bypass final assessment, completion approval or certificate requirements.</p><form onSubmit={submitEarlyEnd}><div className="form-field"><label>Revised End Date</label><input className="input" type="date" required min={early.startDate} max={early.currentEnd} value={early.endDate} onChange={e=>setEarly(x=>({...x,endDate:e.target.value}))}/></div><div className="form-field"><label>Reason for Early End</label><textarea className="input" required minLength={10} value={early.reason} onChange={e=>setEarly(x=>({...x,reason:e.target.value}))}/></div><div className="form-actions action-row"><button type="button" className="btn secondary" onClick={()=>setEarly(null)}>Cancel</button><button className="btn" disabled={busy}>Save Early End</button></div></form></section></div>}
      {pick && (
        <div className="modal-backdrop" onMouseDown={() => setPick(null)}>
          <section
            className="modal-card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="verification-title">
              <div>
                <h2>Internship Allotment</h2>
                {feedbackArea==="allotment"&&err&&<p className="error" role="alert">{err}</p>}
                <p className="muted">
                  {pick.intern.full_name} · {pick.intern.college_name}
                </p>
              </div>
              <button className="icon-close" onClick={() => setPick(null)}>
                ×
              </button>
            </div>
            <form onSubmit={allocate}>
              <div className="form-field">
                <label>Batch</label>
                <select
                  className="input"
                  value={pick.batchId}
                  onChange={(e) => chooseBatch(e.target.value)}
                  required
                >
                  <option value="">Select batch</option>
                  {batches
                    .filter(
                      (b) =>
                        !b.college_id ||
                        b.college_id === pick.intern.college_id,
                    )
                    .map((b) => (
                      <option value={b.id} key={b.id}>
                        {b.name} ({String(b.start_date).slice(0, 10)} to{" "}
                        {String(b.end_date).slice(0, 10)})
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label>Internship Start</label>
                  <input
                    className="input"
                    type="date"
                    value={pick.internStart}
                    readOnly
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Internship End</label>
                  <input
                    className="input"
                    type="date"
                    min={pick.internStart}
                    value={pick.internEnd}
                    readOnly
                    required
                  />
                </div>
              </div>
              <div className="proof-alert">
                <b>Verification rule</b>
                <span>
                  Internship dates are set by GAINT Admin when creating the batch. Students cannot edit them. If the college permission period differs, Super Admin must provide an audited override.
                </span>
              </div>
              <div className="form-field">
                <label>Override Reason (only when required)</label>
                <textarea
                  className="input"
                  value={pick.overrideReason}
                  onChange={(e) =>
                    setPick((x) => ({ ...x, overrideReason: e.target.value }))
                  }
                  placeholder="Explain why this allotment is being approved outside the college-approved period."
                />
              </div>
              <div className="form-actions action-row">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setPick(null)}
                >
                  Cancel
                </button>
                <button className="btn" disabled={busy}>
                  {busy ? "Verifying…" : "Verify & Allot"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

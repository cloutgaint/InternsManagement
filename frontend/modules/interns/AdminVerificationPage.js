"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
const ITEMS = [
  ["nameMatch", "Student name matches proof"],
  ["rollMatch", "Roll / registration number matches"],
  ["collegeMatch", "College / university matches"],
  ["datesValid", "Approved internship dates are valid"],
  ["signatureSeal", "College signature / seal is present"],
  ["referenceMatch", "Reference number matches the document"],
  ["duplicateChecked", "Duplicate reference / document check completed"],
];
export default function AdminVerificationPage() {
  const [rows, setRows] = useState([]),
    [selected, setSelected] = useState(null),
    [checks, setChecks] = useState({}),
    [reason, setReason] = useState(""),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [role, setRole] = useState(""),
    [query,setQuery]=useState(""),
    [statusFilter,setStatusFilter]=useState("ALL");
  useEffect(() => {
    setRole(sessionStorage.getItem("role") || "");
  }, []);
  async function removeStudent(p) {
    if (!window.confirm(`Remove student "${p.full_name}" (${p.email}) from active records? The student will lose login access. Historical records will be retained.`)) return;
    setBusy(true);setErr("");setMsg("");
    try {
      await api("/admin/interns/" + p.user_id, {method:"DELETE"});
      setSelected(null);
      setMsg("Student removed from active records and login disabled.");
      await load();
    } catch(e) {setErr(e.message);} finally {setBusy(false);}
  }
  const load = () =>
    api("/admin/proofs")
      .then((x) => {
        setRows(x.filter((p)=>p.account_status!=="DELETED"));
        if (selected) {
          const n = x.find((y) => y.id === selected.id);
          if (n) setSelected(n);
        }
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  function open(p) {
    setSelected(p);
    setChecks(p.last_checklist || {});
    setReason(p.last_verification_reason || "");
    setErr("");
    setMsg("");
  }
  async function view(id, index = 0) {
    try {
      const b = await apiBlob("/admin/proofs/" + id + "/file?index=" + index);
      const u = URL.createObjectURL(b);
      window.open(u, "_blank");
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (e) {
      setErr(e.message);
    }
  }
  async function decision(outcome) {
    if (!selected) return;
    setErr("");
    setMsg("");
    if (outcome === "VERIFIED" && ITEMS.some(([k]) => checks[k] !== true))
      return setErr(
        "Complete every checklist item before verifying the proof.",
      );
    if (outcome !== "VERIFIED" && !reason.trim())
      return setErr(
        "Enter a reason before requesting re-upload or rejecting the proof.",
      );
    try {
      setBusy(true);
      await api("/admin/proofs/" + selected.id + "/verify", {
        method: "POST",
        body: JSON.stringify({
          outcome,
          reason: reason.trim(),
          checklist: checks,
        }),
      });
      setMsg(
        outcome === "VERIFIED"
          ? "Proof verified. Student is now waiting for account approval."
          : outcome === "REUPLOAD_REQUESTED"
            ? "Re-upload requested with reason recorded."
            : "Proof rejected with reason recorded.",
      );
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function accountDecision(p, route, done) {
    if (!reason.trim()) return setErr("Enter a reason in the Admin Note first.");
    try {
      setBusy(true);
      setErr("");
      await api("/admin/interns/" + p.user_id + "/" + route, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) });
      setMsg(done);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function override(p) {
    if (!reason.trim()) return setErr("Enter the override reason in the Admin Note first.");
    const dueDate = prompt("Optional: date the student must submit the proof by (YYYY-MM-DD). Leave blank for none.") || undefined;
    try {
      setBusy(true);
      setErr("");
      await api("/admin/interns/" + p.user_id + "/approve", { method: "POST", body: JSON.stringify({ overrideReason: reason.trim(), dueDate }) });
      setMsg("Override recorded in the audit trail and account activated.");
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function approve(p) {
    try {
      setBusy(true);
      await api("/admin/interns/" + p.user_id + "/approve", {
        method: "POST",
        body: "{}",
      });
      setMsg(p.full_name + " account activated successfully.");
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const pending = rows.filter(
      (x) => !["VERIFIED", "REJECTED"].includes(x.status),
    ),
    done = rows.filter((x) => ["VERIFIED", "REJECTED"].includes(x.status));
  const filteredRows=rows.filter(p=>(statusFilter==="ALL"||(statusFilter==="PENDING"?!["VERIFIED","REJECTED"].includes(p.status):p.status===statusFilter))&&[p.full_name,p.college_name,p.roll_number,p.email].some(v=>String(v||"").toLowerCase().includes(query.trim().toLowerCase())));
  return (
    <main className="wrap verification-page">
      <div className="intern-head verification-page-head">
        <div>
          <h1>College Proof Verification</h1>
          <p className="muted">
            Verify eligibility against the GAINT verification checklist before
            activating an intern.
          </p>
        </div>
        <span className="badge verification-pending-badge">{pending.length} pending</span>
      </div>
      <div className="verification-layout">
        <section className="card verification-queue">
          <div className="verification-queue-heading"><div><h2>Verification Queue</h2><p className="muted">{filteredRows.length} of {rows.length} applications</p></div><span className="verification-queue-count">{pending.length} awaiting review</span></div>
          <div className="verification-filters"><label className="verification-search"><span className="sr-only">Search applications</span><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search student, college or roll no." /></label><select aria-label="Filter verification status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option><option value="REUPLOAD_REQUESTED">Re-upload requested</option></select></div>{!selected&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
          {!filteredRows.length ? (
            <p className="muted verification-no-results">{rows.length?"No applications match your filters.":"No proof submissions found."}</p>
          ) : (
            filteredRows.map((p) => (
              <button
                type="button"
                className={
                  "proof-row " + (selected?.id === p.id ? "active" : "")
                }
                key={p.id}
                onClick={() => open(p)}
              >
                <span>
                  <b>{p.full_name}</b>
                  <small>
                    {p.college_name || "College not set"} · {p.roll_number}
                  </small>
                </span>
                <span
                  className={
                    "status-pill status-" + String(p.status).toLowerCase()
                  }
                >
                  {p.status.replaceAll("_", " ")}
                </span>
              </button>
            ))
          )}
        </section>
        <section className="card verification-detail">
          {!selected ? (
            <div className="empty-state">
              <h2>Select an application</h2>
              <p className="muted">
                Choose a student from the queue to review proof details and
                complete verification.
              </p>
            </div>
          ) : (
            <>
              <div className="verification-title">
                <div>
                  <h2>{selected.full_name}</h2><>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>
                  <p className="muted">
                    {selected.email} · {selected.mobile || "No mobile"}
                  </p>
                </div>
                <button type="button" className="btn danger verification-delete-student" disabled={busy} onClick={() => removeStudent(selected)}>Delete Student</button>
                {(Array.isArray(selected.file_names) && selected.file_names.length > 1 ? selected.file_names : [null]).map((name, i) => (
                  <button
                    key={i}
                    className="btn secondary"
                    onClick={() => view(selected.id, i)}
                  >
                    {name ? "View " + name : "View Uploaded Proof"}
                  </button>
                ))}
              </div>
              <div className="detail-grid proof-meta">
                <div>
                  <b>College</b>
                  <span>{selected.college_name || "—"}</span>
                </div>
                <div>
                  <b>Account Status</b>
                  <span>{String(selected.account_status || "—").replaceAll("_", " ")}{selected.account_status_reason ? " · " + selected.account_status_reason : ""}</span>
                </div>
                <div>
                  <b>University</b>
                  <span>{selected.university || "—"}</span>
                </div>
                <div>
                  <b>Program / Branch</b>
                  <span>
                    {selected.program || "—"} / {selected.branch || "—"}
                  </span>
                </div>
                <div>
                  <b>Roll Number</b>
                  <span>{selected.roll_number || "—"}</span>
                </div>
                <div>
                  <b>Proof Type</b>
                  <span>{selected.proof_type}{selected.batch_order_id ? " (covers this student)" : ""} · Version {selected.version}</span>
                </div>
                <div>
                  <b>Reference Number</b>
                  <span>{selected.reference_number}</span>
                </div>
                <div>
                  <b>Issuing Authority</b>
                  <span>{selected.issuing_authority}</span>
                </div>
                <div>
                  <b>Issue Date</b>
                  <span>{String(selected.issue_date || "").slice(0, 10)}</span>
                </div>
                <div>
                  <b>Approved Period</b>
                  <span>
                    {String(selected.approved_from || "").slice(0, 10)} to{" "}
                    {String(selected.approved_to || "").slice(0, 10)}
                  </span>
                </div>
                <div>
                  <b>Coordinator</b>
                  <span>
                    {selected.coordinator_name || "—"} ·{" "}
                    {selected.coordinator_designation || "—"}
                  </span>
                </div>
              </div>
              {(selected.duplicate_reference ||
                selected.duplicate_file ||
                selected.date_mismatch) && (
                <div className="proof-alert">
                  <b>System checks need attention</b>
                  {selected.duplicate_reference && (
                    <span>Duplicate reference number detected.</span>
                  )}
                  {selected.duplicate_file && (
                    <span>Duplicate uploaded document detected.</span>
                  )}
                  {selected.date_mismatch && (
                    <span>
                      College-approved dates do not cover the allocated
                      internship period.
                    </span>
                  )}
                </div>
              )}
              <div className="verification-checklist-heading"><h3>Verification Checklist</h3><span>{ITEMS.filter(([k])=>checks[k]===true).length} / {ITEMS.length} completed</span></div>
              <div className="checklist">
                {ITEMS.map(([k, label]) => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      checked={checks[k] === true}
                      onChange={(e) =>
                        setChecks((x) => ({ ...x, [k]: e.target.checked }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <div className="form-field">
                <label>Reason / Admin Note</label>
                <textarea
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Required for re-upload request or rejection. Be specific about what the student must correct."
                />
              </div>
              <div className="coordinator-box">
                <div>
                  <b>Faculty Coordinator</b>
                  <span>
                    {selected.coordinator_name || "—"} ·{" "}
                    {selected.coordinator_email || "—"} ·{" "}
                    {selected.coordinator_phone || "—"}
                  </span>
                </div>
                {selected.coordinator_email && (
                  <a
                    className="btn secondary"
                    href={
                      "mailto:" +
                      selected.coordinator_email +
                      "?subject=" +
                      encodeURIComponent(
                        "GAINT Internship Permission Verification - " +
                          selected.full_name,
                      )
                    }
                  >
                    Email Coordinator
                  </a>
                )}
              </div>
              <div className="action-row verification-actions">
                <button
                  className="btn"
                  disabled={busy || selected.status === "VERIFIED"}
                  onClick={() => decision("VERIFIED")}
                >
                  Verify Proof
                </button>
                <button
                  className="btn warning verification-action-reupload"
                  disabled={busy}
                  onClick={() => decision("REUPLOAD_REQUESTED")}
                >
                  Request Re-upload
                </button>
                <button
                  className="btn danger verification-action-reject"
                  disabled={busy}
                  onClick={() => decision("REJECTED")}
                >
                  Reject Proof
                </button>
                {["VERIFIED", "OVERRIDE"].includes(selected.status) && !selected.is_active && (
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => approve(selected)}
                  >
                    Approve Account
                  </button>
                )}
                {!selected.is_active && (
                  <>
                    <button className="btn secondary verification-action-correction" disabled={busy} onClick={() => accountDecision(selected, "request-correction", "Correction requested from the student.")}>
                      Request Correction
                    </button>
                    <button className="btn danger verification-action-reject" disabled={busy} onClick={() => accountDecision(selected, "reject", "Application rejected.")}>
                      Reject Application
                    </button>
                    {role === "SUPER_ADMIN" && !["VERIFIED", "OVERRIDE"].includes(selected.status) && (
                      <button className="btn warning verification-action-override" disabled={busy} onClick={() => override(selected)}>
                        Super Admin Override &amp; Approve
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      {done.length > 0 && (
        <p className="muted verification-foot">
          Completed decisions remain in the queue for audit/history. Every
          decision stores the checklist, reason, Admin identity and timestamp.
        </p>
      )}
      <style jsx global>{`
      .verification-page .btn{border-radius:999px!important;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 18px;min-height:41px;font-size:12px;font-weight:750}
      .verification-page .verification-layout{grid-template-columns:minmax(310px,.85fr) minmax(0,1.65fr)}
      .verification-page .verification-page-head{margin-bottom:24px}
      .verification-page .verification-queue{top:112px}
      @media(max-width:720px){.verification-page .verification-layout{grid-template-columns:1fr}}

.verification-page{max-width:1380px;padding:28px 28px 64px;color:#172e23}
.verification-page-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:24px}
.verification-page-head h1{font-size:clamp(26px,2.5vw,34px);letter-spacing:-.9px;margin:0 0 8px;font-weight:800}
.verification-page-head p{font-size:13px;line-height:1.6;max-width:680px}
.verification-pending-badge{background:#e5f5eb;color:#07643f;border:1px solid #c6e8d2;border-radius:999px;padding:9px 14px;white-space:nowrap;font-size:12px;font-weight:800}
.verification-page .verification-layout{display:grid;grid-template-columns:minmax(310px,.85fr) minmax(0,1.65fr);gap:18px;align-items:start}
.verification-page .verification-layout>.card{min-width:0;background:#fff;border:1px solid #dae8df;border-radius:18px;box-shadow:0 6px 24px #1c493010;padding:22px}
.verification-page .verification-queue{position:sticky;top:88px;max-height:calc(100vh - 108px);overflow-y:auto}
.verification-queue-heading{display:flex;align-items:start;justify-content:space-between;gap:10px;margin-bottom:18px}
.verification-queue-heading h2{font-size:18px;letter-spacing:-.4px;margin:0 0 5px}
.verification-queue-heading p{font-size:11px;margin:0}
.verification-queue-count{font-size:10px;font-weight:750;color:#0d754b;background:#e9f6ee;border-radius:999px;padding:7px 9px;white-space:nowrap}
.verification-filters{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;margin-bottom:16px}
.verification-search{display:flex;align-items:center;gap:9px;padding:0 12px;background:#f8fbf9;border:1px solid #d7e7dd;border-radius:10px;color:#6a8273;min-height:43px}
.verification-search:focus-within{border-color:#08754b;box-shadow:0 0 0 3px #0b85501a}
.verification-search input{border:0;outline:0;background:transparent;width:100%;min-width:0;font:inherit;font-size:12px;color:#1c3729}
.verification-filters select{width:100%;min-height:42px;border:1px solid #d7e7dd;border-radius:10px;background:#fff;color:#345344;padding:0 12px;font-size:12px}
.verification-page .proof-row{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-width:0;margin:0 0 9px;padding:14px;border:1px solid #e0eae3;border-radius:12px;background:#fff;text-align:left;transition:background .15s,border-color .15s,box-shadow .15s}
.verification-page .proof-row:hover{background:#f5faf7;border-color:#b4d9c3}
.verification-page .proof-row.active{background:#eaf7ef;border-color:#7ec8a0;box-shadow:inset 3px 0 #08734a}
.verification-page .proof-row>span:first-child{min-width:0;display:grid;gap:6px}
.verification-page .proof-row b{font-size:13px;overflow-wrap:anywhere}
.verification-page .proof-row small{font-size:11px;color:#6d8073;line-height:1.5}
.verification-page .status-pill{flex:none;font-size:10px;font-weight:800;max-width:140px;text-align:center;line-height:1.4}
.verification-no-results{padding:24px 12px;text-align:center;font-size:12px}
.verification-page .verification-detail{min-height:420px}
.verification-page .empty-state{display:flex;min-height:330px;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:28px;background:radial-gradient(circle at 50% 38%,#e9f6ee,transparent 52%);border-radius:14px}
.verification-page .empty-state h2{font-size:20px;margin:0 0 10px}
.verification-page .empty-state p{max-width:370px;font-size:13px;line-height:1.7}
.verification-page .verification-title{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding-bottom:20px;margin-bottom:20px;border-bottom:1px solid #e4ece6}
.verification-page .verification-title>div{flex:1 1 100%;min-width:0}
.verification-page .verification-title h2{font-size:23px;letter-spacing:-.6px;margin:0 0 6px}
.verification-page .verification-title .muted{font-size:12px;overflow-wrap:anywhere}
.verification-page .verification-title .btn{min-height:37px;padding:8px 12px;font-size:12px;border-radius:9px;max-width:100%;overflow-wrap:anywhere}
.verification-page .proof-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-bottom:24px}
.verification-page .proof-meta>div{min-width:0;display:flex;flex-direction:column;gap:7px;padding:13px 15px;background:#f7faf8;border:1px solid #e8efe9;border-radius:11px}
.verification-page .proof-meta b{font-size:10px;letter-spacing:.3px;color:#668071;text-transform:uppercase}
.verification-page .proof-meta span{font-size:12px;font-weight:650;color:#233c2d;line-height:1.5;overflow-wrap:anywhere}
.verification-page .verification-checklist-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:18px 0 12px}
.verification-page .verification-checklist-heading h3{margin:0;font-size:17px}
.verification-page .verification-checklist-heading span{color:#0b724b;background:#e8f5ec;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800}
.verification-page .checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:20px}
.verification-page .checklist label{display:flex;align-items:center;gap:10px;min-height:54px;padding:12px;background:#f9fbfa;border:1px solid #e0eae3;border-radius:10px;font-size:12px;line-height:1.5;cursor:pointer}
.verification-page .checklist label:has(input:checked){background:#edf8f1;border-color:#a8dabb}
.verification-page .checklist input{accent-color:#086b45;width:17px;height:17px;flex:none}
.verification-page .form-field textarea{min-height:92px;border-radius:10px;background:#fafcfb;border:1px solid #d5e4da}
.verification-page .coordinator-box{border:1px solid #d9e9de;background:#f3faf5;border-radius:12px;padding:15px;margin:20px 0}
.verification-page .verification-actions{display:flex;flex-wrap:wrap;gap:9px;padding-top:18px;border-top:1px solid #e5eee7}
.verification-page .verification-actions .btn{min-height:39px;padding:9px 13px;border-radius:9px;font-size:12px;font-weight:750}
.verification-page .verification-foot{font-size:11px;margin-top:16px;line-height:1.6}
@media(max-width:1000px){.verification-page{padding:22px 18px 45px}.verification-page .verification-layout{grid-template-columns:minmax(280px,.85fr) minmax(0,1.3fr);gap:12px}.verification-page .verification-layout>.card{padding:17px}.verification-page .proof-meta,.verification-page .checklist{grid-template-columns:1fr}}
@media(max-width:720px){.verification-page{padding:18px 12px 36px}.verification-page-head{align-items:flex-start}.verification-page .verification-layout{grid-template-columns:minmax(0,1fr)}.verification-page .verification-queue{position:static;max-height:400px}.verification-page .proof-meta{grid-template-columns:repeat(2,minmax(0,1fr))}.verification-page .checklist{grid-template-columns:1fr}}
@media(max-width:440px){.verification-page-head{flex-direction:column}.verification-page .proof-meta{grid-template-columns:1fr}.verification-page .verification-title .btn{width:100%}.verification-queue-heading{flex-wrap:wrap}}
/* Readability pass: consistent 14–16px body text and clear status hierarchy. */
.verification-page-head p{font-size:15px;line-height:1.65}
.verification-pending-badge{font-size:13px;padding:10px 16px}
.verification-queue-heading h2{font-size:21px}
.verification-queue-heading p{font-size:14px}
.verification-queue-count{font-size:12px;padding:8px 12px}
.verification-search{min-height:48px}
.verification-search input{font-size:14px}
.verification-filters select{font-size:14px;min-height:47px}
.verification-page .proof-row{padding:16px;gap:12px;min-height:88px}
.verification-page .proof-row b{font-size:15px}
.verification-page .proof-row small{font-size:13px;line-height:1.55}
.verification-page .status-pill{font-size:11px;padding:7px 10px}
.verification-no-results{font-size:14px}
.verification-page .empty-state h2{font-size:24px}
.verification-page .empty-state p{font-size:15px;line-height:1.65}
.verification-page .verification-title h2{font-size:25px}
.verification-page .verification-title .muted{font-size:14px}
.verification-page .verification-title .btn{font-size:13px;border-radius:999px}
.verification-page .proof-meta b{font-size:12px}
.verification-page .proof-meta span{font-size:14px}
.verification-page .verification-checklist-heading h3{font-size:19px}
.verification-page .verification-checklist-heading span{font-size:12px}
.verification-page .checklist label{font-size:14px;min-height:60px}
.verification-page .coordinator-box span{font-size:14px;line-height:1.6}
.verification-page .verification-actions .btn{font-size:13px;min-height:42px;padding:10px 16px;border-radius:999px}
.verification-page .verification-foot{font-size:13px;line-height:1.65}
.verification-page .btn{font-size:13px}
@media(max-width:440px){.verification-page .proof-row{padding:13px}.verification-page .proof-row b{font-size:14px}.verification-page .proof-row small{font-size:12px}.verification-page .status-pill{font-size:10px}}
/* Balanced typography: retain legible sizes with softer weights. */
.verification-page-head h1{font-weight:700}
.verification-queue-heading h2{font-weight:650}
.verification-page .proof-row b{font-weight:600}
.verification-page .status-pill{font-weight:650}
.verification-queue-count,.verification-pending-badge{font-weight:600}
.verification-page .empty-state h2{font-weight:650}
.verification-page .verification-title h2{font-weight:650}
.verification-page .verification-checklist-heading h3{font-weight:650}
.verification-page .verification-checklist-heading span{font-weight:600}
.verification-page .proof-meta b{font-weight:600}
.verification-page .proof-meta span{font-weight:500}
.verification-page .verification-actions .btn,.verification-page .btn{font-weight:600}
.verification-page .verification-foot{font-weight:400}
.verification-page .verification-delete-student{background:#ef4444!important;border:1px solid #ef4444!important;color:#fff!important;border-radius:999px!important;font-weight:600}
.verification-page .verification-delete-student:hover:not(:disabled){background:#dc2626!important;border-color:#dc2626!important}
.verification-page .verification-delete-student:focus-visible{outline:3px solid #fecaca;outline-offset:2px}
.verification-page .verification-delete-student:disabled{opacity:.55;cursor:not-allowed}
.verification-page .verification-title>.btn{min-height:42px!important;padding:10px 18px!important;border-radius:999px!important;font-size:13px!important;font-weight:600!important;line-height:1.3!important;display:inline-flex!important;align-items:center;justify-content:center;box-sizing:border-box;transition:background-color .16s,border-color .16s,color .16s}
.verification-page .verification-title>.btn:hover:not(:disabled){color:#fff!important}
.verification-page .verification-title>.btn.secondary:hover:not(:disabled){background:#086443!important;border-color:#086443!important}
.verification-page .verification-title>.btn.verification-delete-student:hover:not(:disabled){background:#dc2626!important;border-color:#dc2626!important;color:#fff!important}
/* Equal-width action grid with GAINT green primary palette and blue override. */
.verification-page .verification-actions{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-items:stretch}
.verification-page .verification-actions>.btn{width:100%;min-width:0;min-height:48px;padding:10px 12px;border-radius:999px!important;white-space:normal;line-height:1.35;text-align:center;font-size:12px;font-weight:600;box-sizing:border-box;border:1px solid transparent;transition:background-color .16s,color .16s,border-color .16s}
.verification-page .verification-actions>.btn:not(.verification-action-override):not(.verification-action-reject):not(.verification-action-reupload):not(.verification-action-correction){background:#075e42;color:#fff;border-color:#075e42}
.verification-page .verification-actions>.verification-action-reupload{background:#177c57;color:#fff;border-color:#177c57}
.verification-page .verification-actions>.verification-action-correction{background:#e4f3e9;color:#075c3d;border-color:#b9ddc8}
.verification-page .verification-actions>.verification-action-reject{background:#a73737;color:#fff;border-color:#a73737}
.verification-page .verification-actions>.verification-action-override{background:#2563eb;color:#fff;border-color:#2563eb;grid-column:1/-1;justify-self:stretch}
.verification-page .verification-actions>.btn:hover:not(:disabled){background:#064b35!important;border-color:#064b35!important;color:#fff!important}
.verification-page .verification-actions>.verification-action-reject:hover:not(:disabled){background:#8f2929!important;border-color:#8f2929!important}
.verification-page .verification-actions>.verification-action-override:hover:not(:disabled){background:#1d4ed8!important;border-color:#1d4ed8!important}
.verification-page .verification-actions>.btn:disabled{opacity:.5;cursor:not-allowed}
@media(max-width:1200px){.verification-page .verification-actions{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.verification-page .verification-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:430px){.verification-page .verification-actions{grid-template-columns:1fr}}
/* Distinct action colors; consistent dimensions and accessible hover states. */
.verification-page .verification-actions>.btn:not(.verification-action-override):not(.verification-action-reject):not(.verification-action-reupload):not(.verification-action-correction){background:#087443!important;border-color:#087443!important;color:#fff!important}
.verification-page .verification-actions>.verification-action-reupload{background:#d97706!important;border-color:#d97706!important;color:#fff!important}
.verification-page .verification-actions>.verification-action-reject:not(:nth-last-child(2)){background:#7e22ce!important;border-color:#7e22ce!important;color:#fff!important}
.verification-page .verification-actions>.verification-action-correction{background:#0891b2!important;border-color:#0891b2!important;color:#fff!important}
.verification-page .verification-actions>.verification-action-reject{background:#dc2626!important;border-color:#dc2626!important;color:#fff!important}
.verification-page .verification-actions>.verification-action-reject:nth-child(3){background:#7e22ce!important;border-color:#7e22ce!important}
.verification-page .verification-actions>.verification-action-override{background:#2563eb!important;border-color:#2563eb!important;color:#fff!important}
.verification-page .verification-actions>.btn:hover:not(:disabled){filter:brightness(.86);color:#fff!important}
.verification-page .verification-actions>.verification-action-reject:hover:not(:disabled){background:#b91c1c!important;border-color:#b91c1c!important}
.verification-page .verification-actions>.verification-action-reject:nth-child(3):hover:not(:disabled){background:#6b21a8!important;border-color:#6b21a8!important}
.verification-page .verification-actions>.verification-action-override:hover:not(:disabled){background:#1d4ed8!important;border-color:#1d4ed8!important}
@media(prefers-reduced-motion:reduce){.verification-page .proof-row{transition:none}}
`}</style>
    </main>
  );
}

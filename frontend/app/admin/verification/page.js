"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "../../../lib/api";
const ITEMS = [
  ["nameMatch", "Student name matches proof"],
  ["rollMatch", "Roll / registration number matches"],
  ["collegeMatch", "College / university matches"],
  ["datesValid", "Approved internship dates are valid"],
  ["signatureSeal", "College signature / seal is present"],
  ["referenceMatch", "Reference number matches the document"],
  ["duplicateChecked", "Duplicate reference / document check completed"],
];
export default function Page() {
  const [rows, setRows] = useState([]),
    [selected, setSelected] = useState(null),
    [checks, setChecks] = useState({}),
    [reason, setReason] = useState(""),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/admin/proofs")
      .then((x) => {
        setRows(x);
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
  async function view(id) {
    try {
      const b = await apiBlob("/admin/proofs/" + id + "/file");
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
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>College Proof Verification</h1>
          <p className="muted">
            Verify eligibility against the GAINT verification checklist before
            activating an intern.
          </p>
        </div>
        <span className="badge">{pending.length} pending</span>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <div className="verification-layout">
        <section className="card">
          <h2>Verification Queue</h2>
          {!rows.length ? (
            <p className="muted">No proof submissions found.</p>
          ) : (
            rows.map((p) => (
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
                  <h2>{selected.full_name}</h2>
                  <p className="muted">
                    {selected.email} · {selected.mobile || "No mobile"}
                  </p>
                </div>
                <button
                  className="btn secondary"
                  onClick={() => view(selected.id)}
                >
                  View Uploaded Proof
                </button>
              </div>
              <div className="detail-grid proof-meta">
                <div>
                  <b>College</b>
                  <span>{selected.college_name || "—"}</span>
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
                  <span>{selected.proof_type}</span>
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
              <h3>Verification Checklist</h3>
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
                  className="btn warning"
                  disabled={busy}
                  onClick={() => decision("REUPLOAD_REQUESTED")}
                >
                  Request Re-upload
                </button>
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() => decision("REJECTED")}
                >
                  Reject Proof
                </button>
                {selected.status === "VERIFIED" && !selected.is_active && (
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => approve(selected)}
                  >
                    Approve Account
                  </button>
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
    </main>
  );
}

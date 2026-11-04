"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/shared/api/client";
const PROOF_TYPES = ["College Allotment Order", "No Objection Certificate (NOC)", "Internship Permission / Recommendation Letter", "Bonafide Certificate with internship permission", "Other"];
const LABELS = { PROOF_UNDER_REVIEW: "College proof under review", PROOF_REUPLOAD_REQUIRED: "New college proof required", PROOF_REJECTED: "College proof rejected", PENDING_APPROVAL: "Awaiting account approval", CORRECTION_REQUESTED: "Correction requested", REJECTED: "Application rejected", ACTIVE: "Approved" };
export default function ApplicationStatusPage() {
  const [creds, setCreds] = useState({ email: "", password: "" }),
    [status, setStatus] = useState(null),
    [proof, setProof] = useState({ proofType: "", issuingAuthority: "", referenceNumber: "", issueDate: "", approvedFrom: "", approvedTo: "" }),
    [files, setFiles] = useState([]),
    [profile, setProfile] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  async function check(e) {
    e?.preventDefault();
    setErr("");
    try {
      setBusy(true);
      const s = await api("/auth/application-status", { method: "POST", body: JSON.stringify(creds) });
      setStatus(s);
      setProfile(s.profile);
    } catch (x) {
      setErr(/invalid credentials/i.test(x.message) ? "Invalid email or password." : x.message);
    } finally {
      setBusy(false);
    }
  }
  async function reupload(e) {
    e.preventDefault();
    setErr("");
    if (!files.length || files.length > 2) return setErr("Upload one or two proof files.");
    if (files.some((f) => f.size > 5 * 1024 * 1024)) return setErr("Each proof file must be 5 MB or smaller.");
    const body = new FormData();
    Object.entries({ ...creds, ...proof }).forEach(([k, v]) => body.append(k, v));
    files.forEach((f) => body.append("proofFiles", f));
    try {
      setBusy(true);
      await api("/auth/proof-reupload", { method: "POST", body });
      setMsg("New college proof submitted for Admin review.");
      await check();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  async function correct(e) {
    e.preventDefault();
    setErr("");
    try {
      setBusy(true);
      await api("/auth/application-correction", { method: "POST", body: JSON.stringify({ ...creds, ...profile }) });
      setMsg("Correction submitted. Admin will review your application again.");
      await check();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  const setP = (k, v) => setProof((x) => ({ ...x, [k]: v }));
  return (
    <main className="wrap">
      <h1>Application Status</h1>
      <p className="muted">Sign in with your registration email and password to see your application and respond to Admin requests.</p>
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      {!status ? (
        <section className="card">
          <form className="form-grid" onSubmit={check}>
            <div className="form-field"><label htmlFor="status-email">Email</label><input id="status-email" className="input" type="email" required value={creds.email} onChange={(e) => setCreds((x) => ({ ...x, email: e.target.value }))} /></div>
            <div className="form-field"><label htmlFor="status-password">Password</label><input id="status-password" className="input" type="password" required value={creds.password} onChange={(e) => setCreds((x) => ({ ...x, password: e.target.value }))} /></div>
            <div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Checking…" : "Check Status"}</button></div>
          </form>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>{LABELS[status.status] || status.status.replaceAll("_", " ")}</h2>
            {status.reason && <p><b>Admin note:</b> {status.reason}</p>}
            {status.proof && <p className="muted">College proof: {status.proof.status.replaceAll("_", " ")}{status.proof.coveredByBatchOrder ? " · Covered by batch allotment order" : ""}{status.proof.referenceNumber ? " · Reference " + status.proof.referenceNumber : ""}</p>}
            {status.active && <Link className="btn" href="/login">Go to Sign In</Link>}
          </section>
          {status.canReupload && (
            <section className="card">
              <h2>Upload New College Proof</h2>
              <form className="form-grid" onSubmit={reupload}>
                <div className="form-field"><label>Proof Type</label><select className="input" required value={proof.proofType} onChange={(e) => setP("proofType", e.target.value)}><option value="">Select proof type</option>{PROOF_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div className="form-field"><label>Issuing Authority</label><input className="input" required value={proof.issuingAuthority} onChange={(e) => setP("issuingAuthority", e.target.value)} /></div>
                <div className="form-field"><label>Letter / Reference Number</label><input className="input" required value={proof.referenceNumber} onChange={(e) => setP("referenceNumber", e.target.value)} /></div>
                <div className="form-field"><label>Issue Date</label><input className="input" type="date" required value={proof.issueDate} onChange={(e) => setP("issueDate", e.target.value)} /></div>
                <div className="form-field"><label>Approved From</label><input className="input" type="date" required value={proof.approvedFrom} onChange={(e) => setP("approvedFrom", e.target.value)} /></div>
                <div className="form-field"><label>Approved To</label><input className="input" type="date" required value={proof.approvedTo} onChange={(e) => setP("approvedTo", e.target.value)} /></div>
                <div className="form-field"><label>Proof Files (PDF/JPG/PNG, up to 2, 5 MB each)</label><input className="input" type="file" multiple required accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles([...e.target.files])} /></div>
                <div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Uploading…" : "Submit New Proof"}</button></div>
              </form>
            </section>
          )}
          {status.canCorrect && profile && (
            <section className="card">
              <h2>Correct Your Application</h2>
              <form className="form-grid" onSubmit={correct}>
                {[["fullName", "Full Name (as in college records)"], ["mobile", "Mobile"], ["address", "Address"], ["university", "University"], ["program", "Program"], ["branch", "Branch / Department"], ["yearSemester", "Year & Semester"], ["rollNumber", "Roll / Registration Number"]].map(([k, label]) => (
                  <div className="form-field" key={k}><label>{label}</label><input className="input" required value={profile[k] || ""} onChange={(e) => setProfile((x) => ({ ...x, [k]: e.target.value }))} /></div>
                ))}
                <div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Submitting…" : "Submit Correction"}</button></div>
              </form>
            </section>
          )}
        </>
      )}
    </main>
  );
}

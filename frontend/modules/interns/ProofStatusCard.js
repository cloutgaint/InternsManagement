"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
const PROOF_TYPES = ["College Allotment Order", "No Objection Certificate (NOC)", "Internship Permission / Recommendation Letter", "Bonafide Certificate with internship permission", "Other"];
export default function ProofStatusCard() {
  const blank = { proofType: "", issuingAuthority: "", referenceNumber: "", issueDate: "", approvedFrom: "", approvedTo: "" };
  const [proofs, setProofs] = useState([]), [f, setF] = useState(blank), [files, setFiles] = useState([]), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const load = () => api("/intern/proofs").then(setProofs).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const p = proofs[0];
  if (!p) return null;
  async function view(index) {
    try {
      const u = URL.createObjectURL(await apiBlob("/intern/proofs/" + p.id + "/file?index=" + index));
      window.open(u, "_blank");
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (e) { setErr(e.message); }
  }
  async function submit(e) {
    e.preventDefault();
    setErr("");
    const body = new FormData();
    Object.entries(f).forEach(([k, v]) => body.append(k, v));
    files.forEach((x) => body.append("proofFiles", x));
    try {
      setBusy(true);
      await api("/intern/proofs", { method: "POST", body });
      setMsg("College proof submitted for Admin review.");
      setF(blank);
      await load();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  const names = Array.isArray(p.file_names) ? p.file_names : [];
  return (
    <section className="card intern-pane intern-pane-onboarding">
      <h2>College Permission Proof</h2>
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="status-row">
        <span><b>{p.batch_order_id ? "Covered by batch allotment order" : p.proof_type}</b><br /><small>Reference {p.reference_number} · Version {p.version}</small></span>
        <span className="status-pill">{String(p.status).replaceAll("_", " ")}</span>
      </div>
      {p.reason && <p className="muted">Admin note: {p.reason}</p>}
      {names.map((name, i) => <button type="button" key={i} className="btn secondary" onClick={() => view(i)}>View {name}</button>)}
      {p.status === "OVERRIDE" && (
        <>
          <p className="proof-alert">Admin approved your account with an override{p.override_due_date ? " until " + p.override_due_date : ""}. Please submit your college proof.</p>
          <form className="form-grid" onSubmit={submit}>
            <div className="form-field"><label>Proof Type</label><select className="input" required value={f.proofType} onChange={(e) => setF((x) => ({ ...x, proofType: e.target.value }))}><option value="">Select proof type</option>{PROOF_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            {[["issuingAuthority", "Issuing Authority", "text"], ["referenceNumber", "Reference Number", "text"], ["issueDate", "Issue Date", "date"], ["approvedFrom", "Approved From", "date"], ["approvedTo", "Approved To", "date"]].map(([k, label, type]) => (
              <div className="form-field" key={k}><label>{label}</label><input className="input" type={type} required value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></div>
            ))}
            <div className="form-field"><label>Files (up to 2)</label><input className="input" type="file" multiple required accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles([...e.target.files])} /></div>
            <div className="form-actions"><button className="btn" disabled={busy}>Submit Proof</button></div>
          </form>
        </>
      )}
    </section>
  );
}

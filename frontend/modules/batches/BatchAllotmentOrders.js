"use client";
import { useEffect, useState } from "react";
import { API, api, apiBlob } from "@/shared/api/client";
export default function BatchAllotmentOrders({ batches }) {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ batchId: "", referenceNumber: "", issuingAuthority: "", issueDate: "", approvedFrom: "", approvedTo: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() { try { setOrders(await api("/admin/batch-allotment-orders")); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, []);
  async function upload(e) {
    e.preventDefault();
    if (!file) return setError("Select an allotment document.");
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    data.append("file", file);
    setBusy(true); setError(""); setMessage("");
    try {
      await api("/admin/batch-allotment-orders", { method: "POST", body: data });
      setMessage("Order uploaded. Verification is pending.");
      setFile(null);
      setForm({ batchId: "", referenceNumber: "", issuingAuthority: "", issueDate: "", approvedFrom: "", approvedTo: "" });
      e.target.reset();
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function review(order, outcome) {
    const reason = outcome === "REJECTED" ? prompt("Rejection reason:") : "";
    if (outcome === "REJECTED" && !reason?.trim()) return;
    setBusy(true); setError("");
    try {
      await api("/admin/batch-allotment-orders/" + order.id + "/verify", { method: "POST", body: JSON.stringify({ outcome, reason }) });
      setMessage("Order " + outcome.toLowerCase() + ".");
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function download(order) {
    try {
      const blob = await apiBlob("/admin/batch-allotment-orders/" + order.id + "/file");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "Allotment-" + order.reference_number.replace(/[^a-zA-Z0-9_-]/g, "") + ".pdf";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { setError(err.message); }
  }
  return <section className="card workflow-section">
    <h2>Batch Allotment Orders</h2>
    <p className="muted">Upload a college-issued allotment order and verify it before using it as supporting batch evidence.</p>
    {error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}
    <form className="form-grid" onSubmit={upload}>
      <div className="form-field"><label>Batch</label><select className="input" required value={form.batchId} onChange={e => setForm(x => ({...x,batchId:e.target.value}))}><option value="">Select batch</option>{batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
      {[
        ["referenceNumber","Reference Number","text"],["issuingAuthority","Issuing Authority","text"],
        ["issueDate","Issue Date","date"],["approvedFrom","Approved From","date"],["approvedTo","Approved To","date"]
      ].map(([key,label,type]) => <div className="form-field" key={key}><label>{label}</label><input className="input" required type={type} value={form[key]} onChange={e => setForm(x => ({...x,[key]:e.target.value}))}/></div>)}
      <div className="form-field"><label>Document (PDF/JPG/PNG, max 5 MB)</label><input className="input" required type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)}/></div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Uploading…" : "Upload Order"}</button></div>
    </form>
    <h3>Uploaded Orders</h3>
    {orders.length ? orders.map(o => <div className="workflow-row" key={o.id}>
      <div><b>{o.reference_number}</b><div className="muted">{o.batch_name} · {String(o.approved_from).slice(0,10)} to {String(o.approved_to).slice(0,10)}</div><span className="status-pill">{o.status}</span>{o.verification_reason && <p className="muted">{o.verification_reason}</p>}</div>
      <div className="action-row"><button className="btn secondary" type="button" onClick={() => download(o)}>Download</button>{o.status === "UPLOADED" && <><button className="btn" disabled={busy} type="button" onClick={() => review(o,"VERIFIED")}>Verify</button><button className="btn danger" disabled={busy} type="button" onClick={() => review(o,"REJECTED")}>Reject</button></>}</div>
    </div>) : <p className="muted">No batch allotment orders uploaded yet.</p>}
  </section>;
}

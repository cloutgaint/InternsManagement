"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function AdminDomainMasterPage() {
  const [domains, setDomains] = useState([]),
    [batches, setBatches] = useState([]),
    [form, setForm] = useState({
      name: "",
      code: "",
      category: "",
      description: "",
      defaultCapacity: 25,
      allowedDeliverables: "",
    }),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [dialog, setDialog] = useState(null),
    [dialogBusy, setDialogBusy] = useState(false),
    [dialogError, setDialogError] = useState("");
  const load = () =>
    Promise.all([api("/admin/domain-master"), api("/admin/batches")])
      .then(([d, b]) => {
        setDomains(d);
        setBatches(b);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function create(e) {
    e.preventDefault();
    try {
      await api("/admin/domains", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          allowedDeliverables: form.allowedDeliverables
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        }),
      });
      setForm({
        name: "",
        code: "",
        category: "",
        description: "",
        defaultCapacity: 25,
        allowedDeliverables: "",
      });
      setMsg("Domain created.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    if (!dialog) return;
    function handleDialogKeyDown(e) { if (e.key === "Escape" && !dialogBusy) closeDialog(); }
    document.addEventListener("keydown", handleDialogKeyDown);
    return () => document.removeEventListener("keydown", handleDialogKeyDown);
  }, [dialog, dialogBusy]);
  function openSubdomain(d) { setDialog({ type: "subdomain", domain: d, name: "", code: "" }); setDialogError(""); }
  function openCapacity(d, b) { const current = d.batch_capacities?.find((x) => x.batch_id === b.id)?.capacity ?? d.default_capacity; setDialog({ type: "capacity", domain: d, batch: b, capacity: String(current) }); setDialogError(""); }
  function closeDialog() { if (dialogBusy) return; setDialog(null); setDialogError(""); }
  async function submitDialog(e) {
    e.preventDefault(); if (!dialog) return; setDialogError("");
    if (dialog.type === "subdomain" && (!dialog.name.trim() || !dialog.code.trim())) { setDialogError("Enter both the sub-domain name and code."); return; }
    if (dialog.type === "capacity" && (!Number.isInteger(Number(dialog.capacity)) || Number(dialog.capacity) < 1)) { setDialogError("Enter a whole number greater than zero."); return; }
    setDialogBusy(true);
    try {
      if (dialog.type === "subdomain") { await api("/admin/domains/" + dialog.domain.id + "/subdomains", { method: "POST", body: JSON.stringify({ name: dialog.name.trim(), code: dialog.code.trim().toUpperCase() }) }); setMsg("Sub-domain added."); }
      else { await api("/admin/batches/" + dialog.batch.id + "/domains/" + dialog.domain.id, { method: "PUT", body: JSON.stringify({ capacity: Number(dialog.capacity) }) }); setMsg("Batch/domain capacity updated."); }
      setDialog(null); await load();
    } catch (e) { setDialogError(e.message || "Unable to save changes. Please try again."); }
    finally { setDialogBusy(false); }
  }
  return (
    <main className="wrap admin-domain-master">
      <div className="intern-head">
        <div>
          <h1>Domain Master</h1>
          <p className="muted">
            Configure domains, sub-domains, deliverable types and capacities
            used by assessments, recommendations and group formation.
          </p>
        </div>
        <span className="badge">{domains.length} domains</span>
      </div>
      <section className="card">
        <h2>Create Domain</h2>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}
        <form className="form-grid" onSubmit={create}>
          <div className="form-field">
            <label>Name</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))}
            />
          </div>
          <div className="form-field">
            <label>Code</label>
            <input
              className="input"
              required
              value={form.code}
              onChange={(e) =>
                setForm((x) => ({ ...x, code: e.target.value.toUpperCase() }))
              }
            />
          </div>
          <div className="form-field">
            <label>Category</label>
            <input
              className="input"
              value={form.category}
              onChange={(e) =>
                setForm((x) => ({ ...x, category: e.target.value }))
              }
            />
          </div>
          <div className="form-field">
            <label>Default Capacity</label>
            <input
              className="input"
              type="number"
              min="1"
              value={form.defaultCapacity}
              onChange={(e) =>
                setForm((x) => ({
                  ...x,
                  defaultCapacity: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="form-field">
            <label>Allowed Deliverable Types</label>
            <input
              className="input"
              placeholder="GitHub, Report, Demo, PPT"
              value={form.allowedDeliverables}
              onChange={(e) =>
                setForm((x) => ({ ...x, allowedDeliverables: e.target.value }))
              }
            />
          </div>
          <div className="form-field">
            <label>Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) =>
                setForm((x) => ({ ...x, description: e.target.value }))
              }
            />
          </div>
          <div className="form-actions">
            <button className="btn">Create Domain</button>
          </div>
        </form>
      </section>
      {domains.map((d) => (
        <section className="card domain-master-card" key={d.id}>
          <div className="verification-title">
            <div>
              <h2>
                {d.name} <small>({d.code})</small>
              </h2>
              <p className="muted">
                {d.category || "Uncategorized"} · Default capacity{" "}
                {d.default_capacity}
              </p>
            </div>
            <button className="btn secondary" onClick={() => openSubdomain(d)}>
              + Sub-domain
            </button>
          </div>
          <p>{d.description || "No description"}</p>
          <div className="master-tags">
            <b>Deliverables:</b>{" "}
            {(d.allowed_deliverables || []).map((x) => (
              <span key={x}>{x}</span>
            ))}
            {!(d.allowed_deliverables || []).length && (
              <span>Not configured</span>
            )}
          </div>
          <div className="master-tags">
            <b>Sub-domains:</b>{" "}
            {(d.subdomains || []).map((x) => (
              <span key={x.id}>
                {x.name} · {x.code}
              </span>
            ))}
            {!d.subdomains?.length && <span>None</span>}
          </div>
          <div className="master-tags">
            <b>Rubrics:</b>{" "}
            {(d.rubrics || []).map((x) => (
              <span key={x.id}>
                {x.name} ({x.criteria?.length || 0} criteria)
              </span>
            ))}
            {!d.rubrics?.length && <span>Create rubrics in Assessments</span>}
          </div>
          <div className="capacity-grid">
            <b>Batch Capacity</b>
            {batches.map((b) => (
              <button
                className="capacity-btn"
                key={b.id}
                onClick={() => openCapacity(d, b)}
              >
                {b.name}
                <strong>
                  {d.batch_capacities?.find((x) => x.batch_id === b.id)
                    ?.capacity ?? d.default_capacity}
                </strong>
              </button>
            ))}
          </div>
        </section>
      ))}
      {dialog && (
        <div className="domain-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(); }}>
          <section className="domain-dialog" role="dialog" aria-modal="true" aria-labelledby="domain-dialog-title">
            <div className="domain-dialog-header">
              <div>
                <span className="domain-dialog-eyebrow">{dialog.type === "subdomain" ? "Domain configuration" : "Capacity settings"}</span>
                <h2 id="domain-dialog-title">{dialog.type === "subdomain" ? "Add sub-domain" : "Update batch capacity"}</h2>
                <p>{dialog.type === "subdomain" ? "Create a sub-domain under " + dialog.domain.name + "." : dialog.domain.name + " · " + dialog.batch.name}</p>
              </div>
              <button type="button" className="domain-dialog-close" aria-label="Close dialog" onClick={closeDialog} disabled={dialogBusy}>×</button>
            </div>
            <form onSubmit={submitDialog}>
              {dialog.type === "subdomain" ? (
                <div className="domain-dialog-fields">
                  <label>Sub-domain name<input className="input" autoFocus required maxLength={100} value={dialog.name} onChange={(e) => setDialog((x) => ({ ...x, name: e.target.value }))} placeholder="e.g. React Development"/></label>
                  <label>Sub-domain code<input className="input" required maxLength={30} value={dialog.code} onChange={(e) => setDialog((x) => ({ ...x, code: e.target.value.toUpperCase() }))} placeholder="e.g. REACT"/></label>
                </div>
              ) : (
                <div className="domain-dialog-fields">
                  <label>Maximum intern capacity<input className="input" autoFocus type="number" min="1" step="1" required value={dialog.capacity} onChange={(e) => setDialog((x) => ({ ...x, capacity: e.target.value }))}/><small>Enter the maximum number of interns for this domain in the selected batch.</small></label>
                </div>
              )}
              {dialogError && <p className="domain-dialog-error" role="alert">{dialogError}</p>}
              <div className="domain-dialog-actions">
                <button type="button" className="btn secondary" onClick={closeDialog} disabled={dialogBusy}>Cancel</button>
                <button type="submit" className="btn" disabled={dialogBusy}>{dialogBusy ? "Saving…" : dialog.type === "subdomain" ? "Add sub-domain" : "Save capacity"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
      <style jsx global>{`.admin-domain-master{max-width:1240px;margin-inline:auto;padding:24px 28px 72px;color:#111}
.admin-domain-master .intern-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin:16px 0 25px}
.admin-domain-master .intern-head h1{font-size:clamp(28px,3vw,36px);font-weight:700;letter-spacing:-.035em;color:#111;margin:0 0 8px}
.admin-domain-master .intern-head p{max-width:760px;font-size:15px;line-height:1.6;color:#525252;margin:0}
.admin-domain-master>.card{background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:24px 26px;margin-bottom:17px;box-shadow:0 5px 20px rgba(15,23,42,.035)}
.admin-domain-master h2{font-size:19px;font-weight:700;letter-spacing:-.02em;color:#111;margin:0 0 18px}
.admin-domain-master .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 18px;align-items:end}
.admin-domain-master .form-field{display:flex;flex-direction:column;gap:7px;min-width:0}
.admin-domain-master .form-field label{font-size:12px;font-weight:650;color:#262626}
.admin-domain-master .input{display:block;width:100%;min-width:0;height:44px;min-height:44px;margin:0;padding:10px 12px;box-sizing:border-box;border:1.5px solid #93b4ed;border-radius:9px;background:#fff;color:#111;font-size:14px}
.admin-domain-master .input:hover{border-color:#2563eb}
.admin-domain-master .input:focus{outline:0;border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe}
.admin-domain-master .form-actions{grid-column:1/-1;display:flex;justify-content:flex-end;align-items:center;margin-top:4px}
.admin-domain-master .btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 16px;border-radius:10px;font-size:13px;font-weight:650;line-height:1.2;box-sizing:border-box}
.admin-domain-master .btn:not(.secondary){background:#075b3b;border:1px solid #075b3b;color:#fff}
.admin-domain-master .btn:not(.secondary):hover{background:#06472f;border-color:#06472f}
.admin-domain-master .btn.secondary{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}
.admin-domain-master .btn.secondary:hover{background:#2563eb;border-color:#2563eb;color:#fff}
.admin-domain-master button:focus-visible,.admin-domain-master input:focus-visible{outline:3px solid #bfdbfe;outline-offset:2px}
.admin-domain-master .domain-master-card{padding:22px 24px}
.admin-domain-master .verification-title{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
.admin-domain-master .verification-title h2{font-size:20px;margin:0 0 6px}
.admin-domain-master .verification-title h2 small{font-size:12px;font-weight:650;color:#64748b;letter-spacing:.02em}
.admin-domain-master .verification-title p{font-size:13px;color:#525252;margin:0;line-height:1.5}
.admin-domain-master .domain-master-card>p{font-size:13px;line-height:1.6;color:#525252;margin:12px 0 17px}
.admin-domain-master .master-tags{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:12px 0;padding:12px 13px;border:1px solid #edf0f4;border-radius:11px;background:#fafbfc;font-size:12px;color:#525252}
.admin-domain-master .master-tags>b{color:#111;font-weight:700;margin-right:3px}
.admin-domain-master .master-tags>span{display:inline-flex;align-items:center;padding:6px 9px;border:1px solid #dbeafe;border-radius:999px;background:#eff6ff;color:#1e40af;font-size:11px;font-weight:600}
.admin-domain-master .capacity-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:9px;margin-top:18px;padding-top:16px;border-top:1px solid #edf0f4}
.admin-domain-master .capacity-grid>b{grid-column:1/-1;font-size:13px;color:#111;margin-bottom:3px}
.admin-domain-master .capacity-btn{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:10px 12px;border:1px solid #dbe5ef;border-radius:10px;background:#fff;color:#374151;font-size:12px;text-align:left}
.admin-domain-master .capacity-btn:hover{border-color:#60a5fa;background:#f8fbff}
.admin-domain-master .capacity-btn strong{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:28px;padding:0 7px;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-size:13px}
@media(max-width:700px){.admin-domain-master{padding:18px 14px 48px}.admin-domain-master>.card{padding:20px 16px}.admin-domain-master .form-grid{grid-template-columns:1fr}.admin-domain-master .verification-title{flex-direction:column}.admin-domain-master .form-actions{justify-content:stretch}.admin-domain-master .form-actions .btn{width:100%}}
.admin-domain-master .domain-dialog-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.48);backdrop-filter:blur(3px)}
.admin-domain-master .domain-dialog{width:min(100%,520px);max-height:calc(100vh - 40px);overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:25px;box-shadow:0 24px 70px rgba(15,23,42,.24);color:#111}
.admin-domain-master .domain-dialog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
.admin-domain-master .domain-dialog-eyebrow{font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#64748b}
.admin-domain-master .domain-dialog-header h2{font-size:21px;font-weight:700;margin:5px 0 6px;color:#111}
.admin-domain-master .domain-dialog-header p{font-size:13px;line-height:1.5;color:#525252;margin:0}
.admin-domain-master .domain-dialog-close{width:34px;height:34px;flex:none;border:1px solid #e2e8f0;border-radius:9px;background:#fff;color:#525252;font-size:22px;line-height:1}
.admin-domain-master .domain-dialog-fields{display:grid;gap:16px}
.admin-domain-master .domain-dialog-fields label{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:650;color:#262626}
.admin-domain-master .domain-dialog-fields .input{height:44px;min-height:44px;margin:0}
.admin-domain-master .domain-dialog-fields small{font-size:11px;font-weight:400;line-height:1.5;color:#64748b}
.admin-domain-master .domain-dialog-error{margin:14px 0 0;padding:10px 12px;border:1px solid #fecaca;border-radius:9px;background:#fef2f2;color:#991b1b;font-size:12px}
.admin-domain-master .domain-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px;padding-top:17px;border-top:1px solid #edf0f4}
.admin-domain-master .domain-dialog-actions .btn{min-width:112px}
@media(max-width:520px){.admin-domain-master .domain-dialog{padding:20px 17px}.admin-domain-master .domain-dialog-actions{flex-direction:column-reverse}.admin-domain-master .domain-dialog-actions .btn{width:100%}}`}</style>
    </main>
  );
}

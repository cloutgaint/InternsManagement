"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
export default function Page() {
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
    [err, setErr] = useState("");
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
  async function sub(d) {
    const name = prompt("Sub-domain name:");
    if (!name) return;
    const code = prompt("Sub-domain code:");
    if (!code) return;
    try {
      await api("/admin/domains/" + d.id + "/subdomains", {
        method: "POST",
        body: JSON.stringify({ name, code }),
      });
      setMsg("Sub-domain added.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function capacity(d, b) {
    const current =
      d.batch_capacities?.find((x) => x.batch_id === b.id)?.capacity ??
      d.default_capacity;
    const v = prompt("Capacity for " + d.name + " in " + b.name + ":", current);
    if (v === null) return;
    try {
      await api("/admin/batches/" + b.id + "/domains/" + d.id, {
        method: "PUT",
        body: JSON.stringify({ capacity: Number(v) }),
      });
      setMsg("Batch/domain capacity updated.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap">
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
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <section className="card">
        <h2>Create Domain</h2>
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
            <button className="btn secondary" onClick={() => sub(d)}>
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
                onClick={() => capacity(d, b)}
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
    </main>
  );
}

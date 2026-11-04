"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
const TYPES = ["TEXT", "LINK", "REPOSITORY", "DOCUMENT", "PRESENTATION", "VIDEO", "FILE"];
export default function TaskTemplates({ domains }) {
  const blank = { domainId: "", weekNo: 1, title: "", description: "", expectedOutput: "", submissionTypes: ["DOCUMENT"], marks: 100 };
  const [rows, setRows] = useState([]), [f, setF] = useState(blank), [msg, setMsg] = useState(""), [err, setErr] = useState("");
  const load = () => api("/admin/task-templates").then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  async function save(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      await api("/admin/task-templates", { method: "POST", body: JSON.stringify({ ...f, marks: Number(f.marks), weekNo: Number(f.weekNo) }) });
      setMsg("Template saved. Use Configure on a batch to schedule its weekly tasks.");
      setF(blank);
      load();
    } catch (x) { setErr(x.message); }
  }
  async function retire(t) {
    try { await api("/admin/task-templates/" + t.id, { method: "DELETE" }); load(); } catch (x) { setErr(x.message); }
  }
  return (
    <section className="card workflow-section">
      <h2>Domain Task Templates</h2>
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <form className="form-grid" onSubmit={save}>
        <div className="form-field"><label>Domain</label><select className="input" value={f.domainId} onChange={(e) => setF((x) => ({ ...x, domainId: e.target.value }))}><option value="">All domains</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="form-field"><label>Week</label><input className="input" type="number" min="1" required value={f.weekNo} onChange={(e) => setF((x) => ({ ...x, weekNo: e.target.value }))} /></div>
        <div className="form-field"><label>Title</label><input className="input" required value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} /></div>
        <div className="form-field"><label>Marks</label><input className="input" type="number" min="1" max="1000" required value={f.marks} onChange={(e) => setF((x) => ({ ...x, marks: e.target.value }))} /></div>
        <div className="form-field" style={{ gridColumn: "1 / -1" }}><label>Description</label><textarea className="input" value={f.description} onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} /></div>
        <fieldset className="form-field" style={{ gridColumn: "1 / -1" }}>
          <legend>Accepted Submission Types</legend>
          {TYPES.map((t) => <label key={t} style={{ marginRight: 12 }}><input type="checkbox" checked={f.submissionTypes.includes(t)} onChange={() => setF((x) => ({ ...x, submissionTypes: x.submissionTypes.includes(t) ? x.submissionTypes.filter((v) => v !== t) : [...x.submissionTypes, t] }))} /> {t}</label>)}
        </fieldset>
        <div className="form-actions"><button className="btn">Save Template</button></div>
      </form>
      {rows.map((t) => (
        <div className="workflow-row" key={t.id}>
          <div><b>Week {t.week_no ?? "—"}: {t.title}</b><p className="muted">{t.domain_name || "All domains"} · {(t.submission_types || []).join(", ")} · {t.marks} marks</p></div>
          <button type="button" className="btn secondary" onClick={() => retire(t)}>Retire</button>
        </div>
      ))}
    </section>
  );
}

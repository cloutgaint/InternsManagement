"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function AdminPerformancePage() {
  const [d, setD] = useState(null),
    [q, setQ] = useState(""),
    [configs, setConfigs] = useState([]),
    [batchId, setBatchId] = useState(""),
    [domainId, setDomainId] = useState(""),
    [weights, setWeights] = useState({ attendance: 25, tasks: 35, reviews: 25, final: 15 }),
    [message, setMessage] = useState("");
  useEffect(() => {
    api("/admin/performance").then(setD).catch(e => setMessage(e.message));
    api("/admin/performance/weights").then(setConfigs).catch(e => setMessage(e.message));
  }, []);
  useEffect(() => {
    if (!batchId) return;
    const config = configs.find(c => c.batch_id === batchId && (c.domain_id || "") === domainId) || configs.find(c => c.batch_id === batchId && !c.domain_id);
    setWeights(config?.weights || { attendance: 25, tasks: 35, reviews: 25, final: 15 });
  }, [batchId, domainId, configs]);
  if (!d) return <main className="wrap">Loading performance dashboard…</main>;
  const rows = d.interns.filter((x) =>
    (
      x.full_name +
      " " +
      (x.roll_number || "") +
      " " +
      (x.batch_name || "") +
      " " +
      (x.domain_name || "")
    )
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const batches = [...new Map(d.interns.filter(x => x.batch_id).map(x => [x.batch_id, x.batch_name])).entries()];
  const domains = [...new Map(d.interns.filter(x => x.domain_id).map(x => [x.domain_id, x.domain_name])).entries()];
  async function saveWeights(e) {
    e.preventDefault();
    setMessage("");
    if (Object.values(weights).some(v => !Number.isFinite(v) || v < 0) || Object.values(weights).reduce((a,b) => a+b,0) !== 100) {
      setMessage("All four weightages must be nonnegative and total 100%."); return;
    }
    try {
      await api("/admin/performance/weights", { method: "PUT", body: JSON.stringify({ batchId, domainId: domainId || null, weights }) });
      const [updated, all] = await Promise.all([api("/admin/performance"), api("/admin/performance/weights")]);
      setD(updated); setConfigs(all); setMessage("Performance weightages saved.");
    } catch (err) { setMessage(err.message); }
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Intern Performance Dashboard</h1>
          <p className="muted">
            Combined attendance, weekly-task, fortnight-review, project and
            individual-performance view.
          </p>
        </div>
      </div>
      <div className="work-summary performance-kpis">
        <div className="card">
          <span>Interns</span>
          <strong>{d.summary.interns}</strong>
        </div>
        <div className="card">
          <span>Avg Attendance</span>
          <strong>{d.summary.avgAttendance}%</strong>
        </div>
        <div className="card">
          <span>Avg Task Marks</span>
          <strong>{d.summary.avgTaskMarks}</strong>
        </div>
        <div className="card">
          <span>Avg Review Marks</span>
          <strong>{d.summary.avgIndividualMarks}</strong>
        </div>
      </div>
      <section className="card">
        <h2>Performance Weightages</h2>
        <p className="muted">Configure batch defaults or domain-specific overrides. Total must equal 100%.</p>
        <form onSubmit={saveWeights} className="workflow-section">
          <select className="input" required value={batchId} onChange={e => setBatchId(e.target.value)}>
            <option value="">Select batch</option>
            {batches.map(([id,name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select className="input" value={domainId} onChange={e => setDomainId(e.target.value)}>
            <option value="">All domains (batch default)</option>
            {domains.map(([id,name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <div className="work-summary">
            {Object.keys(weights).map(k => <label key={k}>{k}<input className="input" type="number" min="0" max="100" step="1" value={weights[k]} onChange={e => setWeights(w => ({...w,[k]:Number(e.target.value)}))}/></label>)}
          </div>
          <button className="btn" type="submit">Save weightages</button>
        </form>
        {message && <p role="status" className="muted">{message}</p>}
        <p className="muted">{configs.length} saved weightage configuration(s)</p>
      </section>
      <section className="card">
        <input
          className="input"
          placeholder="Search intern, roll, batch or domain"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="performance-table">
          <b>Intern</b>
          <b>Batch / Domain</b>
          <b>Attendance</b>
          <b>Tasks</b>
          <b>Task Avg</b>
          <b>Reviews</b>
          <b>Individual Avg</b>
          <b>Project</b>
          <b>Score</b>
          {rows.map((x) => (
            <div className="performance-row" key={x.id}>
              <span>
                <strong>{x.full_name}</strong>
                <small>{x.roll_number || "—"}</small>
              </span>
              <span>
                {x.batch_name || "—"}
                <small>{x.domain_name || "No domain"}</small>
              </span>
              <span>
                {x.attendance_pct}%
                <small>
                  {x.present_days}/{x.attendance_days} days
                </small>
              </span>
              <span>
                {x.approved_tasks}/{x.task_count}
              </span>
              <span>{x.avg_task_marks}</span>
              <span>{x.review_count}</span>
              <span>{x.avg_individual_marks}</span>
              <span>
                {x.project_title || "Not assigned"}
                <small>{x.recommendation || ""}</small>
              </span>
              <span title={JSON.stringify(x.performance_weights || {})}>{x.performance_score == null ? "Pending data" : x.performance_score + "%"}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

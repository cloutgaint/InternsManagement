"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function MentorOperationsPage() {
  const [d, setD] = useState(null),
    [tab, setTab] = useState("attendance"),
    [q, setQ] = useState(""),
    [exceptions, setExceptions] = useState([]),
    [notes, setNotes] = useState({}),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState("");
  const load = () =>
    Promise.all([api("/mentor/operations"), api("/mentor/attendance-exceptions")])
      .then(([o, e]) => {
        setD(o);
        setExceptions(e);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function decide(path, x, status) {
    setErr("");
    setMsg("");
    try {
      await api("/mentor/" + path + "/" + x.id + "/decision", { method: "POST", body: JSON.stringify({ status, reason: notes[x.id] || "" }) });
      setMsg("Decision recorded.");
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }
  const decisionControls = (path, x) => (
    <div className="action-row">
      <input className="input" aria-label={"Decision note for " + x.full_name} placeholder="Reason" value={notes[x.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [x.id]: e.target.value }))} />
      <button className="btn" onClick={() => decide(path, x, "APPROVED")}>Approve</button>
      <button className="btn danger" onClick={() => decide(path, x, "REJECTED")}>Reject</button>
    </div>
  );
  if (!d) return <main className="wrap">Loading operational workspace…</main>;
  const match = (x) =>
    (x.full_name + " " + (x.group_name || ""))
      .toLowerCase()
      .includes(q.toLowerCase());
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Intern Operations</h1>
          <p className="muted">
            Attendance, leave, daily reporting and assigned-project milestones
            for your groups.
          </p>
        </div>
      </div>
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="tab-row">
        {["attendance", "exceptions", "leave", "reports", "milestones"].map((x) => (
          <button
            className={"btn " + (tab === x ? "" : "secondary")}
            onClick={() => setTab(x)}
            key={x}
          >
            {x[0].toUpperCase() + x.slice(1)}
          </button>
        ))}
      </div>
      <input
        className="input"
        placeholder="Search intern or group"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {tab === "attendance" && (
        <section className="card ops-list">
          <h2>Attendance</h2>
          {d.attendance.filter(match).map((x) => (
            <div className="workflow-row" key={x.id}>
              <div>
                <b>{x.full_name}</b>
                <small>
                  {x.group_name} · {String(x.day).slice(0, 10)}
                </small>
              </div>
              <span className="status-pill">{x.status}</span>
              <span>{x.working_minutes || 0} min</span>
            </div>
          ))}
        </section>
      )}
      {tab === "exceptions" && (
        <section className="card ops-list">
          <h2>Attendance Corrections</h2>
          {exceptions.filter(match).map((x) => (
            <div className="workflow-row" key={x.id}>
              <div>
                <b>{x.full_name}</b>
                <small>{x.group_name} · {String(x.day).slice(0, 10)} · {x.kind === "FAILED_MATCH" ? "Failed face match" : "Correction request"}</small>
                <p>{x.reason}</p>
                {x.decision_reason && <p className="muted">Decision: {x.decision_reason}</p>}
              </div>
              <span className="status-pill">{x.status}</span>
              {["DETECTED", "REQUESTED"].includes(x.status) && decisionControls("attendance-exceptions", x)}
            </div>
          ))}
          {!exceptions.length && <p className="muted">No attendance corrections for your groups.</p>}
        </section>
      )}
      {tab === "leave" && (
        <section className="card ops-list">
          <h2>Leave Requests</h2>
          {d.leave.filter(match).map((x) => (
            <div className="workflow-row" key={x.id}>
              <div>
                <b>{x.full_name}</b>
                <small>
                  {x.group_name} · {String(x.from_date).slice(0, 10)} to{" "}
                  {String(x.to_date).slice(0, 10)}
                </small>
                <p>{x.reason}</p>
              </div>
              <span className="status-pill">{x.status}</span>
              {x.status === "REQUESTED" && decisionControls("leave-requests", x)}
            </div>
          ))}
        </section>
      )}
      {tab === "reports" && (
        <section className="card ops-list">
          <h2>Daily Reports</h2>
          {d.dailyReports.filter(match).map((x) => (
            <article className="daily-review-card" key={x.id}>
              <div>
                <b>{x.full_name}</b>
                <small>
                  {x.group_name} · {String(x.day).slice(0, 10)}
                </small>
              </div>
              <p>
                <b>Plan:</b> {x.planned_tasks || "—"}
              </p>
              <p>
                <b>Completed:</b> {x.completed_tasks || "—"}
              </p>
              <p>
                <b>Blockers:</b> {x.pending_blockers || "None"}
              </p>
              {(x.proof_links || []).map((u) => (
                <a href={u} target="_blank" rel="noreferrer" key={u}>
                  {u}
                </a>
              ))}
            </article>
          ))}
        </section>
      )}
      {tab === "milestones" && (
        <section className="card ops-list">
          <h2>Project Milestones</h2>
          {d.milestones.map((x) => (
            <article className="daily-review-card" key={x.group_id}>
              <b>
                {x.group_name} · {x.title || "Project not assigned"}
              </b>
              {Array.isArray(x.milestones) && x.milestones.length ? (
                x.milestones.map((m, i) => (
                  <div className="status-row" key={i}>
                    <span>
                      {typeof m === "string"
                        ? m
                        : m.title || m.name || "Milestone " + (i + 1)}
                    </span>
                    <b>
                      {typeof m === "object"
                        ? m.status || "Planned"
                        : "Planned"}
                    </b>
                  </div>
                ))
              ) : (
                <p className="muted">No milestones configured.</p>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

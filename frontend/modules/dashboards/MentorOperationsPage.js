"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function MentorOperationsPage() {
  const [d, setD] = useState(null),
    [tab, setTab] = useState("attendance"),
    [q, setQ] = useState("");
  useEffect(() => {
    api("/mentor/operations").then(setD);
  }, []);
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
      <div className="tab-row">
        {["attendance", "leave", "reports", "milestones"].map((x) => (
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

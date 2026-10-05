"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
const fmt = (d) => (d ? String(d).slice(0, 10) : "—");
export default function InternWorkLogPage() {
  const [data, setData] = useState({ reports: [], leaves: [], holidays: [] }),
    [mode, setMode] = useState("MORNING"),
    [form, setForm] = useState({
      plannedTasks: "",
      completedTasks: "",
      pendingBlockers: "",
      proofLinks: "",
    }),
    [leave, setLeave] = useState({ fromDate: "", toDate: "", reason: "" }),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState("");
  const load = () =>
    api("/intern/work-log")
      .then(setData)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function report(e) {
    e.preventDefault();
    try {
      await api("/intern/daily-report", {
        method: "POST",
        body: JSON.stringify({
          phase: mode,
          plannedTasks: form.plannedTasks || null,
          completedTasks: form.completedTasks || null,
          pendingBlockers: form.pendingBlockers || null,
          proofLinks: form.proofLinks
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean),
        }),
      });
      setMsg(
        mode === "MORNING"
          ? "Morning plan submitted."
          : "Evening report submitted.",
      );
      setForm({
        plannedTasks: "",
        completedTasks: "",
        pendingBlockers: "",
        proofLinks: "",
      });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function requestLeave(e) {
    e.preventDefault();
    try {
      await api("/intern/leave", {
        method: "POST",
        body: JSON.stringify(leave),
      });
      setMsg("Leave request submitted for Admin approval.");
      setLeave({ fromDate: "", toDate: "", reason: "" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Daily Work & Leave</h1>
          <p className="muted">
            Submit professional morning/evening updates, evidence links and
            leave requests.
          </p>
        </div>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <div className="work-summary">
        <div className="card">
          <span>Leave allowance</span>
          <strong>{data.allocation?.leave_limit_days ?? 0} days</strong>
        </div>
        <div className="card">
          <span>Approved leave</span>
          <strong>{data.approvedLeaveDays || 0} days</strong>
        </div>
        <div className="card">
          <span>Remaining</span>
          <strong>{data.remainingLeaveDays || 0} days</strong>
        </div>
      </div>
      <section className="card">
        <div className="tab-row">
          <button
            className={mode === "MORNING" ? "btn" : "btn secondary"}
            onClick={() => setMode("MORNING")}
          >
            Morning Plan
          </button>
          <button
            className={mode === "EVENING" ? "btn" : "btn secondary"}
            onClick={() => setMode("EVENING")}
          >
            Evening Report
          </button>
        </div>
        <form onSubmit={report}>
          {mode === "MORNING" ? (
            <label>
              Today's Planned Tasks
              <textarea
                className="input work-textarea"
                required
                value={form.plannedTasks}
                onChange={(e) =>
                  setForm((x) => ({ ...x, plannedTasks: e.target.value }))
                }
                placeholder="List the work you plan to complete today."
              />
            </label>
          ) : (
            <>
              <label>
                Completed Work
                <textarea
                  className="input work-textarea"
                  required
                  value={form.completedTasks}
                  onChange={(e) =>
                    setForm((x) => ({ ...x, completedTasks: e.target.value }))
                  }
                  placeholder="Describe what you completed today."
                />
              </label>
              <label>
                Pending Work / Blockers
                <textarea
                  className="input work-textarea"
                  value={form.pendingBlockers}
                  onChange={(e) =>
                    setForm((x) => ({ ...x, pendingBlockers: e.target.value }))
                  }
                  placeholder="Mention blockers, dependencies or pending work."
                />
              </label>
              <label>
                Proof Links <small>(one URL per line)</small>
                <textarea
                  className="input work-textarea"
                  value={form.proofLinks}
                  onChange={(e) =>
                    setForm((x) => ({ ...x, proofLinks: e.target.value }))
                  }
                  placeholder={"https://github.com/...\nhttps://..."}
                />
              </label>
            </>
          )}
          <div className="form-actions">
            <button className="btn">
              Submit {mode === "MORNING" ? "Morning Plan" : "Evening Report"}
            </button>
          </div>
        </form>
      </section>
      <section className="card">
        <h2>Request Leave</h2>
        <form className="form-grid" onSubmit={requestLeave}>
          <label>
            From
            <input
              className="input"
              type="date"
              required
              value={leave.fromDate}
              onChange={(e) =>
                setLeave((x) => ({ ...x, fromDate: e.target.value }))
              }
            />
          </label>
          <label>
            To
            <input
              className="input"
              type="date"
              required
              value={leave.toDate}
              min={leave.fromDate}
              onChange={(e) =>
                setLeave((x) => ({ ...x, toDate: e.target.value }))
              }
            />
          </label>
          <label>
            Reason
            <textarea
              className="input"
              required
              value={leave.reason}
              onChange={(e) =>
                setLeave((x) => ({ ...x, reason: e.target.value }))
              }
            />
          </label>
          <div className="form-actions">
            <button className="btn">Send Leave Request</button>
          </div>
        </form>
        {data.holidays?.length > 0 && (
          <div className="master-tags">
            <b>Batch holidays:</b>
            {data.holidays.map((h) => (
              <span key={h.id}>
                {fmt(h.day)} · {h.name}
              </span>
            ))}
          </div>
        )}
      </section>
      <section className="card">
        <h2>Leave History</h2>
        {data.leaves?.length ? (
          data.leaves.map((x) => (
            <div className="status-row" key={x.id}>
              <span>
                <b>
                  {fmt(x.from_date)} – {fmt(x.to_date)}
                </b>
                <br />
                <small>
                  {x.reason} · {x.requested_days} working day(s)
                </small>
                {x.decision_reason && (
                  <>
                    <br />
                    <small>Decision: {x.decision_reason}</small>
                  </>
                )}
              </span>
              <span className="status-pill">{x.status}</span>
            </div>
          ))
        ) : (
          <p className="muted">No leave requests.</p>
        )}
      </section>
      <section className="card">
        <h2>Daily Report History</h2>
        {data.reports?.length ? (
          data.reports.map((x) => (
            <article className="work-history" key={x.id}>
              <div className="verification-title">
                <b>{fmt(x.day)}</b>
                <span>
                  {x.morning_at ? "Morning ✓" : ""}{" "}
                  {x.evening_at ? "Evening ✓" : ""}
                </span>
              </div>
              {x.planned_tasks && (
                <p>
                  <b>Plan:</b> {x.planned_tasks}
                </p>
              )}
              {x.completed_tasks && (
                <p>
                  <b>Completed:</b> {x.completed_tasks}
                </p>
              )}
              {x.pending_blockers && (
                <p>
                  <b>Blockers:</b> {x.pending_blockers}
                </p>
              )}
              {(x.proof_links || []).length > 0 && (
                <div className="master-tags">
                  <b>Evidence:</b>
                  {x.proof_links.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer">
                      Proof {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))
        ) : (
          <p className="muted">No daily reports yet.</p>
        )}
      </section>
    </main>
  );
}

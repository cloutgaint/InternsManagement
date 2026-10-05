"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "../../../lib/api";
export default function Page() {
  const [rows, setRows] = useState([]),
    [q, setQ] = useState(""),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState("");
  const load = () =>
    api("/admin/reports")
      .then(setRows)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const filtered = rows.filter((x) =>
    (
      x.full_name +
      " " +
      (x.roll_number || "") +
      " " +
      (x.college_name || "") +
      " " +
      (x.batch_name || "")
    )
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  async function generate(x) {
    try {
      await api("/admin/reports/" + x.intern_id + "/completion", {
        method: "POST",
        body: "{}",
      });
      setMsg("College completion report generated for " + x.full_name + ".");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function dl(id, name) {
    try {
      const b = await apiBlob("/admin/reports/completion/" + id + "/file"),
        u = URL.createObjectURL(b),
        a = document.createElement("a");
      a.href = u;
      a.download = "Completion-Report-" + name + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch (e) {
      setErr(e.message);
    }
  }
  async function csv() {
    try {
      const b = await apiBlob("/admin/reports/export.csv"),
        u = URL.createObjectURL(b),
        a = document.createElement("a");
      a.href = u;
      a.download = "GAINT-Intern-Report.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Reports & Exports</h1>
          <p className="muted">
            College completion reports and consolidated internship performance
            export.
          </p>
        </div>
        <button className="btn" onClick={csv}>
          Export CSV
        </button>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <input
        className="input"
        placeholder="Search student, roll, college or batch"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <section className="card report-table">
        <div className="report-head">
          <b>Intern</b>
          <b>College / Batch</b>
          <b>Attendance</b>
          <b>Performance</b>
          <b>Completion</b>
          <b>Report</b>
        </div>
        {filtered.map((x) => (
          <div className="report-row" key={x.intern_id}>
            <span>
              <b>{x.full_name}</b>
              <small>
                {x.roll_number || "—"} · {x.domain_name || "No domain"}
              </small>
            </span>
            <span>
              {x.college_name || "—"}
              <small>{x.batch_name || "No batch"}</small>
            </span>
            <span>{x.attendance_percent}%</span>
            <span>
              Task {x.task_avg}
              <small>
                Review {x.review_avg} · Final {x.individual_marks ?? "—"}
              </small>
            </span>
            <span className="status-pill">
              {x.completion_status || "PENDING"}
            </span>
            <span>
              {x.completion_report_id ? (
                <button
                  className="btn secondary"
                  onClick={() => dl(x.completion_report_id, x.full_name)}
                >
                  Download PDF
                </button>
              ) : (
                <button
                  className="btn"
                  disabled={x.completion_status !== "APPROVED"}
                  onClick={() => generate(x)}
                >
                  Generate College Report
                </button>
              )}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function InternTasksPage() {
  const [tasks, setTasks] = useState([]),
    [form, setForm] = useState({}),
    [files, setFiles] = useState({}),
    [history, setHistory] = useState({}),
    [latest, setLatest] = useState({}),
    [busy, setBusy] = useState({}),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState("");
  useEffect(() => {
    api("/intern/dashboard")
      .then(async (x) => {
        const items = x.tasks || [];
        setTasks(items);
        await Promise.all(items.map(async (t) => {
          try { const submissions = await api("/intern/tasks/" + t.id + "/submissions"); setLatest((prev) => ({ ...prev, [t.id]: submissions[0] || null })); }
          catch { /* History remains available for retry. */ }
        }));
      })
      .catch((e) => setErr(e.message));
  }, []);
  const field = (id, k, v) =>
    setForm((x) => ({ ...x, [id]: { ...(x[id] || {}), [k]: v } }));
  async function hist(t) {
    try {
      const submissions = await api("/intern/tasks/" + t.id + "/submissions");
      setHistory((x) => ({ ...x, [t.id]: submissions }));
      setLatest((x) => ({ ...x, [t.id]: submissions[0] || null }));
    } catch (e) {
      setErr(e.message);
    }
  }
  async function submit(t) {
    setErr(""); setMsg("");
    const v = form[t.id] || {};
    if (!files[t.id] && !Object.values(v).some((value) => typeof value === "string" && value.trim())) return setErr("Add a note, URL, or file before submitting.");
    setBusy((x) => ({ ...x, [t.id]: true }));
    try {
      const fd = new FormData();
      fd.append("content", JSON.stringify(v));
      if (files[t.id]) fd.append("file", files[t.id]);
      await api("/intern/tasks/" + t.id + "/submit", { method: "POST", body: fd });
      setMsg("Task submitted successfully.");
      await hist(t);
    } catch (e) {
      setErr(e.message);
    } finally { setBusy((x) => ({ ...x, [t.id]: false })); }
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Weekly Tasks</h1>
          <p className="muted">
            Submit your work using notes, links, or supporting files.
          </p>
        </div>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      {tasks.map((t) => {
        const v = form[t.id] || {}, current = latest[t.id], canSubmit = !current || current.status === "REWORK_REQUIRED";
        return (
          <section className="card task-submit-card" key={t.id}>
            <div className="verification-title">
              <div>
                <h2>{t.title}</h2>
                <p className="muted">
                  Weekly assignment
                </p>
              </div>
              <div><span className="status-pill">Task: {t.status}</span>{" "}{current && <span className="status-pill">Submission: {current.status.replaceAll("_", " ")}</span>}</div>
            </div>
            <p>{t.description}</p>
            {t.expected_output && (
              <p>
                <b>Expected output:</b> {t.expected_output}
              </p>
            )}
            <div className="submission-form">
              <label>Submission Notes<textarea className="input" value={v.text || ""} onChange={(e) => field(t.id, "text", e.target.value)} disabled={!canSubmit} /></label>
              <label>Work Link<input className="input" type="url" value={v.link || ""} onChange={(e) => field(t.id, "link", e.target.value)} disabled={!canSubmit} /></label>
              <label>Repository URL<input className="input" type="url" value={v.repositoryUrl || ""} onChange={(e) => field(t.id, "repositoryUrl", e.target.value)} disabled={!canSubmit} /></label>
              <label>Video URL<input className="input" type="url" value={v.videoUrl || ""} onChange={(e) => field(t.id, "videoUrl", e.target.value)} disabled={!canSubmit} /></label>
              <label>Supporting File<input className="input" type="file" onChange={(e) => setFiles((x) => ({ ...x, [t.id]: e.target.files?.[0] || null }))} disabled={!canSubmit} /></label>
            </div>
            <div className="form-actions">
              <button className="btn" disabled={!canSubmit || busy[t.id]} onClick={() => submit(t)}>
                {busy[t.id] ? "Submitting…" : current?.status === "REWORK_REQUIRED" ? "Resubmit Task" : "Submit Task"}
              </button>
              <button className="btn secondary" onClick={() => hist(t)}>
                Submission History
              </button>
            </div>
            {(history[t.id] || []).map((x) => (
              <div className="task-attempt" key={x.id}>
                <b>Attempt {x.attempt}</b>
                <span>
                  {new Date(x.submitted_at).toLocaleString()} ·{" "}
                  {x.is_late ? "Late" : "On time"} · {x.status}
                </span>
                {x.file_name && <small>File: {x.file_name}</small>}
                {x.mentor_feedback && <p><b>Mentor feedback:</b> {x.mentor_feedback}</p>}
                {x.rework_instructions && <p><b>Rework instructions:</b> {x.rework_instructions}</p>}
              </div>
            ))}
          </section>
        );
      })}
      {!tasks.length && (
        <section className="card">
          <p className="muted">No released tasks are assigned to you.</p>
        </section>
      )}
    </main>
  );
}

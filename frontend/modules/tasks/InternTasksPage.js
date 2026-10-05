"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function InternTasksPage() {
  const [tasks, setTasks] = useState([]),
    [form, setForm] = useState({}),
    [files, setFiles] = useState({}),
    [history, setHistory] = useState({}),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState("");
  useEffect(() => {
    api("/intern/dashboard")
      .then((x) => setTasks(x.tasks || []))
      .catch((e) => setErr(e.message));
  }, []);
  const field = (id, k, v) =>
    setForm((x) => ({ ...x, [id]: { ...(x[id] || {}), [k]: v } }));
  async function hist(t) {
    try {
      const submissions = await api("/intern/tasks/" + t.id + "/submissions");
      setHistory((x) => ({ ...x, [t.id]: submissions }));
    } catch (e) {
      setErr(e.message);
    }
  }
  async function submit(t) {
    try {
      const fd = new FormData(),
        v = form[t.id] || {};
      fd.append("content", JSON.stringify(v));
      if (files[t.id]) fd.append("file", files[t.id]);
      const token = localStorage.getItem("token"),
        base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      const response = await fetch(base + "/intern/tasks/" + t.id + "/submit", {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
          body: fd,
        }),
        out = await response.json();
      if (!response.ok) throw new Error(out.error || "Submission failed");
      setMsg("Task submitted successfully.");
      hist(t);
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Weekly Tasks</h1>
          <p className="muted">
            Submit the evidence types enabled for each released task.
          </p>
        </div>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      {tasks.map((t) => {
        const ty = t.submission_types || [],
          v = form[t.id] || {};
        return (
          <section className="card task-submit-card" key={t.id}>
            <div className="verification-title">
              <div>
                <h2>{t.title}</h2>
                <p className="muted">
                  {t.due_at ? "Due " + new Date(t.due_at).toLocaleString() : ""}{" "}
                  · {t.marks || 0} marks
                </p>
              </div>
              <span className="status-pill">{t.status}</span>
            </div>
            <p>{t.description}</p>
            {t.expected_output && (
              <p>
                <b>Expected output:</b> {t.expected_output}
              </p>
            )}
            <div className="submission-form">
              {ty.includes("TEXT") && (
                <label>
                  Submission Notes
                  <textarea
                    className="input"
                    value={v.text || ""}
                    onChange={(e) => field(t.id, "text", e.target.value)}
                  />
                </label>
              )}
              {ty.includes("LINK") && (
                <label>
                  Work Link
                  <input
                    className="input"
                    type="url"
                    value={v.link || ""}
                    onChange={(e) => field(t.id, "link", e.target.value)}
                  />
                </label>
              )}
              {ty.includes("REPOSITORY") && (
                <label>
                  Repository URL
                  <input
                    className="input"
                    type="url"
                    value={v.repositoryUrl || ""}
                    onChange={(e) =>
                      field(t.id, "repositoryUrl", e.target.value)
                    }
                  />
                </label>
              )}
              {ty.includes("VIDEO") && (
                <label>
                  Video URL
                  <input
                    className="input"
                    type="url"
                    value={v.videoUrl || ""}
                    onChange={(e) => field(t.id, "videoUrl", e.target.value)}
                  />
                </label>
              )}
              {ty.some((x) =>
                ["FILE", "DOCUMENT", "PRESENTATION", "VIDEO"].includes(x),
              ) && (
                <label>
                  Evidence File
                  <input
                    className="input"
                    type="file"
                    accept=".pdf,.docx,.pptx,.zip,.txt,.mp4"
                    onChange={(e) =>
                      setFiles((x) => ({
                        ...x,
                        [t.id]: e.target.files?.[0] || null,
                      }))
                    }
                  />
                </label>
              )}
            </div>
            <div className="form-actions">
              <button className="btn" onClick={() => submit(t)}>
                Submit Task
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

"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function InternTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    api("/intern/dashboard").then((data) => setTasks(data.tasks || [])).catch((error) => setErr(error.message));
  }, []);
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Weekly Tasks</h1>
          <p className="muted">View your released weekly assignments. Work submission and review are handled offline.</p>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      {tasks.map((task) => (
        <section className="card" key={task.id}>
          <div className="verification-title">
            <div><h2>{task.title}</h2><p className="muted">Weekly assignment</p></div>
            <span className="status-pill">{task.status}</span>
          </div>
          {task.description && <p>{task.description}</p>}
          {task.expected_output && <p><b>Expected output:</b> {task.expected_output}</p>}
        </section>
      ))}
      {!tasks.length && !err && <section className="card"><p className="muted">No released tasks are assigned to you.</p></section>}
    </main>
  );
}

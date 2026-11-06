"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
import TaskTemplates from "./TaskTemplates";
import Link from "next/link";
const types = [
  "TEXT",
  "LINK",
  "REPOSITORY",
  "DOCUMENT",
  "PRESENTATION",
  "VIDEO",
  "FILE",
];
export default function AdminTasksPage() {
  const [tasks, setTasks] = useState([]),
    [batches, setBatches] = useState([]),
    [domains, setDomains] = useState([]),
    [groups, setGroups] = useState([]),
    [f, setF] = useState({
      batchId: "",
      domainId: "",
      groupId: "",
      projectRole: "",
      title: "",
      description: "",
      expectedOutput: "",
      submissionTypes: ["REPOSITORY"],
      resources: "",
      releaseAt: "",
      dueAt: "",
      marks: 100,
    }),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [feedbackArea,setFeedbackArea]=useState("save");
  const load = () =>
    Promise.all([
      api("/admin/tasks"),
      api("/admin/batches"),
      api("/admin/domains"),
      api("/admin/groups"),
    ])
      .then(([t, b, d, g]) => {
        setTasks(t);
        setBatches(b);
        setDomains(d);
        setGroups(g);
        if (!f.batchId && b[0]) setF((x) => ({ ...x, batchId: b[0].id }));
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function control(t, action) {setFeedbackArea("control");
    setErr("");
    setMsg("");
    try {
      await api("/admin/tasks/" + t.id + "/" + action, { method: "POST", body: "{}" });
      setMsg(action === "publish" ? "Task published." : "Task " + action + "d.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function reschedule(t) {setFeedbackArea("reschedule");
    const value = prompt("New release date and time (YYYY-MM-DD HH:MM):");
    if (!value) return;
    const releaseAt = new Date(value.replace(" ", "T"));
    if (Number.isNaN(releaseAt.getTime())) return setErr("Enter the release time as YYYY-MM-DD HH:MM.");
    setErr("");
    try {
      await api("/admin/tasks/" + t.id, { method: "PATCH", body: JSON.stringify({ releaseAt: releaseAt.toISOString() }) });
      setMsg("Task rescheduled.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  function toggle(t) {
    setF((x) => ({
      ...x,
      submissionTypes: x.submissionTypes.includes(t)
        ? x.submissionTypes.filter((v) => v !== t)
        : [...x.submissionTypes, t],
    }));
  }
  async function save(e) {setFeedbackArea("save");
    e.preventDefault();
    try {
      await api("/admin/tasks", { method: "POST", body: JSON.stringify(f) });
      setMsg(
        "Weekly task scheduled. It will release automatically at the configured time.",
      );
      setF((x) => ({
        ...x,
        title: "",
        description: "",
        expectedOutput: "",
        resources: "",
        releaseAt: "",
        dueAt: "",
      }));
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Weekly Task Scheduler</h1><Link className="btn" href="/admin/task-plans">Bulk Weekly Planner · Confirm All</Link>
          <p className="muted">
            Configure tasks now; the server releases them automatically at the
            scheduled date and time.
          </p>
        </div>
      </div>
      <section className="card">{["save"].includes(feedbackArea)&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        <form onSubmit={save}>
          <div className="form-grid">
            <label>
              Batch
              <select
                className="input"
                required
                value={f.batchId}
                onChange={(e) =>
                  setF((x) => ({ ...x, batchId: e.target.value }))
                }
              >
                {batches.map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Domain (optional)
              <select
                className="input"
                value={f.domainId}
                onChange={(e) =>
                  setF((x) => ({ ...x, domainId: e.target.value }))
                }
              >
                <option value="">All domains</option>
                {domains.map((d) => (
                  <option value={d.id} key={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Group (optional)
              <select
                className="input"
                value={f.groupId}
                onChange={(e) =>
                  setF((x) => ({ ...x, groupId: e.target.value }))
                }
              >
                <option value="">All eligible groups</option>
                {groups
                  .filter((g) => !f.batchId || g.batch_id === f.batchId)
                  .map((g) => (
                    <option value={g.id} key={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>Project role (optional)<select className="input" value={f.projectRole} onChange={e=>setF(x=>({...x,projectRole:e.target.value}))} disabled={!f.groupId}><option value="">All team members</option>{["Frontend Developer","Backend Developer","Full Stack Developer","UI/UX Designer","QA Tester","DevOps Engineer","Database Developer","Team Lead"].map(role=><option key={role} value={role}>{role}</option>)}</select><small className="muted">Choose a team above to target a specific project role.</small></label>
            <label>
              Marks
              <input
                className="input"
                type="number"
                min="0"
                value={f.marks}
                onChange={(e) =>
                  setF((x) => ({ ...x, marks: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              Release Date & Time
              <input
                className="input"
                type="datetime-local"
                required
                value={f.releaseAt}
                onChange={(e) =>
                  setF((x) => ({ ...x, releaseAt: e.target.value }))
                }
              />
            </label>
            <label>
              Due Date & Time
              <input
                className="input"
                type="datetime-local"
                required
                value={f.dueAt}
                onChange={(e) => setF((x) => ({ ...x, dueAt: e.target.value }))}
              />
            </label>
          </div>
          <label>
            Task Title
            <input
              className="input"
              required
              value={f.title}
              onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))}
            />
          </label>
          <label>
            Description
            <textarea
              className="input work-textarea"
              value={f.description}
              onChange={(e) =>
                setF((x) => ({ ...x, description: e.target.value }))
              }
            />
          </label>
          <label>
            Expected Output
            <textarea
              className="input"
              value={f.expectedOutput}
              onChange={(e) =>
                setF((x) => ({ ...x, expectedOutput: e.target.value }))
              }
            />
          </label>
          <label>
            Resources / References
            <textarea
              className="input"
              value={f.resources}
              onChange={(e) =>
                setF((x) => ({ ...x, resources: e.target.value }))
              }
            />
          </label>
          <h3>Allowed Submission Types</h3>
          <div className="deliverable-picks">
            {types.map((t) => (
              <label key={t}>
                <input
                  type="checkbox"
                  checked={f.submissionTypes.includes(t)}
                  onChange={() => toggle(t)}
                />
                {t.replace("_", " ")}
              </label>
            ))}
          </div>
          <button className="btn">Schedule Weekly Task</button>
        </form>
      </section>
      <TaskTemplates domains={domains} />
      <section className="card">
        <h2>Task Release Queue</h2>{["control","reschedule"].includes(feedbackArea)&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        {tasks.map((t) => (
          <div className="status-row" key={t.id}>
            <span>
              <b>{t.title}</b>
              <br />
              <small>
                Release:{" "}
                {t.release_at ? new Date(t.release_at).toLocaleString() : "—"} ·
                Due: {t.due_at ? new Date(t.due_at).toLocaleString() : "—"}
              </small>
              <br />
              <small>{(t.submission_types || []).join(", ")}</small>
            </span>
            <span className="status-pill">{t.status}</span>
            <div className="action-row">
              {t.status === "SCHEDULED" && <button type="button" className="btn secondary" onClick={() => control(t, "pause")}>Pause</button>}
              {t.status === "PAUSED" && <button type="button" className="btn secondary" onClick={() => control(t, "resume")}>Resume</button>}
              {["SCHEDULED", "PAUSED"].includes(t.status) && <button type="button" className="btn secondary" onClick={() => reschedule(t)}>Reschedule</button>}
              {["SCHEDULED", "PAUSED"].includes(t.status) && <button type="button" className="btn" onClick={() => control(t, "publish")}>Publish Now</button>}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
export default function MentorDashboardPage() {
  const [d, setD] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [taskEval, setTaskEval] = useState(null),
    [plans,setPlans]=useState([]),[planError,setPlanError]=useState("");
  const load = async () => {
    setErr("");
    try {
      const x=await api("/mentor/dashboard");
      setD(x);
    } catch(e) {setErr("Mentor dashboard: "+e.message);}
    try{setPlans(await api("/mentor/task-plans"));setPlanError("");}catch(e){setPlanError(e.message);}
    // Initial assessment is MCQ-only and scored automatically; do not call legacy written-answer evaluation API.
  };
  useEffect(() => {
    load();
  }, []);
  async function evaluate(s) {
    try {
      const x = await api("/mentor/submissions/" + s.id);
      setTaskEval({
        ...x,
        decision: "APPROVED",
        feedback: "",
        marks: "",
        rubricScores: {},
        reworkInstructions: "",
        reworkDueAt: "",
      });
    } catch (e) {
      setErr(e.message);
    }
  }
  async function saveTaskEval() {
    try {
      const x = taskEval,
        criteria = x.rubric_criteria || [];
      const body = {
        decision: x.decision,
        feedback: x.feedback,
        reworkInstructions: x.reworkInstructions,
        reworkDueAt: x.reworkDueAt,
      };
      if (criteria.length)
        body.rubricScores = criteria.map((c) => ({
          criterionId: c.id,
          awarded: Number(x.rubricScores[c.id] || 0),
        }));
      else body.marks = Number(x.marks);
      await api("/mentor/submissions/" + x.id + "/evaluate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMsg(
        x.decision === "REWORK_REQUIRED"
          ? "Rework requested."
          : x.decision === "REJECTED"
            ? "Task rejected."
            : "Task approved.",
      );
      setTaskEval(null);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  if (!d)
    return (
      <main className="wrap">
        {err ? (
          <p className="error">{err}</p>
        ) : (
          <p>Loading mentor workspace…</p>
        )}
      </main>
    );
  return (
    <main className="wrap">
      <div className="verification-title">
        <h1>Mentor Dashboard</h1>
        <div className="action-row">
          <a className="btn" href="/mentor/tasks">Create / Edit Tasks</a><a className="btn secondary" href="/mentor/task-schedule">Task Schedule</a><a className="btn secondary" href="/mentor/reports">Fortnight Reports</a><a className="btn secondary" href="/mentor/final-submissions">Final Project Reviews</a><a className="btn secondary" href="/mentor/final-evaluations">
            Final Evaluations
          </a>
          <a className="btn secondary" href="/mentor/operations">
            Intern Operations
          </a>
        </div>
      </div>
      <p className="muted">
        Assign weekly tasks and record fortnight marks and comments from offline reviews.
      </p>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <div className="form-grid" style={{margin:"20px 0",gap:12}}>
        <section className="card"><p className="muted">My Task Plans</p><h2>{plans.length}</h2><a href="/mentor/tasks">Manage weekly tasks</a></section>
        <section className="card"><p className="muted">Scheduled Plans</p><h2>{plans.filter(p=>p.status==="CONFIRMED").length}</h2><a href="/mentor/task-schedule">View scheduled tasks</a></section>
        <section className="card"><p className="muted">Pending Evaluations</p><h2>{d.submissions?.length||0}</h2><a href="/mentor/final-evaluations">Final evaluations</a></section>
      </div>
      <section className="card" style={{marginBottom:16}}>
        <div className="workflow-row" style={{alignItems:"center",justifyContent:"space-between"}}><h2>Weekly Task Plans</h2><a className="btn secondary" href="/mentor/task-schedule">View Full Schedule</a></div>
        {planError&&<p className="error">Task plans unavailable: {planError}</p>}
        {!planError&&!plans.length&&<p className="muted">No weekly task plans created yet. Start by assigning tasks to an intern.</p>}
        {plans.slice(0,6).map(p=><div className="workflow-row" key={p.id} style={{padding:"12px 0",borderBottom:"1px solid #e5ece8",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong>{p.intern_name}</strong><div className="muted">{p.project_name||"Project not assigned"} · {p.college_name||"College unavailable"} · {p.batch_name||"Batch unavailable"}</div><small>{p.task_count||0} weeks · {p.status==="CONFIRMED"?"Confirmed schedule":"Draft"}</small></div><a className="btn secondary" href={"/mentor/tasks?plan="+encodeURIComponent(p.id)}>Open This Plan</a></div>)}
      </section>
      <div className="intern-sections">
        <section className="card">
          <h2>Pending Task Evaluations</h2>
          {!d.submissions.length ? (
            <p className="muted">No submissions awaiting evaluation.</p>
          ) : (
            d.submissions.map((s) => (
              <div className="workflow-row" key={s.id}>
                <div>
                  <b>{s.title}</b>
                  <div>{s.full_name}</div>
                </div>
                <button className="btn" onClick={() => evaluate(s)}>
                  Evaluate
                </button>
              </div>
            ))
          )}
        </section>
      </div>
      {taskEval && (
        <div className="modal-backdrop" onMouseDown={() => setTaskEval(null)}>
          <section
            className="modal-card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="verification-title">
              <div>
                <h2>{taskEval.title}</h2>
                <p className="muted">
                  {taskEval.full_name} · Attempt {taskEval.attempt}
                </p>
              </div>
              <button className="icon-close" onClick={() => setTaskEval(null)}>
                ×
              </button>
            </div>
            <p>
              {taskEval.content?.text ||
                taskEval.content?.repositoryUrl ||
                taskEval.content?.link ||
                "Submission evidence attached."}
            </p>
            {taskEval.file_name && (
              <button type="button" className="btn secondary" onClick={() => apiBlob("/mentor/submissions/" + taskEval.id + "/file").then((b) => { const u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = taskEval.file_name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 10000); })}>
                Download {taskEval.file_name}
              </button>
            )}
            {(taskEval.rubric_criteria || []).length ? (
              <div className="rubric-eval">
                <h3>{taskEval.rubric_name}</h3>
                {taskEval.rubric_criteria.map((c) => (
                  <label key={c.id}>
                    {c.name} <small>max {c.max_marks}</small>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max={c.max_marks}
                      value={taskEval.rubricScores[c.id] || ""}
                      onChange={(e) =>
                        setTaskEval((x) => ({
                          ...x,
                          rubricScores: {
                            ...x.rubricScores,
                            [c.id]: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <label>
                Marks / {taskEval.task_marks || 100}
                <input
                  className="input"
                  type="number"
                  min="0"
                  max={taskEval.task_marks || 100}
                  value={taskEval.marks}
                  onChange={(e) =>
                    setTaskEval((x) => ({ ...x, marks: e.target.value }))
                  }
                />
              </label>
            )}
            <label>
              Feedback
              <textarea
                className="input"
                required
                value={taskEval.feedback}
                onChange={(e) =>
                  setTaskEval((x) => ({ ...x, feedback: e.target.value }))
                }
              />
            </label>
            <label>
              Decision
              <select
                className="input"
                value={taskEval.decision}
                onChange={(e) =>
                  setTaskEval((x) => ({ ...x, decision: e.target.value }))
                }
              >
                <option value="APPROVED">Approve</option>
                <option value="REWORK_REQUIRED">Request Rework</option>
                <option value="REJECTED">Reject</option>
              </select>
            </label>
            {taskEval.decision === "REWORK_REQUIRED" && (
              <>
                <label>
                  Rework Instructions
                  <textarea
                    className="input"
                    value={taskEval.reworkInstructions}
                    onChange={(e) =>
                      setTaskEval((x) => ({
                        ...x,
                        reworkInstructions: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Rework Due
                  <input
                    className="input"
                    type="datetime-local"
                    value={taskEval.reworkDueAt}
                    onChange={(e) =>
                      setTaskEval((x) => ({
                        ...x,
                        reworkDueAt: e.target.value,
                      }))
                    }
                  />
                </label>
              </>
            )}
            <div className="form-actions">
              <button className="btn" onClick={saveTaskEval}>
                Save Evaluation
              </button>
              <button
                className="btn secondary"
                onClick={() => setTaskEval(null)}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

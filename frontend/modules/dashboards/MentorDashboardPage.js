"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
import {MentorQueue,ReviewCard,InternHealthCard,Skeleton,EmptyState} from "@/shared/mentor/ReviewComponents";
export default function MentorDashboardPage() {
  const [d, setD] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [taskEval, setTaskEval] = useState(null),
    [plans,setPlans]=useState([]),[planError,setPlanError]=useState(""),[teamMembers,setTeamMembers]=useState({});
  const load = async () => {
    setErr("");
    try {
      const x=await api("/mentor/dashboard");
      setD(x);
      const entries=await Promise.all((x.groups||[]).map(async(g)=>{try{return [g.id,await api("/mentor/groups/"+g.id+"/members")];}catch{return [g.id,[]];}}));
      setTeamMembers(Object.fromEntries(entries));
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
      <main className="wrap mentor-dashboard-modern">
        {err ? (
          <p className="error">{err}</p>
        ) : (
          <Skeleton/>
        )}
      </main>
    );
  return (
    <main className="wrap mentor-dashboard-modern">
      <header className="mentor-dash-heading"><div><h1>Mentor workspace</h1><p className="muted">Manage weekly plans, review assigned projects and track evaluations.</p></div><a className="btn" href="/mentor/tasks">Create / Edit Tasks</a></header>
      <MentorQueue count={d.submissions?.length||0} links={[{label:"Review task submissions",href:"/mentor#task-reviews"},{label:"Final submissions",href:"/mentor/final-submissions"},{label:"Face approvals",href:"/mentor/face-approvals"},{label:"Intern operations",href:"/mentor/operations"}]}/>
      <nav className="card mentor-dash-quick" aria-label="Mentor quick actions"><div><h2>Quick actions</h2><p className="muted">Access your most-used mentor workspaces.</p></div><div className="mentor-dash-actions"><a className="btn secondary" href="/mentor/task-schedule">Task Schedule</a><a className="btn secondary" href="/mentor/reports">Fortnight Reports</a><a className="btn secondary" href="/mentor/klu-fortnight">KLU Fortnight Reports</a><a className="btn secondary" href="/mentor/final-submissions">Final Project Reviews</a><a className="btn secondary" href="/mentor/final-evaluations">Final Evaluations</a><a className="btn secondary" href="/mentor/operations">Intern Operations</a><a className="btn secondary" href="/mentor/profile">My Profile / Signature</a></div></nav>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <div className="mentor-dash-metrics">
        <a className="card mentor-dash-metric" href="/mentor/tasks"><span>My task plans</span><strong>{plans.length}</strong><small>Manage weekly tasks →</small></a>
        <a className="card mentor-dash-metric" href="/mentor/task-schedule"><span>Scheduled plans</span><strong>{plans.filter(p=>p.status==="CONFIRMED").length}</strong><small>View scheduled tasks →</small></a>
        <a className="card mentor-dash-metric" href="/mentor/final-evaluations"><span>Pending task evaluations</span><strong>{d.submissions?.length||0}</strong><small>Review evaluations →</small></a>
      </div>
      <section className="card mentor-dash-section">
        <div className="workflow-row" style={{alignItems:"center",justifyContent:"space-between"}}><h2>Weekly task plans</h2><a className="btn secondary" href="/mentor/task-schedule">View Full Schedule</a></div>
        {planError&&<p className="error">Task plans unavailable: {planError}</p>}
        {!planError&&!plans.length&&<p className="muted">No weekly task plans created yet. Start by assigning tasks to an intern.</p>}
        {plans.slice(0,6).map(p=><div className="workflow-row" key={p.id} style={{padding:"12px 0",borderBottom:"1px solid #e5ece8",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong>{p.intern_name}</strong><div className="muted">{p.project_name||"Project not assigned"} · {p.college_name||"College unavailable"} · {p.batch_name||"Batch unavailable"}</div><small>{p.task_count||0} weeks · {p.status==="CONFIRMED"?"Confirmed schedule":"Draft"}</small></div><a className="btn secondary" href={"/mentor/tasks?plan="+encodeURIComponent(p.id)}>Open This Plan</a></div>)}
      </section>
      <section className="card mentor-dash-section">
        <h2>Project team members</h2>
        <p className="muted">Every mentor assigned to a project can see its complete team. Directly assigned interns are marked separately.</p>
        {(d.groups||[]).map(g=><InternHealthCard key={g.id} name={g.name} members={(teamMembers[g.id]||[]).map(m=>m.full_name+(m.is_my_intern?" (My intern)":" (Teammate)")).join(" · ")}/>) }
        {!d.groups?.length&&<EmptyState title="No assigned projects" description="Your assigned project teams will appear here when available."/>}
      </section>
      <div id="task-reviews" className="mentor-dash-evaluations">
        <section className="card mentor-dash-section">
          <h2>Pending task evaluations</h2>
          {!d.submissions.length ? (
            <EmptyState title="Review queue clear" description="No task submissions are currently awaiting evaluation."/>
          ) : (
            d.submissions.map(s=><ReviewCard key={s.id} title={s.title} student={s.full_name} onReview={()=>evaluate(s)}/>)
          )}
        </section>
      </div>
      <style jsx global>{` .mentor-dashboard-modern{max-width:1240px;width:100%;margin:0 auto;padding:32px 20px 64px;box-sizing:border-box;color:#111;display:block;clear:both}.mentor-dashboard-modern .mentor-dash-heading{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:20px}.mentor-dashboard-modern .mentor-dash-heading h1{font-size:clamp(26px,3vw,34px);margin:0 0 8px;color:#111}.mentor-dashboard-modern .mentor-dash-heading p{margin:0;font-size:14px}.mentor-dashboard-modern .card{border-radius:20px;border:1px solid #dce7e2;box-shadow:0 5px 18px #122c2010}.mentor-dashboard-modern .mentor-dash-quick{padding:22px 24px;margin-bottom:18px}.mentor-dashboard-modern .mentor-dash-quick h2{font-size:20px;margin:0 0 5px}.mentor-dashboard-modern .mentor-dash-quick p{font-size:13px;margin:0 0 16px}.mentor-dashboard-modern .mentor-dash-actions{display:flex;flex-wrap:wrap;gap:10px}.mentor-dashboard-modern .mentor-dash-actions .btn{min-height:44px;border-radius:999px}.mentor-dashboard-modern .mentor-dash-quick{display:block;clear:both}.mentor-dashboard-modern .mentor-dash-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:18px 0}.mentor-dashboard-modern .mentor-dash-metric{min-width:0;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;padding:22px 24px;text-decoration:none;color:#111;min-height:145px;transition:transform .15s ease,box-shadow .15s ease}.mentor-dashboard-modern .mentor-dash-metric:hover{transform:translateY(-2px);box-shadow:0 8px 24px #122c2020}.mentor-dashboard-modern .mentor-dash-metric:focus-visible{outline:3px solid #2563eb;outline-offset:3px}.mentor-dashboard-modern .mentor-dash-metric span{font-size:13px;font-weight:700}.mentor-dashboard-modern .mentor-dash-metric strong{font-size:32px;line-height:1;color:#111}.mentor-dashboard-modern .mentor-dash-metric small{font-size:12px;color:#4c5375;font-weight:650}.mentor-dashboard-modern .mentor-dash-section{display:block;width:100%;box-sizing:border-box;padding:22px 24px;margin-bottom:18px}.mentor-dashboard-modern .mentor-dash-evaluations{display:block;width:100%}.mentor-dashboard-modern .mentor-dash-section h2{font-size:20px;margin:0 0 12px}.mentor-dashboard-modern .mentor-dash-section .workflow-row{padding:16px 0;gap:14px}.mentor-dashboard-modern .mentor-dash-section .workflow-row .muted{font-size:13px;line-height:1.55;margin-top:5px}.mentor-dashboard-modern .btn{border-radius:999px!important;min-height:44px}.mentor-dashboard-modern .mentor-dash-heading>.btn{white-space:nowrap}.mentor-dashboard-modern .mentor-dash-metrics>*{min-width:0}.mentor-dashboard-modern .mentor-dash-heading h1{line-height:1.25}.mentor-dashboard-modern .mentor-dash-actions .btn{display:inline-flex;align-items:center;justify-content:center;white-space:normal;text-align:center}@media(max-width:800px){.mentor-dashboard-modern .mentor-dash-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.mentor-dashboard-modern{padding-top:18px}.mentor-dashboard-modern .mentor-dash-heading{flex-direction:column;align-items:stretch}.mentor-dashboard-modern .mentor-dash-heading>.btn{align-self:flex-start}.mentor-dashboard-modern .mentor-dash-metrics{grid-template-columns:1fr;gap:12px}.mentor-dashboard-modern .mentor-dash-metric{min-height:120px}.mentor-dashboard-modern .mentor-dash-quick,.mentor-dashboard-modern .mentor-dash-section{padding:16px}.mentor-dashboard-modern .mentor-dash-actions{display:grid;grid-template-columns:1fr 1fr}.mentor-dashboard-modern .mentor-dash-actions .btn{white-space:normal;text-align:center}.mentor-dashboard-modern .mentor-dash-section .workflow-row{align-items:stretch;flex-direction:column}.mentor-dashboard-modern .mentor-dash-section .workflow-row .btn{align-self:flex-start}} `}</style>
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

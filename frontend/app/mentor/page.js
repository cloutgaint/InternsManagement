"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
export default function Page() {
  const [d, setD] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [assess, setAssess] = useState([]),
    [attempt, setAttempt] = useState(null),
    [scores, setScores] = useState({});
  const load = () =>
    Promise.all([
      api("/mentor/dashboard"),
      api("/mentor/assessment-evaluations"),
    ])
      .then(([x, a]) => {
        setD(x);
        setAssess(a);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function evaluate(s) {
    try {
      const x = await api("/mentor/submissions/" + s.id);
      const marks = Number(
        window.prompt("Marks / " + (x.task_marks || 100) + ":"),
      );
      if (!Number.isFinite(marks)) return;
      const feedback = window.prompt("Feedback:") || "";
      const rework = window.confirm("Does this submission require rework?");
      let body = {
        marks,
        feedback,
        decision: rework ? "REWORK_REQUIRED" : "APPROVED",
      };
      if (rework) {
        body.reworkInstructions = window.prompt("Rework instructions:") || "";
        body.reworkDueAt =
          window.prompt("Rework due date/time (YYYY-MM-DDTHH:MM):") || "";
      }
      await api("/mentor/submissions/" + s.id + "/evaluate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMsg(rework ? "Rework requested." : "Task approved.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function review(g) {
    const periodNo = prompt("Review period number:");
    if (!periodNo) return;
    const groupMarks = prompt("Group marks:");
    if (groupMarks === null) return;
    const feedback = prompt("Review feedback:") || "";
    try {
      await api("/mentor/reviews", {
        method: "POST",
        body: JSON.stringify({
          groupId: g.id,
          periodNo: Number(periodNo),
          reviewDate: new Date().toISOString().slice(0, 10),
          status: "PUBLISHED",
          progress: "Reviewed",
          domainReview: "Reviewed",
          presentationReview: "Reviewed",
          groupMarks: Number(groupMarks),
          feedback,
          actionItems: "",
          nextExpectations: "",
        }),
      });
      setMsg("Fortnight review published successfully.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function finalEval(g) {
    try {
      const members = await api("/mentor/groups/" + g.id + "/members");
      if (!members.length) throw new Error("No active members in this group.");
      const names = members
        .map((m, i) => i + 1 + ". " + m.full_name)
        .join("\n");
      const pick = Number(prompt("Choose intern number:\n" + names)) - 1;
      if (!members[pick]) return;
      const groupMarks = Number(prompt("Group marks:"));
      const individualMarks = Number(prompt("Individual marks:"));
      const mentorFeedback = prompt("Final feedback:") || "";
      const recommendation =
        prompt("Recommendation (COMPLETED / NEEDS_WORK):") || "COMPLETED";
      await api("/mentor/final-evaluations", {
        method: "POST",
        body: JSON.stringify({
          groupId: g.id,
          internId: members[pick].id,
          groupMarks,
          individualMarks,
          mentorFeedback,
          recommendation,
        }),
      });
      setMsg("Final evaluation submitted for Admin completion approval.");
    } catch (e) {
      setErr(e.message);
    }
  }
  async function openAttempt(x) {
    try {
      setAttempt(await api("/mentor/assessment-evaluations/" + x.attempt_id));
      setScores({});
    } catch (e) {
      setErr(e.message);
    }
  }
  async function evalAnswer(a) {
    const rs = a.rubric_criteria || [];
    let body = { feedback: scores[a.id + "_feedback"] || "" };
    if (rs.length)
      body.rubricScores = rs.map((c) => ({
        criterionId: c.id,
        awarded: Number(scores[a.id + "_" + c.id] ?? 0),
      }));
    else body.score = Number(scores[a.id + "_score"] ?? 0);
    try {
      await api("/mentor/assessment-answers/" + a.id + "/evaluate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMsg("Written answer evaluated.");
      setAttempt(await api("/mentor/assessment-evaluations/" + attempt.id));
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
      <h1>Mentor Dashboard</h1>
      <p className="muted">
        Manage assigned groups, evaluate weekly work, publish fortnight reviews
        and submit final evaluations.
      </p>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <section className="card workflow-section">
        <h2>Assessment Evaluation</h2>
        <p className="muted">
          Review descriptive answers only for interns assigned to your groups.
        </p>
        {!assess.length ? (
          <p className="muted">No assessment answers awaiting review.</p>
        ) : (
          assess.map((x) => (
            <div className="workflow-row" key={x.attempt_id}>
              <div>
                <b>{x.full_name}</b>
                <div className="muted">
                  {x.assessment_name} · {x.pending_manual} written answer(s)
                  pending
                </div>
              </div>
              <button className="btn" onClick={() => openAttempt(x)}>
                Evaluate
              </button>
            </div>
          ))
        )}
      </section>
      <div className="intern-sections">
        <section className="card">
          <h2>Assigned Groups</h2>
          {!d.groups.length ? (
            <p className="muted">No groups assigned.</p>
          ) : (
            d.groups.map((g) => (
              <div className="workflow-row" key={g.id}>
                <div>
                  <b>{g.name}</b>
                  <div className="muted">{g.status}</div>
                </div>
                <div>
                  <button className="btn" onClick={() => review(g)}>
                    Fortnight Review
                  </button>{" "}
                  <button
                    className="btn secondary"
                    onClick={() => finalEval(g)}
                  >
                    Final Evaluation
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
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
      {attempt && (
        <div className="modal-backdrop" onMouseDown={() => setAttempt(null)}>
          <section
            className="modal-card assessment-review"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="verification-title">
              <div>
                <h2>{attempt.assessment_name}</h2>
                <p className="muted">{attempt.full_name}</p>
              </div>
              <button className="icon-close" onClick={() => setAttempt(null)}>
                ×
              </button>
            </div>
            {attempt.answers
              .filter((a) => ["SHORT_TEXT", "DESCRIPTIVE"].includes(a.type))
              .map((a) => (
                <div className="review-answer" key={a.id}>
                  <b>{a.question}</b>
                  <p>
                    {typeof a.answer === "string"
                      ? a.answer
                      : JSON.stringify(a.answer)}
                  </p>
                  <p className="muted">
                    Marking guide: {a.marking_guide || "Not provided"}
                  </p>
                  {a.manual_score != null ? (
                    <p className="success">
                      Evaluated: {a.manual_score} / {a.marks}
                      {a.feedback ? " · " + a.feedback : ""}
                    </p>
                  ) : (
                    <>
                      {(a.rubric_criteria || []).length ? (
                        <div className="rubric-eval">
                          <b>{a.rubric_name}</b>
                          {a.rubric_criteria.map((c) => (
                            <label key={c.id}>
                              {c.name}{" "}
                              <small>
                                ({c.weight}% · max {c.max_marks})
                              </small>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                max={c.max_marks}
                                value={scores[a.id + "_" + c.id] ?? ""}
                                onChange={(e) =>
                                  setScores((x) => ({
                                    ...x,
                                    [a.id + "_" + c.id]: e.target.value,
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      ) : (
                        <label>
                          Score / {a.marks}
                          <input
                            className="input"
                            type="number"
                            min="0"
                            max={a.marks}
                            value={scores[a.id + "_score"] ?? ""}
                            onChange={(e) =>
                              setScores((x) => ({
                                ...x,
                                [a.id + "_score"]: e.target.value,
                              }))
                            }
                          />
                        </label>
                      )}
                      <label>
                        Feedback
                        <textarea
                          className="input"
                          value={scores[a.id + "_feedback"] || ""}
                          onChange={(e) =>
                            setScores((x) => ({
                              ...x,
                              [a.id + "_feedback"]: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <button className="btn" onClick={() => evalAnswer(a)}>
                        Save Evaluation
                      </button>
                    </>
                  )}
                </div>
              ))}
          </section>
        </div>
      )}
    </main>
  );
}

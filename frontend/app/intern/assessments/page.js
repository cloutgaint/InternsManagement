"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
export default function Page() {
  const [list, setList] = useState([]),
    [exam, setExam] = useState(null),
    [answers, setAnswers] = useState({}),
    [idx, setIdx] = useState(0),
    [left, setLeft] = useState(0),
    [err, setErr] = useState(""),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/intern/assessments")
      .then(setList)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!exam) return;
    const tick = () => {
      const n = Math.max(
        0,
        Math.floor((new Date(exam.deadline) - Date.now()) / 1000),
      );
      setLeft(n);
      if (n === 0) submit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [exam]);
  async function start(a) {
    try {
      setBusy(true);
      await api("/intern/assessments/" + a.id + "/start", {
        method: "POST",
        body: "{}",
      });
      const x = await api("/intern/assessments/" + a.id + "/questions");
      setExam({ ...x, assessment: a });
      setAnswers({});
      setIdx(0);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  function setAnswer(q, v) {
    setAnswers((x) => ({ ...x, [q.id]: v }));
  }
  async function submit(auto = false) {
    if (!exam || busy) return;
    if (
      !auto &&
      !window.confirm(
        "Submit this assessment? You cannot change answers after submission.",
      )
    )
      return;
    try {
      setBusy(true);
      const out = await api(
        "/intern/assessments/" + exam.assessment.id + "/submit",
        {
          method: "POST",
          body: JSON.stringify({
            attemptId: exam.attemptId,
            answers: exam.questions.map((q) => ({
              questionId: q.id,
              answer: answers[q.id] ?? null,
            })),
          }),
        },
      );
      setExam(null);
      setMsg(
        out.manualEvaluationPending
          ? "Assessment submitted. Written answers are awaiting evaluation."
          : "Assessment submitted and scored.",
      );
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (exam) {
    const q = exam.questions[idx],
      answered = Object.keys(answers).filter(
        (k) => answers[k] !== "" && answers[k] != null,
      ).length;
    const section = exam.sections.find((s) =>
      (s.question_ids || []).includes(q?.id),
    );
    return (
      <main className="wrap exam-shell">
        <div className="exam-top">
          <div>
            <span className="eyebrow">ASSESSMENT IN PROGRESS</span>
            <h1>{exam.assessment.name}</h1>
            <p className="muted">
              {section?.name || "Assessment"} · Question {idx + 1} of{" "}
              {exam.questions.length}
            </p>
          </div>
          <div className={"exam-timer " + (left < 300 ? "urgent" : "")}>
            {String(Math.floor(left / 60)).padStart(2, "0")}:
            {String(left % 60).padStart(2, "0")}
          </div>
        </div>
        <div className="exam-layout">
          <aside className="card exam-nav">
            <b>Questions</b>
            <div className="question-palette">
              {exam.questions.map((x, i) => (
                <button
                  className={
                    (i === idx ? "current " : "") +
                    (answers[x.id] != null && answers[x.id] !== ""
                      ? "answered"
                      : "")
                  }
                  onClick={() => setIdx(i)}
                  key={x.id}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <small>
              {answered}/{exam.questions.length} answered
            </small>
          </aside>
          <section className="card exam-question">
            <div className="question-tags">
              <span>{q.type}</span>
              <span>{q.marks} marks</span>
              <span>{q.difficulty}</span>
            </div>
            <h2>{q.question}</h2>
            {q.type === "MCQ" &&
              (q.options || []).map((o) => (
                <label className="exam-option" key={o}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === o}
                    onChange={() => setAnswer(q, o)}
                  />
                  <span>{o}</span>
                </label>
              ))}
            {q.type === "TRUE_FALSE" &&
              ["True", "False"].map((o) => (
                <label className="exam-option" key={o}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === o}
                    onChange={() => setAnswer(q, o)}
                  />
                  <span>{o}</span>
                </label>
              ))}
            {q.type === "MULTI_SELECT" &&
              (q.options || []).map((o) => {
                const vals = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                return (
                  <label className="exam-option" key={o}>
                    <input
                      type="checkbox"
                      checked={vals.includes(o)}
                      onChange={(e) =>
                        setAnswer(
                          q,
                          e.target.checked
                            ? [...vals, o]
                            : vals.filter((v) => v !== o),
                        )
                      }
                    />
                    <span>{o}</span>
                  </label>
                );
              })}
            {q.type === "SHORT_TEXT" && (
              <input
                className="input"
                value={answers[q.id] || ""}
                onChange={(e) => setAnswer(q, e.target.value)}
                placeholder="Enter your answer"
              />
            )}
            {q.type === "DESCRIPTIVE" && (
              <textarea
                className="input exam-descriptive"
                value={answers[q.id] || ""}
                onChange={(e) => setAnswer(q, e.target.value)}
                placeholder="Write your answer clearly…"
              />
            )}
            <div className="exam-actions">
              <button
                className="btn secondary"
                disabled={idx === 0}
                onClick={() => setIdx((i) => i - 1)}
              >
                Previous
              </button>
              {idx < exam.questions.length - 1 ? (
                <button className="btn" onClick={() => setIdx((i) => i + 1)}>
                  Save & Next
                </button>
              ) : (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => submit(false)}
                >
                  Submit Assessment
                </button>
              )}
            </div>
          </section>
        </div>
      </main>
    );
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>My Assessments</h1>
          <p className="muted">
            Start available assessments and complete them within the configured
            time.
          </p>
        </div>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <section className="card workflow-section">
        {list.length ? (
          list.map((a) => (
            <div className="workflow-row" key={a.id}>
              <div>
                <b>{a.name}</b>
                <div className="muted">
                  {a.duration_minutes} minutes · {a.attempt_count} attempt(s)
                  {a.window_end
                    ? " · closes " + new Date(a.window_end).toLocaleString()
                    : ""}
                </div>
              </div>
              <div className="action-row">
                <span className="status-pill">
                  {a.attempt_status || "AVAILABLE"}
                </span>
                {!["PENDING_EVALUATION", "EVALUATED"].includes(
                  a.attempt_status,
                ) && (
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => start(a)}
                  >
                    Start Assessment
                  </button>
                )}
                {a.attempt_status === "PENDING_EVALUATION" && (
                  <span className="muted">Written answers under review</span>
                )}
                {a.attempt_status === "EVALUATED" && (
                  <b>Score: {a.total_score}</b>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No assessments are currently available.</p>
        )}
      </section>
    </main>
  );
}

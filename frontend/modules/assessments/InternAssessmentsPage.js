"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/shared/api/client";
function formatTimeTaken(startedAt, submittedAt) {
  if (!startedAt || !submittedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(submittedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const seconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${seconds % 60} sec` : `${seconds} sec`;
}
export default function InternAssessmentsPage() {
  const submittingRef=useRef(false);
  const [list, setList] = useState([]),
    [exam, setExam] = useState(null),
    [answers, setAnswers] = useState({}),
    [idx, setIdx] = useState(0),
    [left, setLeft] = useState(0),
    [err, setErr] = useState(""),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false),
    [retryReasons, setRetryReasons] = useState({});
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
      if (n === 0 && !submittingRef.current) submit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [exam]);
  async function start(a) {
    setErr("");setMsg("");
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
  async function requestRetry(assessment) {
    const reason = String(retryReasons[assessment.id] || "").trim();
    if (!reason) return setErr("Enter a reason for requesting a retry.");
    setErr(""); setMsg("");
    try {
      setBusy(true);
      await api("/intern/assessments/" + assessment.id + "/retry-request", {method:"POST",body:JSON.stringify({reason})});
      setMsg("Retry request submitted. Wait for Admin approval before rewriting the assessment.");
      setRetryReasons(current => ({...current,[assessment.id]:""}));
      await load();
    } catch(e) { setErr(e.message); } finally { setBusy(false); }
  }
  function canStart(assessment) {
    if (!["PUBLISHED", "ACTIVE"].includes(assessment.status) && !assessment.approved_retry_available) return false;
    const history = assessment.attempt_history || [];
    const inProgress = history.some((attempt) => attempt.status === "IN_PROGRESS");
    const withinWindow =
      (!assessment.window_start || new Date(assessment.window_start) <= new Date()) &&
      (!assessment.window_end || new Date(assessment.window_end) > new Date());
    return assessment.approved_retry_available || (withinWindow && (inProgress || history.length < Number(assessment.attempt_count || 1)));
  }
  // Optional integrity signal (Blueprint 7.1): leaving the tab is logged, never blocked.
  useEffect(() => {
    if (!exam?.assessment?.id) return;
    const report = () => {
      if (document.hidden) api("/intern/assessments/" + exam.assessment.id + "/tab-switch", { method: "POST", body: "{}" }).catch(() => {});
    };
    document.addEventListener("visibilitychange", report);
    return () => document.removeEventListener("visibilitychange", report);
  }, [exam?.assessment?.id]);
  function setAnswer(q, v) {
    setAnswers((x) => ({ ...x, [q.id]: v }));
  }
  async function submit(auto = false) {
    if (!exam || submittingRef.current) return;
    if (
      !auto &&
      !window.confirm(
        "Submit this assessment? You cannot change answers after submission.",
      )
    )
      return;
    try {
      submittingRef.current=true;
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
      submittingRef.current=false;
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
            {err&&<p className="error" role="alert">{err}</p>}
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
            {["CASE_STUDY", "CODING_PRACTICAL", "WRITING_SAMPLE"].includes(q.type) && (
              <textarea
                className="input exam-descriptive"
                value={answers[q.id] || ""}
                onChange={(e) => setAnswer(q, e.target.value)}
                placeholder={q.type === "CODING_PRACTICAL" ? "Enter code, approach, output, or repository details…" : "Write your response clearly…"}
              />
            )}
            {q.type === "PORTFOLIO_LINK" && (
              <input
                className="input"
                type="url"
                value={answers[q.id] || ""}
                onChange={(e) => setAnswer(q, e.target.value)}
                placeholder="https://example.com/your-work"
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
      <section className="card workflow-section">
        {msg&&<p className="success" role="status">{msg}</p>}{err&&<p className="error" role="alert">{err}</p>}
        {list.length ? (
          list.map((a) => (
            <div className="assessment-history-card" key={a.id}>
              <div className="workflow-row">
                <div><b>{a.name}</b><div className="muted">{a.duration_minutes} minutes · {a.attempt_count} attempt(s){a.window_end ? " · closes " + new Date(a.window_end).toLocaleString() : ""}</div></div>
                <div className="action-row">
                  <span className="status-pill">{a.attempt_status || "AVAILABLE"}</span>
                  {canStart(a) && !a.approved_retry_available && <button className="btn" disabled={busy} onClick={() => start(a)}>{a.attempt_status === "IN_PROGRESS" ? "Resume Assessment" : (a.attempt_history || []).length ? "Start Next Attempt" : "Start Assessment"}</button>}
                  {a.attempt_status === "PENDING_EVALUATION" && <span className="muted">Evaluation pending</span>}
                  {a.attempt_status === "EVALUATED" && <b>Recorded score: {a.total_score ?? "Unavailable"}</b>}
                </div>
              </div>
              {(a.attempt_history || []).some(attempt=>["SUBMITTED","EVALUATED"].includes(attempt.status)) && !a.approved_retry_available && !a.attempt_history?.some(attempt=>attempt.status==="IN_PROGRESS") && <div className="card" style={{padding:12,marginTop:12}}>
                <b>Assessment Retake</b>
                {a.retry_requests?.some(request=>request.status==="PENDING") ? <p className="muted">Retry request pending Admin approval.</p> : <>
                  {a.retry_requests?.[0]?.status==="REJECTED" && <p className="muted">Previous request rejected: {a.retry_requests[0].admin_note || "No reason provided"}</p>}
                  {(a.attempt_history || []).length < Number(a.attempt_count || 1) && <p className="muted">You still have an unused attempt. You can start it without requesting Admin approval.</p>}
                  {(a.attempt_history || []).length >= Number(a.attempt_count || 1) && <textarea aria-label="Reason for assessment retry" rows={2} placeholder="Why do you need to retake this assessment?" value={retryReasons[a.id] || ""} onChange={e=>setRetryReasons(current=>({...current,[a.id]:e.target.value}))}/>}
                  {(a.attempt_history || []).length >= Number(a.attempt_count || 1) && <button className="btn secondary" type="button" disabled={busy} onClick={()=>requestRetry(a)}>Request Retry</button>}
                </>}
              </div>}
              {a.approved_retry_available && <div className="success" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><span>Admin approved your retry. You may start another attempt.</span><button type="button" className="btn" disabled={busy} onClick={()=>start(a)}>Start Approved Retake</button></div>}
              {!!a.attempt_history?.length && <div className="assessment-history">
                <b>Assessment History</b>
                {a.attempt_history.map((attempt, index) => <div className="attempt-result" key={attempt.id}>
                  <div className="attempt-result-head"><span>Attempt {a.attempt_history.length - index} · {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "In progress"}{formatTimeTaken(attempt.started_at, attempt.submitted_at) && <> · Time taken: {formatTimeTaken(attempt.started_at, attempt.submitted_at)}</>}</span><span className={attempt.passed === true ? "result-pass" : attempt.passed === false ? "result-fail" : "muted"}>{attempt.scoreUnavailable ? "RESULT UNAVAILABLE" : attempt.passed === true ? "PASSED" : attempt.passed === false ? "NOT PASSED" : attempt.status}</span></div>
                  {attempt.status === "EVALUATED" && (attempt.scoreUnavailable ? <div className="overall-result"><b>Recorded score: {attempt.earned ?? "Unavailable"}</b><span>Percentage and pass/fail unavailable</span><p className="muted">Some original questions or scoring details are no longer available. The recorded score is retained, but the historical result cannot be recalculated reliably.</p></div> : <><div className="overall-result"><b>{attempt.earned}/{attempt.possible} marks</b><span>{attempt.percentage}% overall</span></div><div className="section-results" style={{display:"grid",gap:10}}>{(attempt.sectionResults || []).map(section => <div key={section.sectionId} className="card" style={{padding:12}}><b>{section.name}</b><div>{section.earned}/{section.possible} marks · {section.percentage}% · {section.passed ? "Passed" : `Below ${section.passScore}%`}</div>{section.totalQuestions != null && <div className="muted">Total: {section.totalQuestions} · Correct: {section.correct} · Wrong: {section.wrong} · Unanswered: {section.unanswered}</div>}</div>)}</div>{(attempt.sectionResults || []).every(s=>s.totalQuestions!=null) && <p className="muted">Overall questions: {(attempt.sectionResults||[]).reduce((n,s)=>n+s.totalQuestions,0)} · Correct: {(attempt.sectionResults||[]).reduce((n,s)=>n+s.correct,0)} · Wrong: {(attempt.sectionResults||[]).reduce((n,s)=>n+s.wrong,0)} · Unanswered: {(attempt.sectionResults||[]).reduce((n,s)=>n+s.unanswered,0)}</p>}{attempt.domainRecommendation && <p className="muted">Recommended domain: <b>{attempt.domainRecommendation === "ADMIN_REVIEW" ? "Equal scores — Admin review required" : attempt.domainRecommendation}</b></p>}</>)}
                </div>)}
              </div>}
            </div>
          ))
        ) : (
          <p className="muted">No assessments are currently available.</p>
        )}
      </section>
    </main>
  );
}

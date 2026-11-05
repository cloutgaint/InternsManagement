"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
import AssessmentQuestionWorkspace from "./AssessmentQuestionWorkspace";
const fresh = () => ({
  batchId: "",
  name: "",
  windowStart: "",
  windowEnd: "",
  durationMinutes: 60,
  attemptCount: 1,
  randomize: true,
  status: "DRAFT",
  sections: [
    {
      name: "Common / Domain Assessment",
      domainId: "",
      passScore: 50,
      questionIds: [],
    },
  ],
});
function formatTimeTaken(startedAt, submittedAt) {
  if (!startedAt || !submittedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(submittedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const seconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${seconds % 60} sec` : `${seconds} sec`;
}
export default function AdminAssessmentsPage() {
  const [batches, setBatches] = useState([]),
    [questions, setQuestions] = useState([]),
    [domains, setDomains] = useState([]),
    [assessments, setAssessments] = useState([]),
    [subs, setSubs] = useState([]),
    [retryRequests, setRetryRequests] = useState([]),
    [retryNotes, setRetryNotes] = useState({}),
    [form, setForm] = useState(fresh()),
    [review, setReview] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [feedbackArea,setFeedbackArea]=useState("create"),
    [sectionErrors, setSectionErrors] = useState({}),
    [busy, setBusy] = useState(false);
  const load = () =>
    Promise.all([
      api("/admin/batches"),
      api("/admin/questions"),
      api("/admin/domains"),
      api("/admin/assessments"),
      api("/admin/assessment-submissions"),
      api("/admin/assessment-retry-requests"),
    ])
      .then(([b, q, d, a, s, retries]) => {
        setBatches(b);
        setQuestions(q);
        setDomains(d);
        setAssessments(a);
        setSubs(s);
        setRetryRequests(retries);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  function sec(i, k, v) {
    setForm((x) => ({
      ...x,
      sections: x.sections.map((s, n) => (n === i ? { ...s, [k]: v } : s)),
    }));
  }
  function setupDevelopmentAssessment() {
    const frontend = domains.find(d => /^front[ -]?end$/i.test(d.name?.trim() || ""));
    const backend = domains.find(d => /^back[ -]?end$/i.test(d.name?.trim() || ""));
    const fullStack = domains.find(d => /full[ -]?stack/i.test(d.name || ""));
    const frontendId = frontend?.id || fullStack?.id || "";
    const backendId = backend?.id || fullStack?.id || "";
    setForm(current => ({
      ...current,
      name: current.name || "Full Stack Development Initial Assessment",
      sections: [
        { name: "Frontend", domainId: frontendId, passScore: 50, questionIds: [] },
        { name: "Backend", domainId: backendId, passScore: 50, questionIds: [] },
      ],
    }));
    setSectionErrors({});
    setFeedbackArea("create");
    setErr("");
    setMsg("Frontend and Backend sections created. Select eligible MCQs for both sections. Question counts may differ; recommendations compare score percentages.");
  }
  async function create(e) {setFeedbackArea("create");
    e.preventDefault();setErr("");setMsg("");setSectionErrors({});
    if(form.windowStart&&form.windowEnd&&new Date(form.windowEnd)<=new Date(form.windowStart))return setErr("Assessment closing time must be after opening time.");
    const developmentNames = form.sections.map(s => s.name.trim().toLowerCase());
    if (developmentNames.includes("frontend") || developmentNames.includes("backend")) {
      if (form.sections.length !== 2 || !developmentNames.includes("frontend") || !developmentNames.includes("backend") || form.sections.some(s => !s.questionIds.length || !s.domainId))
        return setErr("Select at least one MCQ in each Frontend and Backend section and assign their domains. Counts may differ; recommendations use score percentages.");
    }
    const emptySections = form.sections.reduce((out, section, index) => (!section.questionIds.length ? { ...out, [index]: "Add at least one eligible question to this section." } : out), {});
    if(Object.keys(emptySections).length){setSectionErrors(emptySections);return;}
    const ineligibleSections = form.sections.reduce((out, section, index) => section.questionIds.some((id) => { const question = questions.find((row) => row.id === id); return question?.status !== "ACTIVE" || question?.type !== "MCQ"; }) ? { ...out, [index]: "Every selected question must be an approved, active MCQ." } : out, {});
    if(Object.keys(ineligibleSections).length){setSectionErrors(ineligibleSections);return;}
    const selected=form.sections.flatMap(x=>x.questionIds);
    if(new Set(selected).size!==selected.length){
      const duplicateIds = selected.filter((id, index) => selected.indexOf(id) !== index);
      setSectionErrors(form.sections.reduce((out, section, index) => section.questionIds.some((id) => duplicateIds.includes(id)) ? { ...out, [index]: "A question cannot be used in more than one section." } : out, {}));
      return;
    }
    try {
      setBusy(true);
      await api("/admin/assessments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          windowStart: form.windowStart || null,
          windowEnd: form.windowEnd || null,
        }),
      });
      setMsg("Assessment created successfully.");
      setForm(fresh());
      setSectionErrors({});
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function status(a, status) {setFeedbackArea("status");setErr("");setMsg("");
    try {
      await api("/admin/assessments/" + a.id + "/status", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMsg("Assessment " + status.toLowerCase() + ".");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function decideRetry(request, decision) {
    setFeedbackArea("retry");setErr("");setMsg("");
    try {
      setBusy(true);
      await api("/admin/assessment-retry-requests/" + request.id + "/decision",{method:"POST",body:JSON.stringify({decision,note:retryNotes[request.id] || ""})});
      setMsg("Retry request " + decision.toLowerCase() + ".");
      await load();
    } catch(e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function openReview(x) {
    try {
      setReview(await api("/admin/assessment-submissions/" + x.attempt_id));
    } catch (e) {
      setErr(e.message);
    }
  }
  async function score(ans) {setFeedbackArea("score");setErr("");setMsg("");
    const val = window.prompt(
      "Score out of " + ans.marks + ":",
      ans.manual_score ?? "",
    );
    if (val === null) return;
    const feedback =
      window.prompt("Feedback (optional):", ans.feedback || "") || "";
    try {
      await api("/admin/assessment-answers/" + ans.id + "/evaluate", {
        method: "POST",
        body: JSON.stringify({ score: Number(val), feedback }),
      });
      setReview(await api("/admin/assessment-submissions/" + review.id));
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Assessments</h1>
          <p className="muted">
            Create timed, automatically scored assessments from approved MCQs.
          </p>
        </div>
        <span className="badge">{assessments.length} assessments</span>
      </div>
      <section className="card">
        <h2>Create Assessment</h2>{feedbackArea==="create"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        <form onSubmit={create}>
          <div className="form-grid">
            <div className="form-field">
              <label>Batch</label>
              <select
                className="input"
                value={form.batchId}
                onChange={(e) =>
                  setForm((x) => ({ ...x, batchId: e.target.value }))
                }
                required
              >
                <option value="">Select batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Assessment Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) =>
                  setForm((x) => ({ ...x, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="form-field">
              <label>Opens At</label>
              <input
                className="input"
                type="datetime-local"
                value={form.windowStart}
                onChange={(e) =>
                  setForm((x) => ({ ...x, windowStart: e.target.value }))
                }
              />
            </div>
            <div className="form-field">
              <label>Closes At</label>
              <input
                className="input"
                type="datetime-local"
                value={form.windowEnd}
                onChange={(e) =>
                  setForm((x) => ({ ...x, windowEnd: e.target.value }))
                }
              />
            </div>
            <div className="form-field">
              <label>Duration (minutes)</label>
              <input
                className="input"
                type="number"
                min="1"
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm((x) => ({
                    ...x,
                    durationMinutes: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="form-field">
              <label>Allowed Attempts</label>
              <input
                className="input"
                type="number"
                min="1"
                value={form.attemptCount}
                onChange={(e) =>
                  setForm((x) => ({
                    ...x,
                    attemptCount: Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={form.randomize}
              onChange={(e) =>
                setForm((x) => ({ ...x, randomize: e.target.checked }))
              }
            />{" "}
            Randomize question order for each attempt
          </label>
          <div className="form-actions"><button type="button" className="btn secondary" onClick={setupDevelopmentAssessment}>Set up Full Stack Assessment (Frontend + Backend)</button></div>
          {form.sections.map((s, i) => (
            <div className="assessment-section-builder" key={i}>
              <div className="verification-title">
                <h3>Section {i + 1}</h3>
                {form.sections.length > 1 && (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() =>
                      setForm((x) => ({
                        ...x,
                        sections: x.sections.filter((_, n) => n !== i),
                      }))
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label>Section Name</label>
                  <input
                    className="input"
                    value={s.name}
                    onChange={(e) => sec(i, "name", e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Domain</label>
                  <select
                    className="input"
                    value={s.domainId}
                    onChange={(e) => sec(i, "domainId", e.target.value)}
                  >
                    <option value="">Common / All</option>
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Pass Score (%)</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    value={s.passScore}
                    onChange={(e) =>
                      sec(i, "passScore", Number(e.target.value))
                    }
                  />
                </div>
              </div>
              <AssessmentQuestionWorkspace
                section={s}
                sectionIndex={i}
                questions={questions}
                domains={domains}
                usedQuestionIds={new Set(form.sections.flatMap((section, index) => index === i ? [] : section.questionIds))}
                onChange={(ids) => {
                  sec(i, "questionIds", ids);
                  if (ids.length) setSectionErrors((x) => ({ ...x, [i]: "" }));
                }}
                onReload={load}
                error={sectionErrors[i]}
                setError={(message) => setSectionErrors((x) => ({ ...x, [i]: message }))}
              />
            </div>
          ))}
          <div className="action-row">
            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                setForm((x) => ({
                  ...x,
                  sections: [
                    ...x.sections,
                    {
                      name: "Section " + (x.sections.length + 1),
                      domainId: "",
                      passScore: 50,
                      questionIds: [],
                    },
                  ],
                }))
              }
            >
              + Add Section
            </button>
            <button className="btn" disabled={busy}>
              {busy ? "Creating…" : "Create Assessment"}
            </button>
          </div>
        </form>
      </section>
      <section className="card workflow-section">
        <h2>Assessment Management</h2>{feedbackArea==="status"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        {assessments.map((a) => (
          <div className="workflow-row" key={a.id}>
            <div>
              <b>{a.name}</b>
              <div className="muted">
                {a.duration_minutes} min · {a.attempt_count} attempt(s) ·{" "}
                {a.status}
              </div>
            </div>
            <div className="action-row">
              {a.status === "DRAFT" && (
                <button className="btn" onClick={() => status(a, "PUBLISHED")}>
                  Publish
                </button>
              )}
              {["PUBLISHED", "ACTIVE"].includes(a.status) && (
                <button
                  className="btn secondary"
                  onClick={() => status(a, "CLOSED")}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
      <section className="card workflow-section">
        <h2>Assessment Retry Requests</h2>
        {feedbackArea==="retry" && <>{err && <p className="error" role="alert">{err}</p>}{msg && <p className="success" role="status">{msg}</p>}</>}
        {retryRequests.filter(request=>request.status==="PENDING").length ? retryRequests.filter(request=>request.status==="PENDING").map(request=><div className="workflow-row" key={request.id}>
          <div><b>{request.full_name}</b><div className="muted">{request.assessment_name} · {new Date(request.created_at).toLocaleString()}</div><p>{request.reason}</p><input aria-label="Admin retry decision note" placeholder="Optional decision note" value={retryNotes[request.id] || ""} onChange={e=>setRetryNotes(current=>({...current,[request.id]:e.target.value}))}/></div>
          <div className="action-row"><button type="button" className="btn" disabled={busy} onClick={()=>decideRetry(request,"APPROVED")}>Approve Retry</button><button type="button" className="btn secondary" disabled={busy} onClick={()=>decideRetry(request,"REJECTED")}>Reject</button></div>
        </div>) : <p className="muted">No pending retry requests.</p>}
      </section>
      <section className="card workflow-section">
        <h2>Intern Assessment Results & Evaluation</h2>{feedbackArea==="score"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        {subs.length ? (
          subs.map((x) => (
            <div className="workflow-row" key={x.attempt_id}>
              <div>
                <b>{x.full_name}</b>
                <div className="muted">
                  {x.assessment_name} · Score {x.result_snapshot?.earned ?? x.total_score ?? 0}{x.result_snapshot?.possible != null && <>/{x.result_snapshot.possible} ({x.result_snapshot.percentage}%)</>} · {x.status}{formatTimeTaken(x.started_at, x.submitted_at) && <> · Time taken: {formatTimeTaken(x.started_at, x.submitted_at)}</>}
                  {x.result_snapshot?.sectionResults?.length > 0 && <div className="section-results" style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:8}}>{x.result_snapshot.sectionResults.map(s=><span key={s.sectionId}><b>{s.name}</b>: {s.earned}/{s.possible} ({s.percentage}%) {s.totalQuestions!=null && <>· Correct {s.correct} · Wrong {s.wrong} · Unanswered {s.unanswered}</>}</span>)}</div>}
                  {x.result_snapshot?.domainRecommendation && <div style={{marginTop:6}}><b>Suggested domain: {x.result_snapshot.domainRecommendation==="ADMIN_REVIEW"?"Balanced performance — Admin review":x.result_snapshot.domainRecommendation+" Development"}</b><span className="muted"> · Recommendation only; Admin confirms allocation</span></div>}
                </div>
              </div>
              <div className="action-row">
                <span className="status-pill">{x.pending_manual} pending</span>
                <button className="btn secondary" onClick={() => openReview(x)}>
                  Review
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No submissions yet.</p>
        )}
      </section>
      {review && (
        <div className="modal-backdrop" onMouseDown={() => setReview(null)}>
          <section
            className="modal-card assessment-review"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="verification-title">
              <div>
                <h2>{review.assessment_name}</h2>
                <p className="muted">{review.full_name}</p>
              </div>
              <button className="icon-close" onClick={() => setReview(null)}>
                ×
              </button>
            </div>
            {review.answers.map((a) => (
              <div className="review-answer" key={a.id}>
                <b>{a.question}</b>
                <p>
                  {typeof a.answer === "string"
                    ? a.answer
                    : JSON.stringify(a.answer)}
                </p>
                <small>
                  Marks: {a.marks} · Auto: {a.auto_score ?? "—"} · Manual:{" "}
                  {a.manual_score ?? "Pending"}
                </small>
                {!['MCQ', 'MULTI_SELECT', 'TRUE_FALSE'].includes(a.type) && (
                  <>
                    <p className="muted">
                      Guide: {a.marking_guide || "No marking guide"}
                    </p>
                    <button className="btn" onClick={() => score(a)}>
                      Evaluate
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

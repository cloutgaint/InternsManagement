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
    [busy, setBusy] = useState(false),
    [activeView, setActiveView] = useState("create"),
    [resultSearch, setResultSearch] = useState(""),
    [resultAssessment, setResultAssessment] = useState(""),
    [resultStatus, setResultStatus] = useState(""),
    [resultPage, setResultPage] = useState(1),
    [resultPageSize, setResultPageSize] = useState(10);
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
  const resultAssessments = [...new Set(subs.map(x => x.assessment_name).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  const filteredResults = subs.filter(x =>
    (!resultSearch || [x.full_name, x.assessment_name].some(v => String(v || "").toLowerCase().includes(resultSearch.trim().toLowerCase()))) &&
    (!resultAssessment || x.assessment_name === resultAssessment) &&
    (!resultStatus || x.status === resultStatus)
  );
  const resultPageCount = Math.max(1, Math.ceil(filteredResults.length / resultPageSize));
  const currentResultPage = Math.min(resultPage, resultPageCount);
  const visibleResults = filteredResults.slice((currentResultPage - 1) * resultPageSize, currentResultPage * resultPageSize);
  return (
    <main className="wrap admin-assessments-page">
      <div className="intern-head">
        <div>
          <h1>Assessments</h1>
          <p className="muted">
            Create timed, automatically scored assessments from approved MCQs.
          </p>
        </div>
        <span className="badge">{assessments.length} assessments</span>
      </div>
      <nav aria-label="Assessment workspace" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:10,marginBottom:20}}>
        {[{id:"create",title:"Create Assessment",desc:"Build sections and allocate MCQs"},{id:"manage",title:"Manage Assessments",desc:assessments.length+" assessments"},{id:"retry",title:"Retry Requests",desc:retryRequests.filter(r=>r.status==="PENDING").length+" pending"},{id:"results",title:"Intern Results",desc:subs.length+" submissions"}].map(item=><button key={item.id} type="button" onClick={()=>{setActiveView(item.id);setErr("");setMsg("");}} aria-current={activeView===item.id?"page":undefined} className={"card "+(activeView===item.id?"":"secondary")} style={{cursor:"pointer",textAlign:"left",padding:16,border:activeView===item.id?"2px solid #047857":"1px solid #d9e1e7",background:activeView===item.id?"#ecfdf5":"#fff",color:"#172b38"}}><strong style={{display:"block",marginBottom:5}}>{item.title}</strong><small>{item.desc}</small></button>)}
      </nav>
      {activeView==="create" && <section className="card">
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
      </section>}
      {activeView==="manage" && <section className="card workflow-section">
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
      </section>}
      {activeView==="retry" && <section className="card workflow-section">
        <h2>Assessment Retry Requests</h2>
        {feedbackArea==="retry" && <>{err && <p className="error" role="alert">{err}</p>}{msg && <p className="success" role="status">{msg}</p>}</>}
        {retryRequests.filter(request=>request.status==="PENDING").length ? retryRequests.filter(request=>request.status==="PENDING").map(request=><div className="workflow-row" key={request.id}>
          <div><b>{request.full_name}</b><div className="muted">{request.assessment_name} · {new Date(request.created_at).toLocaleString()}</div><p>{request.reason}</p><input aria-label="Admin retry decision note" placeholder="Optional decision note" value={retryNotes[request.id] || ""} onChange={e=>setRetryNotes(current=>({...current,[request.id]:e.target.value}))}/></div>
          <div className="action-row"><button type="button" className="btn" disabled={busy} onClick={()=>decideRetry(request,"APPROVED")}>Approve Retry</button><button type="button" className="btn secondary" disabled={busy} onClick={()=>decideRetry(request,"REJECTED")}>Reject</button></div>
        </div>) : <p className="muted">No pending retry requests.</p>}
      </section>}
      {activeView==="results" && <section className="card workflow-section assessment-results">
        <div className="assessment-results-heading"><div><h2>Intern Assessment Results & Evaluation</h2><p className="muted">Search and review intern submissions. Select Review for section scores and domain recommendations.</p></div><span className="badge">{subs.length} submissions</span></div>
        {feedbackArea==="score"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        <div className="assessment-results-filters">
          <label>Search intern or assessment<input className="input" type="search" placeholder="Search by name or assessment" value={resultSearch} onChange={e=>{setResultSearch(e.target.value);setResultPage(1);}}/></label>
          <label>Assessment<select className="input" value={resultAssessment} onChange={e=>{setResultAssessment(e.target.value);setResultPage(1);}}><option value="">All assessments</option>{resultAssessments.map(name=><option key={name} value={name}>{name}</option>)}</select></label>
          <label>Status<select className="input" value={resultStatus} onChange={e=>{setResultStatus(e.target.value);setResultPage(1);}}><option value="">All statuses</option>{[...new Set(subs.map(x=>x.status).filter(Boolean))].sort().map(status=><option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}</select></label>
          <button type="button" className="btn secondary" onClick={()=>{setResultSearch("");setResultAssessment("");setResultStatus("");setResultPage(1);}}>Clear filters</button>
        </div>
        {filteredResults.length ? <>
          <div className="assessment-results-scroll"><table className="assessment-results-table"><thead><tr><th scope="col">Intern</th><th scope="col">Assessment</th><th scope="col">Score</th><th scope="col">Time taken</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{visibleResults.map(x=><tr key={x.attempt_id}>
            <td><strong>{x.full_name || "Unknown intern"}</strong></td><td>{x.assessment_name || "—"}</td>
            <td><strong>{x.result_snapshot?.earned ?? x.total_score ?? 0}{x.result_snapshot?.possible != null ? "/"+x.result_snapshot.possible : ""}</strong>{x.result_snapshot?.percentage != null && <small>{x.result_snapshot.percentage}%</small>}</td>
            <td>{formatTimeTaken(x.started_at,x.submitted_at)||"—"}</td><td><span className="status-pill">{String(x.status||"Unknown").replaceAll("_"," ")}</span>{Number(x.pending_manual)>0&&<small>{x.pending_manual} pending</small>}</td>
            <td><button type="button" className="btn secondary" onClick={()=>openReview(x)}>Review</button></td>
          </tr>)}</tbody></table></div>
          <div className="assessment-results-footer"><span>Showing {(currentResultPage-1)*resultPageSize+1}–{Math.min(currentResultPage*resultPageSize,filteredResults.length)} of {filteredResults.length} results</span>
            <div className="assessment-results-pagination"><label>Rows per page <select value={resultPageSize} onChange={e=>{setResultPageSize(Number(e.target.value));setResultPage(1);}}>{[5,10,20,50].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
            <button type="button" className="btn secondary" disabled={currentResultPage===1} onClick={()=>setResultPage(p=>Math.max(1,p-1))}>Previous</button><span>Page {currentResultPage} of {resultPageCount}</span><button type="button" className="btn secondary" disabled={currentResultPage===resultPageCount} onClick={()=>setResultPage(p=>Math.min(resultPageCount,p+1))}>Next</button></div></div>
        </> : <div className="assessment-results-empty"><strong>{subs.length?"No matching results":"No submissions yet"}</strong><p>{subs.length?"Try a different search or clear the filters.":"Intern assessment submissions will appear here."}</p></div>}
      </section>}
            {review && (
        <div className="modal-backdrop" onMouseDown={() => setReview(null)}>
          <section
            className="modal-card assessment-review"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="verification-title">
              <div>
                <h2>{review.assessment_name} — Answer Review</h2>
                <p className="muted">{review.full_name}</p>
              </div>
              <button className="icon-close" onClick={() => setReview(null)}>
                ×
              </button>
            </div>
            <p className="muted">Review each submitted answer alongside the correct answer and awarded marks.</p>
            {!review.answers?.length && <p className="muted">No answer records are available for this attempt.</p>}
            {review.answers.map((a, index) => (
              <div className="review-answer" key={a.id}>
                <b>Q{index+1}. {a.question || "Question no longer available"}</b>
                <div style={{display:"grid",gap:6,marginTop:8}}>
                  <div><strong>Intern answer: </strong>{a.answer == null || a.answer === "" ? "Not answered" : typeof a.answer === "string" ? a.answer : JSON.stringify(a.answer)}</div>
                  {["MCQ","MULTI_SELECT","TRUE_FALSE"].includes(a.type) && <div><strong>Correct answer: </strong>{a.correct_answer == null ? "Unavailable (question removed)" : typeof a.correct_answer === "string" ? a.correct_answer : JSON.stringify(a.correct_answer)}</div>}
                  {["MCQ","MULTI_SELECT","TRUE_FALSE"].includes(a.type) && <div style={{fontWeight:600,color:Number(a.auto_score)>0?"#047857":"#b45309"}}>{Number(a.auto_score)>0?"Correct":"Incorrect / unanswered"} · {a.auto_score ?? 0}/{a.marks} marks</div>}
                </div>
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
      <style jsx global>{`
      .admin-assessments-page .btn{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 16px;border:1px solid #065f46;border-radius:10px;background:#065f46;color:#fff;font-size:13px;font-weight:700;transition:background .15s,border-color .15s,color .15s}
      .admin-assessments-page .btn:hover:not(:disabled){background:#064e3b;border-color:#064e3b;color:#fff}
      .admin-assessments-page .btn.secondary{background:#e8f5ee;border-color:#b9dcca;color:#075b3b}
      .admin-assessments-page .btn.secondary:hover:not(:disabled){background:#065f46;border-color:#065f46;color:#fff}
      .admin-assessments-page .btn.danger{background:#b42332;border-color:#b42332;color:#fff}
      .admin-assessments-page .btn.danger:hover:not(:disabled){background:#91202a;border-color:#91202a;color:#fff}
      .admin-assessments-page .btn:focus-visible,.admin-assessments-page nav button:focus-visible{outline:3px solid #86efac;outline-offset:3px}
      .admin-assessments-page .btn:disabled{opacity:.55;cursor:not-allowed}
      .admin-assessments-page .action-row{align-items:center;gap:10px}
      .admin-assessments-page nav[aria-label="Assessment workspace"] button:hover{border-color:#065f46!important;box-shadow:0 6px 18px #065f4618}
      .admin-assessments-page nav[aria-label="Assessment workspace"] button[aria-current="page"]{background:#ecfdf5!important}
      @media(max-width:600px){.admin-assessments-page .action-row .btn{flex:1}}

      .admin-assessments-page .assessment-results-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}
      .admin-assessments-page .assessment-results-heading h2{margin:0 0 6px;font-size:21px;color:#111}
      .admin-assessments-page .assessment-results-heading p{margin:0;font-size:13px;line-height:1.5}
      .admin-assessments-page .assessment-results-filters{display:grid;grid-template-columns:minmax(190px,1.6fr) minmax(155px,1fr) minmax(140px,.8fr) auto;gap:12px;align-items:end;margin-bottom:18px}
      .admin-assessments-page .assessment-results-filters label{display:grid;gap:7px;font-size:12px;font-weight:650;color:#111;min-width:0}
      .admin-assessments-page .assessment-results-filters .input{margin:0;min-height:44px;color:#111;border:1.5px solid #93b4ed;border-radius:9px}
      .admin-assessments-page .assessment-results-scroll{overflow-x:auto;border:1px solid #e2e8f0;border-radius:12px}
      .admin-assessments-page .assessment-results-table{width:100%;border-collapse:collapse;text-align:left;min-width:690px;font-size:13px;color:#111}
      .admin-assessments-page .assessment-results-table th{padding:13px 15px;background:#f8faf9;font-size:12px;font-weight:700;color:#374151;border-bottom:1px solid #e2e8f0}
      .admin-assessments-page .assessment-results-table td{padding:13px 15px;border-bottom:1px solid #edf0f2;vertical-align:middle}
      .admin-assessments-page .assessment-results-table tr:last-child td{border-bottom:0}
      .admin-assessments-page .assessment-results-table tbody tr:hover{background:#f8fbf9}
      .admin-assessments-page .assessment-results-table td small{display:block;margin-top:4px;color:#525252;font-size:11px}
      .admin-assessments-page .assessment-results-table .btn{min-height:38px;padding:8px 13px}
      .admin-assessments-page .assessment-results-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:17px;color:#374151;font-size:12px}
      .admin-assessments-page .assessment-results-pagination{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .admin-assessments-page .assessment-results-pagination label{display:flex;align-items:center;gap:7px}
      .admin-assessments-page .assessment-results-pagination select{width:auto;min-height:38px;margin:0;padding:7px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#111}
      .admin-assessments-page .assessment-results-pagination .btn{min-height:38px;padding:8px 12px}
      .admin-assessments-page .assessment-results-empty{text-align:center;padding:48px 16px;border:1px dashed #cbd5e1;border-radius:12px;color:#111}
      .admin-assessments-page .assessment-results-empty p{font-size:13px;color:#525252}
      @media(max-width:900px){.admin-assessments-page .assessment-results-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.admin-assessments-page .assessment-results-footer{align-items:flex-start;flex-direction:column}}
      @media(max-width:540px){.admin-assessments-page .assessment-results-filters{grid-template-columns:1fr}.admin-assessments-page .assessment-results-heading{flex-direction:column}.admin-assessments-page .assessment-results-pagination{gap:7px}}
      `}</style>
    </main>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/shared/api/client";
import { QUESTION_TYPES, fullStackQuestionCategory, isFullStackDomain } from "./AssessmentQuestionWorkspace";
import AdminQuestionAiPanel from "./AdminQuestionAiPanel";
import AdminQuestionEditor from "./AdminQuestionEditor";
const aiEmpty = {
  instructions: "",
  domainId: "",
  subject: "",
  difficulty: "BEGINNER",
  count: 10,
  marks: 1,
};
const empty = {
  domainId: "",
  topic: "",
  difficulty: "MEDIUM",
  type: "MCQ",
  question: "",
  options: ["", "", "", ""],
  correctAnswer: "",
  markingGuide: "",
  marks: 1,
  explanation: "",
  status: "DRAFT",
};
export default function AdminQuestionsPage() {
  const aiPreviewRef = useRef(null);
  const [rows, setRows] = useState([]),
    [domains, setDomains] = useState([]),
    [form, setForm] = useState(empty),
    [editId, setEditId] = useState(null),
    [questionTab, setQuestionTab] = useState("ALL"),
    [workspace, setWorkspace] = useState("library"),
    [libraryPage, setLibraryPage] = useState(1),
    [libraryPageSize, setLibraryPageSize] = useState(10),
    [filter, setFilter] = useState({
      q: "",
      domain: "",
      difficulty: "",
      type: "",
      status: "",
    }),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [feedbackArea,setFeedbackArea]=useState("save"),
    [busy, setBusy] = useState(false),
    [ai, setAi] = useState(aiEmpty),
    [aiBusy, setAiBusy] = useState(false),
    [aiDrafts, setAiDrafts] = useState([]),
    [aiSelectedIds, setAiSelectedIds] = useState([]),
    [aiEditingId, setAiEditingId] = useState(null),
    [aiDirtyIds, setAiDirtyIds] = useState([]),
    [aiError, setAiError] = useState(""),
    [aiMessage, setAiMessage] = useState("");
  const load = () =>
    Promise.all([api("/admin/questions"), api("/admin/domains")])
      .then(([q, d]) => {
        setRows(q);
        setDomains(d.filter((x) => x.active !== false));
      });
  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    if (aiDrafts.length)
      aiPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [aiDrafts.length]);
  const questionDomains = useMemo(() => ({
    FRONTEND: domains.find(d => /^front[ -]?end$/i.test(d.name.trim()))?.id || null,
    BACKEND: domains.find(d => /^back[ -]?end$/i.test(d.name.trim()))?.id || null,
  }), [domains]);
  const fullStackIds = useMemo(
    () => domains.filter(isFullStackDomain).map((domain) => domain.id),
    [domains],
  );
  const fullStackFilter = !filter.domain || fullStackIds.includes(filter.domain);
  const selectQuestionTab = (tab) => {
    setQuestionTab(tab);
    setLibraryPage(1);
    const domainId = fullStackFilter ? filter.domain : tab === "ALL" ? "" : questionDomains[tab] || "";
    setFilter(current => ({ ...current, domain: domainId }));
    if (domainId || (fullStackFilter && tab !== "ALL")) {
      const selectedDomain = domainId || fullStackIds[0] || "";
      setAi(current => ({ ...current, domainId: selectedDomain }));
      if (!editId) setForm(current => ({ ...current, domainId: selectedDomain }));
    }
  };
  const visible = useMemo(
    () =>
      rows.filter(
        (x) =>
          (!filter.q ||
            (x.question || "").toLowerCase().includes(filter.q.toLowerCase()) ||
            (x.topic || "").toLowerCase().includes(filter.q.toLowerCase())) &&
          (questionTab === "ALL" || (fullStackFilter ? fullStackIds.includes(x.domain_id) && fullStackQuestionCategory(x) === questionTab : (questionDomains[questionTab] && x.domain_id === questionDomains[questionTab]))) &&
          (!filter.domain || x.domain_id === filter.domain) &&
          (!filter.difficulty || x.difficulty === filter.difficulty) &&
          (!filter.type || x.type === filter.type) &&
          (!filter.status || x.status === filter.status),
      ),
    [rows, filter, questionTab, questionDomains, fullStackFilter, fullStackIds],
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / libraryPageSize));
  const currentPage = Math.min(libraryPage, pageCount);
  const paginatedQuestions = visible.slice((currentPage-1)*libraryPageSize,currentPage*libraryPageSize);
  const generatedRows = aiDrafts;
  const editingAiDraft = Boolean(editId && rows.find((question) => question.id === editId)?.source === "AI" && rows.find((question) => question.id === editId)?.status === "DRAFT");
  function reset() {
    setForm(empty);
    setEditId(null);
  }
  function edit(x) {
    setFeedbackArea("save"); setErr(""); setMsg("");
    setEditId(x.id);
    setWorkspace("manual");
    setForm({
      domainId: x.domain_id || "",
      topic: x.topic || "",
      difficulty: x.difficulty || "MEDIUM",
      type: x.type || "MCQ",
      question: x.question || "",
      options: Array.isArray(x.options)
        ? [...x.options, "", "", "", ""].slice(0, 4)
        : ["", "", "", ""],
      correctAnswer: Array.isArray(x.correct_answer)
        ? x.correct_answer.join(", ")
        : (x.correct_answer ?? ""),
      markingGuide: x.marking_guide || "",
      marks: x.marks || 1,
      explanation: x.explanation || "",
      status: x.status || "DRAFT",
    });
    document.querySelector(".question-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function moveQuestion(x, target) {
    setFeedbackArea("library");setErr("");setMsg("");
    const baseTopic = String(x.topic || "").replace(/^\[(?:frontend|backend)\]\s*/i, "").trim();
    const topic = "[" + target + "] " + (baseTopic || "General");
    try {
      setBusy(true);
      await api("/admin/questions/" + x.id, {method:"PATCH",body:JSON.stringify({topic})});
      setMsg("Question moved to " + target + ". It will appear in the " + target + " tab.");
      await load();
    } catch(e) {setErr(e.message);} finally {setBusy(false);}
  }
  async function save(e) {setFeedbackArea("save");
    e.preventDefault();
    setErr("");
    const objective = ["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(form.type);
    let options =
      form.type === "TRUE_FALSE"
        ? ["True", "False"]
        : ["MCQ", "MULTI_SELECT"].includes(form.type)
          ? form.options.map((x) => x.trim()).filter(Boolean)
          : null;
    let correct = objective ? form.correctAnswer.trim() : null;
    if (form.type === "MULTI_SELECT")
      correct = form.correctAnswer
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    try {
      setBusy(true);
      const body = {
        ...form,
        options,
        correctAnswer: correct,
        marks: Number(form.marks),
      };
      await api(editId ? "/admin/questions/" + editId : "/admin/questions", {
        method: editId ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setMsg(
        editId
          ? "Question updated successfully."
          : "Question added to the bank.",
      );
      reset();
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const draftError = (question) => {
    const options = Array.isArray(question.options) ? question.options.map((option) => String(option || "").trim()) : [];
    if (!String(question.question || "").trim() || options.length !== 4 || options.some((option) => !option) || new Set(options.map((option) => option.toLowerCase())).size !== 4 || !options.includes(String(question.correctAnswer || "").trim()) || !String(question.explanation || "").trim())
      return "Provide a question, four unique options, one correct answer, and an explanation.";
    return "";
  };
  const withClientIds = (questions) => questions.map((question, index) => ({ ...question, clientId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}` }));
  function updateAiDraft(clientId, changes) {
    setAiDrafts((drafts) => drafts.map((draft) => draft.clientId === clientId ? { ...draft, ...changes } : draft));
    setAiDirtyIds((ids) => ids.includes(clientId) ? ids : [...ids, clientId]);
  }
  function updateAiOption(question, index, value) {
    const options = question.options.map((option, optionIndex) => optionIndex === index ? value : option);
    updateAiDraft(question.clientId, { options, correctAnswer: question.correctAnswer === question.options[index] ? value : question.correctAnswer });
  }
  function discardAiDrafts() {
    if (aiDirtyIds.length && !window.confirm("Discard all generated MCQs and unsaved edits?")) return;
    setAiDrafts([]); setAiSelectedIds([]); setAiDirtyIds([]); setAiEditingId(null);
    setAiError(""); setAiMessage("Generated draft discarded.");
  }
  async function generateAI(e) {setFeedbackArea("generateAI");
    e.preventDefault();
    if (aiBusy) return;
    setAiError(""); setAiMessage("");
    if (!ai.instructions.trim()) return setAiError("Describe the MCQs you want to generate.");
    if (questionTab !== "ALL" && fullStackFilter && questionTab !== "UNCLASSIFIED" && ai.domainId !== filter.domain) return setAiError("Select Full Stack as the AI generation domain to add questions to this category.");
    if (aiDrafts.length && aiDirtyIds.length && !window.confirm("Replace the edited unsaved MCQs with a new generation?")) return;
    try {
      setAiBusy(true);
      const out = await api("/admin/questions/ai-generate", {
        method: "POST",
        body: JSON.stringify({ ...ai, instructions: fullStackFilter && ["FRONTEND", "BACKEND"].includes(questionTab) ? `Generate only ${questionTab.toLowerCase()} development MCQs. Each question topic must begin with "${questionTab === "FRONTEND" ? "Frontend" : "Backend"} - ". ${ai.instructions}` : ai.instructions, topic: "", types: ["MCQ"] }),
      });
      if (!out.questions?.length) throw new Error("No valid MCQs were generated. Try refining your prompt.");
      const drafts = withClientIds(out.questions);
      setAiDrafts(drafts);
      setAiSelectedIds(drafts.map((question) => question.clientId));
      setAiDirtyIds([]); setAiEditingId(null);
      setAiMessage(out.validCount < out.requestedCount ? `${out.validCount} of ${out.requestedCount} requested MCQs were valid. The unsaved preview is shown below; review it and click Save to add questions to the Question Bank.` : `${out.validCount} MCQs generated. The unsaved preview is shown below; review it and click Save to add questions to the Question Bank.`);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiBusy(false);
    }
  }
  async function approveGenerated(questionIds) {
    if (aiBusy) return;
    const drafts = generatedRows.filter((question) => questionIds.includes(question.clientId));
    if (!drafts.length) return setAiError("Select at least one MCQ to save.");
    const invalid = drafts.find((question) => draftError(question));
    if (invalid) return setAiError(`Question ${generatedRows.indexOf(invalid) + 1}: ${draftError(invalid)}`);
    setAiError(""); setAiMessage(""); setAiBusy(true);
    try {
      const saved = await api("/admin/questions/ai-save", { method: "POST", body: JSON.stringify({ questions: drafts }) });
      await load();
      const savedIds = new Set(drafts.map((question) => question.clientId));
      setAiDrafts((items) => items.filter((question) => !savedIds.has(question.clientId)));
      setAiSelectedIds((ids) => ids.filter((id) => !savedIds.has(id)));
      setAiDirtyIds((ids) => ids.filter((id) => !savedIds.has(id)));
      const hidden = saved.some((question) => (filter.q && !question.question.toLowerCase().includes(filter.q.toLowerCase()) && !(question.topic || "").toLowerCase().includes(filter.q.toLowerCase())) || (filter.domain && question.domain_id !== filter.domain) || (filter.difficulty && question.difficulty !== filter.difficulty) || (filter.type && question.type !== filter.type) || (filter.status && question.status !== filter.status));
      setAiMessage(`${saved.length} question${saved.length === 1 ? "" : "s"} saved successfully to the Question Bank.${hidden ? " Clear the current Question Library filters to view all saved questions." : ""}`);
    } catch (e) {
      const detail = String(e.message || "Please try again.").replace(/^Unable to save questions\.\s*/i, "");
      setAiError(`Unable to save questions. ${detail} Your draft has been preserved.`);
    } finally { setAiBusy(false); }
  }
  async function regenerateGenerated(question) {
    if (aiBusy) return;
    if (aiDirtyIds.includes(question.clientId) && !window.confirm("Replace your unsaved edits for this MCQ?")) return;
    setAiError(""); setAiMessage(""); setAiBusy(true);
    try {
      const out = await api("/admin/questions/ai-generate", { method: "POST", body: JSON.stringify({ ...ai, topic: question.topic || "", difficulty: question.difficulty, count: 1, marks: Number(question.marks), types: ["MCQ"] }) });
      if (!out.questions?.length) throw new Error("No valid replacement MCQ was generated.");
      const replacement = withClientIds(out.questions.slice(0, 1))[0];
      setAiDrafts((drafts) => drafts.map((draft) => draft.clientId === question.clientId ? replacement : draft));
      setAiSelectedIds((ids) => ids.map((id) => id === question.clientId ? replacement.clientId : id));
      setAiDirtyIds((ids) => ids.filter((id) => id !== question.clientId));
      setAiEditingId(null);
      setAiMessage("Replacement MCQ generated for review.");
    } catch (e) { setAiError(`Regeneration failed: ${e.message}`); } finally { setAiBusy(false); }
  }
  async function removeGenerated(question) {
    if (aiBusy) return;
    setAiDrafts((drafts) => drafts.filter((draft) => draft.clientId !== question.clientId));
    setAiSelectedIds((ids) => ids.filter((id) => id !== question.clientId));
    setAiDirtyIds((ids) => ids.filter((id) => id !== question.clientId));
    if (aiEditingId === question.clientId) setAiEditingId(null);
    setAiError(""); setAiMessage("Unsaved MCQ removed from the preview.");
  }
  async function reviewAI(x, decision) {setFeedbackArea("reviewAI");
    let reason = "";
    if (decision === "REJECT") {
      reason = window.prompt("Reason for rejection:") || "";
      if (!reason) return;
    }
    try {
      await api("/admin/questions/" + x.id + "/review", {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
      });
      setMsg(
        decision === "APPROVE"
          ? "AI question reviewed and approved."
          : "AI question rejected.",
      );
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function status(x, status) {
    try {
      await api("/admin/questions/" + x.id + "/status", {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setMsg("Question status changed to " + status + ".");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function deleteQuestion(x) {
    setFeedbackArea("reviewAI");
    setErr(""); setMsg("");
    if (!window.confirm("Permanently delete this question? If used in assessments, its answers and section references will also be removed, changing historical scores. This cannot be undone.")) return;
    try {
      await api("/admin/questions/" + x.id, { method: "DELETE" });
      setRows(items => items.filter(item => item.id !== x.id));
      if (editId === x.id) reset();
      setMsg("Question deleted successfully.");
    } catch (e) {
      const message = String(e.message || "");
      if (/409|conflict|used in an assessment|referenced/i.test(message)) {
        setErr("This question is already used in an assessment and cannot be permanently deleted. Use Deactivate to remove it from future assessments while preserving existing results.");
      } else setErr(message);
    }
  }
  const domainName = (id) => domains.find((x) => x.id === id)?.name || "Common";
  return (
    <main className="wrap question-bank-page">
      <div className="intern-head">
        <div>
          <h1>Question Bank</h1>
          <p className="muted">
            Build and maintain reusable assessment questions by domain, topic,
            difficulty and type.
          </p>
        </div>
        <span className="badge">
          {rows.filter((x) => x.status === "ACTIVE").length} active /{" "}
          {rows.length} total
        </span>
      </div>
      <nav className="question-workspace-tabs" aria-label="Question Bank workspaces">{[["library","Question Library"],["ai","Generate with AI"],["manual",editId?"Edit Question":"Add Question"]].map(([id,label])=><button key={id} type="button" aria-current={workspace===id?"page":undefined} className={workspace===id?"is-active":""} onClick={()=>setWorkspace(id)}>{label}</button>)}</nav>
      {workspace==="ai" && <AdminQuestionAiPanel
        ai={ai}
        setAi={setAi}
        domains={domains}
        aiBusy={aiBusy}
        aiError={aiError}
        aiMessage={aiMessage}
        generateAI={generateAI}
        generatedRows={generatedRows}
        aiPreviewRef={aiPreviewRef}
        discardAiDrafts={discardAiDrafts}
        aiSelectedIds={aiSelectedIds}
        setAiSelectedIds={setAiSelectedIds}
        approveGenerated={approveGenerated}
        aiEditingId={aiEditingId}
        setAiEditingId={setAiEditingId}
        updateAiDraft={updateAiDraft}
        updateAiOption={updateAiOption}
        draftError={draftError}
        regenerateGenerated={regenerateGenerated}
        removeGenerated={removeGenerated}
        domainName={domainName}
      />}
      {workspace==="manual" && <AdminQuestionEditor
        editId={editId}
        reset={reset}
        feedbackArea={feedbackArea}
        error={err}
        message={msg}
        save={save}
        form={form}
        setForm={setForm}
        domains={domains}
        editingAiDraft={editingAiDraft}
        busy={busy}
      />}
      {workspace==="library" && <section className="card workflow-section question-library">
        <div className="verification-title">
          <div>
            <h2>Question Library</h2>{(feedbackArea==="reviewAI"||feedbackArea==="library")&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
            <p className="muted">
              Search and filter without removing historical questions.
            </p>
          </div>
        </div>
        {fullStackFilter && <p className="muted">Full Stack questions can be moved between Frontend and Backend using the Move to menu on each question. Automatic topic detection still applies to questions without an assigned category.</p>}
        <nav aria-label="Question Library categories" style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {(fullStackFilter ? [{key:"ALL",label:"All Full Stack"},{key:"FRONTEND",label:"Frontend"},{key:"BACKEND",label:"Backend"},{key:"UNCLASSIFIED",label:"Unclassified"}] : [{key:"ALL",label:"All Questions"},{key:"FRONTEND",label:"Frontend"},{key:"BACKEND",label:"Backend"}]).map(tab => (
            <button key={tab.key} type="button" aria-pressed={questionTab===tab.key} className={"btn "+(questionTab===tab.key?"":"secondary")} onClick={()=>selectQuestionTab(tab.key)} disabled={!fullStackFilter&&tab.key!=="ALL"&&!questionDomains[tab.key]}>
              {tab.label} ({rows.filter(q=>(!filter.domain||q.domain_id===filter.domain)&&(tab.key==="ALL"||(fullStackFilter?fullStackIds.includes(q.domain_id)&&fullStackQuestionCategory(q)===tab.key:q.domain_id===questionDomains[tab.key]))).length})
            </button>
          ))}
        </nav>
        <div className="question-filters">
          <input
            className="input"
            placeholder="Search question or topic…"
            value={filter.q}
            onChange={(e) => {setFilter((x) => ({ ...x, q: e.target.value }));setLibraryPage(1);}}
          />
          <select
            className="input"
            value={filter.domain}
            onChange={(e) => { setFilter((x) => ({ ...x, domain: e.target.value })); setQuestionTab("ALL"); setLibraryPage(1); }}
          >
            <option value="">All domains</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={filter.difficulty}
            onChange={(e) => {setFilter((x) => ({ ...x, difficulty: e.target.value }));setLibraryPage(1);}}
          >
            <option value="">All difficulty</option>
            <option>EASY</option>
            <option>MEDIUM</option>
            <option>HARD</option>
          </select>
          <select
            className="input"
            value={filter.type}
            onChange={(e) => {setFilter((x) => ({ ...x, type: e.target.value }));setLibraryPage(1);}}
          >
            <option value="">All types</option>
            {QUESTION_TYPES.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
          </select>
          <select
            className="input"
            value={filter.status}
            onChange={(e) => {setFilter((x) => ({ ...x, status: e.target.value }));setLibraryPage(1);}}
          >
            <option value="">All status</option>
            <option>DRAFT</option>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select>
        </div>
        {!visible.length ? (
          <p className="muted">No questions match the selected filters.</p>
        ) : (
          paginatedQuestions.map((x) => (
            <div className="question-row" key={x.id}>
              <div className="question-main">
                <div className="question-tags">
                  <span>{domainName(x.domain_id)}</span>
                  <span>{x.topic || "General"}</span>
                  <span>{x.difficulty}</span>
                  <span>{x.type}</span>
                  <span>
                    {x.marks} mark{x.marks == 1 ? "" : "s"}
                  </span>
                </div>
                <b>{x.question}</b>
                {x.explanation && <small>{x.explanation}</small>}
              </div>
              <div className="action-row">
                <span
                  className={
                    "status-pill " +
                    (x.status === "ACTIVE" ? "status-verified" : "")
                  }
                >
                  {x.status}
                </span>
                {x.source === "AI" && x.status === "DRAFT" && (
                  <>
                    <button
                      className="btn"
                      onClick={() => reviewAI(x, "APPROVE")}
                    >
                      Review & Approve
                    </button>
                    <button
                      className="btn danger"
                      onClick={() => reviewAI(x, "REJECT")}
                    >
                      Reject
                    </button>
                  </>
                )}
                {fullStackIds.includes(x.domain_id) && <select className="input" aria-label="Move question to section" value="" disabled={busy} onChange={e=>{if(e.target.value)moveQuestion(x,e.target.value);}}>
                  <option value="">Move to…</option>
                  {fullStackQuestionCategory(x)!=="FRONTEND" && <option value="FRONTEND">Frontend</option>}
                  {fullStackQuestionCategory(x)!=="BACKEND" && <option value="BACKEND">Backend</option>}
                </select>}
                <button className="btn danger" onClick={() => deleteQuestion(x)}>Delete</button>
                <button className="btn secondary" onClick={() => edit(x)}>
                  Edit
                </button>
                {x.status !== "ACTIVE" && !(x.source === "AI" && x.status === "DRAFT") && (
                  <button className="btn" onClick={() => status(x, "ACTIVE")}>
                    Activate
                  </button>
                )}
                {x.status === "ACTIVE" && (
                  <button
                    className="btn secondary"
                    onClick={() => status(x, "INACTIVE")}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {visible.length>0&&<div className="question-library-pagination"><span>Showing {(currentPage-1)*libraryPageSize+1}–{Math.min(currentPage*libraryPageSize,visible.length)} of {visible.length} questions</span><div><label>Rows per page <select value={libraryPageSize} onChange={e=>{setLibraryPageSize(Number(e.target.value));setLibraryPage(1);}}>{[5,10,20,50].map(n=><option key={n} value={n}>{n}</option>)}</select></label><button className="btn secondary" disabled={currentPage===1} onClick={()=>setLibraryPage(p=>Math.max(1,p-1))}>Previous</button><span>Page {currentPage} of {pageCount}</span><button className="btn secondary" disabled={currentPage===pageCount} onClick={()=>setLibraryPage(p=>Math.min(pageCount,p+1))}>Next</button></div></div>}
      </section>}
      <style jsx global>{`
      .question-bank-page{color:#111}.question-bank-page .question-workspace-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px;padding:6px;border:1px solid #dce8e0;border-radius:14px;background:#eef5f0}
      .question-bank-page .question-workspace-tabs button{min-height:44px;padding:10px 18px;border:1px solid transparent;border-radius:10px;background:transparent;color:#234b37;font-weight:700;cursor:pointer}
      .question-bank-page .question-workspace-tabs button.is-active{background:#065f46;color:#fff}
      .question-bank-page .question-workspace-tabs button:hover:not(.is-active){background:#dcece2;color:#111}
      .question-bank-page .card{border-radius:16px;padding:24px}.question-bank-page .input{border:1.5px solid #7ea7ef;border-radius:9px;min-height:44px;color:#111}
      .question-bank-page .btn{min-height:40px;background:#065f46;color:#fff}.question-bank-page .btn:hover:not(:disabled){background:#064e3b;color:#fff}
      .question-bank-page .btn.secondary{background:#e8f5ee;color:#075b3b}.question-bank-page .btn.secondary:hover:not(:disabled){background:#065f46;color:#fff}
      .question-bank-page .btn.danger{background:#b42332;color:#fff}.question-bank-page .btn.danger:hover:not(:disabled){background:#91202a;color:#fff}
      .question-bank-page .question-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;padding:16px 0}
      .question-bank-page .question-row .action-row{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:7px;max-width:350px}
      .question-bank-page .question-row .action-row .input{width:auto;max-width:160px;margin:0}
      .question-bank-page .question-library-pagination{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;padding-top:18px;margin-top:12px;border-top:1px solid #dce8e0;font-size:12px}
      .question-bank-page .question-library-pagination>div{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
      .question-bank-page .question-library-pagination label{display:inline-flex;flex-direction:row;align-items:center;gap:8px;font-size:12px;white-space:nowrap;flex:0 0 auto;min-width:max-content}
      .question-bank-page .question-library-pagination select{width:auto;min-height:40px;margin:0;border-radius:8px;padding:7px}
      @media(max-width:760px){.question-bank-page .question-row{grid-template-columns:1fr}.question-bank-page .question-row .action-row{justify-content:flex-start;max-width:none}.question-bank-page .card{padding:16px}}
      `}</style>
    </main>
  );
}

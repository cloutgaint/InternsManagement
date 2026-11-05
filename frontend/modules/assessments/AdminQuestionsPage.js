"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/shared/api/client";
import { QUESTION_TYPES, fullStackQuestionCategory, isFullStackDomain } from "./AssessmentQuestionWorkspace";
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
  const fullStackFilter = domains.some(domain => domain.id === filter.domain && isFullStackDomain(domain));
  const selectQuestionTab = (tab) => {
    setQuestionTab(tab);
    const domainId = fullStackFilter ? filter.domain : tab === "ALL" ? "" : questionDomains[tab] || "";
    setFilter(current => ({ ...current, domain: domainId }));
    if (domainId) {
      setAi(current => ({ ...current, domainId }));
      if (!editId) setForm(current => ({ ...current, domainId }));
    }
  };
  const visible = useMemo(
    () =>
      rows.filter(
        (x) =>
          (!filter.q ||
            (x.question || "").toLowerCase().includes(filter.q.toLowerCase()) ||
            (x.topic || "").toLowerCase().includes(filter.q.toLowerCase())) &&
          (questionTab === "ALL" || (fullStackFilter ? fullStackQuestionCategory(x) === questionTab : (questionDomains[questionTab] && x.domain_id === questionDomains[questionTab]))) &&
          (!filter.domain || x.domain_id === filter.domain) &&
          (!filter.difficulty || x.difficulty === filter.difficulty) &&
          (!filter.type || x.type === filter.type) &&
          (!filter.status || x.status === filter.status),
      ),
    [rows, filter, questionTab, questionDomains, fullStackFilter],
  );
  const generatedRows = aiDrafts;
  const editingAiDraft = Boolean(editId && rows.find((question) => question.id === editId)?.source === "AI" && rows.find((question) => question.id === editId)?.status === "DRAFT");
  function reset() {
    setForm(empty);
    setEditId(null);
  }
  function edit(x) {
    setFeedbackArea("save"); setErr(""); setMsg("");
    setEditId(x.id);
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
    if (aiDrafts.length && aiDirtyIds.length && !window.confirm("Replace the edited unsaved MCQs with a new generation?")) return;
    try {
      setAiBusy(true);
      const out = await api("/admin/questions/ai-generate", {
        method: "POST",
        body: JSON.stringify({ ...ai, topic: "", types: ["MCQ"] }),
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
    <main className="wrap">
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
      <section className="card ai-question-panel">
        <div className="verification-title">
          <div>
            <span className="eyebrow">AI ASSISTED</span>
            <h2>Generate Assessment Questions</h2>
            <p className="muted">Generate single-answer MCQ drafts, review them, then explicitly approve the questions to add them to the active library.</p>
          </div>
          <span className="status-pill">REVIEW REQUIRED</span>
        </div>
        {aiError && <p className="error" role="alert">{aiError}</p>}
        {aiMessage && <p className="success" role="status">{aiMessage}</p>}
        <form id="ai-generation-form" onSubmit={generateAI}>
          <div className="form-field">
            <label>Describe the questions you want to generate</label>
            <textarea className="input ai-prompt-input" value={ai.instructions} onChange={(e) => setAi((current) => ({ ...current, instructions: e.target.value }))} placeholder="Example: Generate scenario-based MCQs covering SQL INNER/LEFT joins, duplicate rows, NULL handling, and query-result reasoning. Use intermediate complexity and avoid definition-only questions." required />
            <span className="field-help">Include topics, subtopics, concepts, preferred question style, and complexity.</span>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label>Domain <span className="muted">(optional)</span></label>
              <select
                className="input"
                value={ai.domainId}
                onChange={(e) =>
                  setAi((x) => ({ ...x, domainId: e.target.value }))
                }
              >
                <option value="">Common / All Domains</option>
                {domains.map((d) => (
                  <option value={d.id} key={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Programming Language / Subject <span className="muted">(optional)</span></label>
              <input className="input" list="ai-subjects" value={ai.subject} onChange={(e) => setAi((current) => ({ ...current, subject: e.target.value }))} placeholder="Python, Java, SQL, Cybersecurity…" />
              <datalist id="ai-subjects"><option value="Python"/><option value="Java"/><option value="JavaScript"/><option value="SQL"/><option value="Cybersecurity"/><option value="AI / Machine Learning"/></datalist>
            </div>
            <div className="form-field">
              <label>Difficulty</label>
              <select
                className="input"
                value={ai.difficulty}
                onChange={(e) =>
                  setAi((x) => ({ ...x, difficulty: e.target.value }))
                }
              >
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
            <div className="form-field">
              <label>Number of Questions</label>
              <select className="input" value={ai.count} onChange={(e) => setAi((current) => ({ ...current, count: Number(e.target.value) }))}>{[5,10,15,20,25,30].map((count) => <option key={count} value={count}>{count}</option>)}</select>
            </div>
            <div className="form-field">
              <label>Default Marks</label>
              <input
                className="input"
                type="number"
                min=".5"
                step=".5"
                value={ai.marks}
                onChange={(e) =>
                  setAi((x) => ({ ...x, marks: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <div className="form-actions">
            <span className="muted">Output: single-correct-answer MCQs</span>
            <button className="btn" disabled={aiBusy || !ai.instructions.trim()}>
              {aiBusy ? "Generating MCQs…" : "Generate MCQs with AI"}
            </button>
          </div>
        </form>
        {!!generatedRows.length && <div className="ai-generated-preview" ref={aiPreviewRef} tabIndex={-1}>
          <div className="verification-title"><div><h3>Generated MCQs — Review Before Saving</h3><p className="muted">{generatedRows.length} unsaved MCQ{generatedRows.length === 1 ? "" : "s"}. Edit or regenerate before saving to the Question Bank.</p></div><div className="action-row"><button type="submit" form="ai-generation-form" className="btn secondary" disabled={aiBusy}>Regenerate Questions</button><button type="button" className="btn secondary" disabled={aiBusy} onClick={discardAiDrafts}>Discard Draft</button><button type="button" className="btn" disabled={aiBusy || !aiSelectedIds.length} onClick={() => approveGenerated(aiSelectedIds)}>{aiSelectedIds.length === generatedRows.length ? "Save All Valid Questions" : `Save Selected (${aiSelectedIds.length})`}</button></div></div>
          {generatedRows.map((question, questionIndex) => <div className="ai-preview-question" key={question.clientId}>
            <label className="ai-preview-select"><input type="checkbox" disabled={aiBusy} checked={aiSelectedIds.includes(question.clientId)} onChange={(e) => setAiSelectedIds((ids) => e.target.checked ? [...ids, question.clientId] : ids.filter((id) => id !== question.clientId))} /></label>
            <div className="question-main">
              <div className="question-tags"><span>Question {questionIndex + 1}</span><span>{domainName(question.domainId)}</span><span>{question.topic || "Prompt-defined"}</span><span>{question.difficulty}</span><span>{question.marks} marks</span><span>UNSAVED</span></div>
              {aiEditingId === question.clientId ? <div className="ai-inline-editor">
                <div className="form-field"><label>Question text</label><textarea className="input" value={question.question} onChange={(e) => updateAiDraft(question.clientId, { question: e.target.value })} /></div>
                <div className="mcq-option-grid">{question.options.map((option, optionIndex) => <div className="mcq-option-field" key={optionIndex}><label className="mcq-correct-pick"><input type="radio" name={`ai-correct-${question.clientId}`} checked={question.correctAnswer === option && Boolean(option)} onChange={() => updateAiDraft(question.clientId, { correctAnswer: option })} />Correct</label><div className="form-field"><label>Option {String.fromCharCode(65 + optionIndex)}</label><input className="input" value={option} onChange={(e) => updateAiOption(question, optionIndex, e.target.value)} /></div></div>)}</div>
                <div className="form-grid"><div className="form-field"><label>Difficulty</label><select className="input" value={question.difficulty} onChange={(e) => updateAiDraft(question.clientId, { difficulty: e.target.value })}><option>EASY</option><option>MEDIUM</option><option>HARD</option></select></div><div className="form-field"><label>Explanation</label><textarea className="input" value={question.explanation} onChange={(e) => updateAiDraft(question.clientId, { explanation: e.target.value })} /></div></div>
                {draftError(question) && <p className="error" role="alert">{draftError(question)}</p>}
              </div> : <><b>{question.question}</b><ol className="ai-option-preview">{question.options.map((option) => <li key={option}>{option}</li>)}</ol><small><b>Correct Answer:</b> {String.fromCharCode(65 + question.options.indexOf(question.correctAnswer))}. {question.correctAnswer}</small><small><b>Explanation:</b> {question.explanation}</small></>}
            </div>
            <div className="action-row">
              <button type="button" className="btn secondary" disabled={aiBusy} onClick={() => setAiEditingId((id) => id === question.clientId ? null : question.clientId)}>{aiEditingId === question.clientId ? "Done" : "Edit"}</button>
              <button type="button" className="btn secondary" disabled={aiBusy} onClick={() => regenerateGenerated(question)}>Regenerate</button>
              <button type="button" className="btn danger" disabled={aiBusy} onClick={() => removeGenerated(question)}>Delete</button>
            </div>
          </div>)}
        </div>}
      </section>
      <section className="card question-editor">
        <div className="verification-title">
          <div>
            <h2>{editId ? "Edit Question" : "Add Question"}</h2>
            <p className="muted">
              Objective questions can be auto-scored. Descriptive questions use
              a marking guide for mentor evaluation.
            </p>
          </div>
          {editId && (
            <button className="btn secondary" onClick={reset}>
              Cancel Edit
            </button>
          )}
        </div>
        {feedbackArea === "save" && <>{err && <p className="error" role="alert">{err}</p>}{msg && <p className="success" role="status">{msg}</p>}</>}
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="form-field">
              <label>Domain</label>
              <select
                className="input"
                value={form.domainId}
                onChange={(e) =>
                  setForm((x) => ({ ...x, domainId: e.target.value }))
                }
              >
                <option value="">Common / All Domains</option>
                {domains.map((d) => (
                  <option value={d.id} key={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Topic</label>
              <input
                className="input"
                value={form.topic}
                onChange={(e) =>
                  setForm((x) => ({ ...x, topic: e.target.value }))
                }
                placeholder="Example: SQL Joins"
              />
            </div>
            <div className="form-field">
              <label>Difficulty</label>
              <select
                className="input"
                value={form.difficulty}
                onChange={(e) =>
                  setForm((x) => ({ ...x, difficulty: e.target.value }))
                }
              >
                <option>EASY</option>
                <option>MEDIUM</option>
                <option>HARD</option>
              </select>
            </div>
            <div className="form-field">
              <label>Question Type</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) =>
                  setForm((x) => ({
                    ...x,
                    type: e.target.value,
                    correctAnswer: "",
                    options: ["", "", "", ""],
                  }))
                }
              >
                {QUESTION_TYPES.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Question</label>
            <textarea
              className="input question-text"
              value={form.question}
              onChange={(e) =>
                setForm((x) => ({ ...x, question: e.target.value }))
              }
              required
              placeholder="Enter the complete question"
            />
          </div>
          {["MCQ", "MULTI_SELECT"].includes(form.type) && (
            <div className="option-grid">
              {form.options.map((o, i) => (
                <div className="form-field" key={i}>
                  <label>Option {String.fromCharCode(65 + i)}</label>
                  <input
                    className="input"
                    value={o}
                    onChange={(e) =>
                      setForm((x) => ({
                        ...x,
                        options: x.options.map((v, n) =>
                          n === i ? e.target.value : v,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}
          {["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(form.type) && (
            <div className="form-field">
              <label>Correct Answer</label>
              {form.type === "TRUE_FALSE" ? (
                <select
                  className="input"
                  value={form.correctAnswer}
                  onChange={(e) =>
                    setForm((x) => ({ ...x, correctAnswer: e.target.value }))
                  }
                  required
                >
                  <option value="">Select answer</option>
                  <option value="True">True</option>
                  <option value="False">False</option>
                </select>
              ) : (
                <input
                  className="input"
                  value={form.correctAnswer}
                  onChange={(e) =>
                    setForm((x) => ({ ...x, correctAnswer: e.target.value }))
                  }
                  required
                  placeholder={
                    form.type === "MULTI_SELECT"
                      ? "Enter correct option text separated by commas"
                      : "Enter exact correct option text"
                  }
                />
              )}
              <span className="field-help">
                The answer is used by the assessment auto-scoring workflow.
              </span>
            </div>
          )}
          {!['MCQ', 'MULTI_SELECT', 'TRUE_FALSE'].includes(form.type) && (
            <div className="form-field">
              <label>Marking Guide</label>
              <textarea
                className="input"
                value={form.markingGuide}
                onChange={(e) =>
                  setForm((x) => ({ ...x, markingGuide: e.target.value }))
                }
                placeholder="Expected concepts / points for manual evaluation"
              />
            </div>
          )}
          <div className="form-grid">
            <div className="form-field">
              <label>Marks</label>
              <input
                className="input"
                type="number"
                min="0.5"
                step="0.5"
                value={form.marks}
                onChange={(e) =>
                  setForm((x) => ({ ...x, marks: e.target.value }))
                }
                required
              />
            </div>
            <div className="form-field">
              <label>Status</label>
              <select
                className="input"
                value={form.status}
                disabled={editingAiDraft}
                onChange={(e) =>
                  setForm((x) => ({ ...x, status: e.target.value }))
                }
              >
                <option>DRAFT</option>
                <option>ACTIVE</option>
                <option>INACTIVE</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Explanation / Reference Answer</label>
            <textarea
              className="input"
              value={form.explanation}
              onChange={(e) =>
                setForm((x) => ({ ...x, explanation: e.target.value }))
              }
              placeholder="Optional explanation shown after evaluation"
            />
          </div>
          <div className="form-actions">
            <button className="btn" disabled={busy}>
              {busy ? "Saving…" : editId ? "Update Question" : "Add Question"}
            </button>
          </div>
        </form>
      </section>
      <section className="card workflow-section">
        <div className="verification-title">
          <div>
            <h2>Question Library</h2>{feedbackArea==="reviewAI"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
            <p className="muted">
              Search and filter without removing historical questions.
            </p>
          </div>
        </div>
        <nav aria-label="Question Library categories" style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {(fullStackFilter ? [{key:"ALL",label:"All Full Stack"},{key:"FRONTEND",label:"Frontend"},{key:"BACKEND",label:"Backend"},{key:"UNCLASSIFIED",label:"Unclassified"}] : [{key:"ALL",label:"All Questions"},{key:"FRONTEND",label:"Frontend"},{key:"BACKEND",label:"Backend"}]).map(tab => (
            <button key={tab.key} type="button" aria-pressed={questionTab===tab.key} className={"btn "+(questionTab===tab.key?"":"secondary")} onClick={()=>selectQuestionTab(tab.key)} disabled={!fullStackFilter&&tab.key!=="ALL"&&!questionDomains[tab.key]}>
              {tab.label} ({rows.filter(q=>(!filter.domain||q.domain_id===filter.domain)&&(tab.key==="ALL"||(fullStackFilter?fullStackQuestionCategory(q)===tab.key:q.domain_id===questionDomains[tab.key]))).length})
            </button>
          ))}
        </nav>
        <div className="question-filters">
          <input
            className="input"
            placeholder="Search question or topic…"
            value={filter.q}
            onChange={(e) => setFilter((x) => ({ ...x, q: e.target.value }))}
          />
          <select
            className="input"
            value={filter.domain}
            onChange={(e) => { setFilter((x) => ({ ...x, domain: e.target.value })); setQuestionTab("ALL"); }}
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
            onChange={(e) =>
              setFilter((x) => ({ ...x, difficulty: e.target.value }))
            }
          >
            <option value="">All difficulty</option>
            <option>EASY</option>
            <option>MEDIUM</option>
            <option>HARD</option>
          </select>
          <select
            className="input"
            value={filter.type}
            onChange={(e) => setFilter((x) => ({ ...x, type: e.target.value }))}
          >
            <option value="">All types</option>
            {QUESTION_TYPES.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
          </select>
          <select
            className="input"
            value={filter.status}
            onChange={(e) =>
              setFilter((x) => ({ ...x, status: e.target.value }))
            }
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
          visible.map((x) => (
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
      </section>
    </main>
  );
}

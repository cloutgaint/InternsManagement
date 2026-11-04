"use client";
import { useMemo, useState } from "react";
import { api } from "@/shared/api/client";

// The shared Question Bank still supports these types outside Initial Assessment.
export const QUESTION_TYPES = [
  ["MCQ", "Single Choice (MCQ)"], ["MULTI_SELECT", "Multiple Select"],
  ["TRUE_FALSE", "True / False"], ["SHORT_TEXT", "Short Text"],
  ["DESCRIPTIVE", "Descriptive"], ["CASE_STUDY", "Case Study"],
  ["CODING_PRACTICAL", "Coding / Practical"], ["WRITING_SAMPLE", "Writing Sample"],
  ["PORTFOLIO_LINK", "Portfolio Link"],
];

const blankQuestion = (domainId = "") => ({
  domainId, topic: "", difficulty: "MEDIUM", type: "MCQ", question: "",
  options: ["", "", "", ""], correctAnswer: "", marks: 1,
  explanation: "", status: "ACTIVE",
});
const blankAi = (domainId = "") => ({ domainId, topic: "", difficulty: "MEDIUM", count: 3, marks: 1 });
const blankFilters = { q: "", domain: "", topic: "", difficulty: "" };
const isEligibleMcq = (question) =>
  question.type === "MCQ" && question.status === "ACTIVE" &&
  Array.isArray(question.options) && question.options.length === 4 &&
  new Set(question.options.map((option) => String(option).trim().toLowerCase())).size === 4 &&
  question.options.some((option) => String(option).trim() === String(question.correct_answer ?? "").trim());

function McqFields({ value, setValue, domains, editingAiDraft }) {
  const set = (key, next) => setValue((current) => ({ ...current, [key]: next }));
  const setOption = (index, next) => setValue((current) => {
    const previous = current.options[index];
    return {
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index ? next : option),
      correctAnswer: current.correctAnswer === previous ? next : current.correctAnswer,
    };
  });
  return <>
    <div className="form-grid compact-grid">
      <div className="form-field"><label>Domain</label><select className="input" value={value.domainId} onChange={(e) => set("domainId", e.target.value)}><option value="">Common / All Domains</option>{domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}</select></div>
      <div className="form-field"><label>Difficulty</label><select className="input" value={value.difficulty} onChange={(e) => set("difficulty", e.target.value)}><option>EASY</option><option>MEDIUM</option><option>HARD</option></select></div>
      <div className="form-field"><label>Marks</label><input className="input" type="number" min="0.5" step="0.5" value={value.marks} onChange={(e) => set("marks", e.target.value)} required /></div>
      {!editingAiDraft && <div className="form-field"><label>Status</label><select className="input" value={value.status} onChange={(e) => set("status", e.target.value)}><option>ACTIVE</option><option>DRAFT</option><option>INACTIVE</option></select></div>}
    </div>
    <div className="form-field"><label>Question</label><textarea className="input question-text" value={value.question} onChange={(e) => set("question", e.target.value)} required /></div>
    <div className="mcq-option-grid">{value.options.map((option, index) => <div className="mcq-option-field" key={index}>
      <label className="mcq-correct-pick"><input type="radio" name="correct-answer" checked={Boolean(option) && value.correctAnswer === option} disabled={!option.trim()} onChange={() => set("correctAnswer", option)} />Correct</label>
      <div className="form-field"><label>Option {String.fromCharCode(65 + index)}</label><input className="input" value={option} onChange={(e) => setOption(index, e.target.value)} required /></div>
    </div>)}</div>
    <div className="form-field"><label>Explanation</label><textarea className="input" value={value.explanation} onChange={(e) => set("explanation", e.target.value)} /></div>
    {editingAiDraft && <p className="muted">This AI-generated MCQ remains DRAFT until explicitly approved.</p>}
  </>;
}

function QuestionPreview({ question, domainName }) {
  if (!question) return null;
  return <div className="question-preview">
    <div className="question-tags"><span>MCQ</span><span>{domainName(question.domain_id)}</span><span>{question.difficulty}</span><span>{question.marks} marks</span><span>{question.status}</span></div>
    <h3>{question.question}</h3><ol>{(question.options || []).map((option) => <li key={option}>{option}</li>)}</ol>
    {question.explanation && <p><b>Explanation:</b> {question.explanation}</p>}
  </div>;
}

export default function AssessmentQuestionWorkspace({ section, questions, domains, usedQuestionIds, onChange, onReload, error, setError }) {
  const [modal, setModal] = useState(null);
  const [modalError, setModalError] = useState("");
  const [busy, setBusy] = useState(false);
  const [questionForm, setQuestionForm] = useState(blankQuestion(section.domainId));
  const [editId, setEditId] = useState(null);
  const [editingAiDraft, setEditingAiDraft] = useState(false);
  const [ai, setAi] = useState(blankAi(section.domainId));
  const [generatedIds, setGeneratedIds] = useState([]);
  const [filters, setFilters] = useState({ ...blankFilters, domain: section.domainId || "" });
  const [bankSelection, setBankSelection] = useState([]);
  const [preview, setPreview] = useState(null);
  const selected = section.questionIds.map((id) => questions.find((question) => question.id === id)).filter(Boolean);
  const domainName = (id) => domains.find((domain) => domain.id === id)?.name || "Common";
  const totalMarks = selected.reduce((sum, question) => sum + Number(question.marks || 0), 0);
  const generated = generatedIds.map((id) => questions.find((question) => question.id === id)).filter(Boolean);
  const bankRows = useMemo(() => questions.filter((question) =>
    isEligibleMcq(question) &&
    (!filters.q || question.question.toLowerCase().includes(filters.q.toLowerCase())) &&
    (!filters.domain || question.domain_id === filters.domain) &&
    (!filters.topic || (question.topic || "").toLowerCase().includes(filters.topic.toLowerCase())) &&
    (!filters.difficulty || question.difficulty === filters.difficulty)), [questions, filters]);

  function openManual(question = null) {
    if (question && question.type !== "MCQ") return setError("Initial Assessments support only single-answer MCQs.");
    setModalError(""); setEditId(question?.id || null);
    setEditingAiDraft(question?.source === "AI" && question?.status === "DRAFT");
    setQuestionForm(question ? {
      domainId: question.domain_id || "", topic: question.topic || "", difficulty: question.difficulty,
      type: "MCQ", question: question.question,
      options: Array.isArray(question.options) ? [...question.options, "", "", "", ""].slice(0, 4) : ["", "", "", ""],
      correctAnswer: question.correct_answer ?? "", marks: question.marks,
      explanation: question.explanation || "", status: question.status,
    } : blankQuestion(section.domainId));
    setModal("manual");
  }

  async function saveQuestion(event) {
    event.preventDefault(); setModalError("");
    const options = questionForm.options.map((option) => option.trim());
    if (options.some((option) => !option)) return setModalError("All four options are required.");
    if (new Set(options.map((option) => option.toLowerCase())).size !== 4) return setModalError("All four options must be different.");
    const selectedIndex = questionForm.options.indexOf(questionForm.correctAnswer);
    if (selectedIndex < 0) return setModalError("Select exactly one correct answer.");
    setBusy(true);
    try {
      const saved = await api(editId ? `/admin/questions/${editId}` : "/admin/questions", {
        method: editId ? "PATCH" : "POST",
        body: JSON.stringify({ ...questionForm, type: "MCQ", options, correctAnswer: options[selectedIndex], marks: Number(questionForm.marks), source: "MANUAL" }),
      });
      await onReload();
      if (!editId && saved.status === "ACTIVE") onChange([...section.questionIds, saved.id]);
      setModal(null);
    } catch (requestError) { setModalError(requestError.message); } finally { setBusy(false); }
  }

  async function generate(event) {
    event.preventDefault(); setModalError(""); setBusy(true);
    try {
      const rows = await api("/admin/questions/ai-generate", { method: "POST", body: JSON.stringify({ ...ai, types: ["MCQ"] }) });
      setGeneratedIds((ids) => [...rows.map((question) => question.id), ...ids]);
      await onReload();
    } catch (requestError) { setModalError(requestError.message); } finally { setBusy(false); }
  }

  async function review(question, decision, reason = "") {
    setModalError("");
    try {
      await api(`/admin/questions/${question.id}/review`, { method: "POST", body: JSON.stringify({ decision, reason }) });
      await onReload();
      if (decision === "APPROVE" && !section.questionIds.includes(question.id) && !usedQuestionIds.has(question.id)) onChange([...section.questionIds, question.id]);
    } catch (requestError) { setModalError(requestError.message); }
  }

  async function regenerate(question) {
    setModalError(""); setBusy(true);
    try {
      await api(`/admin/questions/${question.id}/review`, { method: "POST", body: JSON.stringify({ decision: "REJECT", reason: "Replaced by regenerated MCQ" }) });
      const rows = await api("/admin/questions/ai-generate", { method: "POST", body: JSON.stringify({ ...ai, domainId: question.domain_id || ai.domainId, topic: question.topic || ai.topic, difficulty: question.difficulty, types: ["MCQ"], count: 1, marks: question.marks }) });
      setGeneratedIds((ids) => [...rows.map((row) => row.id), ...ids.filter((id) => id !== question.id)]);
      await onReload();
    } catch (requestError) { setModalError(requestError.message); } finally { setBusy(false); }
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= section.questionIds.length) return;
    const ids = [...section.questionIds]; [ids[index], ids[target]] = [ids[target], ids[index]]; onChange(ids);
  }
  function addFromBank() {
    if (bankSelection.some((id) => usedQuestionIds.has(id))) return setModalError("One or more selected MCQs are already used in another section.");
    onChange([...section.questionIds, ...bankSelection.filter((id) => !section.questionIds.includes(id))]);
    setBankSelection([]); setError(""); setModal(null);
  }
  function closeModal() { setModal(null); setModalError(""); setPreview(null); }

  return <>
    <div className="section-question-toolbar"><div><b>{selected.length} MCQ{selected.length === 1 ? "" : "s"}</b><span>{totalMarks} total marks</span></div><div className="action-row">
      <button type="button" className="btn secondary" onClick={() => openManual()}>+ Create MCQ</button>
      <button type="button" className="btn secondary" onClick={() => { setAi((current) => generatedIds.length ? current : blankAi(section.domainId)); setModalError(""); setModal("ai"); }}>Generate with AI</button>
      <button type="button" className="btn" onClick={() => { setFilters({ ...blankFilters, domain: section.domainId || "" }); setBankSelection([]); setModalError(""); setModal("bank"); }}>Select from Question Bank</button>
    </div></div>
    {error && <p className="error section-error" role="alert">{error}</p>}
    {!selected.length ? <div className="empty-question-list">No MCQs selected. Add at least one eligible MCQ.</div> : <div className="selected-question-list">{selected.map((question, index) => <div className="selected-question-row" key={question.id}>
      <span className="question-order">{index + 1}</span><div className="selected-question-copy"><b>{question.question}</b><small>MCQ · {domainName(question.domain_id)} · {question.difficulty} · {question.marks} marks · {question.status}{question.source === "AI" ? " · AI" : ""}</small></div>
      <div className="question-row-actions"><button type="button" onClick={() => { setPreview(question); setModal("preview"); }}>Preview</button><button type="button" onClick={() => openManual(question)}>Edit</button><button type="button" aria-label="Move question up" disabled={!index} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="Move question down" disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" className="danger-link" onClick={() => onChange(section.questionIds.filter((id) => id !== question.id))}>Remove</button></div>
    </div>)}</div>}

    {modal && <div className="modal-backdrop" onMouseDown={closeModal}><section className="modal-card assessment-question-modal" onMouseDown={(event) => event.stopPropagation()}>
      <div className="verification-title"><div><h2>{modal === "manual" ? (editId ? "Edit MCQ" : "Create MCQ") : modal === "ai" ? "Generate MCQs with AI" : modal === "bank" ? "Select MCQs from Question Bank" : "MCQ Preview"}</h2>{modal === "ai" && <p className="muted">Generated MCQs stay DRAFT until explicitly approved by an Admin.</p>}</div><button type="button" className="icon-close" onClick={closeModal}>×</button></div>
      {modalError && <p className="error" role="alert">{modalError}</p>}
      {modal === "manual" && <form onSubmit={saveQuestion}><McqFields value={questionForm} setValue={setQuestionForm} domains={domains} editingAiDraft={editingAiDraft} /><div className="form-actions"><button type="button" className="btn secondary" onClick={closeModal}>Cancel</button><button className="btn" disabled={busy}>{busy ? "Saving…" : editId ? "Save Changes" : "Create & Add"}</button></div></form>}
      {modal === "ai" && <><form onSubmit={generate}><div className="form-grid compact-grid">
        <div className="form-field"><label>Domain</label><select className="input" value={ai.domainId} onChange={(e) => setAi((current) => ({ ...current, domainId: e.target.value }))}><option value="">Common / All</option>{domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}</select></div>
        <div className="form-field"><label>Topic</label><input className="input" value={ai.topic} onChange={(e) => setAi((current) => ({ ...current, topic: e.target.value }))} required /></div>
        <div className="form-field"><label>Difficulty</label><select className="input" value={ai.difficulty} onChange={(e) => setAi((current) => ({ ...current, difficulty: e.target.value }))}><option>EASY</option><option>MEDIUM</option><option>HARD</option></select></div>
        <div className="form-field"><label>Question Count</label><input className="input" type="number" min="1" max="20" value={ai.count} onChange={(e) => setAi((current) => ({ ...current, count: Number(e.target.value) }))} /></div>
        <div className="form-field"><label>Marks per MCQ</label><input className="input" type="number" min="0.5" step="0.5" value={ai.marks} onChange={(e) => setAi((current) => ({ ...current, marks: Number(e.target.value) }))} /></div>
      </div><div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Generating…" : generated.length ? "Generate More Drafts" : "Generate Draft MCQs"}</button></div></form>
      {!!generated.length && <div className="ai-review-list">{generated.map((question) => <div className="question-row" key={question.id}><div className="question-main"><div className="question-tags"><span>MCQ</span><span>{question.difficulty}</span><span>{question.marks} marks</span><span>{question.status}</span></div><b>{question.question}</b></div><div className="action-row"><button type="button" className="btn secondary" onClick={() => { setPreview(question); setModal("preview"); }}>Preview</button>{question.status === "DRAFT" && <><button type="button" className="btn secondary" onClick={() => openManual(question)}>Edit</button><button type="button" className="btn secondary" disabled={busy} onClick={() => regenerate(question)}>Regenerate</button><button type="button" className="btn danger" onClick={() => review(question, "REJECT", "Rejected during assessment creation")}>Reject</button><button type="button" className="btn" onClick={() => review(question, "APPROVE")}>Approve & Add</button></>}</div></div>)}</div>}</>}
      {modal === "bank" && <><div className="question-bank-filters mcq-bank-filters"><input className="input" placeholder="Search MCQs" value={filters.q} onChange={(e) => setFilters((current) => ({ ...current, q: e.target.value }))} /><select className="input" value={filters.domain} onChange={(e) => setFilters((current) => ({ ...current, domain: e.target.value }))}><option value="">All domains</option>{domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}</select><input className="input" placeholder="Topic" value={filters.topic} onChange={(e) => setFilters((current) => ({ ...current, topic: e.target.value }))} /><select className="input" value={filters.difficulty} onChange={(e) => setFilters((current) => ({ ...current, difficulty: e.target.value }))}><option value="">All difficulties</option><option>EASY</option><option>MEDIUM</option><option>HARD</option></select></div>
        <div className="bank-question-list">{bankRows.map((question) => { const inSection = section.questionIds.includes(question.id); const elsewhere = usedQuestionIds.has(question.id); return <label className={(inSection || elsewhere) ? "already-selected" : ""} key={question.id}><input type="checkbox" disabled={inSection || elsewhere} checked={inSection || bankSelection.includes(question.id)} onChange={(event) => setBankSelection((ids) => event.target.checked ? [...ids, question.id] : ids.filter((id) => id !== question.id))} /><span><b>{question.question}</b><small>MCQ · {domainName(question.domain_id)} · {question.topic || "General"} · {question.difficulty} · {question.marks} marks · ACTIVE {inSection ? "· Already in this section" : elsewhere ? "· Used in another section" : ""}</small></span></label>; })}{!bankRows.length && <p className="muted">No eligible active MCQs match these filters.</p>}</div>
        <div className="form-actions"><span className="muted">{bankSelection.length} selected</span><button type="button" className="btn secondary" onClick={closeModal}>Cancel</button><button type="button" className="btn" disabled={!bankSelection.length} onClick={addFromBank}>Add Selected</button></div></>}
      {modal === "preview" && <><QuestionPreview question={preview} domainName={domainName} /><div className="form-actions"><button type="button" className="btn" onClick={closeModal}>Close</button></div></>}
    </section></div>}
  </>;
}

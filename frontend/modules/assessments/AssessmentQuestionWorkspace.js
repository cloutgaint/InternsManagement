"use client";
import { useMemo, useState } from "react";
import { api } from "@/shared/api/client";

export const QUESTION_TYPES = [
  ["MCQ", "Single Choice (MCQ)"],
  ["MULTI_SELECT", "Multiple Select"],
  ["TRUE_FALSE", "True / False"],
  ["SHORT_TEXT", "Short Text"],
  ["DESCRIPTIVE", "Descriptive"],
  ["CASE_STUDY", "Case Study"],
  ["CODING_PRACTICAL", "Coding / Practical"],
  ["WRITING_SAMPLE", "Writing Sample"],
  ["PORTFOLIO_LINK", "Portfolio Link"],
];
const OBJECTIVE = ["MCQ", "MULTI_SELECT", "TRUE_FALSE"];
const blankQuestion = (domainId = "") => ({
  domainId,
  topic: "",
  difficulty: "MEDIUM",
  type: "MCQ",
  question: "",
  options: ["", "", "", ""],
  correctAnswer: "",
  markingGuide: "",
  marks: 1,
  explanation: "",
  status: "ACTIVE",
});
const blankAi = (domainId = "") => ({
  instructions: "",
  domainId,
  topic: "",
  difficulty: "MEDIUM",
  expectedLevel: "INTERMEDIATE",
  type: "MCQ",
  count: 3,
  marks: 1,
});
const blankFilters = { q: "", domain: "", topic: "", difficulty: "", type: "", status: "ACTIVE" };

function QuestionFields({ value, setValue, domains, allowStatus = true }) {
  const set = (key, next) => setValue((x) => ({ ...x, [key]: next }));
  return <>
    <div className="form-grid compact-grid">
      <div className="form-field"><label>Domain</label><select className="input" value={value.domainId} onChange={(e) => set("domainId", e.target.value)}><option value="">Common / All Domains</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div className="form-field"><label>Topic</label><input className="input" value={value.topic} onChange={(e) => set("topic", e.target.value)} /></div>
      <div className="form-field"><label>Difficulty</label><select className="input" value={value.difficulty} onChange={(e) => set("difficulty", e.target.value)}><option>EASY</option><option>MEDIUM</option><option>HARD</option></select></div>
      <div className="form-field"><label>Question Type</label><select className="input" value={value.type} onChange={(e) => setValue((x) => ({ ...x, type: e.target.value, correctAnswer: "", options: ["", "", "", ""] }))}>{QUESTION_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
    </div>
    <div className="form-field"><label>Question</label><textarea className="input question-text" value={value.question} onChange={(e) => set("question", e.target.value)} required /></div>
    {["MCQ", "MULTI_SELECT"].includes(value.type) && <div className="option-grid">{value.options.map((option, index) => <div className="form-field" key={index}><label>Option {String.fromCharCode(65 + index)}</label><input className="input" value={option} onChange={(e) => setValue((x) => ({ ...x, options: x.options.map((o, i) => i === index ? e.target.value : o) }))} /></div>)}</div>}
    {OBJECTIVE.includes(value.type) && <div className="form-field"><label>Correct Answer</label>{value.type === "TRUE_FALSE" ? <select className="input" value={value.correctAnswer} onChange={(e) => set("correctAnswer", e.target.value)} required><option value="">Select answer</option><option value="True">True</option><option value="False">False</option></select> : <input className="input" value={value.correctAnswer} onChange={(e) => set("correctAnswer", e.target.value)} placeholder={value.type === "MULTI_SELECT" ? "Exact option texts, separated by commas" : "Exact option text"} required />}</div>}
    {!OBJECTIVE.includes(value.type) && <div className="form-field"><label>Marking Guide / Evaluation Criteria</label><textarea className="input" value={value.markingGuide} onChange={(e) => set("markingGuide", e.target.value)} placeholder="Expected concepts, deliverables, or scoring guidance" /></div>}
    <div className="form-grid compact-grid">
      <div className="form-field"><label>Marks</label><input className="input" type="number" min="0.5" step="0.5" value={value.marks} onChange={(e) => set("marks", e.target.value)} required /></div>
      {allowStatus && <div className="form-field"><label>Status</label><select className="input" value={value.status} onChange={(e) => set("status", e.target.value)}><option>ACTIVE</option><option>DRAFT</option><option>INACTIVE</option></select></div>}
    </div>
    <div className="form-field"><label>Explanation / Reference Answer</label><textarea className="input" value={value.explanation} onChange={(e) => set("explanation", e.target.value)} /></div>
  </>;
}

function QuestionPreview({ question, domainName }) {
  if (!question) return null;
  return <div className="question-preview">
    <div className="question-tags"><span>{question.type}</span><span>{domainName(question.domain_id)}</span><span>{question.difficulty}</span><span>{question.marks} marks</span><span>{question.status}</span></div>
    <h3>{question.question}</h3>
    {Array.isArray(question.options) && <ol>{question.options.map((o) => <li key={o}>{o}</li>)}</ol>}
    {question.marking_guide && <p><b>Marking guide:</b> {question.marking_guide}</p>}
    {question.explanation && <p><b>Explanation:</b> {question.explanation}</p>}
  </div>;
}

export default function AssessmentQuestionWorkspace({ section, sectionIndex, questions, domains, usedQuestionIds, onChange, onReload, error, setError }) {
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
  const selected = section.questionIds.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
  const domainName = (id) => domains.find((d) => d.id === id)?.name || "Common";
  const totalMarks = selected.reduce((sum, q) => sum + Number(q.marks || 0), 0);
  const generated = generatedIds.map((id) => questions.find((q) => q.id === id)).filter(Boolean);
  const bankRows = useMemo(() => questions.filter((q) => (!filters.status || q.status === filters.status) && (!filters.q || q.question.toLowerCase().includes(filters.q.toLowerCase())) && (!filters.domain || q.domain_id === filters.domain) && (!filters.topic || (q.topic || "").toLowerCase().includes(filters.topic.toLowerCase())) && (!filters.difficulty || q.difficulty === filters.difficulty) && (!filters.type || q.type === filters.type)), [questions, filters]);

  function openManual(question = null) {
    setModalError("");
    setEditId(question?.id || null);
    setEditingAiDraft(question?.source === "AI" && question?.status === "DRAFT");
    setQuestionForm(question ? { domainId: question.domain_id || "", topic: question.topic || "", difficulty: question.difficulty, type: question.type, question: question.question, options: Array.isArray(question.options) ? [...question.options, "", "", "", ""].slice(0, 4) : ["", "", "", ""], correctAnswer: Array.isArray(question.correct_answer) ? question.correct_answer.join(", ") : (question.correct_answer ?? ""), markingGuide: question.marking_guide || "", marks: question.marks, explanation: question.explanation || "", status: question.status } : blankQuestion(section.domainId));
    setModal("manual");
  }
  async function saveQuestion(e) {
    e.preventDefault(); setModalError(""); setBusy(true);
    const objective = OBJECTIVE.includes(questionForm.type);
    const options = questionForm.type === "TRUE_FALSE" ? ["True", "False"] : ["MCQ", "MULTI_SELECT"].includes(questionForm.type) ? questionForm.options.map((x) => x.trim()).filter(Boolean) : null;
    const correctAnswer = questionForm.type === "MULTI_SELECT" ? questionForm.correctAnswer.split(",").map((x) => x.trim()).filter(Boolean) : objective ? questionForm.correctAnswer.trim() : null;
    try {
      const saved = await api(editId ? `/admin/questions/${editId}` : "/admin/questions", { method: editId ? "PATCH" : "POST", body: JSON.stringify({ ...questionForm, options, correctAnswer, marks: Number(questionForm.marks), source: "MANUAL" }) });
      await onReload();
      if (!editId && saved.status === "ACTIVE") onChange([...section.questionIds, saved.id]);
      setModal(null);
    } catch (e) { setModalError(e.message); } finally { setBusy(false); }
  }
  async function generate(e) {
    e.preventDefault(); setModalError(""); setBusy(true);
    try {
      const rows = await api("/admin/questions/ai-generate", { method: "POST", body: JSON.stringify({ ...ai, types: [ai.type] }) });
      setGeneratedIds((ids) => [...rows.map((q) => q.id), ...ids]);
      await onReload();
    } catch (e) { setModalError(e.message); } finally { setBusy(false); }
  }
  async function review(question, decision, reason = "") {
    setModalError("");
    try {
      await api(`/admin/questions/${question.id}/review`, { method: "POST", body: JSON.stringify({ decision, reason }) });
      await onReload();
      if (decision === "APPROVE" && !section.questionIds.includes(question.id) && !usedQuestionIds.has(question.id))
        onChange([...section.questionIds, question.id]);
    } catch (e) { setModalError(e.message); }
  }
  async function regenerate(question) {
    setModalError(""); setBusy(true);
    try {
      await api(`/admin/questions/${question.id}/review`, { method: "POST", body: JSON.stringify({ decision: "REJECT", reason: "Replaced by regenerated question" }) });
      const rows = await api("/admin/questions/ai-generate", { method: "POST", body: JSON.stringify({ ...ai, domainId: question.domain_id || ai.domainId, topic: question.topic || ai.topic, difficulty: question.difficulty, types: [question.type], count: 1, marks: question.marks }) });
      setGeneratedIds((ids) => [...rows.map((q) => q.id), ...ids.filter((id) => id !== question.id)]);
      await onReload();
    } catch (e) { setModalError(e.message); } finally { setBusy(false); }
  }
  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= section.questionIds.length) return;
    const ids = [...section.questionIds];
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onChange(ids);
  }
  function addFromBank() {
    const duplicates = bankSelection.filter((id) => usedQuestionIds.has(id));
    if (duplicates.length) return setModalError("One or more selected questions are already used in another section.");
    onChange([...section.questionIds, ...bankSelection.filter((id) => !section.questionIds.includes(id))]);
    setBankSelection([]); setError(""); setModal(null);
  }
  function closeModal() { setModal(null); setModalError(""); setPreview(null); }

  return <>
    <div className="section-question-toolbar">
      <div><b>{selected.length} question{selected.length === 1 ? "" : "s"}</b><span>{totalMarks} total marks</span></div>
      <div className="action-row">
        <button type="button" className="btn secondary" onClick={() => openManual()}>+ Create Question</button>
        <button type="button" className="btn secondary" onClick={() => { setAi((current) => generatedIds.length ? current : blankAi(section.domainId)); setModalError(""); setModal("ai"); }}>Generate with AI</button>
        <button type="button" className="btn" onClick={() => { setFilters({ ...blankFilters, domain: section.domainId || "" }); setBankSelection([]); setModalError(""); setModal("bank"); }}>Select from Question Bank</button>
      </div>
    </div>
    {error && <p className="error section-error" role="alert">{error}</p>}
    {!selected.length ? <div className="empty-question-list">No questions selected. Add at least one eligible question.</div> : <div className="selected-question-list">{selected.map((q, index) => <div className="selected-question-row" key={q.id}>
      <span className="question-order">{index + 1}</span><div className="selected-question-copy"><b>{q.question}</b><small>{q.type} · {domainName(q.domain_id)} · {q.difficulty} · {q.marks} marks · {q.status}{q.source === "AI" ? " · AI" : ""}</small></div>
      <div className="question-row-actions"><button type="button" onClick={() => { setPreview(q); setModal("preview"); }}>Preview</button><button type="button" onClick={() => openManual(q)}>Edit</button><button type="button" aria-label="Move question up" disabled={!index} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="Move question down" disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" className="danger-link" onClick={() => onChange(section.questionIds.filter((id) => id !== q.id))}>Remove</button></div>
    </div>)}</div>}

    {modal && <div className="modal-backdrop" onMouseDown={closeModal}><section className="modal-card assessment-question-modal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="verification-title"><div><h2>{modal === "manual" ? (editId ? "Edit Question" : "Create Question") : modal === "ai" ? "Generate Questions with AI" : modal === "bank" ? "Select from Question Bank" : "Question Preview"}</h2>{modal === "ai" && <p className="muted">Generated questions stay DRAFT until you explicitly approve them.</p>}</div><button type="button" className="icon-close" onClick={closeModal}>×</button></div>
      {modalError && <p className="error" role="alert">{modalError}</p>}
      {modal === "manual" && <form onSubmit={saveQuestion}><QuestionFields value={questionForm} setValue={setQuestionForm} domains={domains} allowStatus={!editingAiDraft} />{editingAiDraft && <p className="muted">This AI question remains DRAFT until you approve it from the AI review list.</p>}<div className="form-actions"><button type="button" className="btn secondary" onClick={closeModal}>Cancel</button><button className="btn" disabled={busy}>{busy ? "Saving…" : editId ? "Save Changes" : "Create & Add"}</button></div></form>}
      {modal === "ai" && <>
        <form onSubmit={generate}><div className="form-field"><label>Admin Prompt / Instructions</label><textarea className="input" value={ai.instructions} onChange={(e) => setAi((x) => ({ ...x, instructions: e.target.value }))} placeholder="Focus areas, constraints, scenarios, or skills to assess" /></div><div className="form-grid compact-grid">
          <div className="form-field"><label>Domain</label><select className="input" value={ai.domainId} onChange={(e) => setAi((x) => ({ ...x, domainId: e.target.value }))}><option value="">Common / All</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="form-field"><label>Topic</label><input className="input" value={ai.topic} onChange={(e) => setAi((x) => ({ ...x, topic: e.target.value }))} required /></div>
          <div className="form-field"><label>Difficulty</label><select className="input" value={ai.difficulty} onChange={(e) => setAi((x) => ({ ...x, difficulty: e.target.value }))}><option>EASY</option><option>MEDIUM</option><option>HARD</option></select></div>
          <div className="form-field"><label>Expected Level</label><select className="input" value={ai.expectedLevel} onChange={(e) => setAi((x) => ({ ...x, expectedLevel: e.target.value }))}><option>BEGINNER</option><option>INTERMEDIATE</option><option>ADVANCED</option></select></div>
          <div className="form-field"><label>Question Type</label><select className="input" value={ai.type} onChange={(e) => setAi((x) => ({ ...x, type: e.target.value }))}>{QUESTION_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <div className="form-field"><label>Number of Questions</label><input className="input" type="number" min="1" max="20" value={ai.count} onChange={(e) => setAi((x) => ({ ...x, count: Number(e.target.value) }))} /></div>
          <div className="form-field"><label>Marks per Question</label><input className="input" type="number" min="0.5" step="0.5" value={ai.marks} onChange={(e) => setAi((x) => ({ ...x, marks: Number(e.target.value) }))} /></div>
        </div><div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Generating…" : generated.length ? "Generate More Drafts" : "Generate Draft Questions"}</button></div></form>
        {!!generated.length && <div className="ai-review-list">{generated.map((q) => <div className="question-row" key={q.id}><div className="question-main"><div className="question-tags"><span>{q.type}</span><span>{q.difficulty}</span><span>{q.marks} marks</span><span>{q.status}</span></div><b>{q.question}</b></div><div className="action-row"><button type="button" className="btn secondary" onClick={() => { setPreview(q); setModal("preview"); }}>Preview</button>{q.status === "DRAFT" && <><button type="button" className="btn secondary" onClick={() => openManual(q)}>Edit</button><button type="button" className="btn secondary" disabled={busy} onClick={() => regenerate(q)}>Regenerate</button><button type="button" className="btn danger" onClick={() => review(q, "REJECT", "Rejected during assessment creation")}>Reject</button><button type="button" className="btn" onClick={() => review(q, "APPROVE")}>Approve</button></>}</div></div>)}</div>}
      </>}
      {modal === "bank" && <><div className="question-bank-filters"><input className="input" placeholder="Search question" value={filters.q} onChange={(e) => setFilters((x) => ({ ...x, q: e.target.value }))} /><select className="input" value={filters.domain} onChange={(e) => setFilters((x) => ({ ...x, domain: e.target.value }))}><option value="">All domains</option>{domains.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><input className="input" placeholder="Topic" value={filters.topic} onChange={(e) => setFilters((x) => ({ ...x, topic: e.target.value }))} /><select className="input" value={filters.difficulty} onChange={(e) => setFilters((x) => ({ ...x, difficulty: e.target.value }))}><option value="">All difficulties</option><option>EASY</option><option>MEDIUM</option><option>HARD</option></select><select className="input" value={filters.type} onChange={(e) => setFilters((x) => ({ ...x, type: e.target.value }))}><option value="">All types</option>{QUESTION_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select className="input" value={filters.status} onChange={(e) => { setFilters((x) => ({ ...x, status: e.target.value })); setBankSelection([]); }}><option value="ACTIVE">ACTIVE (eligible)</option><option value="DRAFT">DRAFT</option><option value="INACTIVE">INACTIVE</option><option value="">All statuses</option></select></div>
        <div className="bank-question-list">{bankRows.map((q) => { const inSection = section.questionIds.includes(q.id); const elsewhere = usedQuestionIds.has(q.id); const ineligible = q.status !== "ACTIVE"; return <label className={(inSection || elsewhere || ineligible) ? "already-selected" : ""} key={q.id}><input type="checkbox" disabled={inSection || elsewhere || ineligible} checked={inSection || bankSelection.includes(q.id)} onChange={(e) => setBankSelection((ids) => e.target.checked ? [...ids, q.id] : ids.filter((id) => id !== q.id))} /><span><b>{q.question}</b><small>{q.type} · {domainName(q.domain_id)} · {q.topic || "General"} · {q.difficulty} · {q.marks} marks · {q.status} {inSection ? "· Already in this section" : elsewhere ? "· Used in another section" : ineligible ? "· Not eligible for assessment" : ""}</small></span></label>; })}{!bankRows.length && <p className="muted">No questions match these filters.</p>}</div>
        <div className="form-actions"><span className="muted">{bankSelection.length} selected</span><button type="button" className="btn secondary" onClick={closeModal}>Cancel</button><button type="button" className="btn" disabled={!bankSelection.length} onClick={addFromBank}>Add Selected</button></div></>}
      {modal === "preview" && <><QuestionPreview question={preview} domainName={domainName} /><div className="form-actions"><button type="button" className="btn" onClick={closeModal}>Close</button></div></>}
    </section></div>}
  </>;
}

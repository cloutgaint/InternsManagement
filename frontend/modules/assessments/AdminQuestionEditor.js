import { QUESTION_TYPES } from "./AssessmentQuestionWorkspace";

export default function AdminQuestionEditor({
  editId,
  reset,
  feedbackArea,
  error,
  message,
  save,
  form,
  setForm,
  domains,
  editingAiDraft,
  busy,
}) {
  const update = (changes) => setForm((current) => ({ ...current, ...changes }));
  return (
    <section className="card question-editor">
      <div className="verification-title">
        <div><h2>{editId ? "Edit Question" : "Add Question"}</h2><p className="muted">Objective questions can be auto-scored. Descriptive questions use a marking guide for mentor evaluation.</p></div>
        {editId && <button className="btn secondary" onClick={reset}>Cancel Edit</button>}
      </div>
      {feedbackArea === "save" && <>{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}</>}
      <form onSubmit={save}>
        <div className="form-grid">
          <div className="form-field">
            <label>Domain</label>
            <select className="input" value={form.domainId} onChange={(event) => update({ domainId: event.target.value })}>
              <option value="">Common / All Domains</option>
              {domains.map((domain) => <option value={domain.id} key={domain.id}>{domain.name}</option>)}
            </select>
          </div>
          <div className="form-field"><label>Topic</label><input className="input" value={form.topic} onChange={(event) => update({ topic: event.target.value })} placeholder="Example: SQL Joins" /></div>
          <div className="form-field"><label>Difficulty</label><select className="input" value={form.difficulty} onChange={(event) => update({ difficulty: event.target.value })}><option>EASY</option><option>MEDIUM</option><option>HARD</option></select></div>
          <div className="form-field">
            <label>Question Type</label>
            <select className="input" value={form.type} onChange={(event) => update({ type: event.target.value, correctAnswer: "", options: ["", "", "", ""] })}>
              {QUESTION_TYPES.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-field"><label>Question</label><textarea className="input question-text" value={form.question} onChange={(event) => update({ question: event.target.value })} required placeholder="Enter the complete question" /></div>
        {["MCQ", "MULTI_SELECT"].includes(form.type) && (
          <div className="option-grid">
            {form.options.map((option, index) => <div className="form-field" key={index}><label>Option {String.fromCharCode(65 + index)}</label><input className="input" value={option} onChange={(event) => update({ options: form.options.map((value, optionIndex) => optionIndex === index ? event.target.value : value) })} /></div>)}
          </div>
        )}
        {["MCQ", "MULTI_SELECT", "TRUE_FALSE"].includes(form.type) && (
          <div className="form-field">
            <label>Correct Answer</label>
            {form.type === "TRUE_FALSE" ? (
              <select className="input" value={form.correctAnswer} onChange={(event) => update({ correctAnswer: event.target.value })} required><option value="">Select answer</option><option value="True">True</option><option value="False">False</option></select>
            ) : (
              <input className="input" value={form.correctAnswer} onChange={(event) => update({ correctAnswer: event.target.value })} required placeholder={form.type === "MULTI_SELECT" ? "Enter correct option text separated by commas" : "Enter exact correct option text"} />
            )}
            <span className="field-help">The answer is used by the assessment auto-scoring workflow.</span>
          </div>
        )}
        {!['MCQ', 'MULTI_SELECT', 'TRUE_FALSE'].includes(form.type) && <div className="form-field"><label>Marking Guide</label><textarea className="input" value={form.markingGuide} onChange={(event) => update({ markingGuide: event.target.value })} placeholder="Expected concepts / points for manual evaluation" /></div>}
        <div className="form-grid">
          <div className="form-field"><label>Marks</label><input className="input" type="number" min="0.5" step="0.5" value={form.marks} onChange={(event) => update({ marks: event.target.value })} required /></div>
          <div className="form-field"><label>Status</label><select className="input" value={form.status} disabled={editingAiDraft} onChange={(event) => update({ status: event.target.value })}><option>DRAFT</option><option>ACTIVE</option><option>INACTIVE</option></select></div>
        </div>
        <div className="form-field"><label>Explanation / Reference Answer</label><textarea className="input" value={form.explanation} onChange={(event) => update({ explanation: event.target.value })} placeholder="Optional explanation shown after evaluation" /></div>
        <div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Saving…" : editId ? "Update Question" : "Add Question"}</button></div>
      </form>
    </section>
  );
}

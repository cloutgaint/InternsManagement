export default function AdminQuestionAiPanel({
  ai,
  setAi,
  domains,
  aiBusy,
  aiError,
  aiMessage,
  generateAI,
  generatedRows,
  aiPreviewRef,
  discardAiDrafts,
  aiSelectedIds,
  setAiSelectedIds,
  approveGenerated,
  aiEditingId,
  setAiEditingId,
  updateAiDraft,
  updateAiOption,
  draftError,
  regenerateGenerated,
  removeGenerated,
  domainName,
}) {
  return (
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
          <textarea className="input ai-prompt-input" value={ai.instructions} onChange={(event) => setAi((current) => ({ ...current, instructions: event.target.value }))} placeholder="Example: Generate scenario-based MCQs covering SQL INNER/LEFT joins, duplicate rows, NULL handling, and query-result reasoning. Use intermediate complexity and avoid definition-only questions." required />
          <span className="field-help">Include topics, subtopics, concepts, preferred question style, and complexity.</span>
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label>Domain <span className="muted">(optional)</span></label>
            <select className="input" value={ai.domainId} onChange={(event) => setAi((current) => ({ ...current, domainId: event.target.value }))}>
              <option value="">Common / All Domains</option>
              {domains.map((domain) => <option value={domain.id} key={domain.id}>{domain.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Programming Language / Subject <span className="muted">(optional)</span></label>
            <input className="input" list="ai-subjects" value={ai.subject} onChange={(event) => setAi((current) => ({ ...current, subject: event.target.value }))} placeholder="Python, Java, SQL, Cybersecurity…" />
            <datalist id="ai-subjects"><option value="Python"/><option value="Java"/><option value="JavaScript"/><option value="SQL"/><option value="Cybersecurity"/><option value="AI / Machine Learning"/></datalist>
          </div>
          <div className="form-field">
            <label>Difficulty</label>
            <select className="input" value={ai.difficulty} onChange={(event) => setAi((current) => ({ ...current, difficulty: event.target.value }))}>
              <option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option><option value="MIXED">Mixed</option>
            </select>
          </div>
          <div className="form-field">
            <label>Number of Questions</label>
            <select className="input" value={ai.count} onChange={(event) => setAi((current) => ({ ...current, count: Number(event.target.value) }))}>{[5, 10, 15, 20, 25, 30].map((count) => <option key={count} value={count}>{count}</option>)}</select>
          </div>
          <div className="form-field">
            <label>Default Marks</label>
            <input className="input" type="number" min=".5" step=".5" value={ai.marks} onChange={(event) => setAi((current) => ({ ...current, marks: Number(event.target.value) }))} />
          </div>
        </div>
        <div className="form-actions">
          <span className="muted">Output: single-correct-answer MCQs</span>
          <button className="btn" disabled={aiBusy || !ai.instructions.trim()}>{aiBusy ? "Generating MCQs…" : "Generate MCQs with AI"}</button>
        </div>
      </form>
      {!!generatedRows.length && (
        <div className="ai-generated-preview" ref={aiPreviewRef} tabIndex={-1}>
          <div className="verification-title">
            <div><h3>Generated MCQs — Review Before Saving</h3><p className="muted">{generatedRows.length} unsaved MCQ{generatedRows.length === 1 ? "" : "s"}. Edit or regenerate before saving to the Question Bank.</p></div>
            <div className="action-row"><button type="submit" form="ai-generation-form" className="btn secondary" disabled={aiBusy}>Regenerate Questions</button><button type="button" className="btn secondary" disabled={aiBusy} onClick={discardAiDrafts}>Discard Draft</button><button type="button" className="btn" disabled={aiBusy || !aiSelectedIds.length} onClick={() => approveGenerated(aiSelectedIds)}>{aiSelectedIds.length === generatedRows.length ? "Save All Valid Questions" : `Save Selected (${aiSelectedIds.length})`}</button></div>
          </div>
          {generatedRows.map((question, questionIndex) => (
            <div className="ai-preview-question" key={question.clientId}>
              <label className="ai-preview-select"><input type="checkbox" disabled={aiBusy} checked={aiSelectedIds.includes(question.clientId)} onChange={(event) => setAiSelectedIds((ids) => event.target.checked ? [...ids, question.clientId] : ids.filter((id) => id !== question.clientId))} /></label>
              <div className="question-main">
                <div className="question-tags"><span>Question {questionIndex + 1}</span><span>{domainName(question.domainId)}</span><span>{question.topic || "Prompt-defined"}</span><span>{question.difficulty}</span><span>{question.marks} marks</span><span>UNSAVED</span></div>
                {aiEditingId === question.clientId ? (
                  <div className="ai-inline-editor">
                    <div className="form-field"><label>Question text</label><textarea className="input" value={question.question} onChange={(event) => updateAiDraft(question.clientId, { question: event.target.value })} /></div>
                    <div className="mcq-option-grid">{question.options.map((option, optionIndex) => <div className="mcq-option-field" key={optionIndex}><label className="mcq-correct-pick"><input type="radio" name={`ai-correct-${question.clientId}`} checked={question.correctAnswer === option && Boolean(option)} onChange={() => updateAiDraft(question.clientId, { correctAnswer: option })} />Correct</label><div className="form-field"><label>Option {String.fromCharCode(65 + optionIndex)}</label><input className="input" value={option} onChange={(event) => updateAiOption(question, optionIndex, event.target.value)} /></div></div>)}</div>
                    <div className="form-grid"><div className="form-field"><label>Difficulty</label><select className="input" value={question.difficulty} onChange={(event) => updateAiDraft(question.clientId, { difficulty: event.target.value })}><option>EASY</option><option>MEDIUM</option><option>HARD</option></select></div><div className="form-field"><label>Explanation</label><textarea className="input" value={question.explanation} onChange={(event) => updateAiDraft(question.clientId, { explanation: event.target.value })} /></div></div>
                    {draftError(question) && <p className="error" role="alert">{draftError(question)}</p>}
                  </div>
                ) : <><b>{question.question}</b><ol className="ai-option-preview">{question.options.map((option) => <li key={option}>{option}</li>)}</ol><small><b>Correct Answer:</b> {String.fromCharCode(65 + question.options.indexOf(question.correctAnswer))}. {question.correctAnswer}</small><small><b>Explanation:</b> {question.explanation}</small></>}
              </div>
              <div className="action-row"><button type="button" className="btn secondary" disabled={aiBusy} onClick={() => setAiEditingId((id) => id === question.clientId ? null : question.clientId)}>{aiEditingId === question.clientId ? "Done" : "Edit"}</button><button type="button" className="btn secondary" disabled={aiBusy} onClick={() => regenerateGenerated(question)}>Regenerate</button><button type="button" className="btn danger" disabled={aiBusy} onClick={() => removeGenerated(question)}>Delete</button></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

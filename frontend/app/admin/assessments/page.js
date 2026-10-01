"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
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
      rubricId: "",
    },
  ],
});
export default function Page() {
  const [batches, setBatches] = useState([]),
    [questions, setQuestions] = useState([]),
    [domains, setDomains] = useState([]),
    [assessments, setAssessments] = useState([]),
    [subs, setSubs] = useState([]),
    [form, setForm] = useState(fresh()),
    [review, setReview] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [rubrics, setRubrics] = useState([]),
    [rubric, setRubric] = useState({
      name: "",
      domainId: "",
      criteria: [
        {
          name: "Technical Accuracy",
          maxMarks: 10,
          weight: 50,
          kind: "DOMAIN",
        },
        {
          name: "Clarity & Reasoning",
          maxMarks: 10,
          weight: 50,
          kind: "COMMUNICATION",
        },
      ],
    });
  const load = () =>
    Promise.all([
      api("/admin/batches"),
      api("/admin/questions"),
      api("/admin/domains"),
      api("/admin/assessments"),
      api("/admin/assessment-submissions"),
      api("/admin/rubrics"),
    ])
      .then(([b, q, d, a, s, r]) => {
        setBatches(b);
        setQuestions(q.filter((x) => x.status === "ACTIVE"));
        setDomains(d);
        setAssessments(a);
        setSubs(s);
        setRubrics(r);
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
  function toggle(i, id) {
    const ids = form.sections[i].questionIds;
    sec(
      i,
      "questionIds",
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }
  async function create(e) {
    e.preventDefault();
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
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function status(a, status) {
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
  async function openReview(x) {
    try {
      setReview(await api("/admin/assessment-submissions/" + x.attempt_id));
    } catch (e) {
      setErr(e.message);
    }
  }
  async function score(ans) {
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
            Create timed assessments from approved Question Bank questions and
            review written answers.
          </p>
        </div>
        <span className="badge">{assessments.length} assessments</span>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <section className="card workflow-section">
        <h2>Scoring Rubrics</h2>
        <p className="muted">
          Create reusable weighted criteria for descriptive assessment answers.
          Criterion weights must total 100%.
        </p>
        <div className="form-grid">
          <div className="form-field">
            <label>Rubric Name</label>
            <input
              className="input"
              value={rubric.name}
              onChange={(e) =>
                setRubric((x) => ({ ...x, name: e.target.value }))
              }
            />
          </div>
          <div className="form-field">
            <label>Domain</label>
            <select
              className="input"
              value={rubric.domainId}
              onChange={(e) =>
                setRubric((x) => ({ ...x, domainId: e.target.value }))
              }
            >
              <option value="">Common</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {rubric.criteria.map((c, i) => (
          <div className="rubric-row" key={i}>
            <input
              className="input"
              value={c.name}
              onChange={(e) =>
                setRubric((x) => ({
                  ...x,
                  criteria: x.criteria.map((v, n) =>
                    n === i ? { ...v, name: e.target.value } : v,
                  ),
                }))
              }
            />
            <input
              className="input"
              type="number"
              min="1"
              value={c.maxMarks}
              onChange={(e) =>
                setRubric((x) => ({
                  ...x,
                  criteria: x.criteria.map((v, n) =>
                    n === i ? { ...v, maxMarks: Number(e.target.value) } : v,
                  ),
                }))
              }
            />
            <input
              className="input"
              type="number"
              min="1"
              max="100"
              value={c.weight}
              onChange={(e) =>
                setRubric((x) => ({
                  ...x,
                  criteria: x.criteria.map((v, n) =>
                    n === i ? { ...v, weight: Number(e.target.value) } : v,
                  ),
                }))
              }
            />
          </div>
        ))}
        <div className="action-row">
          <button
            className="btn secondary"
            onClick={() =>
              setRubric((x) => ({
                ...x,
                criteria: [
                  ...x.criteria,
                  {
                    name: "New Criterion",
                    maxMarks: 10,
                    weight: 0,
                    kind: "DOMAIN",
                  },
                ],
              }))
            }
          >
            + Criterion
          </button>
          <button
            className="btn"
            onClick={async () => {
              try {
                await api("/admin/rubrics", {
                  method: "POST",
                  body: JSON.stringify(rubric),
                });
                setMsg("Scoring rubric created.");
                load();
              } catch (e) {
                setErr(e.message);
              }
            }}
          >
            Save Rubric
          </button>
        </div>
      </section>
      <section className="card">
        <h2>Create Assessment</h2>
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
                  <label>Scoring Rubric</label>
                  <select
                    className="input"
                    value={s.rubricId || ""}
                    onChange={(e) => sec(i, "rubricId", e.target.value)}
                  >
                    <option value="">No rubric / direct marks</option>
                    {rubrics
                      .filter(
                        (r) =>
                          !s.domainId ||
                          !r.domain_id ||
                          r.domain_id === s.domainId,
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
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
              <div className="assessment-question-picker">
                {questions
                  .filter(
                    (q) =>
                      !s.domainId || !q.domain_id || q.domain_id === s.domainId,
                  )
                  .map((q) => (
                    <label key={q.id}>
                      <input
                        type="checkbox"
                        checked={s.questionIds.includes(q.id)}
                        onChange={() => toggle(i, q.id)}
                      />
                      <span>
                        <b>{q.question}</b>
                        <small>
                          {q.type} · {q.difficulty} · {q.marks} marks
                        </small>
                      </span>
                    </label>
                  ))}
              </div>
              <p className="muted">
                {s.questionIds.length} question(s) selected
              </p>
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
                      rubricId: "",
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
        <h2>Assessment Management</h2>
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
        <h2>Written Answer Evaluation</h2>
        {subs.length ? (
          subs.map((x) => (
            <div className="workflow-row" key={x.attempt_id}>
              <div>
                <b>{x.full_name}</b>
                <div className="muted">
                  {x.assessment_name} · Score {x.total_score || 0} · {x.status}
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
                {["SHORT_TEXT", "DESCRIPTIVE"].includes(a.type) && (
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

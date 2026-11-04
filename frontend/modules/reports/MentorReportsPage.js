"use client";
import { Fragment, useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function MentorReportsPage() {
  const [reviews, setReviews] = useState([]),
    [report, setReport] = useState(null),
    [err, setErr] = useState(""),
    [msg, setMsg] = useState(""),
    [edit, setEdit] = useState(null);
  const load = () =>
    api("/mentor/reviews")
      .then(setReviews)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function startEdit(x) {
    try {
      const members = await api("/mentor/groups/" + x.group_id + "/members");
      const saved = (await api("/mentor/reviews/" + x.id + "/report")).members;
      setEdit({
        id: x.id, title: x.group_name + " · Fortnight " + x.period_no, status: x.status === "SCHEDULED" ? "CONDUCTED" : x.status,
        progress: x.progress || "", domainReview: x.domain_review || "", presentationReview: x.presentation_review || "", groupMarks: x.group_marks ?? "", feedback: x.feedback || "", actionItems: x.action_items || "", nextExpectations: x.next_expectations || "",
        marks: members.map((m) => { const s = saved.find((v) => v.full_name === m.full_name); return { internId: m.id, name: m.full_name, marks: s?.marks ?? "", note: s?.contribution_note || "" }; }),
      });
    } catch (e) {
      setErr(e.message);
    }
  }
  async function saveEdit(e) {
    e.preventDefault();
    setErr("");
    const individualMarks = edit.marks.filter((m) => m.marks !== "").map((m) => ({ internId: m.internId, marks: Number(m.marks), note: m.note }));
    try {
      await api("/mentor/reviews/" + edit.id, {
        method: "PATCH",
        body: JSON.stringify({ status: edit.status, progress: edit.progress, domainReview: edit.domainReview, presentationReview: edit.presentationReview, groupMarks: edit.groupMarks === "" ? null : Number(edit.groupMarks), feedback: edit.feedback, actionItems: edit.actionItems, nextExpectations: edit.nextExpectations, individualMarks }),
      });
      setMsg(edit.status === "PUBLISHED" ? "Review published to the group." : "Review saved.");
      setEdit(null);
      await load();
    } catch (x) {
      setErr(x.message);
    }
  }
  async function open(x) {
    try {
      setReport(await api("/mentor/reviews/" + x.id + "/report"));
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap mentor-reports-page">
      <div className="intern-head">
        <div>
          <h1>Fortnight Reports</h1>
          <p className="muted">
            Generated from published mentor reviews and individual contribution
            marks.
          </p>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      {msg && <p className="success" role="status">{msg}</p>}
      {edit && (
        <section className="card">
          <h2>{edit.title}</h2>
          <form className="form-grid" onSubmit={saveEdit}>
            <div className="form-field"><label>Status</label><select className="input" value={edit.status} onChange={(e) => setEdit((x) => ({ ...x, status: e.target.value }))}><option value="CONDUCTED">Conducted</option><option value="MARKS_ENTERED">Marks Entered</option><option value="PUBLISHED">Published</option></select></div>
            <div className="form-field"><label>Group Marks (0-100)</label><input className="input" type="number" min="0" max="100" value={edit.groupMarks} onChange={(e) => setEdit((x) => ({ ...x, groupMarks: e.target.value }))} /></div>
            {[["progress", "Progress"], ["domainReview", "Domain Work Review"], ["presentationReview", "Presentation / Demo"], ["feedback", "Feedback"], ["actionItems", "Action Items"], ["nextExpectations", "Next Review Expectations"]].map(([k, label]) => (
              <div className="form-field" key={k} style={{ gridColumn: "1 / -1" }}><label>{label}</label><textarea className="input" value={edit[k]} onChange={(e) => setEdit((x) => ({ ...x, [k]: e.target.value }))} /></div>
            ))}
            {edit.marks.map((m, i) => (
              <div className="form-field" key={m.internId} style={{ gridColumn: "1 / -1" }}>
                <label>{m.name}: Individual Marks and Contribution</label>
                <div className="action-row">
                  <input className="input" type="number" min="0" max="100" aria-label={"Marks for " + m.name} value={m.marks} onChange={(e) => setEdit((x) => ({ ...x, marks: x.marks.map((v, j) => (j === i ? { ...v, marks: e.target.value } : v)) }))} />
                  <input className="input" aria-label={"Contribution note for " + m.name} placeholder="Contribution note" value={m.note} onChange={(e) => setEdit((x) => ({ ...x, marks: x.marks.map((v, j) => (j === i ? { ...v, note: e.target.value } : v)) }))} />
                </div>
              </div>
            ))}
            <div className="form-actions action-row"><button className="btn">Save Review</button><button type="button" className="btn secondary" onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        </section>
      )}
      <section className="card workflow-section">
        {reviews.length ? (
          reviews.map((x) => (
            <div className="workflow-row" key={x.id}>
              <div>
                <b>
                  {x.group_name} · Period {x.period_no}
                </b>
                <div className="muted">
                  {String(x.review_date).slice(0, 10)} · {x.status} ·{" "}
                  {x.individual_count} individual review(s)
                </div>
              </div>
              <div className="action-row">
                {x.status !== "PUBLISHED" && <button className="btn secondary" onClick={() => startEdit(x)}>Update Review</button>}
                <button className="btn" onClick={() => open(x)}>
                  Generate Report
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No fortnight reviews yet.</p>
        )}
      </section>
      {report && (
        <section className="card fortnight-report">
          <div className="verification-title">
            <div>
              <h2>Fortnight Progress Report</h2>
              <p className="muted">
                {report.review.group_name} · {report.review.batch_name || ""} ·
                Period {report.review.period_no}
              </p>
            </div>
            <button
              className="btn secondary no-print"
              onClick={() => window.print()}
            >
              Print / Save PDF
            </button>
          </div>
          <div className="report-meta">
            <span>
              <b>Review Date</b>
              {String(report.review.review_date).slice(0, 10)}
            </span>
            <span>
              <b>Project</b>
              {report.review.project_title || "Not assigned"}
            </span>
            <span>
              <b>Group Marks</b>
              {report.review.group_marks ?? "—"}
            </span>
            <span>
              <b>Status</b>
              {report.review.status}
            </span>
          </div>
          {[
            ["Progress", report.review.progress],
            ["Domain / Technical Review", report.review.domain_review],
            ["Presentation Review", report.review.presentation_review],
            ["Mentor Feedback", report.review.feedback],
            ["Action Items", report.review.action_items],
            ["Next Expectations", report.review.next_expectations],
          ].map(([a, b]) => (
            <div className="report-block" key={a}>
              <h3>{a}</h3>
              <p>{b || "—"}</p>
            </div>
          ))}
          <h3>Individual Performance</h3>
          <div className="review-member-table">
            <b>Intern</b>
            <b>Roll No.</b>
            <b>Marks</b>
            <b>Contribution Note</b>
            {report.members.map((m) => (
              <Fragment key={m.roll_number || m.full_name}>
                <span>{m.full_name}</span>
                <span>{m.roll_number || "—"}</span>
                <span>{m.marks}</span>
                <span>{m.contribution_note || "—"}</span>
              </Fragment>
            ))}
          </div>
          <small className="muted">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </small>
        </section>
      )}
    </main>
  );
}

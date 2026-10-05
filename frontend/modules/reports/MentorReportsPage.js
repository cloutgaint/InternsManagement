"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function MentorReportsPage() {
  const [reviews, setReviews] = useState([]),
    [report, setReport] = useState(null),
    [err, setErr] = useState("");
  useEffect(() => {
    api("/mentor/reviews")
      .then(setReviews)
      .catch((e) => setErr(e.message));
  }, []);
  async function open(x) {
    try {
      setReport(await api("/mentor/reviews/" + x.id + "/report"));
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap">
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
              <button className="btn" onClick={() => open(x)}>
                Generate Report
              </button>
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
              <>
                <span>{m.full_name}</span>
                <span>{m.roll_number || "—"}</span>
                <span>{m.marks}</span>
                <span>{m.contribution_note || "—"}</span>
              </>
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

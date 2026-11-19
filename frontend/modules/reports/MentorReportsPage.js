"use client";
import { Fragment, useEffect, useState } from "react";
import { api } from "@/shared/api/client";
const isKlu = (name = "") => /koneru lakshmaiah|\\bklu\\b/i.test(name);
const reportTemplate = (name = "") =>
  isKlu(name) ? "KLU Fortnight Evaluation" : "General Fortnight Evaluation";
export default function MentorReportsPage({ admin = false }) {
  const base = admin ? "/admin/fortnight" : "/mentor";
  const [reviews, setReviews] = useState([]),
    [report, setReport] = useState(null),
    [err, setErr] = useState(""),
    [msg, setMsg] = useState(""),
    [edit, setEdit] = useState(null),
    [groups, setGroups] = useState([]),
    [creating, setCreating] = useState(false),
    [accessError, setAccessError] = useState(false),
    [loadingAccess, setLoadingAccess] = useState(true),
    [reviewSearch,setReviewSearch]=useState(""),[reviewStatus,setReviewStatus]=useState("ALL"),[reviewPage,setReviewPage]=useState(1),
    [draft, setDraft] = useState({
      groupId: "",
      periodNo: 1,
      reviewDate: new Date().toISOString().slice(0, 10),
      groupMarks: "",
      feedback: "",
      progress: "",
      domainReview: "",
      presentationReview: "",
      actionItems: "",
      nextExpectations: "",
      marks: [],
    });
  const load = () => api(base + "/reviews").then(setReviews);
  async function loadAccess() {
    setLoadingAccess(true);
    setAccessError(false);
    setErr("");
    const results = await Promise.allSettled([
      load(),
      admin ? api("/admin/fortnight/groups").then(setGroups) : api("/mentor/dashboard").then((x) => setGroups(x.groups || []))
    ]);
    const failures = results.filter((x) => x.status === "rejected");
    if (failures.length) {
      setAccessError(true);
      setCreating(false);
      setErr([...new Set(failures.map((x) => x.reason?.message || "Unable to load mentor data"))].join(" · "));
    }
    setLoadingAccess(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loaders are recreated each render; run only when the listed values change.
  useEffect(() => { loadAccess(); }, []);
  async function chooseGroup(groupId) {
    setErr("");
    setDraft((x) => ({ ...x, groupId, marks: [] }));
    if (!groupId) return;
    try {
      const members = await api(
        (admin ? "/admin/fortnight/groups/" : "/mentor/groups/") +
          groupId +
          "/members",
      );
      setDraft((x) => ({
        ...x,
        groupId,
        marks: members.map((m) => ({
          internId: m.id,
          name: m.full_name,
          marks: "",
          note: "",
        })),
      }));
    } catch (e) {
      setErr(e.message);
    }
  }
  async function createReview(event) {
    event.preventDefault();
    setErr("");
    setMsg("");
    if (!draft.groupId)
      return setErr("Select a project before creating a review.");
    if (draft.marks.some((m) => m.marks === ""))
      return setErr("Enter marks for every intern before creating the review.");
    try {
      await api(base + "/reviews", {
        method: "POST",
        body: JSON.stringify({
          groupId: draft.groupId,
          periodNo: Number(draft.periodNo),
          reviewDate: draft.reviewDate,
          status: "MARKS_ENTERED",
          groupMarks: draft.groupMarks === "" ? null : Number(draft.groupMarks),
          progress: draft.progress,
          domainReview: draft.domainReview,
          presentationReview: draft.presentationReview,
          feedback: draft.feedback,
          actionItems: draft.actionItems,
          nextExpectations: draft.nextExpectations,
          individualMarks: draft.marks.map((m) => ({
            internId: m.internId,
            marks: Number(m.marks),
            note: m.note,
          })),
        }),
      });
      setMsg(
        "Fortnight evaluation saved. Review the report before publishing.",
      );
      setCreating(false);
      await load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function startEdit(x) {
    try {
      const members = await api(
        (admin ? "/admin/fortnight/groups/" : "/mentor/groups/") +
          x.group_id +
          "/members",
      );
      const saved = (await api(base + "/reviews/" + x.id + "/report")).members;
      setEdit({
        id: x.id,
        title: x.group_name + " · Fortnight " + x.period_no,
        status: x.status === "SCHEDULED" ? "CONDUCTED" : x.status,
        progress: x.progress || "",
        domainReview: x.domain_review || "",
        presentationReview: x.presentation_review || "",
        groupMarks: x.group_marks ?? "",
        feedback: x.feedback || "",
        actionItems: x.action_items || "",
        nextExpectations: x.next_expectations || "",
        marks: members.map((m) => {
          const s = saved.find((v) => v.full_name === m.full_name);
          return {
            internId: m.id,
            name: m.full_name,
            marks: s?.marks ?? "",
            note: s?.contribution_note || "",
          };
        }),
      });
    } catch (e) {
      setErr(e.message);
    }
  }
  async function saveEdit(e) {
    e.preventDefault();
    setErr("");
    const individualMarks = edit.marks
      .filter((m) => m.marks !== "")
      .map((m) => ({
        internId: m.internId,
        marks: Number(m.marks),
        note: m.note,
      }));
    try {
      await api(base + "/reviews/" + edit.id, {
        method: "PATCH",
        body: JSON.stringify({
          status: edit.status,
          progress: edit.progress,
          domainReview: edit.domainReview,
          presentationReview: edit.presentationReview,
          groupMarks: edit.groupMarks === "" ? null : Number(edit.groupMarks),
          feedback: edit.feedback,
          actionItems: edit.actionItems,
          nextExpectations: edit.nextExpectations,
          individualMarks,
        }),
      });
      setMsg(
        edit.status === "PUBLISHED"
          ? "Review published to the group."
          : "Review saved.",
      );
      setEdit(null);
      await load();
    } catch (x) {
      setErr(x.message);
    }
  }
  async function open(x) {
    try {
      setReport(await api(base + "/reviews/" + x.id + "/report"));
    } catch (e) {
      setErr(e.message);
    }
  }
  const filteredReviews=reviews.filter(x=>(reviewStatus==="ALL"||x.status===reviewStatus)&&[x.group_name,x.college_name,x.period_no].some(v=>String(v??"").toLowerCase().includes(reviewSearch.toLowerCase())));
  const reviewPages=Math.max(1,Math.ceil(filteredReviews.length/5)),activeReviewPage=Math.min(reviewPage,reviewPages);
  return (
    <main className="wrap mentor-reports-page mentor-reports-modern">
      <div className="intern-head">
        <div>
          <h1>{admin ? "Admin Fortnight Evaluations" : "Fortnight Reports"}</h1>
          <p className="muted">
            Record marks and comments from offline evaluations. Reports use a
            college-specific format where configured.
          </p>
        </div>
      </div>
      {accessError && <div className="mentor-access-error" role="alert"><strong>Unable to load fortnight evaluations</strong><p>{err || "You do not currently have access to these records."}</p><p>Sign in with an active Mentor account. If the problem continues, ask an administrator to check your mentor profile and assigned role.</p><button className="btn secondary" type="button" onClick={loadAccess}>Try again</button></div>}
      {!accessError && err && <p className="error" role="alert">{err}</p>}
      {msg && (
        <p className="success" role="status">
          {msg}
        </p>
      )}
      {!accessError && !loadingAccess && <section className="card">
        <div className="verification-title">
          <div>
            <h2>Fortnight Evaluations</h2>
            <p className="muted">
              Create a record after completing the offline review. Each project
              and fortnight can have one review.
            </p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setCreating((v) => !v);
              setErr("");
            }}
          >
            {creating ? "Close Form" : "Create Fortnight Evaluation"}
          </button>
        </div>
        {creating && (
          <form className="form-grid" onSubmit={createReview}>
            <div className="form-field">
              <label>Project / Group</label>
              <select
                className="input"
                required
                value={draft.groupId}
                onChange={(e) => chooseGroup(e.target.value)}
              >
                <option value="">Select project</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Fortnight Number</label>
              <input
                className="input"
                type="number"
                min="1"
                required
                value={draft.periodNo}
                onChange={(e) =>
                  setDraft((x) => ({ ...x, periodNo: e.target.value }))
                }
              />
            </div>
            <div className="form-field">
              <label>Offline Review Date</label>
              <input
                className="input"
                type="date"
                required
                value={draft.reviewDate}
                onChange={(e) =>
                  setDraft((x) => ({ ...x, reviewDate: e.target.value }))
                }
              />
            </div>
            <div className="form-field">
              <label>Group Marks (0–100)</label>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                value={draft.groupMarks}
                onChange={(e) =>
                  setDraft((x) => ({ ...x, groupMarks: e.target.value }))
                }
              />
            </div>
            {[
              ["progress", "Progress"],
              ["domainReview", "Technical Work"],
              ["presentationReview", "Presentation / Demo"],
              ["feedback", "Mentor Comments"],
              ["actionItems", "Action Items"],
              ["nextExpectations", "Next Fortnight Expectations"],
            ].map(([key, label]) => (
              <div
                className="form-field"
                key={key}
                style={{ gridColumn: "1 / -1" }}
              >
                <label>{label}</label>
                <textarea
                  className="input"
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((x) => ({ ...x, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            {draft.marks.map((m, i) => (
              <div
                className="form-field"
                key={m.internId}
                style={{ gridColumn: "1 / -1" }}
              >
                <label>{m.name}: Marks and Comments</label>
                <div className="action-row">
                  <input
                    className="input"
                    aria-label={"Marks for " + m.name}
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={m.marks}
                    onChange={(e) =>
                      setDraft((x) => ({
                        ...x,
                        marks: x.marks.map((v, j) =>
                          j === i ? { ...v, marks: e.target.value } : v,
                        ),
                      }))
                    }
                  />
                  <input
                    className="input"
                    aria-label={"Comments for " + m.name}
                    placeholder="Individual feedback"
                    value={m.note}
                    onChange={(e) =>
                      setDraft((x) => ({
                        ...x,
                        marks: x.marks.map((v, j) =>
                          j === i ? { ...v, note: e.target.value } : v,
                        ),
                      }))
                    }
                  />
                </div>
              </div>
            ))}
            <div className="form-actions">
              <button className="btn" type="submit">
                Save Fortnight Evaluation
              </button>
            </div>
          </form>
        )}
      </section>}
      {!accessError && !loadingAccess && edit && (
        <section className="card">
          <h2>{edit.title}</h2>
          <p className="muted">
            Enter the marks and comments collected during the offline fortnight
            review. College-specific fields can be configured without changing
            other colleges.
          </p>
          <form className="form-grid" onSubmit={saveEdit}>
            <div className="form-field">
              <label>Status</label>
              <select
                className="input"
                value={edit.status}
                onChange={(e) =>
                  setEdit((x) => ({ ...x, status: e.target.value }))
                }
              >
                <option value="CONDUCTED">Conducted</option>
                <option value="MARKS_ENTERED">Marks Entered</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
            <div className="form-field">
              <label>Group Marks (0-100)</label>
              <input
                className="input"
                type="number"
                min="0"
                max="100"
                value={edit.groupMarks}
                onChange={(e) =>
                  setEdit((x) => ({ ...x, groupMarks: e.target.value }))
                }
              />
            </div>
            {[
              ["progress", "Progress"],
              ["domainReview", "Domain Work Review"],
              ["presentationReview", "Presentation / Demo"],
              ["feedback", "Feedback"],
              ["actionItems", "Action Items"],
              ["nextExpectations", "Next Review Expectations"],
            ].map(([k, label]) => (
              <div
                className="form-field"
                key={k}
                style={{ gridColumn: "1 / -1" }}
              >
                <label>{label}</label>
                <textarea
                  className="input"
                  value={edit[k]}
                  onChange={(e) =>
                    setEdit((x) => ({ ...x, [k]: e.target.value }))
                  }
                />
              </div>
            ))}
            {edit.marks.map((m, i) => (
              <div
                className="form-field"
                key={m.internId}
                style={{ gridColumn: "1 / -1" }}
              >
                <label>{m.name}: Individual Marks and Contribution</label>
                <div className="action-row">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    aria-label={"Marks for " + m.name}
                    value={m.marks}
                    onChange={(e) =>
                      setEdit((x) => ({
                        ...x,
                        marks: x.marks.map((v, j) =>
                          j === i ? { ...v, marks: e.target.value } : v,
                        ),
                      }))
                    }
                  />
                  <input
                    className="input"
                    aria-label={"Contribution note for " + m.name}
                    placeholder="Contribution note"
                    value={m.note}
                    onChange={(e) =>
                      setEdit((x) => ({
                        ...x,
                        marks: x.marks.map((v, j) =>
                          j === i ? { ...v, note: e.target.value } : v,
                        ),
                      }))
                    }
                  />
                </div>
              </div>
            ))}
            <div className="form-actions action-row">
              <button className="btn">Save Review</button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      {!accessError && !loadingAccess && <section className="card workflow-section fortnight-review-list">
        <div className="fortnight-list-head"><h2>Saved fortnight evaluations</h2><span>{filteredReviews.length} reports</span></div>
        <div className="fortnight-list-filters"><label>Search reports<input className="input" type="search" placeholder="Project, college or period" value={reviewSearch} onChange={e=>{setReviewSearch(e.target.value);setReviewPage(1);}}/></label><label>Status<select className="input" value={reviewStatus} onChange={e=>{setReviewStatus(e.target.value);setReviewPage(1);}}><option value="ALL">All statuses</option>{[...new Set(reviews.map(x=>x.status).filter(Boolean))].map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label></div>
        {filteredReviews.length ? (
          filteredReviews.slice((activeReviewPage-1)*5,activeReviewPage*5).map((x) => (
            <div className="workflow-row" key={x.id}>
              <div>
                <b>
                  {x.group_name} · Period {x.period_no}
                </b>
                <div className="muted">
                  {x.college_name || "College not assigned"} ·{" "}
                  {reportTemplate(x.college_name)} ·{" "}
                  {String(x.review_date).slice(0, 10)} · {x.status} ·{" "}
                  {x.individual_count} individual review(s)
                </div>
              </div>
              <div className="action-row">
                {x.status !== "PUBLISHED" && (
                  <button
                    className="btn secondary"
                    onClick={() => startEdit(x)}
                  >
                    Update Review
                  </button>
                )}
                <button className="btn" onClick={() => open(x)}>
                  Generate Report
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">{reviews.length?"No matching evaluations. Try changing the filters.":"No fortnight reviews yet."}</p>
        )}
        {filteredReviews.length>0&&<div className="fortnight-pagination"><span>Showing {(activeReviewPage-1)*5+1}–{Math.min(activeReviewPage*5,filteredReviews.length)} of {filteredReviews.length} · Page {activeReviewPage} of {reviewPages}</span><div className="action-row"><button className="btn secondary" disabled={activeReviewPage===1} onClick={()=>setReviewPage(v=>Math.max(1,v-1))}>Previous</button><button className="btn secondary" disabled={activeReviewPage===reviewPages} onClick={()=>setReviewPage(v=>Math.min(reviewPages,v+1))}>Next</button></div></div>}
      </section>}
      {!accessError && !loadingAccess && report && (
        <section className="card fortnight-report">
          <div className="verification-title">
            <div>
              <h2>{reportTemplate(report.review.college_name)}</h2>
              <p>
                <b>GAINT CLOUT TECHNOLOGIES PVT. LTD.</b>
              </p>
              <p className="muted">
                {report.review.college_name || "College not assigned"} ·
                Fortnight evaluation
              </p>
              <p className="muted">
                {report.review.group_name} · {report.review.batch_name || ""} ·
                Period {report.review.period_no}
              </p>
            </div>
            <button
              className="btn secondary no-print"
              onClick={() => window.print()}
              disabled={report.review.status !== "PUBLISHED"}
              title={
                report.review.status !== "PUBLISHED"
                  ? "Publish the review before printing"
                  : "Print the approved report"
              }
            >
              Print / Save PDF
            </button>
          </div>
          {report.review.status !== "PUBLISHED" && (
            <p className="error no-print">
              Draft preview only. Publish the review before issuing a report.
            </p>
          )}
          {isKlu(report.review.college_name) && (
            <p className="muted">
              KLU-specific report profile. The official college layout is
              pending the approved KLU template.
            </p>
          )}
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
          <div className="report-block">
            <h3>Company Verification</h3>
            <p>Authorized GAINT signature: ____________________</p>
            <p>Company stamp: To be applied by an authorized signatory</p>
          </div>
          <small className="muted">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </small>
        </section>
      )}
      <style jsx global>{`
/* Fortnight evaluation workspace */
.mentor-reports-modern{color:#111;width:100%;max-width:1160px;margin:0 auto;padding:28px 20px 64px;box-sizing:border-box;clear:both}.mentor-reports-modern .intern-head h1{font-size:clamp(26px,3vw,34px);line-height:1.25;margin:0 0 8px}.mentor-reports-modern .intern-head{margin-bottom:24px}.mentor-reports-modern .intern-head p{font-size:14px;line-height:1.6}.mentor-reports-modern .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.mentor-reports-modern .form-field{min-width:0}.mentor-reports-modern .form-field label{font-size:13px;font-weight:650;color:#111}.mentor-reports-modern .form-field textarea{min-height:76px;width:100%;box-sizing:border-box}.mentor-reports-modern .form-actions{grid-column:1/-1;display:flex;justify-content:flex-end}.mentor-reports-modern .btn{min-height:44px;border-radius:999px!important}.mentor-reports-modern .btn:not(.secondary){background:linear-gradient(120deg,#8d48f6,#5c8cf8);color:#fff;border:0}.mentor-reports-modern .btn:hover:not(:disabled){color:#fff}.mentor-reports-modern .btn.secondary:hover:not(:disabled){background:#095f45;color:#fff}.mentor-reports-modern .card{margin-bottom:18px}.mentor-reports-modern .card{border-radius:20px;padding:24px}.mentor-reports-modern .verification-title{display:flex;align-items:center;justify-content:space-between;gap:16px}.mentor-reports-modern .input{min-height:44px;border:1.5px solid #7ea7ef;border-radius:10px;color:#111}.mentor-reports-modern .fortnight-list-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.mentor-reports-modern .fortnight-list-head h2{margin:0;font-size:21px}.mentor-reports-modern .fortnight-list-head span{background:#eef1fb;border-radius:999px;padding:8px 12px;font-size:12px}.mentor-reports-modern .fortnight-list-filters{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin:20px 0}.mentor-reports-modern .fortnight-list-filters label{display:flex;flex-direction:column;gap:5px;font-size:12px}.mentor-reports-modern .fortnight-list-filters .input{margin:0}.mentor-reports-modern .fortnight-review-list .workflow-row{padding:16px 0}.mentor-reports-modern .fortnight-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:18px;font-size:12px}@media(max-width:700px){.mentor-reports-modern{padding:20px 16px 48px}.mentor-reports-modern .form-grid{grid-template-columns:1fr}.mentor-reports-modern .form-actions .btn{width:100%}.mentor-reports-modern .card{padding:16px}.mentor-reports-modern .verification-title{flex-direction:column;align-items:stretch}.mentor-reports-modern .fortnight-list-filters{grid-template-columns:1fr}.mentor-reports-modern .fortnight-list-head{align-items:flex-start;flex-direction:column}}
`}</style>
    </main>
  );
}

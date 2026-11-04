"use client";
import ProofStatusCard from "@/modules/interns/ProofStatusCard";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";

const fmt = (d) => (d ? String(d).slice(0, 10) : "—");
export default function InternDashboardPage() {
  const [data, setData] = useState(null),
    [err, setErr] = useState(""),
    [msg, setMsg] = useState(""),
    [assessments, setAssessments] = useState([]),
    [group, setGroup] = useState(null),
    [reviews, setReviews] = useState([]),
    [completion, setCompletion] = useState(null),
    [offers, setOffers] = useState([]),
    [offerView, setOfferView] = useState(null),
    [tab,setTab]=useState("overview");
  useEffect(() => {
    Promise.all([
      api("/intern/dashboard"),
      api("/intern/assessments"),
      api("/intern/group"),
      api("/intern/reviews"),
      api("/intern/completion"),
      api("/intern/offer-letters"),
    ])
      .then(([a, b, c, d, e, f]) => {
        setData(a);
        setAssessments(b);
        setGroup(c);
        setReviews(d);
        setCompletion(e);
        setOffers(f);
      })
      .catch((e) => setErr(e.message));
  }, []);
  if (err)
    return (
      <main className="wrap">
        <p className="error">{err}</p>
      </main>
    );
  if (!data)
    return (
      <main className="wrap">
        <p>Loading dashboard…</p>
      </main>
    );
  const p = data.profile || {},
    a = data.allocation,
    o = data.offerLetter,
    f = data.face;
  async function daily(phase) {
    const text = prompt(
      phase === "MORNING"
        ? "What are you planning to work on today?"
        : "What did you complete today?",
    );
    if (!text) return;
    try {
      await api("/intern/daily-report", {
        method: "POST",
        body: JSON.stringify(
          phase === "MORNING"
            ? { phase, plannedTasks: text }
            : { phase, completedTasks: text },
        ),
      });
      setMsg(
        phase === "MORNING"
          ? "Morning plan submitted."
          : "Evening report submitted.",
      );
    } catch (e) {
      setErr(e.message);
    }
  }
  async function leave() {
    const fromDate = prompt("Leave from (YYYY-MM-DD):");
    if (!fromDate) return;
    const toDate = prompt("Leave to (YYYY-MM-DD):");
    const reason = prompt("Reason:");
    if (!toDate || !reason) return;
    try {
      await api("/intern/leave", {
        method: "POST",
        body: JSON.stringify({ fromDate, toDate, reason }),
      });
      setMsg("Leave request submitted.");
    } catch (e) {
      setErr(e.message);
    }
  }
  async function submitTask(t) {
    const text = prompt("Enter submission details / links:");
    if (!text) return;
    try {
      await api("/intern/tasks/" + t.id + "/submit", {
        method: "POST",
        body: JSON.stringify({ content: { text } }),
      });
      setMsg("Task submitted successfully.");
    } catch (e) {
      setErr(e.message);
    }
  }
  async function viewOffer(x) {
    try {
      setOfferView(await api("/intern/offer-letters/" + x.id + "/view"));
    } catch (e) {
      setErr(e.message);
    }
  }
  async function downloadOffer(x) {
    try {
      const blob = await apiBlob("/intern/offer-letters/" + x.id + "/pdf");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "GAINT-Offer-" + x.reference_number.replace(/[^a-zA-Z0-9_-]/g, "") + ".pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setErr(e.message);
    }
  }
  const present = (data.attendance || []).filter(
    (x) => x.status === "PRESENT",
  ).length;
  return (
    <main className="wrap">
      {msg && <p className="success">{msg}</p>}
      <div className="intern-head">
        <div>
          <h1>Intern Dashboard</h1>
          <p className="muted">
            Welcome back, {p.full_name || "Intern"}. Track your internship
            progress and required actions here.
          </p>
        </div>
        <span className="badge">
          {a?.batch_name || "Awaiting batch allocation"}
        </span>
      </div>
      <div className="intern-summary">
        <div className="card">
          <span className="muted">Domain</span>
          <h3>{a?.domain_name || "Not assigned"}</h3>
        </div>
        <div className="card">
          <span className="muted">Internship Period</span>
          <h3>
            {a
              ? fmt(a.intern_start) + " to " + fmt(a.intern_end)
              : "Not allocated"}
          </h3>
        </div>
        <div className="card">
          <span className="muted">Attendance</span>
          <h3>
            {present} present / {(data.attendance || []).length} records
          </h3>
        </div>
        <div className="card">
          <span className="muted">Active Tasks</span>
          <h3>{(data.tasks || []).length}</h3>
        </div>
      </div>
      <nav className="intern-tabs" aria-label="Intern dashboard sections">{[["overview","Overview"],["onboarding","Onboarding"],["work","Daily Work"],["learning","Tasks & Assessments"],["team","Team & Project"],["reviews","Fortnight Reviews"],["completion","Completion"]].map(([key,label])=><button key={key} type="button" className={tab===key?"active":""} onClick={()=>setTab(key)} aria-current={tab===key?"page":undefined}>{label}</button>)}</nav>
      <div className="intern-sections intern-tabbed" data-tab={tab}>
        <section className="card intern-pane intern-pane-onboarding">
          <h2>Onboarding</h2>
          <div className="status-row">
            <span>Batch allocation</span>
            <b>{a ? "Completed" : "Pending"}</b>
          </div>
          <div className="status-row">
            <span>Offer letter</span>
            <b>{o ? "Issued" : "Pending"}</b>
          </div>
          <div className="status-row">
            <span>Face registration</span>
            <div className="action-row">
              <b>{f ? f.status : "Not submitted"}</b>
              <a className="btn secondary" href="/intern/face-enrollment">
                {f ? "View" : "Register Face"}
              </a>
            </div>
          </div>
          <div className="status-row">
            <span>Final domain</span>
            <b>{a?.domain_name || "Pending"}</b>
          </div>
        </section>
        <section className="card intern-pane intern-pane-onboarding">
          <h2>Offer Letter</h2>
          {offers.length ? (
            offers.map((x) => (
              <div className="status-row" key={x.id}>
                <span>
                  <b>{x.reference_number}</b>
                  <br />
                  <small>
                    {fmt(x.from_date)} to {fmt(x.to_date)}
                  </small>
                </span>
                <div className="action-row">
                  <span className="status-pill">{x.status}</span>
                  <button
                    className="btn secondary"
                    onClick={() => viewOffer(x)}
                  >
                    View / Print
                  </button>
                  {["ISSUED", "REISSUED"].includes(x.status) && (
                    <button className="btn secondary" onClick={() => downloadOffer(x)}>
                      Download PDF
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="muted">
              Your offer letter will appear after Admin approval and issue.
            </p>
          )}
        </section>
        <ProofStatusCard />
        <section className="card intern-pane intern-pane-work">
          <h2>Attendance</h2>
          <div className="form-actions">
            <a className="btn" href="/intern/attendance">
              Camera Check-In / Check-Out
            </a>
          </div>
          {(data.attendance || []).length ? (
            <div className="mini-list">
              {data.attendance.slice(0, 5).map((x) => (
                <div key={x.id || x.day}>
                  <span>{fmt(x.day)}</span>
                  <b>{x.status}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No attendance records yet.</p>
          )}
        </section>
        <section className="card intern-pane intern-pane-work">
          <h2>Daily Work, Reports & Leave</h2>
          <p className="muted">
            Morning plans, evening reports, blockers, evidence and leave
            history.
          </p>
          <div className="form-actions">
            <a className="btn" href="/intern/work-log">
              Open Work & Leave
            </a>
          </div>
        </section>
        <section className="card intern-pane intern-pane-learning">
          <h2>Weekly Tasks</h2>
          {(data.tasks || []).length ? (
            <p>{data.tasks.length} released task(s) are available.</p>
          ) : (
            <p className="muted">No released tasks assigned yet.</p>
          )}
          <div className="form-actions">
            <a className="btn" href="/intern/tasks">
              Open Task Workspace
            </a>
          </div>
        </section>
        <section className="card intern-pane intern-pane-learning">
          <h2>Assessment</h2>
          {assessments.length ? (
            assessments.map((x) => (
              <div className="status-row" key={x.id}>
                <span>{x.name}</span>
                <b>{x.attempt_status || "Available"}</b>
              </div>
            ))
          ) : (
            <p className="muted">No assessment published yet.</p>
          )}
          <div className="form-actions">
            <a className="btn" href="/intern/assessments">
              Open Assessments
            </a>
          </div>
        </section>
        <section className="card intern-pane intern-pane-team">
          <div className="verification-title"><h2>Team & Project</h2><div className="action-row"><a className="btn secondary" href="/intern/collaboration">Group Workspace</a><a className="btn secondary" href="/intern/final-submission">Final Project Submission</a></div></div>
          {group ? (
            <>
              <p>
                <b>{group.name}</b> · {group.status}
              </p>
              <p>Project: {group.project_title || "Not assigned"}</p>
              <p>
                Mentor:{" "}
                {group.mentors?.map((x) => x.full_name).join(", ") ||
                  "Not assigned"}
              </p>
            </>
          ) : (
            <p className="muted">Group not assigned yet.</p>
          )}
        </section>
        <section className="card intern-pane intern-pane-reviews">
          <h2>Fortnight Reviews</h2>
          {reviews.length ? (
            reviews.map((x) => (
              <div className="status-row" key={x.id}>
                <span>
                  Review {x.period_no} ({String(x.review_date).slice(0, 10)}): {x.status === "SCHEDULED" ? "Scheduled" : x.feedback || "Published"}
                  {x.action_items ? <><br /><small>Action items: {x.action_items}</small></> : null}
                  {x.contribution_note ? <><br /><small>Your contribution: {x.contribution_note}</small></> : null}
                </span>
                <b>{x.status === "SCHEDULED" ? "—" : "Group " + (x.group_marks ?? "—") + " · You " + (x.individual_marks ?? "—")}</b>
              </div>
            ))
          ) : (
            <p className="muted">No reviews published yet.</p>
          )}
        </section>
        <section className="card intern-pane intern-pane-completion">
          <div className="verification-title"><h2>Completion & Certificate</h2><a className="btn secondary" href="/intern/certificate">Open Certificate</a></div>
          <div className="status-row">
            <span>Final evaluation</span>
            <b>{completion?.evaluation ? "Completed" : "Pending"}</b>
          </div>
          <div className="status-row">
            <span>Completion approval</span>
            <b>{completion?.approval?.status || "Pending"}</b>
          </div>
          <div className="status-row">
            <span>Certificate</span>
            <b>{completion?.certificate?.status || "Not issued"}</b>
          </div>
        </section>
        <section className="card intern-pane intern-pane-team"><h2>Group Workspace</h2><p className="muted">Documents, shared resources and group chat with your mentor.</p><div className="form-actions"><a className="btn" href="/intern/collaboration">Open Group Workspace</a></div></section>
        <section className="card intern-pane intern-pane-overview">
          <div className="verification-title"><h2>Notifications</h2><a className="btn secondary" href="/intern/notifications">View All</a></div>
          {(data.notifications || []).length ? (
            <div className="mini-list">
              {data.notifications.slice(0, 5).map((n) => (
                <div key={n.id}>
                  <span>{n.title || n.message || "Notification"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No new notifications.</p>
          )}
        </section>
      </div>
      {offerView && (
        <div className="modal-backdrop" onMouseDown={() => setOfferView(null)}>
          <section
            className="modal-card offer-preview"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="verification-title">
              <div>
                <span className="eyebrow">GAINT CLOUT TECHNOLOGIES</span>
                <h2>Internship Offer Letter</h2>
              </div>
              <button className="icon-close" onClick={() => setOfferView(null)}>
                ×
              </button>
            </div>
            <div className="offer-ref">
              <b>{offerView.reference_number}</b>
              <span>{offerView.status}</span>
            </div>
            <div className="letter-body">{offerView.rendered_body}</div>
            {offerView.signatory && (
              <p className="offer-sign">
                <b>{offerView.signatory}</b>
              </p>
            )}
            <div className="action-row">
              <button className="btn" onClick={() => window.print()}>
                Print / Save PDF
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

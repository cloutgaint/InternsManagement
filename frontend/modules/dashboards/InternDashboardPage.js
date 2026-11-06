"use client";
import ProofStatusCard from "@/modules/interns/ProofStatusCard";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";

const fmt = (d) => (d ? String(d).slice(0, 10) : "—");

const card =
  "rounded-[14px] border border-[#dbe5df] bg-white p-[18px] shadow-[0_8px_28px_rgba(20,45,31,.055)]";
const button =
  "cursor-pointer rounded-[9px] border-0 font-bold transition-all duration-[180ms] ease-[ease] hover:-translate-y-px hover:bg-[#06472f]";
const primary = "bg-[#0c5132] text-white";
const secondary = "bg-[#e8f0eb] text-[#123]";
const regular = "px-4 py-[11px]";
const compact = "px-3 py-2";
const s = {
  page: "mx-auto max-w-[1200px] px-7 pb-7 pt-[34px] max-[600px]:px-[18px] max-[600px]:pb-[18px]",
  error: "rounded-lg border border-current bg-[#ffe9e9] p-2.5 text-[#8b1f1f]",
  success: "rounded-lg border border-current bg-[#e8f7ed] p-2.5 text-[#176331]",
  muted: "text-[#65756c]",
  card,
  head: "mb-[18px] flex items-start justify-between gap-[18px] max-[520px]:block",
  title: "m-0 mb-1.5",
  badge: "inline-block rounded-full bg-[#e8f0eb] px-[9px] py-1 text-[12px] max-[520px]:mt-2.5",
  summary: "mb-[18px] grid grid-cols-4 gap-4 max-[850px]:grid-cols-2 max-[520px]:grid-cols-1",
  summaryValue: "m-0 mt-2 text-[17px]",
  tabs: "mx-0 mb-[15px] mt-[18px] flex flex-wrap gap-[7px] rounded-[13px] border border-[#dce7e0] bg-[#eaf1ed] p-1.5 max-[680px]:flex-nowrap max-[680px]:overflow-x-auto max-[680px]:[scrollbar-width:thin]",
  tab: "cursor-pointer rounded-[9px] border-0 px-[15px] py-[11px] text-[13px] font-bold [font-family:inherit] transition-colors duration-150 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#4ca77a] max-[680px]:flex-none max-[680px]:whitespace-nowrap max-[680px]:px-3 max-[680px]:py-2.5",
  tabActive: "bg-[#075e3e] text-white shadow-[0_3px_10px_#0b573b24]",
  tabIdle: "bg-transparent text-[#50665a] hover:bg-[#dcebe1] hover:text-[#155b3a]",
  sections: "mt-[18px] grid grid-cols-2 gap-4 max-[850px]:grid-cols-1",
  sectionTitle: "mt-0 text-[19px]",
  sectionTitleInRow: "mb-[5px] mt-0 text-[19px]",
  titleRow: "flex items-start justify-between gap-4 max-[900px]:flex-col",
  row: "flex justify-between gap-4 border-b border-[#e4ebe7] py-[11px] last:border-b-0",
  actions: "flex flex-wrap gap-2",
  pill: "whitespace-nowrap rounded-full bg-[#edf2ef] px-2 py-[5px] text-[10px] font-extrabold",
  formActions: "mt-[18px] flex justify-end",
  btn: [button, primary, regular, "min-w-[170px] max-[760px]:w-full"].join(" "),
  btnPrintable: [button, primary, compact].join(" "),
  btnLink: [button, secondary, regular].join(" "),
  btnSmall: [button, secondary, compact].join(" "),
  backdrop: "fixed inset-0 z-[1000] grid place-items-center bg-[rgba(10,28,19,.48)] p-5 print:visible print:absolute print:inset-0 print:bg-white print:p-0 print:[&_*]:visible",
  modal: "max-h-[90vh] w-[min(780px,100%)] overflow-auto rounded-2xl bg-white p-6 shadow-[0_25px_80px_rgba(0,0,0,.22)] print:max-h-none print:w-full print:rounded-none print:shadow-none",
  modalTitle: "mb-[5px]",
  eyebrow: "text-[12px] font-extrabold tracking-[1.4px] text-[#075b3b]",
  close: "h-9 w-9 cursor-pointer rounded-[9px] border-0 bg-[#edf3ef] text-[24px] text-[#385145] print:hidden",
  offerRef: "flex justify-between gap-3 border-b border-[#dbe5df] pb-[18px] pt-3 text-[#52675c]",
  letter: "min-h-[300px] whitespace-pre-wrap px-2 py-7 text-[15px] leading-[1.75]",
  signature: "mx-2 mb-7 mt-3",
  modalActions: "flex flex-wrap justify-end gap-2 border-t border-[#dbe5df] pt-4 print:hidden",
};
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
      <main className={s.page}>
        <p className={s.error}>{err}</p>
      </main>
    );
  if (!data)
    return (
      <main className={s.page}>
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
  const pane = (key) => s.card + (tab === key ? "" : " hidden");
  const present = (data.attendance || []).filter(
    (x) => x.status === "PRESENT",
  ).length;
  return (
    <main className={s.page}>
      {msg && <p className={s.success}>{msg}</p>}
      <div className={s.head}>
        <div>
          <h1 className={s.title}>Intern Dashboard</h1>
          <p className={s.muted}>
            Welcome back, {p.full_name || "Intern"}. Track your internship
            progress and required actions here.
          </p>
        </div>
        <span className={s.badge}>
          {a?.batch_name || "Awaiting batch allocation"}
        </span>
      </div>
      <div className={s.summary}>
        <div className={s.card}>
          <span className={s.muted}>Domain</span>
          <h3 className={s.summaryValue}>{a?.domain_name || "Not assigned"}</h3>
        </div>
        <div className={s.card}>
          <span className={s.muted}>Internship Period</span>
          <h3 className={s.summaryValue}>
            {a
              ? fmt(a.intern_start) + " to " + fmt(a.intern_end)
              : "Not allocated"}
          </h3>
        </div>
        <div className={s.card}>
          <span className={s.muted}>Attendance</span>
          <h3 className={s.summaryValue}>
            {present} present / {(data.attendance || []).length} records
          </h3>
        </div>
        <div className={s.card}>
          <span className={s.muted}>Active Tasks</span>
          <h3 className={s.summaryValue}>{(data.tasks || []).length}</h3>
        </div>
      </div>
      <nav className={s.tabs} aria-label="Intern dashboard sections">{[["overview","Overview"],["onboarding","Onboarding"],["work","Daily Work"],["learning","Tasks & Assessments"],["team","Team & Project"],["reviews","Fortnight Reviews"],["completion","Completion"]].map(([key,label])=><button key={key} type="button" className={s.tab + " " + (tab === key ? s.tabActive : s.tabIdle)} onClick={()=>setTab(key)} aria-current={tab===key?"page":undefined}>{label}</button>)}</nav>
      <div className={s.sections}>
        <section className={pane("onboarding")}>
          <h2 className={s.sectionTitle}>Onboarding</h2>
          <div className={s.row}>
            <span>Batch allocation</span>
            <b>{a ? "Completed" : "Pending"}</b>
          </div>
          <div className={s.row}>
            <span>Offer letter</span>
            <b>{o ? "Issued" : "Pending"}</b>
          </div>
          <div className={s.row}>
            <span>Face registration</span>
            <div className={s.actions}>
              <b>{f ? f.status : "Not submitted"}</b>
              <a className={s.btnSmall} href="/intern/face-enrollment">
                {f ? "View" : "Register Face"}
              </a>
            </div>
          </div>
          <div className={s.row}>
            <span>Final domain</span>
            <b>{a?.domain_name || "Pending"}</b>
          </div>
        </section>
        <section className={pane("onboarding")}>
          <h2 className={s.sectionTitle}>Offer Letter</h2>
          {offers.length ? (
            offers.map((x) => (
              <div className={s.row} key={x.id}>
                <span>
                  <b>{x.reference_number}</b>
                  <br />
                  <small>
                    {fmt(x.from_date)} to {fmt(x.to_date)}
                  </small>
                </span>
                <div className={s.actions}>
                  <span className={s.pill}>{x.status}</span>
                  <button
                    className={s.btnSmall}
                    onClick={() => viewOffer(x)}
                  >
                    View / Print
                  </button>
                  {["ISSUED", "REISSUED"].includes(x.status) && (
                    <button className={s.btnSmall} onClick={() => downloadOffer(x)}>
                      Download PDF
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className={s.muted}>
              Your offer letter will appear after Admin approval and issue.
            </p>
          )}
        </section>
        <ProofStatusCard hidden={tab !== "onboarding"} />
        <section className={pane("work")}>
          <h2 className={s.sectionTitle}>Attendance</h2>
          <div className={s.formActions}>
            <a className={s.btn} href="/intern/attendance">
              Camera Check-In / Check-Out
            </a>
          </div>
          {(data.attendance || []).length ? (
            <div>
              {data.attendance.slice(0, 5).map((x) => (
                <div className={s.row} key={x.id || x.day}>
                  <span>{fmt(x.day)}</span>
                  <b>{x.status}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className={s.muted}>No attendance records yet.</p>
          )}
        </section>
        <section className={pane("work")}>
          <h2 className={s.sectionTitle}>Daily Work, Reports & Leave</h2>
          <p className={s.muted}>
            Morning plans, evening reports, blockers, evidence and leave
            history.
          </p>
          <div className={s.formActions}>
            <a className={s.btn} href="/intern/work-log">
              Open Work & Leave
            </a>
          </div>
        </section>
        <section className={pane("learning")}>
          <h2 className={s.sectionTitle}>Weekly Tasks</h2>
          {(data.tasks || []).length ? (
            <p>{data.tasks.length} released task(s) are available.</p>
          ) : (
            <p className={s.muted}>No released tasks assigned yet.</p>
          )}
          <div className={s.formActions}>
            <a className={s.btn} href="/intern/tasks">
              Open Task Workspace
            </a>
          </div>
        </section>
        <section className={pane("learning")}>
          <h2 className={s.sectionTitle}>Assessment</h2>
          {assessments.length ? (
            assessments.map((x) => (
              <div className={s.row} key={x.id}>
                <span>{x.name}</span>
                <b>{x.attempt_status || "Available"}</b>
              </div>
            ))
          ) : (
            <p className={s.muted}>No assessment published yet.</p>
          )}
          <div className={s.formActions}>
            <a className={s.btn} href="/intern/assessments">
              Open Assessments
            </a>
          </div>
        </section>
        <section className={pane("team")}>
          <div className={s.titleRow}><h2 className={s.sectionTitleInRow}>Team & Project</h2><div className={s.actions}><a className={s.btnSmall} href="/intern/collaboration">Group Workspace</a><a className={s.btnSmall} href="/intern/final-submission">Final Project Submission</a></div></div>
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
            <p className={s.muted}>Group not assigned yet.</p>
          )}
        </section>
        <section className={pane("reviews")}>
          <h2 className={s.sectionTitle}>Fortnight Reviews</h2>
          {reviews.length ? (
            reviews.map((x) => (
              <div className={s.row} key={x.id}>
                <span>
                  Review {x.period_no} ({String(x.review_date).slice(0, 10)}): {x.status === "SCHEDULED" ? "Scheduled" : x.feedback || "Published"}
                  {x.action_items ? <><br /><small>Action items: {x.action_items}</small></> : null}
                  {x.contribution_note ? <><br /><small>Your contribution: {x.contribution_note}</small></> : null}
                </span>
                <b>{x.status === "SCHEDULED" ? "—" : "Group " + (x.group_marks ?? "—") + " · You " + (x.individual_marks ?? "—")}</b>
              </div>
            ))
          ) : (
            <p className={s.muted}>No reviews published yet.</p>
          )}
        </section>
        <section className={pane("completion")}>
          <div className={s.titleRow}><h2 className={s.sectionTitleInRow}>Completion & Certificate</h2><a className={s.btnLink} href="/intern/certificate">Open Certificate</a></div>
          <div className={s.row}>
            <span>Final evaluation</span>
            <b>{completion?.evaluation ? "Completed" : "Pending"}</b>
          </div>
          <div className={s.row}>
            <span>Completion approval</span>
            <b>{completion?.approval?.status || "Pending"}</b>
          </div>
          <div className={s.row}>
            <span>Certificate</span>
            <b>{completion?.certificate?.status || "Not issued"}</b>
          </div>
        </section>
        <section className={pane("team")}><h2 className={s.sectionTitle}>Group Workspace</h2><p className={s.muted}>Documents, shared resources and group chat with your mentor.</p><div className={s.formActions}><a className={s.btn} href="/intern/collaboration">Open Group Workspace</a></div></section>
        <section className={pane("overview")}>
          <div className={s.titleRow}><h2 className={s.sectionTitleInRow}>Notifications</h2><a className={s.btnLink} href="/intern/notifications">View All</a></div>
          {(data.notifications || []).length ? (
            <div>
              {data.notifications.slice(0, 5).map((n) => (
                <div className={s.row} key={n.id}>
                  <span>{n.title || n.message || "Notification"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={s.muted}>No new notifications.</p>
          )}
        </section>
      </div>
      {offerView && (
        <div className={s.backdrop} onMouseDown={() => setOfferView(null)}>
          <section
            className={s.modal}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={s.titleRow}>
              <div>
                <span className={s.eyebrow}>GAINT CLOUT TECHNOLOGIES</span>
                <h2 className={s.modalTitle}>Internship Offer Letter</h2>
              </div>
              <button className={s.close} onClick={() => setOfferView(null)}>
                ×
              </button>
            </div>
            <div className={s.offerRef}>
              <b>{offerView.reference_number}</b>
              <span>{offerView.status}</span>
            </div>
            <div className={s.letter}>{offerView.rendered_body}</div>
            {offerView.signatory && (
              <p className={s.signature}>
                <b>{offerView.signatory}</b>
              </p>
            )}
            <div className={s.modalActions}>
              <button className={s.btnPrintable} onClick={() => window.print()}>
                Print / Save PDF
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

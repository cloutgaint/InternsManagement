"use client";
import ProofStatusCard from "@/modules/interns/ProofStatusCard";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api, apiBlob } from "@/shared/api/client";
import {JourneyTimeline,NextActionCard,ProgressRing,Skeleton,AchievementCard,MentorCard} from "@/shared/intern/JourneyComponents";

const fmt = (d) => (d ? String(d).slice(0, 10) : "—");

const card =
  "rounded-2xl border border-[#e2e8e5] bg-white p-6 shadow-[0_8px_30px_rgba(15,35,30,.045)] max-[600px]:p-[18px]";
const button =
  "inline-flex min-h-10 items-center justify-center text-center cursor-pointer rounded-[9px] border-0 font-bold transition-all duration-[180ms] ease-[ease] hover:-translate-y-px hover:bg-[#06472f]";
const primary = "bg-[#0c5132] text-white";
const secondary = "bg-[#e8f0eb] text-[#111827]";
const regular = "px-4 py-[11px]";
const compact = "px-3 py-2";
const displayStatus = (value) => String(value || "Pending").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const s = {
  page: "mx-auto max-w-[1320px] px-7 pb-12 pt-9 text-[#111827] max-[600px]:px-4 max-[600px]:pt-5",
  error: "rounded-lg border border-current bg-[#ffe9e9] p-2.5 text-[#8b1f1f]",
  success: "rounded-lg border border-current bg-[#e8f7ed] p-2.5 text-[#176331]",
  muted: "text-[#52645e]",
  card,
  head: "mb-7 flex items-start justify-between gap-5 max-[600px]:flex-col",
  title: "m-0 mb-1.5",
  badge: "inline-block rounded-full bg-[#e8f0eb] px-[9px] py-1 text-[12px] max-[520px]:mt-2.5",
  summary: "mb-6 grid grid-cols-4 gap-4 max-[950px]:grid-cols-2 max-[520px]:grid-cols-1 [&>div]:min-h-[114px]",
  summaryValue: "m-0 mt-3 text-[18px] font-bold leading-snug text-[#111827]",
  tabs: "mx-0 mb-5 flex flex-wrap gap-1.5 rounded-xl border border-[#e0e9e5] bg-[#edf3f0] p-2 max-[850px]:flex-nowrap max-[850px]:overflow-x-auto max-[850px]:[scrollbar-width:thin]",
  tab: "cursor-pointer rounded-lg border-0 px-[17px] py-3 text-[13px] font-semibold [font-family:inherit] transition-colors duration-150 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#4ca77a] max-[680px]:flex-none max-[680px]:whitespace-nowrap max-[680px]:px-3 max-[680px]:py-2.5",
  tabActive: "bg-[#075e3e] text-white shadow-[0_3px_10px_#0b573b24]",
  tabIdle: "bg-transparent text-[#50665a] hover:bg-[#dcebe1] hover:text-[#155b3a]",
  sections: "mt-5 grid grid-cols-2 items-start gap-5 max-[900px]:grid-cols-1 [&>section]:min-w-0",
  sectionTitle: "mt-0 mb-4 text-[19px] font-bold text-[#111827]",
  sectionTitleInRow: "mb-3 mt-0 text-[19px] font-bold text-[#111827]",
  titleRow: "flex items-start justify-between gap-4 max-[600px]:flex-col",
  row: "flex items-center justify-between gap-4 border-b border-[#e4ebe7] py-[11px] last:border-b-0",
  actions: "flex flex-wrap items-center justify-end gap-2 max-[600px]:justify-start",
  pill: "inline-flex min-h-[28px] items-center justify-center whitespace-nowrap rounded-full bg-[#edf2ef] px-3 py-1 text-center text-[12px] font-bold leading-none text-[#123]",
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
  const router=useRouter();
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
  useEffect(()=>{if(router.isReady)setTab(router.query.section==="onboarding"?"onboarding":"overview")},[router.isReady,router.query.section]);
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
        <Skeleton/>
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
  async function viewOffer(x) {
    try {
      const blob = await apiBlob("/intern/offer-letters/" + x.id + "/pdf");
      const url = URL.createObjectURL(blob);
      const tab = window.open(url, "_blank", "noopener,noreferrer");
      if (!tab) {
        const link = document.createElement("a");
        link.href = url;
        link.download = "GAINT-Offer-" + x.reference_number.replace(/[^a-zA-Z0-9_-]/g, "") + ".pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
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
  const pane = (key) => s.card + (tab === key ? (["reviews","completion"].includes(key) ? " col-span-2 max-[900px]:col-span-1" : "") : " hidden");
  const present = (data.attendance || []).filter(
    (x) => x.status === "PRESENT",
  ).length;
  return (
    <main className={s.page}>
      {msg && <p className={s.success}>{msg}</p>}
      <div className={s.head}>
        <div>
          <h1 className={s.title+" text-[30px] font-bold tracking-tight text-[#111827] max-[600px]:text-[25px]"}>Intern dashboard</h1>
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
          <span className={s.muted}>Internship period</span>
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
          <span className={s.muted}>Active tasks</span>
          <h3 className={s.summaryValue}>{(data.tasks || []).length}</h3>
        </div>
      </div>
      <div className="mb-5"><NextActionCard title={!a?"Awaiting internship allocation":!f||f.status!=="APPROVED"?"Complete face registration":!o?"Await your offer letter":(data.tasks||[]).length?"Review your released tasks":"Track your internship progress"} description={!a?"Your administrator will assign your approved batch and internship dates.":!f||f.status!=="APPROVED"?"Submit your face registration for approval before using attendance.":!o?"Your administrator will issue the official offer letter.":(data.tasks||[]).length?"Your assigned weekly tasks are available for review.":"Check attendance, mentor feedback and your completion status."} href={!a?null:!f||f.status!=="APPROVED"?"/intern/face-enrollment":!o?null:(data.tasks||[]).length?"/intern/tasks":"/intern/attendance"} action={!f||f.status!=="APPROVED"?"Open face registration":(data.tasks||[]).length?"View tasks":"Open attendance"}/></div>
      <section className={s.card+" mb-5"}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg font-bold text-[#0f172a]">Your internship journey</h2><span className="text-xs font-medium text-[#64748b]">Progress follows approved internship records</span></div><JourneyTimeline steps={[{label:"Registration",done:true},{label:"Verification",done:!!a},{label:"Allocation",done:!!a},{label:"Internship",done:!!a&&!!a.intern_start},{label:"Final review",done:!!completion?.evaluation},{label:"Certificate",done:["ISSUED","REISSUED"].includes(completion?.certificate?.status)}]}/></section>
      <div className="mb-5 grid gap-4 md:grid-cols-2"><section className={s.card}><h2 className="mb-4 mt-0 text-lg font-bold text-[#0f172a]">Attendance overview</h2><ProgressRing value={present} total={(data.attendance||[]).length} label="Recorded attendance"/><p className="mt-3 text-xs text-[#64748b]">This shows recorded present days, not official attendance eligibility. A valid full day requires the configured 7-hour rule.</p><a className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-[#2563eb]" href="/intern/attendance">View attendance</a></section><section className={s.card}><h2 className="mb-4 mt-0 text-lg font-bold text-[#0f172a]">Internship identity</h2><div className={s.row}><span>Batch</span><b>{a?.batch_name||"Not allocated"}</b></div><div className={s.row}><span>Domain</span><b>{a?.domain_name||"Not assigned"}</b></div><div className={s.row}><span>Project</span><b>{group?.project_title||"Not assigned"}</b></div><div className="mt-4"><MentorCard names={group?.mentors?.map(x=>x.full_name).filter(Boolean).join(", ")}/></div></section></div>
      <div className="mb-5 grid gap-4 md:grid-cols-2"><section className={s.card}><h2 className="mt-0 text-lg font-bold text-[#0f172a]">Learning and work</h2><div className={s.row}><span>Released tasks</span><b>{(data.tasks||[]).length}</b></div><div className={s.row}><span>Assessments available</span><b>{assessments.length}</b></div><div className={s.row}><span>Fortnight reviews</span><b>{reviews.length}</b></div><p className="mt-4 text-sm text-[#64748b]">Task deadlines are displayed only when provided by the application.</p><div className="flex flex-wrap gap-3"><a className={s.btnSmall} href="/intern/tasks">Open tasks</a><a className={s.btnSmall} href="/intern/assessments">Open assessments</a></div></section><AchievementCard status={displayStatus(completion?.certificate?.status||"Not issued")}/></div>
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
              <b>{f ? displayStatus(f.status) : "Not submitted"}</b>
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
                  <span className={s.pill}>{displayStatus(x.status)}</span>
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
                  <b>{displayStatus(x.status)}</b>
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
              View Weekly Tasks
            </a>
          </div>
        </section>
        <section className={pane("learning")}>
          <h2 className={s.sectionTitle}>Assessment</h2>
          {assessments.length ? (
            assessments.map((x) => (
              <div className={s.row} key={x.id}>
                <span>{x.name}</span>
                <b>{displayStatus(x.attempt_status || "Available")}</b>
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
          <div className={s.titleRow}><h2 className={s.sectionTitleInRow}>Team & project</h2><div className={s.actions}><a className={s.btnSmall} href="/intern/collaboration">Group Workspace</a><a className={s.btnSmall} href="/intern/final-submission">Final Project Submission</a></div></div>
          {group ? (
            <>
              <p>
                <b>{group.name}</b> · {displayStatus(group.status)}
              </p>
              <p>Project: {group.project_title || "Not assigned"}</p>
              <p>
                Mentor:{" "}
                {group.mentors?.map((x) => x.full_name).join(", ") ||
                  "Not assigned"}
              </p>
            </>
          ) : (
            <p className={s.muted}>Project not assigned yet.</p>
          )}
        </section>
        <section className={pane("reviews")}>
          <h2 className={s.sectionTitle}>Fortnight reviews</h2><p className={s.muted+" mb-5 text-sm"}>Review outcomes and mentor feedback appear here when published.</p>
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
            <div className="rounded-xl border border-dashed border-[#d7e4dc] bg-[#f8faf9] px-5 py-7 text-center"><p className="mb-1 font-semibold text-[#111827]">No reviews published yet</p><p className={s.muted+" m-0 text-sm"}>Your mentor’s fortnightly feedback will appear here after publication.</p></div>
          )}
        </section>
        <section className={pane("completion")}>
          <div className={s.titleRow}><h2 className={s.sectionTitleInRow}>Completion & certificate</h2><a className={s.btnLink} href="/intern/certificate">Open Certificate</a></div>
          <p className={s.muted+" mb-4 text-sm"}>Track final evaluation, approval and certificate issuance.</p><div className={s.row}>
            <span>Final evaluation</span>
            <b>{completion?.evaluation ? "Completed" : "Pending"}</b>
          </div>
          <div className={s.row}>
            <span>Completion approval</span>
            <b>{displayStatus(completion?.approval?.status)}</b>
          </div>
          <div className={s.row}>
            <span>Certificate</span>
            <b>{displayStatus(completion?.certificate?.status || "Not issued")}</b>
          </div>
        </section>
        <section className={pane("team")}><h2 className={s.sectionTitle}>Group workspace</h2><p className={s.muted+" leading-relaxed"}>Access shared documents, project resources and conversations with your mentor.</p><div className={s.formActions}><a className={s.btn} href="/intern/collaboration">Open Group Workspace</a></div></section>
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

    </main>
  );
}

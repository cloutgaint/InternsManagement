"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@/shared/api/client";
const modules = [
  ["🏫", "College Master", "Add, edit and manage colleges", "/admin/colleges"],
  [
    "🧑‍🎓",
    "Student Verification",
    "Student registration, proofs and account approval",
    "/admin/verification",
  ],
  [
    "📅",
    "Batches & Domains",
    "Manage batches and student allocation",
    "/admin/batches",
  ],
  ["✉️", "Offer Letters", "Prepare, approve and issue offers", "/admin/offers"],
  [
    "🧩",
    "Domain Master",
    "Domains, subdomains and rubrics",
    "/admin/domain-master",
  ],
  ["🌴", "Leave & Holidays", "Requests, limits and holidays", "/admin/leave"],
  [
    "📷",
    "Face & Attendance",
    "Face approval and attendance exceptions",
    "/admin/attendance",
  ],
  [
    "📁",
    "Project Master",
    "Create projects and allocate interns",
    "/admin/projects",
  ],
  [
    "👥",
    "Mentor Assignment",
    "Individual intern mentor assignments",
    "/admin/mentors",
  ],
  [
    "🎯",
    "Domain Recommendations",
    "Student domain recommendations",
    "/admin/domains",
  ],
  [
    "📝",
    "Assessments",
    "Exams, schedules and evaluations",
    "/admin/assessments",
  ],
  ["❓", "Question Bank", "Manage assessment questions", "/admin/questions"],
  [
    "🗂️",
    "Internship Management",
    "Project roles, mentors and weekly tasks",
    "/admin/work",
  ],
  ["🏢", "Company Settings", "Upload official company stamp", "/admin/company-settings"],
  ["📄", "KLU Fortnight Reports", "KLU-specific progress reports and attendance", "/admin/klu-fortnight"],
  ["📋", "Fortnight Evaluations", "Create, review and finalize offline fortnight marks", "/admin/fortnight"],
  [
    "📊",
    "Reports & Exports",
    "Completion reports and exports",
    "/admin/reports",
  ],
  ["🛡️", "Audit Log", "Administrative action history", "/admin/audit"],
  [
    "📈",
    "Performance Dashboard",
    "Attendance, tasks and scores",
    "/admin/performance",
  ],
  [
    "🎓",
    "Completion & Certificates",
    "Final evaluation and certificates",
    "/admin/completion",
  ],
  [
    "📚",
    "Documents & Announcements",
    "Guidelines, announcements and chat oversight",
    "/admin/documents",
  ],
  ["🔔", "Notifications", "Requests and system alerts", "/notifications"],
];
const DashboardIcon=({name})=>{const drawing=()=>{switch(name){
    case "🏫": return <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/></>;
    case "🧑‍🎓": return <><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M2 5l10-3 10 3-10 3zM20 6v5"/></>;
    case "📅": return <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h3"/></>;
    case "✉️": return <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>;
    case "🧩": return <><path d="M8 3H4a1 1 0 0 0-1 1v5h2a2 2 0 1 1 0 4H3v7a1 1 0 0 0 1 1h6v-2a2 2 0 1 1 4 0v2h6a1 1 0 0 0 1-1v-6h-2a2 2 0 1 1 0-4h2V4a1 1 0 0 0-1-1h-6v2a2 2 0 1 1-4 0V3z"/></>;
    case "🌴": return <><path d="M12 21V9M12 9C8 3 3 5 2 8c4-1 7 0 10 1M12 9c1-6 6-8 10-5-4 0-7 2-10 5M12 9c5-2 9 0 10 4-4-2-7-2-10-4M8 21h8"/></>;
    case "📷": return <><path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="4"/></>;
    case "📁": return <><path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>;
    case "👥": return <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></>;
    case "🎯": return <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>;
    case "📝": return <><path d="M4 4h12v16H4zM8 9h5M8 13h5M8 17h3M17 6l3 3-5 5-3 1 1-3z"/></>;
    case "❓": return <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2l-1.5 1.5V14M12 17h.01"/></>;
    case "🗂️": return <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M12 9h5M12 13h5"/></>;
    case "🏢": return <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M14 7h2M9 11h2M14 11h2M10 21v-5h4v5"/></>;
    case "📄": return <><path d="M6 2h8l5 5v15H6zM14 2v6h5M9 12h7M9 16h7"/></>;
    case "📋": return <><rect x="5" y="5" width="14" height="17" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h6M9 19h4"/></>;
    case "📊": return <><path d="M4 21h16M6 18v-6h3v6M11 18V5h3v13M16 18V9h3v9"/></>;
    case "🛡️": return <><path d="M12 2 20 5v6c0 5-3 8-8 11-5-3-8-6-8-11V5zM9 12l2 2 4-4"/></>;
    case "📈": return <><path d="M3 20h18M4 16l5-5 4 3 7-9M16 5h4v4"/></>;
    case "🎓": return <><path d="m2 9 10-5 10 5-10 5zM6 12v5c4 3 8 3 12 0v-5M22 9v7"/></>;
    case "📚": return <><path d="M4 4h6v16H4zM10 6h5v14h-5zM16 4l4-1 3 16-4 1z"/></>;
    case "🔔": return <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4"/></>;
    case "🪪": return <><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M4 16c1-3 7-3 8 0M15 9h4M15 13h4"/></>;
    default:return <circle cx="12" cy="12" r="8"/>;
  }};return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawing()}</svg>};
const ArrowIcon=()=> <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>;
export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api("/auth/me")
      .then((user) => {
        if (!active) return;
        if (!["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
          router.replace(
            user.role === "INTERN"
              ? "/intern"
              : user.role === "MENTOR"
                ? "/mentor"
                : "/login?role=admin",
          );
          return;
        }
        return api("/admin/dashboard")
          .then((v) => {
            if (active) setData(v);
          })
          .catch((e) => {
            if (active) setError(e.message);
          });
      })
      .catch((e) => {
        if (active) {
          if (/token|authentication|unauthorized/i.test(e.message))
            router.replace("/login?role=admin");
          else setError(e.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);
  const count = (...keys) =>
    keys.reduce((n, k) => n + Number(data?.[k] || 0), 0);
  const verification = count(
    "proofs_pending",
    "approvals_pending",
    "faces_pending",
  );
  const pending = count(
    "leave_pending",
    "attendance_exceptions",
    "completions_pending",
    "task_evaluations_pending",
  );
  const pendingItems = [
    {label:"Leave requests",key:"leave_pending",href:"/admin/leave"},
    {label:"Attendance exceptions",key:"attendance_exceptions",href:"/admin/attendance"},
    {label:"Completion reviews",key:"completions_pending",href:"/admin/completion"},
    {label:"Task evaluations",key:"task_evaluations_pending",href:"/admin/work"},
  ];
  const modulePending = {
    "/admin/verification": verification,
    "/admin/attendance": count("attendance_exceptions","faces_pending"),
    "/admin/leave": count("leave_pending"),
    "/admin/completion": count("completions_pending"),
    "/admin/work": count("task_evaluations_pending"),
  };
  const pendingBadge = (value) => !loading && value > 0 ? <span aria-label={value+" pending items"} title={value+" pending items"} style={{position:"absolute",right:12,top:10,minWidth:22,height:22,padding:"0 6px",display:"inline-flex",alignItems:"center",justifyContent:"center",borderRadius:999,background:"#dc2626",color:"#fff",fontWeight:700,fontSize:11,lineHeight:1}}>{value}</span> : null;
  const overview = [
    {
      icon: "🧑‍🎓",
      title: "Registered Interns",
      value: data?.interns || 0,
      sub: "Active: " + (data?.active_interns || 0),
      href: "/admin/verification",
      tone: "green",
    },
    {
      icon: "🛡️",
      title: "Student Verification",
      value: verification,
      sub: "Proofs, accounts and face approvals",
      href: "/admin/verification",
      tone: "amber",
    },
    {
      icon: "📋",
      title: "Pending Operations",
      value: pending,
      sub: pendingItems.filter(item=>count(item.key)>0).map(item=>count(item.key)+" "+item.label.toLowerCase()).join(" · ") || "No pending operations",
      href: "/admin/work",
      tone: "blue",
    },
    {
      icon: "🎓",
      title: "Certificates Issued",
      value: data?.certificates_issued || 0,
      sub: "Completed certificate workflow",
      href: "/admin/completion",
      tone: "green",
    },
  ];
  return (
    <main className="wrap admin-home">
      <header className="admin-home-header">
        <div>
          <span className="admin-eyebrow">Operations overview</span>
          <h1>Operations dashboard</h1>
          <p className="muted">
            Manage student onboarding, internship operations and approvals from
            one place.
          </p>
        </div>
        <span className="admin-live">
          <span aria-hidden="true">●</span> Live overview
        </span>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section aria-label="Platform overview" className="admin-overview-grid">
        {overview.map((x) => (
          <Link
            key={x.title}
            href={x.href}
            className={"admin-overview-card tone-" + x.tone}
            style={{position:"relative"}}
          >
            {x.title==="Pending Operations" && pendingBadge(pending)}
            {x.title==="Student Verification" && pendingBadge(verification)}
            <div className="admin-overview-top">
              <span className="admin-overview-icon" aria-hidden="true">
                <DashboardIcon name={x.icon} />
              </span>
              <span className="admin-card-chevron" aria-hidden="true">
                <ArrowIcon />
              </span>
            </div>
            <span className="admin-overview-title">{x.title}</span>
            <strong>{loading ? "…" : x.value}</strong>
            <small>{x.sub}</small>
          </Link>
        ))}
      </section>
      {!loading && pending>0 && <section className="card" aria-label="Pending operations breakdown" style={{marginTop:14,padding:16}}>
        <h2 style={{margin:"0 0 10px",fontSize:16}}>Pending operations breakdown</h2>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{pendingItems.filter(item=>count(item.key)>0).map(item=><Link key={item.key} href={item.href} style={{display:"inline-flex",alignItems:"center",gap:8,border:"1px solid #dce6e0",borderRadius:10,padding:"9px 12px",color:"inherit",textDecoration:"none"}}><strong style={{color:"#b91c1c"}}>{count(item.key)}</strong><span>{item.label}</span><span aria-hidden="true"><ArrowIcon /></span></Link>)}</div>
      </section>}
      <section className="admin-queue-section">
        <div className="admin-section-heading">
          <div>
            <h2>Requires attention</h2>
            <p className="muted">
              Jump straight to the workspace that needs attention.
            </p>
          </div>
        </div>
        <div className="admin-queue-grid">
          <Link href="/admin/verification" className="admin-queue-link">
            <span aria-hidden="true"><DashboardIcon name="🪪" /></span>
            <span>
              <b>Student Verification</b>
              <small>
                {loading ? "Loading…" : verification + " pending"} · Proofs,
                accounts and face verification
              </small>
            </span>
            <span aria-hidden="true"><ArrowIcon /></span>
          </Link>
          <Link href="/admin/attendance" className="admin-queue-link">
            <span aria-hidden="true"><DashboardIcon name="📅" /></span>
            <span>
              <b>Attendance</b>
              <small>
                {loading
                  ? "Loading…"
                  : count("attendance_exceptions") + " exceptions"}{" "}
                · Face approvals and records
              </small>
            </span>
            <span aria-hidden="true"><ArrowIcon /></span>
          </Link>
          <Link href="/admin/leave" className="admin-queue-link">
            <span aria-hidden="true"><DashboardIcon name="🌴" /></span>
            <span>
              <b>Leave Requests</b>
              <small>
                {loading ? "Loading…" : count("leave_pending") + " pending"} ·
                Review leave applications
              </small>
            </span>
            <span aria-hidden="true"><ArrowIcon /></span>
          </Link>
          <Link href="/admin/completion" className="admin-queue-link">
            <span aria-hidden="true"><DashboardIcon name="🎓" /></span>
            <span>
              <b>Completion</b>
              <small>
                {loading
                  ? "Loading…"
                  : count("completions_pending") + " pending"}{" "}
                · Final decisions and certificates
              </small>
            </span>
            <span aria-hidden="true"><ArrowIcon /></span>
          </Link>
        </div>
      </section>
      <section className="admin-workspaces">
        <div className="admin-section-heading">
          <div>
            <h2>Management workspaces</h2>
            <p className="muted">
              All administrative modules, grouped in one consistent grid.
            </p>
          </div>
        </div>
        <div className="admin-workspace-grid">
          {modules.map(([icon, title, description, href]) => (
            <Link key={href} href={href} className="admin-workspace-card" style={{position:"relative",paddingRight:modulePending[href]>0?45:undefined}}>
              <span className="admin-workspace-icon" aria-hidden="true">
                <DashboardIcon name={icon} />
              </span>
              <span className="admin-workspace-copy">
                <b>{title}</b>
                <small>{description}</small>
              </span>
              {pendingBadge(modulePending[href] || 0)}
              <span className="admin-card-chevron" aria-hidden="true" style={modulePending[href]>0?{marginRight:25}:undefined}>
                <ArrowIcon />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <style jsx global>{`
      .admin-home .admin-overview-icon,.admin-home .admin-workspace-icon,.admin-home .admin-queue-link>span:first-child{color:#0a6748;background:#e3f4e9}
      .admin-home .admin-overview-card.tone-amber .admin-overview-icon{color:#9c671c;background:#fff0d2}
      .admin-home .admin-overview-card.tone-blue .admin-overview-icon{color:#3464aa;background:#e1edff}
      .admin-home .admin-overview-card.tone-purple .admin-overview-icon{color:#075e46;background:#e8f5ee}
      .admin-home .admin-workspace-icon svg,.admin-home .admin-overview-icon svg,.admin-home .admin-queue-link>span:first-child svg{display:block;width:22px;height:22px}
      .admin-home .admin-workspace-card:nth-child(4n+2) .admin-workspace-icon{color:#3464aa;background:#e8f0ff}
      .admin-home .admin-workspace-card:nth-child(4n+3) .admin-workspace-icon{color:#986419;background:#fff2dc}
      .admin-home .admin-workspace-card:nth-child(4n+4) .admin-workspace-icon{color:#075e46;background:#e8f5ee}

.admin-home{max-width:1320px;padding:28px 28px 60px;color:#0f172a}
.admin-home-header{margin-bottom:25px;align-items:center}
.admin-home-header h1{font-size:clamp(28px,2.7vw,36px);letter-spacing:-1.1px;margin:7px 0 8px}
.admin-home-header .muted{font-size:13px;color:#6a7b70}
.admin-home .admin-live{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border:1px solid #cce7d8;background:#e8f6ee;color:#09633f;font-size:11px}
.admin-home .admin-live span{color:#0f9d64;font-size:12px;margin:0}
.admin-home .admin-overview-grid{gap:16px;margin-bottom:31px}
.admin-home .admin-overview-card{min-height:184px;padding:20px 21px;border-radius:17px;box-shadow:0 5px 15px #153d2708;overflow:hidden}
.admin-home .admin-overview-top{margin-bottom:16px}
.admin-home .admin-overview-icon{width:42px;height:42px;font-size:22px;border-radius:12px;background:#ffffffb8}
.admin-home .admin-overview-title{font-size:12px;font-weight:750;color:#395448}
.admin-home .admin-overview-card strong{font-size:37px;letter-spacing:-1.4px;line-height:1.22;margin:4px 0}
.admin-home .admin-overview-card small{font-size:11px;line-height:1.5}
.admin-home .admin-card-chevron{display:grid;place-items:center;width:29px;height:29px;flex:none;border-radius:9px;color:#48705b;background:#f6f8fc}
.admin-home .admin-section-heading{margin-bottom:15px}
.admin-home .admin-section-heading h2{font-size:19px;font-weight:800;letter-spacing:-.5px;margin-bottom:5px}
.admin-home .admin-section-heading p{font-size:12px;color:#6a7d71}
.admin-home .admin-queue-section{margin-bottom:32px}
.admin-home .admin-queue-grid{gap:12px}
.admin-home .admin-queue-link{min-height:84px;padding:16px 18px;border:1px solid #dce9e1;border-radius:14px;box-shadow:0 3px 10px #1a4b3108}
.admin-home .admin-queue-link>span:first-child{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:12px;background:#eef6f1;font-size:22px}
.admin-home .admin-queue-link>span:last-child{display:grid;place-items:center;width:31px;height:31px;border-radius:9px;background:#f2f8f4;color:#0a6945}
.admin-home .admin-queue-link b{font-size:13px;color:#21392a}
.admin-home .admin-queue-link small{font-size:11px}
.admin-home .admin-workspace-grid{gap:12px}
.admin-home .admin-workspace-card{min-height:82px;padding:14px 16px;gap:13px;border:1px solid #dce9e1;border-radius:14px;box-shadow:0 3px 10px #1a4b3107}
.admin-home .admin-workspace-icon{width:43px;height:43px;font-size:21px;border-radius:12px;background:#eff7f2}
.admin-home .admin-workspace-copy{gap:5px}
.admin-home .admin-workspace-copy b{font-size:12.5px;color:#20372a}
.admin-home .admin-workspace-copy small{font-size:11px;color:#738177;line-height:1.45}
.admin-home .admin-workspace-card .admin-card-chevron{align-self:center;width:27px;height:27px}
.admin-home .admin-workspace-card:hover,.admin-home .admin-queue-link:hover,.admin-home .admin-overview-card:hover{border-color:#a9d7bd;box-shadow:0 11px 25px #17452d16}
@media(max-width:980px){.admin-home{padding:24px 20px 48px}.admin-home .admin-overview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.admin-home .admin-workspace-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.admin-home{padding:18px 14px 40px}.admin-home-header{align-items:flex-start;gap:12px}.admin-home .admin-overview-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-home .admin-overview-card{min-height:155px;padding:14px}.admin-home .admin-overview-card strong{font-size:31px}.admin-home .admin-queue-grid,.admin-home .admin-workspace-grid{grid-template-columns:1fr}.admin-home .admin-queue-link,.admin-home .admin-workspace-card{min-height:76px}.admin-home .admin-live{font-size:10px;padding:7px 9px}}
@media(max-width:390px){.admin-home .admin-overview-grid{grid-template-columns:1fr}.admin-home-header{flex-direction:column}}
@media(prefers-reduced-motion:reduce){.admin-home .admin-overview-card,.admin-home .admin-workspace-card,.admin-home .admin-queue-link{transition:none}}
`}</style>
    </main>
  );
}

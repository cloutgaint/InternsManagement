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
    "Projects, milestones and deliverables",
    "/admin/projects",
  ],
  [
    "👥",
    "Mentor Assignment",
    "Mentor workload and assignments",
    "/admin/mentors",
  ],
  ["🫂", "Group Proposals", "Review and approve groups", "/admin/groups"],
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
    "Groups, projects and weekly tasks",
    "/admin/work",
  ],
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
    "groups_pending",
    "completions_pending",
    "task_evaluations_pending",
  );
  const pendingItems = [
    {label:"Leave requests",key:"leave_pending",href:"/admin/leave"},
    {label:"Attendance exceptions",key:"attendance_exceptions",href:"/admin/attendance"},
    {label:"Group approvals",key:"groups_pending",href:"/admin/groups"},
    {label:"Completion reviews",key:"completions_pending",href:"/admin/completion"},
    {label:"Task evaluations",key:"task_evaluations_pending",href:"/admin/work"},
  ];
  const modulePending = {
    "/admin/verification": verification,
    "/admin/attendance": count("attendance_exceptions","faces_pending"),
    "/admin/leave": count("leave_pending"),
    "/admin/groups": count("groups_pending"),
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
      tone: "purple",
    },
  ];
  return (
    <main className="wrap admin-home">
      <header className="admin-home-header">
        <div>
          <span className="admin-eyebrow">ADMIN WORKSPACE</span>
          <h1>Admin Dashboard</h1>
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
                {x.icon}
              </span>
              <span className="admin-card-chevron" aria-hidden="true">
                ↗
              </span>
            </div>
            <span className="admin-overview-title">{x.title}</span>
            <strong>{loading ? "…" : x.value}</strong>
            <small>{x.sub}</small>
          </Link>
        ))}
      </section>
      {!loading && pending>0 && <section className="card" aria-label="Pending operations breakdown" style={{marginTop:14,padding:16}}>
        <h2 style={{margin:"0 0 10px",fontSize:16}}>Pending Operations Breakdown</h2>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{pendingItems.filter(item=>count(item.key)>0).map(item=><Link key={item.key} href={item.href} style={{display:"inline-flex",alignItems:"center",gap:8,border:"1px solid #dce6e0",borderRadius:10,padding:"9px 12px",color:"inherit",textDecoration:"none"}}><strong style={{color:"#b91c1c"}}>{count(item.key)}</strong><span>{item.label}</span><span aria-hidden="true">↗</span></Link>)}</div>
      </section>}
      <section className="admin-queue-section">
        <div className="admin-section-heading">
          <div>
            <h2>Action Center</h2>
            <p className="muted">
              Jump straight to the workspace that needs attention.
            </p>
          </div>
        </div>
        <div className="admin-queue-grid">
          <Link href="/admin/verification" className="admin-queue-link">
            <span aria-hidden="true">🪪</span>
            <span>
              <b>Student Verification</b>
              <small>
                {loading ? "Loading…" : verification + " pending"} · Proofs,
                accounts and face verification
              </small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link href="/admin/attendance" className="admin-queue-link">
            <span aria-hidden="true">📅</span>
            <span>
              <b>Attendance</b>
              <small>
                {loading
                  ? "Loading…"
                  : count("attendance_exceptions") + " exceptions"}{" "}
                · Face approvals and records
              </small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link href="/admin/leave" className="admin-queue-link">
            <span aria-hidden="true">🌴</span>
            <span>
              <b>Leave Requests</b>
              <small>
                {loading ? "Loading…" : count("leave_pending") + " pending"} ·
                Review leave applications
              </small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link href="/admin/completion" className="admin-queue-link">
            <span aria-hidden="true">🎓</span>
            <span>
              <b>Completion</b>
              <small>
                {loading
                  ? "Loading…"
                  : count("completions_pending") + " pending"}{" "}
                · Final decisions and certificates
              </small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
      <section className="admin-workspaces">
        <div className="admin-section-heading">
          <div>
            <h2>Management Workspaces</h2>
            <p className="muted">
              All administrative modules, grouped in one consistent grid.
            </p>
          </div>
        </div>
        <div className="admin-workspace-grid">
          {modules.map(([icon, title, description, href]) => (
            <Link key={href} href={href} className="admin-workspace-card" style={{position:"relative",paddingRight:modulePending[href]>0?45:undefined}}>
              <span className="admin-workspace-icon" aria-hidden="true">
                {icon}
              </span>
              <span className="admin-workspace-copy">
                <b>{title}</b>
                <small>{description}</small>
              </span>
              {pendingBadge(modulePending[href] || 0)}
              <span className="admin-card-chevron" aria-hidden="true" style={modulePending[href]>0?{marginRight:25}:undefined}>
                ↗
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

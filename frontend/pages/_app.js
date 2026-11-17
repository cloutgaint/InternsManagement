import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import "@/shared/globals.css";
import { useAppSession } from "@/shared/auth/useAppSession";
export default function App({ Component, pageProps }) {
  const router = useRouter();
  const pageHistory = useRef([]);
  const { session, profile, photo, clearSession } = useAppSession(router.asPath);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const profileRef = useRef(null);
  useEffect(() => {
    setProfileOpen(false);
    setMobileNavOpen(false);
  }, [router.asPath]);
  useEffect(() => {
    if (!profileOpen) return;
    const close = (e) => {
      if (!profileRef.current?.contains(e.target)) setProfileOpen(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [profileOpen]);
  const loggedIn = !!session.token;
  const role = session.role || "";
  const home = role.includes("ADMIN")
    ? "/admin"
    : role === "MENTOR"
      ? "/mentor"
      : role === "COLLEGE_COORDINATOR"
        ? "/college-coordinator"
        : "/intern";
  useEffect(() => {
    if (!loggedIn) {
      pageHistory.current = [];
      return;
    }
    const path = router.asPath;
    if (!(path === home || path.startsWith(home + "/"))) return;
    if (["/login", "/register", "/"].includes(path.split("?")[0])) return;
    const history = pageHistory.current;
    if (history[history.length - 1] !== path) history.push(path);
    if (history.length > 30) history.shift();
  }, [loggedIn, router.asPath, home]);
  const links = loggedIn
    ? [
        {
          href: home,
          label: role.includes("ADMIN")
            ? "Admin Dashboard"
            : role === "MENTOR"
              ? "Mentor Dashboard"
              : role === "COLLEGE_COORDINATOR"
                ? "College Coordinator Dashboard"
                : "Student Dashboard",
        },
        { href: "/account/password", label: "Password" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/login", label: "Student Login" },
        { href: "/login?role=admin", label: "Admin Login" },
        { href: "/login?role=college", label: "Coordinator Login" },
        { href: "/login?role=mentor", label: "Mentor Login" },
        { href: "/register", label: "Student Registration" },
      ];
  const activeNavHref=router.pathname==="/login"
    ? (["admin","college","mentor"].includes(router.query.role)?"/login?role="+router.query.role:"/login")
    : router.pathname;
  function goBack() {
    if (!loggedIn) {
      router.push("/");
      return;
    }
    const history = pageHistory.current;
    if (history[history.length - 1] === router.asPath) history.pop();
    const previous = history.pop();
    router.push(previous && previous !== router.asPath ? previous : home);
  }
  function logout() {
    pageHistory.current = [];
    setProfileOpen(false);
    clearSession();
    router.replace("/login");
  }
  return (
    <>
      <Head>
        <title>GAINT SkillBridge | Connecting Education with Industry</title>
        <meta
          name="description"
          content="End-to-end internship lifecycle management"
        />
      </Head>
      <header className="top glass-top">
        <div className="glass-nav-shell">
          <Link
            href="/"
            className="glass-brand"
            aria-label="GAINT SkillBridge home"
          >
            <img
              src="/Interns-logo.png"
              alt="GAINT SkillBridge"
              className="glass-brand-logo"
            />
          </Link>
          <button className="glass-mobile-toggle" type="button" aria-label={mobileNavOpen?"Close navigation":"Open navigation"} aria-expanded={mobileNavOpen} aria-controls="gaint-primary-navigation" onClick={()=>setMobileNavOpen(v=>!v)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{mobileNavOpen?<><path d="M5 5l14 14M19 5L5 19"/></>:<><path d="M4 7h16M4 12h16M4 17h16"/></>}</svg></button>
          <nav id="gaint-primary-navigation" className={"nav glass-nav"+(mobileNavOpen?" mobile-open":"")} aria-label="Main navigation">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={activeNavHref === href ? "page" : undefined}
                className={
                  "glass-nav-link" +
                  (activeNavHref === href ? " is-active" : "") +
                  (!loggedIn && href === "/register" ? " glass-nav-cta" : "")
                }
              >
                {label}
              </Link>
            ))}
            {loggedIn && (
              <Link
                href="/notifications"
                className={
                  "nav-notification-icon" +
                  (router.pathname === "/notifications" ? " is-active" : "")
                }
                aria-label="Notifications"
                title="Notifications"
                aria-current={
                  router.pathname === "/notifications" ? "page" : undefined
                }
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                  <path d="M10 21h4" />
                </svg>
              </Link>
            )}
            {loggedIn && (
              <div className="nav-profile" ref={profileRef}>
                <button
                  type="button"
                  className="nav-profile-trigger"
                  aria-label="Open my profile"
                  aria-expanded={profileOpen}
                  aria-haspopup="dialog"
                  onClick={() => setProfileOpen((v) => !v)}
                >
                  {photo ? (
                    <img src={photo} alt="" className="nav-profile-avatar" />
                  ) : (
                    <span className="nav-profile-avatar nav-profile-initial">
                      {(profile?.full_name || profile?.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                  <span className="nav-profile-label">My Profile</span>
                  <span aria-hidden="true">⌄</span>
                </button>
                {profileOpen && (
                  <section
                    className="nav-profile-menu"
                    role="dialog"
                    aria-label="My profile"
                  >
                    <div className="nav-profile-top">
                      {photo ? (
                        <img
                          src={photo}
                          alt="Registered profile"
                          className="nav-profile-large"
                        />
                      ) : (
                        <span className="nav-profile-large nav-profile-initial">
                          {(profile?.full_name || profile?.email || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                      <div>
                        <strong>{profile?.full_name || "My Account"}</strong>
                        <small>{profile?.email || "Signed in"}</small>
                        <span className="nav-profile-role">
                          {profile?.role || role}
                        </span>
                      </div>
                    </div>
                    {role === "INTERN" && (
                      <div className="nav-profile-details">
                        <div>
                          <span>Roll Number</span>
                          <b>{profile?.roll_number || "—"}</b>
                        </div>
                        <div>
                          <span>Program</span>
                          <b>{profile?.program || "—"}</b>
                        </div>
                        <div>
                          <span>Branch</span>
                          <b>{profile?.branch || "—"}</b>
                        </div>
                        <div>
                          <span>Mobile</span>
                          <b>{profile?.mobile || "—"}</b>
                        </div>
                        <div>
                          <span>University</span>
                          <b>{profile?.university || "—"}</b>
                        </div>
                      </div>
                    )}
                    <Link
                      className="nav-profile-home"
                      href={home}
                      onClick={() => setProfileOpen(false)}
                    >
                      Go to Dashboard
                    </Link>
                    <button
                      type="button"
                      className="nav-profile-signout"
                      onClick={logout}
                    >
                      Log Out
                    </button>
                  </section>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>
      <style jsx global>{`
        /* Compact, balanced desktop header with a real mobile navigation. */
        .top.glass-top{min-height:72px;padding:9px 24px;background:#f9fcfa;border-bottom:1px solid #dceae2;box-shadow:0 3px 16px #16452d0c;backdrop-filter:blur(16px)}
        .top .glass-nav-shell{max-width:1200px;min-height:52px;gap:24px}
        .top .glass-brand{flex:none}
        .top .glass-brand-logo{width:155px;height:47px;object-fit:contain}
        .top .glass-nav{margin-left:auto;gap:3px;padding:4px;border:1px solid #e3ece6;border-radius:13px;background:#fff;box-shadow:none}
        .top .glass-nav-link{min-height:38px;padding:9px 12px;border-radius:9px;font-size:12px;font-weight:700;color:#385548}
        .top .glass-nav-link:hover{background:#f0f7f3;color:#075b3b}
        .top .glass-nav-link.is-active:not(.glass-nav-cta){background:#e3f2e9;color:#075b3b}
        .top .glass-nav-cta{background:#086443;color:white;box-shadow:none;margin-left:6px}
        .top .glass-nav-cta:hover{background:#064d34;color:white;transform:none}
        .glass-mobile-toggle{display:none;align-items:center;justify-content:center;width:42px;height:42px;border:1px solid #d5e5dc;border-radius:11px;background:white;color:#0a6040;cursor:pointer}
        .glass-mobile-toggle:focus-visible{outline:3px solid #2c8e65;outline-offset:2px}
        @media(max-width:1080px){
          .top.glass-top{padding:9px 18px}
          .top .glass-nav-shell{position:relative;max-width:100%;gap:12px}
          .top .glass-brand-logo{width:145px;height:43px}
          .glass-mobile-toggle{display:inline-flex;margin-left:auto}
          .top .glass-nav{display:none;position:absolute;top:calc(100% + 12px);left:0;right:0;z-index:110;flex-direction:column;align-items:stretch;gap:4px;margin:0;padding:12px;background:#fff;border:1px solid #dceae2;border-radius:15px;box-shadow:0 16px 38px #174c3420}
          .top .glass-nav.mobile-open{display:flex}
          .top .glass-nav-link{justify-content:flex-start;min-height:43px;padding:11px 14px;font-size:13px}
          .top .glass-nav-cta{margin:6px 0 0;justify-content:center}
          .top .nav-profile{width:100%}
          .top .nav-profile-trigger{width:100%;justify-content:flex-start}
          .top .nav-profile-menu{right:0;max-width:100%}
        }
        @media(max-width:600px){.top.glass-top{min-height:64px;padding:8px 14px}.top .glass-nav-shell{min-height:46px}.top .glass-brand-logo{width:135px;height:40px}.top .glass-nav{top:calc(100% + 9px)}}
        @media(prefers-reduced-motion:reduce){.top .glass-nav-link{transition:none}}
        .login-back-bar{position:relative;z-index:1;background:#eef7f1;padding:14px 24px 10px;border:0;box-shadow:none}
        .login-back-bar .page-back-inner{max-width:1000px}
        .page-back-button .back-arrow{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#e5f4eb;color:#087449;flex:none}
        .page-back-button .back-arrow svg{display:block}
        .login-back-bar .page-back-button{display:inline-flex;align-items:center;gap:9px;min-height:38px;padding:5px 14px 5px 7px;border:1px solid #cde3d5;border-radius:999px;background:#ffffffd9;color:#09583a;font-size:13px;font-weight:750;box-shadow:0 3px 12px #154c3210;transition:background .16s,border-color .16s,transform .16s}
        .login-back-bar .page-back-button .back-arrow{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#e5f4eb;color:#087449;font-size:18px;line-height:1}
        .login-back-bar .page-back-button:hover{background:#fff;border-color:#8bc6a6;transform:translateX(-2px)}
        .login-back-bar .page-back-button:focus-visible{outline:3px solid #25865c;outline-offset:2px}
        @media(max-width:640px){.login-back-bar{padding:10px 14px 8px}}
        .nav-notification-icon {
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          color: #254a37;
          flex-shrink: 0;
          transition:
            background 0.15s,
            color 0.15s;
        }
        .nav-notification-icon:hover,
        .nav-notification-icon.is-active {
          background: #e5f1e9;
          color: #075b38;
        }
        .nav-notification-icon:focus-visible {
          outline: 2px solid #087044;
          outline-offset: 2px;
        }
      `}</style>
      {router.pathname !== "/" && (!loggedIn || router.asPath !== home) && (
        <div className={"page-back-bar"+(router.pathname==="/login"?" login-back-bar":"")}>
          <div className="page-back-inner">
            <button
              type="button"
              className="page-back-button"
              onClick={goBack}
              aria-label="Go back to previous page"
            >
              <span className="back-arrow" aria-hidden="true"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6"/><path d="M9 12h11"/></svg></span><span>Back</span>
            </button>
          </div>
        </div>
      )}
      <Component {...pageProps} />
    </>
  );
}

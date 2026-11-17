"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api } from "@/shared/api/client";
export default function LoginPage() {
  const router=useRouter();
  const adminMode=router.query.role==="admin";
  const collegeMode=router.query.role==="college";
  const mentorMode=router.query.role==="mentor";
  const [e, setE] = useState(""),
    [p, setP] = useState(""),
    [show, setShow] = useState(false),
    [err, setErr] = useState(""),
    [pending,setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [mfa, setMfa] = useState(null),
    [code, setCode] = useState(""),
    [setup, setSetup] = useState(null);
  const EyeIcon=({visible})=><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible&&<path d="M3 3l18 18" strokeWidth="2.2"/>}</svg>;
  function finish(d) {
    sessionStorage.setItem("token", d.token);
    sessionStorage.setItem("role", d.user.role);
    location.href = d.user.mustChangePassword ? "/account/password?required=1" : d.user.role.includes("ADMIN")
      ? "/admin"
      : d.user.role === "COLLEGE_COORDINATOR" ? "/college-coordinator"
      : d.user.role === "MENTOR"
        ? "/mentor"
        : "/intern";
  }
  async function go(ev) {
    ev.preventDefault();
    setErr("");
    setPending(false);
    const email = e.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setErr("Enter a valid email address.");
    if (!p)
      return setErr("Enter your password.");
    if(busy)return;
    try {
      setBusy(true);
      const d = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: p }),
      });
      if(collegeMode&&d.user?.role!=="COLLEGE_COORDINATOR")return setErr("This account does not have college coordinator access.");
      if(mentorMode&&d.user?.role!=="MENTOR")return setErr("This account does not have mentor access.");
      if (d.mfaRequired) {
        setMfa(d);
        if (d.mfaSetupRequired)
          setSetup(
            await api("/auth/mfa/setup", {
              method: "POST",
              body: JSON.stringify({ challenge: d.challenge }),
            }),
          );
        return;
      }
      if(adminMode&&!d.user?.role?.includes("ADMIN"))return setErr("This account does not have administrator access.");
      if(collegeMode&&d.user?.role!=="COLLEGE_COORDINATOR")return setErr("This account does not have college coordinator access.");
      if(mentorMode&&d.user?.role!=="MENTOR")return setErr("This account does not have mentor access.");
      finish(d);
    } catch (x) {
      const isPending=/pending Admin verification|pending.*approval|not approved\/active/i.test(x.message);
      setPending(isPending);
      setErr(isPending?x.message:/invalid credentials/i.test(x.message)?"Invalid email or password.":x.message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(ev) {
    ev.preventDefault();
    if(busy)return;
    setErr("");
    if(!/^\d{6}$/.test(code))return setErr("Enter the 6-digit authentication code.");
    try {
      setBusy(true);
      const d = await api("/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ challenge: mfa.challenge, code }),
      });
      if(adminMode&&!d.user?.role?.includes("ADMIN"))return setErr("This account does not have administrator access.");
      if(collegeMode&&d.user?.role!=="COLLEGE_COORDINATOR")return setErr("This account does not have college coordinator access.");
      finish(d);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell auth-login-shell premium-login-shell"><div className="premium-login-layout"><aside className="premium-login-story"><div className="premium-login-story-inner"><div className="premium-login-brand"><img src="/Interns-logo.png" alt="GAINT Interns Hub" /></div><h2>One place for your <em>internship journey.</em></h2><p>Access your workspace, stay connected with your college and mentors, and follow your progress through every stage.</p><div className="premium-login-story-steps"><div><span>01</span><strong>Register &amp; verify</strong></div><div><span>02</span><strong>Learn &amp; collaborate</strong></div><div><span>03</span><strong>Track your progress</strong></div></div><div className="premium-login-story-foot">Your next chapter starts here <span aria-hidden="true">↗</span></div></div></aside>
      <section className="auth-panel auth-login-panel premium-login-panel">
        <div className="auth-brand">
          <span className="eyebrow">{adminMode?"GAINT ADMIN PORTAL":collegeMode?"COLLEGE COORDINATOR PORTAL":mentorMode?"GAINT MENTOR PORTAL":"GAINT STUDENT PORTAL"}</span>
          <h1>{mfa ? "Secure verification" : adminMode ? "Admin sign in" : collegeMode ? "College coordinator sign in" : mentorMode ? "Mentor sign in" : "Welcome back"}</h1>
          <p>
            {mfa
              ? "Admin and Mentor accounts require multi-factor authentication."
              : adminMode ? "Access the administrative workspace using your authorized account." : collegeMode ? "View your college interns and semester batches." : mentorMode ? "Assign tasks and review intern submissions." : "Sign in to continue to your internship workspace."}
          </p>
        </div>
        {router.query.registered==="1"&&!adminMode&&<p className="success" role="status">Registration submitted successfully. Your college permission proof is awaiting Admin verification and approval. You can sign in after your account is activated.</p>}
        {err && <p className={pending?"success":"error"} role="alert"><strong>{pending?"Account Pending Approval":"Sign-in unsuccessful"}</strong><span style={{display:"block",marginTop:6}}>{err}</span></p>}
        {!mfa ? (
          <form onSubmit={go} noValidate>
            <div className="form-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                className="input"
                type="email"
                autoComplete="email"
                value={e}
                onChange={(x) => setE(x.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="login-password">Password</label>
              <div className="password-wrap">
                <input
                  id="login-password"
                  className="input"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={p}
                  onChange={(x) => setP(x.target.value)}
                  required
                />
                <button
                  className="password-eye"
                  type="button"
                  onClick={() => setShow((x) => !x)}
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                >
                  <EyeIcon visible={show} />
                </button>
              </div>
            </div>
            <button className="btn auth-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="auth-login-switch"><Link href="/forgot-password">Forgot password?</Link>{!adminMode&&!collegeMode&&!mentorMode&&<> · <Link href="/application-status">Check application status</Link></>}</p><p className="auth-login-switch">{adminMode?<>Student account? <Link href="/login">Student Login</Link></>:<>Administrator? <Link href="/login?role=admin">Admin Login</Link> · College coordinator? <Link href="/login?role=college">Coordinator Login</Link> · Mentor? <Link href="/login?role=mentor">Mentor Login</Link></>}</p>
          </form>
        ) : (
          <form onSubmit={verify}>
            {setup && (
              <div className="mfa-setup">
                <h3>Set up Authenticator</h3>
                <p>
                  Scan this QR code with Google Authenticator, Microsoft
                  Authenticator or another TOTP app.
                </p>
                <img src={setup.qrDataUrl} alt="MFA QR code" />
                <details>
                  <summary>Cannot scan?</summary>
                  <code>{setup.secret}</code>
                </details>
              </div>
            )}
            <div className="form-field">
              <label>6-digit authentication code</label>
              <input
                className="input mfa-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="6"
                value={code}
                onChange={(x) => setCode(x.target.value.replace(/\D/g, ""))}
                autoFocus
                required
              />
            </div>
            <button
              className="btn auth-submit"
              disabled={busy || code.length !== 6}
            >
              {busy ? "Verifying…" : "Verify & Continue"}
            </button>
            <button
              className="btn secondary auth-submit"
              type="button"
              onClick={() => {
                setMfa(null);
                setSetup(null);
                setCode("");
              }}
            >
              Back to sign in
            </button>
          </form>
        )}
      </section></div>
      <style jsx global>{`
      .premium-login-shell{min-height:calc(100vh - 90px);display:flex;align-items:center;justify-content:center;padding:36px 24px 48px;background:radial-gradient(circle at 12% 20%,#e2f5ea 0,transparent 40%),linear-gradient(130deg,#f5faf7,#edf5f1)}
      .premium-login-layout{width:min(1050px,100%);min-height:580px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.93fr);background:#fff;border:1px solid #dce9e1;border-radius:24px;overflow:hidden;box-shadow:0 25px 75px #1c53321a}
      .premium-login-story{position:relative;display:flex;align-items:center;overflow:hidden;background:radial-gradient(circle at 90% 85%,#16885f 0,transparent 47%),linear-gradient(145deg,#086342,#06442f);color:white;padding:54px 48px}
      .premium-login-story:before,.premium-login-story:after{content:"";position:absolute;width:340px;height:340px;border:1px solid #ffffff22;border-radius:50%;pointer-events:none}.premium-login-story:before{right:-150px;top:-140px}.premium-login-story:after{right:-95px;bottom:-240px;width:430px;height:430px}
      .premium-login-story-inner{position:relative;z-index:1;width:100%}.premium-login-kicker{display:inline-flex;padding:9px 13px;border:1px solid #ffffff55;border-radius:30px;font-size:11px;letter-spacing:1.3px;font-weight:800;color:#e5fff2}
      .premium-login-story h2{font-size:clamp(34px,3.5vw,49px);letter-spacing:-1.6px;line-height:1.14;margin:28px 0 16px;font-weight:850;color:white}.premium-login-story h2 em{font-style:normal;color:#a9f3cb}
      .premium-login-story p{font-size:14px;line-height:1.85;color:#d1ebdf;max-width:390px;margin:0}
      .premium-login-story-steps{display:grid;gap:12px;margin-top:40px}.premium-login-story-steps>div{display:flex;align-items:center;gap:13px;padding:12px 15px;background:#ffffff13;border:1px solid #ffffff24;border-radius:12px;font-size:13px}.premium-login-story-steps span{font-size:11px;font-weight:800;color:#a7f0c8}.premium-login-story-steps strong{font-weight:700}
      .premium-login-story-foot{display:flex;align-items:center;justify-content:space-between;margin-top:38px;font-size:12px;color:#c7e8d5}.premium-login-story-foot span{font-size:23px}
      .premium-login-layout .premium-login-panel{width:100%;max-width:none;min-width:0;margin:0;align-self:center;padding:44px 45px;background:#fff;border:0;border-radius:0;box-shadow:none}
      .premium-login-panel .auth-brand{margin-bottom:27px}.premium-login-panel .auth-brand .eyebrow{display:inline-block;color:#08724b;letter-spacing:1.4px;font-weight:800;font-size:11px}.premium-login-panel .auth-brand h1{font-size:clamp(28px,3vw,36px);letter-spacing:-1px;margin:10px 0}.premium-login-panel .auth-brand p{font-size:13px;line-height:1.7;color:#687b70}
      .premium-login-panel .form-field{margin-bottom:19px}.premium-login-panel .form-field label{display:block;margin-bottom:9px;font-weight:750;color:#21372b;font-size:13px}
      .premium-login-panel .input{width:100%;min-height:48px;background:#f8fbf9;border:1px solid #d3e3d9;border-radius:10px;padding:12px 14px;color:#142a1f;outline:none;transition:border-color .15s,box-shadow .15s}.premium-login-panel .input:focus{border-color:#087a51;box-shadow:0 0 0 3px #0b86501b}
      .premium-login-panel .password-wrap{position:relative}.premium-login-panel .password-wrap .input{padding-right:75px}.premium-login-panel .password-eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:#e8f3ec;border:0;border-radius:8px;padding:8px 12px;color:#095b3c;font-weight:750;font-size:11px;cursor:pointer}
      .premium-login-panel .auth-submit{width:100%;min-height:48px;border-radius:10px;background:#086342;color:white;font-weight:800;margin-top:7px}.premium-login-panel .auth-submit:hover{background:#075235}.premium-login-panel .auth-submit.secondary{background:#eef6f1;color:#075b3c}
      .premium-login-panel .auth-login-switch{text-align:center;font-size:12px;line-height:1.7;color:#708075;margin:17px 0 0}.premium-login-panel .auth-login-switch a{color:#08724b;font-weight:750;text-decoration:underline;text-underline-offset:3px}
      .premium-login-panel .success,.premium-login-panel .error{margin-bottom:20px}
      @media(max-width:850px){.premium-login-layout{grid-template-columns:1fr;max-width:560px}.premium-login-story{padding:25px 30px}.premium-login-story h2{font-size:28px;margin:15px 0 10px}.premium-login-story p,.premium-login-story-steps,.premium-login-story-foot{display:none}.premium-login-layout .premium-login-panel{padding:35px 32px}}
      @media(max-width:480px){.premium-login-shell{padding:16px 12px 28px}.premium-login-layout{border-radius:17px;min-height:0}.premium-login-story{padding:20px}.premium-login-story h2{font-size:24px}.premium-login-layout .premium-login-panel{padding:27px 22px}.premium-login-panel .auth-brand h1{font-size:28px}}

      /* Keep the entire login panel in the available viewport without horizontal scrolling. */
      html,body{max-width:100%;overflow-x:clip}
      .premium-login-shell{box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:0;padding:20px 20px 28px;overflow-x:clip;align-items:flex-start}
      .premium-login-shell *{box-sizing:border-box}
      .premium-login-layout{width:min(100%,1000px);max-width:100%;min-width:0;min-height:0;grid-template-columns:minmax(0,1fr) minmax(0,1fr);margin:0 auto;align-self:start}
      .premium-login-story,.premium-login-layout .premium-login-panel{min-width:0}
      .premium-login-story{padding:34px 38px}
      .premium-login-story h2{font-size:clamp(30px,3vw,43px);margin:18px 0 12px}
      .premium-login-story-steps{margin-top:23px;gap:8px}
      .premium-login-story-steps>div{padding:9px 12px}
      .premium-login-story-foot{margin-top:22px}
      .premium-login-layout .premium-login-panel{padding:30px 36px}
      .premium-login-panel .auth-brand{margin-bottom:18px}
      .premium-login-panel .auth-brand h1{margin:7px 0}
      .premium-login-panel form{gap:13px}
      .premium-login-panel .form-field{margin:0}
      .premium-login-panel .input{margin:0;min-width:0}
      .premium-login-panel .auth-login-switch{margin:8px 0 0;overflow-wrap:anywhere}
      @media(max-width:850px){.premium-login-layout{grid-template-columns:minmax(0,1fr);max-width:560px}.premium-login-story{padding:22px 28px}.premium-login-story h2{font-size:27px;margin:12px 0 0}.premium-login-story p,.premium-login-story-steps,.premium-login-story-foot{display:none}.premium-login-layout .premium-login-panel{padding:28px}}
      @media(max-width:480px){.premium-login-shell{padding:12px 10px 20px}.premium-login-story{padding:18px}.premium-login-story h2{font-size:23px}.premium-login-layout .premium-login-panel{padding:23px 18px}}
            .premium-login-brand{display:inline-flex;align-items:center;justify-content:center;background:#fff;border-radius:14px;padding:11px 16px;max-width:235px;box-shadow:0 8px 22px #002b1b24}.premium-login-brand img{display:block;width:190px;max-width:100%;height:auto;object-fit:contain}
      @media(max-width:480px){.premium-login-brand{padding:8px 12px;max-width:185px}.premium-login-brand img{width:155px}}
      /* Continuous background through the bottom of the viewport. */
      .premium-login-shell{min-height:calc(100dvh - 145px);background:#eef7f1;align-items:flex-start;padding-top:12px}
      .premium-login-layout{margin-top:0}
      /* Remove white logo badge; blend white pixels of existing opaque PNG into green. */
      .premium-login-brand{background:transparent;box-shadow:none;border-radius:0;padding:0;max-width:235px}
      .premium-login-brand img{mix-blend-mode:multiply;width:190px;height:auto}
      @media(max-width:480px){.premium-login-brand{padding:0}.premium-login-brand img{width:155px}}
      .premium-login-panel .password-eye{display:grid;place-items:center;width:35px;height:35px;padding:0;color:#075c3e;background:#e8f3ec}.premium-login-panel .password-eye:hover{background:#d5eadd}.premium-login-panel .password-eye:focus-visible{outline:2px solid #087449;outline-offset:2px}
      @media(prefers-reduced-motion:reduce){.premium-login-panel .input{transition:none}}
      `}</style>
    </main>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api } from "@/shared/api/client";
export default function LoginPage() {
  const router=useRouter();
  const adminMode=router.query.role==="admin";
  const collegeMode=router.query.role==="college";
  const [e, setE] = useState(""),
    [p, setP] = useState(""),
    [show, setShow] = useState(false),
    [err, setErr] = useState(""),
    [pending,setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [mfa, setMfa] = useState(null),
    [code, setCode] = useState(""),
    [setup, setSetup] = useState(null);
  function finish(d) {
    sessionStorage.setItem("token", d.token);
    sessionStorage.setItem("role", d.user.role);
    location.href = d.user.role.includes("ADMIN")
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
    if (p.length < 10)
      return setErr("Password must contain at least 10 characters.");
    try {
      setBusy(true);
      const d = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: p }),
      });
      if(collegeMode&&d.user?.role!=="COLLEGE_COORDINATOR")return setErr("This account does not have college coordinator access.");
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
    <main className="auth-shell auth-login-shell">
      <section className="auth-panel auth-login-panel">
        <div className="auth-brand">
          <span className="eyebrow">{adminMode?"GAINT ADMIN PORTAL":collegeMode?"COLLEGE COORDINATOR PORTAL":"GAINT STUDENT PORTAL"}</span>
          <h1>{mfa ? "Secure verification" : adminMode ? "Admin sign in" : collegeMode ? "College coordinator sign in" : "Welcome back"}</h1>
          <p>
            {mfa
              ? "Admin and Mentor accounts require multi-factor authentication."
              : adminMode ? "Access the administrative workspace using your authorized account." : collegeMode ? "View your college interns and semester batches." : "Sign in to continue to your internship workspace."}
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
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <button className="btn auth-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="auth-login-switch">{adminMode?<>Student account? <Link href="/login">Student Login</Link></>:<>Administrator? <Link href="/login?role=admin">Admin Login</Link> · College coordinator? <Link href="/login?role=college">Coordinator Login</Link></>}</p>
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
      </section>
    </main>
  );
}

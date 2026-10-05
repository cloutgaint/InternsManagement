"use client";
import { useState } from "react";
import { api } from "../../lib/api";
export default function Login() {
  const [e, setE] = useState(""),
    [p, setP] = useState(""),
    [show, setShow] = useState(false),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [mfa, setMfa] = useState(null),
    [code, setCode] = useState(""),
    [setup, setSetup] = useState(null);
  function finish(d) {
    localStorage.setItem("token", d.token);
    localStorage.setItem("role", d.user.role);
    location.href = d.user.role.includes("ADMIN")
      ? "/admin"
      : d.user.role === "MENTOR"
        ? "/mentor"
        : "/intern";
  }
  async function go(ev) {
    ev.preventDefault();
    setErr("");
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
      finish(d);
    } catch (x) {
      setErr(x.message);
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
      finish(d);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="eyebrow">GAINT INTERNS</span>
          <h1>{mfa ? "Secure verification" : "Welcome back"}</h1>
          <p>
            {mfa
              ? "Admin and Mentor accounts require multi-factor authentication."
              : "Sign in to continue to your internship workspace."}
          </p>
        </div>
        {err && <p className="error">{err}</p>}
        {!mfa ? (
          <form onSubmit={go} noValidate>
            <div className="form-field">
              <label>Email address</label>
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={e}
                onChange={(x) => setE(x.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label>Password</label>
              <div className="password-wrap">
                <input
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

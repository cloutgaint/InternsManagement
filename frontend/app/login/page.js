"use client";
import { useState } from "react";
import { api } from "../../lib/api";
export default function Login() {
  const [e, setE] = useState(""),
    [p, setP] = useState(""),
    [show, setShow] = useState(false),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
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
      localStorage.setItem("token", d.token);
      localStorage.setItem("role", d.user.role);
      location.href = d.user.role.includes("ADMIN")
        ? "/admin"
        : d.user.role === "MENTOR"
          ? "/mentor"
          : "/intern";
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
          <h1>Welcome back</h1>
          <p>Sign in to continue to your internship workspace.</p>
        </div>
        {err && <p className="error">{err}</p>}
        <form onSubmit={go} noValidate>
          <div className="form-field">
            <label>Email address</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={e}
              onChange={(x) => setE(x.target.value)}
              placeholder="name@example.com"
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
                placeholder="Enter your password"
                required
                minLength="10"
              />
              <button
                className="eye-btn"
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                title={show ? "Hide password" : "Show password"}
                onClick={() => setShow((v) => !v)}
              >
                {show ? "◉" : "◉"}
              </button>
            </div>
          </div>
          <button className="btn btn-block" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-foot">
          New student? <a href="/register">Apply for internship</a>
        </p>
      </section>
    </main>
  );
}

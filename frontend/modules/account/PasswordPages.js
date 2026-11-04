"use client";
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { api } from "@/shared/api/client";
const RULE = "At least 10 characters with upper and lowercase letters, a number and a symbol.";
export function ForgotPasswordPage() {
  const [email, setEmail] = useState(""), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function send(e) {
    e.preventDefault();
    setErr("");
    try {
      setBusy(true);
      setMsg((await api("/auth/password/forgot", { method: "POST", body: JSON.stringify({ email }) })).message);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <main className="wrap">
      <h1>Forgot Password</h1>
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <section className="card">
        <form className="form-grid" onSubmit={send}>
          <div className="form-field"><label htmlFor="forgot-email">Registered Email</label><input id="forgot-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Sending…" : "Send Reset Link"}</button></div>
        </form>
      </section>
    </main>
  );
}
export function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setErr("");
    if (password !== confirm) return setErr("Passwords do not match.");
    try {
      setBusy(true);
      setMsg((await api("/auth/password/reset", { method: "POST", body: JSON.stringify({ token: router.query.token, password }) })).message);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <main className="wrap">
      <h1>Set a New Password</h1>
      <p className="muted">{RULE}</p>
      {err && <p className="error" role="alert">{err}</p>}
      {msg ? <p className="success" role="status">{msg} <Link href="/login">Sign in</Link></p> : (
        <section className="card">
          <form className="form-grid" onSubmit={save}>
            <div className="form-field"><label htmlFor="reset-password">New Password</label><input id="reset-password" className="input" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="form-field"><label htmlFor="reset-confirm">Confirm Password</label><input id="reset-confirm" className="input" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            <div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Saving…" : "Save Password"}</button></div>
          </form>
        </section>
      )}
    </main>
  );
}
export function ChangePasswordPage() {
  const router = useRouter();
  const [f, setF] = useState({ currentPassword: "", password: "", confirm: "" }), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setErr("");
    if (f.password !== f.confirm) return setErr("Passwords do not match.");
    try {
      setBusy(true);
      const { token } = await api("/auth/password/change", { method: "POST", body: JSON.stringify({ currentPassword: f.currentPassword, password: f.password }) });
      sessionStorage.setItem("token", token);
      setMsg("Password changed.");
      setF({ currentPassword: "", password: "", confirm: "" });
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <main className="wrap">
      <h1>Change Password</h1>
      {router.query.required === "1" && <p className="proof-alert" role="status">You must change the temporary password before continuing.</p>}
      <p className="muted">{RULE}</p>
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <section className="card">
        <form className="form-grid" onSubmit={save}>
          {[["currentPassword", "Current Password", "current-password"], ["password", "New Password", "new-password"], ["confirm", "Confirm New Password", "new-password"]].map(([k, label, ac]) => (
            <div className="form-field" key={k}><label htmlFor={"pw-" + k}>{label}</label><input id={"pw-" + k} className="input" type="password" required autoComplete={ac} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></div>
          ))}
          <div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Saving…" : "Change Password"}</button></div>
        </form>
      </section>
    </main>
  );
}

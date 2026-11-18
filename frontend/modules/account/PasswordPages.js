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
    <main className="wrap change-password-modern">
      <div className="change-password-heading"><h1>Change Password</h1><p className="muted">Secure your account with a new password.</p></div>
      {router.query.required === "1" && <p className="proof-alert" role="status">You must change the temporary password before continuing.</p>}
      <p className="muted">{RULE}</p>
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <section className="card change-password-card">
        <form className="change-password-form" onSubmit={save}>
          {[["currentPassword", "Current Password", "current-password"], ["password", "New Password", "new-password"], ["confirm", "Confirm New Password", "new-password"]].map(([k, label, ac]) => (
            <div className="form-field" key={k}><label htmlFor={"pw-" + k}>{label}</label><input id={"pw-" + k} className="input" type="password" required autoComplete={ac} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></div>
          ))}
          <div className="form-actions"><button type="submit" className="btn" disabled={busy}>{busy ? "Saving…" : "Change Password"}</button></div>
        </form>
      </section>
      <style jsx global>{` .change-password-modern{width:100%;max-width:840px;margin:0 auto;padding:32px 20px 64px;box-sizing:border-box;color:#111;clear:both}.change-password-modern .change-password-heading h1{font-size:clamp(26px,3vw,34px);margin:0 0 8px;line-height:1.25}.change-password-modern .change-password-heading p{font-size:14px;margin:0 0 16px}.change-password-modern>.muted{font-size:13px;line-height:1.6;margin-bottom:18px}.change-password-modern .change-password-card{border:1px solid #dce7e2;border-radius:20px;padding:28px;box-shadow:0 5px 18px #122c2010}.change-password-modern .change-password-form{display:grid;grid-template-columns:1fr;gap:18px;max-width:100%}.change-password-modern .form-field{display:flex;flex-direction:column;gap:8px;min-width:0}.change-password-modern .form-field label{font-size:14px;font-weight:650;color:#111}.change-password-modern .input{width:100%;box-sizing:border-box;min-height:48px;border:1.5px solid #7099f7;border-radius:10px;color:#111}.change-password-modern .input:focus-visible{outline:3px solid #a4bfff;outline-offset:2px}.change-password-modern .form-actions{display:flex;justify-content:flex-start;padding-top:4px}.change-password-modern .form-actions .btn{border-radius:999px;min-height:48px;padding:0 28px;background:linear-gradient(120deg,#8d48f6,#5c8cf8);color:#fff;border:0}.change-password-modern .form-actions .btn:hover:not(:disabled){color:#fff;filter:brightness(.94)}@media(max-width:600px){.change-password-modern{padding:20px 16px 48px}.change-password-modern .change-password-card{padding:18px}.change-password-modern .form-actions .btn{width:100%}} `}</style>
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function NotificationsPage() {
  const [n, setN] = useState([]), [err, setErr] = useState("");
  const load = () => api("/notifications").then(setN).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  async function open(x) {
    try {
      if (!x.read_at) await api("/notifications/" + x.id + "/read", { method: "POST", body: "{}" });
      if (x.action_url) location.href = x.action_url;
      else load();
    } catch (e) { setErr(e.message); }
  }
  async function readAll() {
    try { await api("/notifications/read-all", { method: "POST", body: "{}" }); load(); } catch (e) { setErr(e.message); }
  }
  const unread = n.filter((x) => !x.read_at).length;
  return (
    <main className="wrap">
      <div className="intern-head">
        <div><h1>Notifications</h1><p className="muted">{unread} unread</p></div>
        {unread > 0 && <button className="btn secondary" onClick={readAll}>Mark All Read</button>}
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <section className="card workflow-section">
        {n.length ? n.map((x) => (
          <button type="button" className="proof-row" key={x.id} onClick={() => open(x)}>
            <span><b>{x.read_at ? x.title : "● " + x.title}</b><small>{x.body}</small><small>{new Date(x.created_at).toLocaleString()}</small></span>
          </button>
        )) : <p className="muted">No notifications yet.</p>}
      </section>
    </main>
  );
}

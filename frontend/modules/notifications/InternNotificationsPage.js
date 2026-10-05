"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function InternNotificationsPage() {
  const [n, setN] = useState([]),
    [err, setErr] = useState("");
  const load = () =>
    api("/intern/notifications")
      .then(setN)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function read(x) {
    if (!x.read_at)
      await api("/intern/notifications/" + x.id + "/read", {
        method: "POST",
        body: "{}",
      });
    if (x.action_url) location.href = x.action_url;
    else load();
  }
  async function all() {
    await api("/intern/notifications/read-all", { method: "POST", body: "{}" });
    load();
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Notifications</h1>
          <p className="muted">
            {n.filter((x) => !x.read_at).length} unread notification(s)
          </p>
        </div>
        <button className="btn secondary" onClick={all}>
          Mark All Read
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <section className="card notification-center">
        {n.map((x) => (
          <button
            key={x.id}
            className={"notification-row " + (!x.read_at ? "unread" : "")}
            onClick={() => read(x)}
          >
            <span>
              <b>{x.title}</b>
              <p>{x.body}</p>
              <small>{new Date(x.created_at).toLocaleString()}</small>
            </span>
            <span className="status-pill">{x.read_at ? "Read" : "New"}</span>
          </button>
        ))}
        {!n.length && <p className="muted">No notifications yet.</p>}
      </section>
    </main>
  );
}

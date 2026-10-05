"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
export default function MentorCollaborationPage() {
  const [groups, setGroups] = useState([]),
    [gid, setGid] = useState(""),
    [d, setD] = useState({ documents: [], messages: [] }),
    [message, setMessage] = useState(""),
    [title, setTitle] = useState(""),
    [file, setFile] = useState(null),
    [url, setUrl] = useState(""),
    [err, setErr] = useState("");
  useEffect(() => {
    api("/mentor/dashboard").then((x) => {
      setGroups(x.groups);
      if (x.groups[0]) setGid(x.groups[0].id);
    });
  }, []);
  const load = () =>
    gid &&
    api("/mentor/groups/" + gid + "/collaboration")
      .then(setD)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    if (!gid) return;
    const x = setInterval(load, 15000);
    return () => clearInterval(x);
  }, [gid]);
  async function send(e) {
    e.preventDefault();
    await api("/mentor/groups/" + gid + "/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    setMessage("");
    load();
  }
  async function upload(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("title", title);
    if (file) fd.append("file", file);
    if (url) fd.append("externalUrl", url);
    const token = localStorage.getItem("token"),
      base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
      r = await fetch(base + "/mentor/groups/" + gid + "/documents", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: fd,
      }),
      x = await r.json();
    if (!r.ok) return setErr(x.error || "Upload failed");
    setTitle("");
    setUrl("");
    setFile(null);
    load();
  }
  async function dl(x) {
    if (x.external_url) return window.open(x.external_url, "_blank");
    const b = await apiBlob("/mentor/documents/" + x.id + "/file"),
      u = URL.createObjectURL(b),
      a = document.createElement("a");
    a.href = u;
    a.download = x.original_name || x.title;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 10000);
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Group Collaboration</h1>
          <p className="muted">
            Role-controlled resources and mentor/intern group communication.
          </p>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      <label>
        Assigned Group
        <select
          className="input"
          value={gid}
          onChange={(e) => setGid(e.target.value)}
        >
          {groups.map((g) => (
            <option value={g.id} key={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      {gid && (
        <div className="collab-grid">
          <section className="card">
            <h2>Documents & Resources</h2>
            <form onSubmit={upload}>
              <input
                className="input"
                required
                placeholder="Resource title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="input"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <input
                className="input"
                type="url"
                placeholder="or external resource URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button className="btn">Share Resource</button>
            </form>
            <div className="document-list">
              {d.documents.map((x) => (
                <button
                  className="document-item"
                  onClick={() => dl(x)}
                  key={x.id}
                >
                  <b>{x.title}</b>
                  <small>{x.original_name || x.external_url}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="card chat-panel">
            <h2>Group Chat</h2>
            <div className="chat-messages">
              {d.messages.map((x) => (
                <div className="chat-message" key={x.id}>
                  <b>{x.sender_name}</b>
                  <p>{x.message}</p>
                  <small>{new Date(x.created_at).toLocaleString()}</small>
                </div>
              ))}
            </div>
            <form className="chat-compose" onSubmit={send}>
              <textarea
                className="input"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <button className="btn">Send</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

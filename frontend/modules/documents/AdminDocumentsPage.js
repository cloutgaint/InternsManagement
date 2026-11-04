"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
export default function AdminDocumentsPage() {
  const blank = { title: "", kind: "GUIDELINE", visibility: "ALL", batchId: "", groupId: "", externalUrl: "" };
  const [docs, setDocs] = useState([]), [batches, setBatches] = useState([]), [groups, setGroups] = useState([]),
    [f, setF] = useState(blank), [file, setFile] = useState(null),
    [note, setNote] = useState({ title: "", body: "", batchId: "" }),
    [chatGroup, setChatGroup] = useState(""), [chat, setChat] = useState([]), [message, setMessage] = useState(""),
    [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const load = () => Promise.all([api("/admin/documents"), api("/admin/batches"), api("/admin/groups")])
    .then(([d, b, g]) => { setDocs(d); setBatches(b); setGroups(g.filter((x) => x.status === "ACTIVE")); })
    .catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const run = async (work, done) => {
    setErr(""); setMsg("");
    try { setBusy(true); await work(); if (done) setMsg(done); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const loadChat = async (id) => { setChatGroup(id); setChat(id ? await api("/admin/groups/" + id + "/chat") : []); };
  function publish(e) {
    e.preventDefault();
    const body = new FormData();
    Object.entries(f).forEach(([k, v]) => { if (v) body.append(k, v); });
    if (file) body.append("file", file);
    run(async () => { await api("/admin/documents", { method: "POST", body }); setF(blank); setFile(null); e.target.reset(); await load(); }, "Document published.");
  }
  const remove = (d) => { if (window.confirm("Remove \"" + d.title + "\"? Users will lose access.")) run(async () => { await api("/admin/documents/" + d.id, { method: "DELETE" }); await load(); }, "Document removed."); };
  const download = (d) => run(async () => {
    const u = URL.createObjectURL(await apiBlob("/admin/documents/" + d.id + "/file")), a = document.createElement("a");
    a.href = u; a.download = d.original_name || d.title; a.click(); setTimeout(() => URL.revokeObjectURL(u), 10000);
  });
  function announce(e) {
    e.preventDefault();
    run(async () => { const r = await api("/admin/announcements", { method: "POST", body: JSON.stringify({ ...note, batchId: note.batchId || null }) }); setNote({ title: "", body: "", batchId: "" }); setMsg("Announcement sent to " + r.recipients + " user(s)."); });
  }
  const moderate = (m) => { if (window.confirm("Remove this message from the group chat?")) run(async () => { await api("/admin/chat/" + m.id, { method: "DELETE" }); await loadChat(chatGroup); }, "Message removed."); };
  function post(e) {
    e.preventDefault();
    run(async () => { await api("/admin/groups/" + chatGroup + "/chat", { method: "POST", body: JSON.stringify({ message }) }); setMessage(""); await loadChat(chatGroup); });
  }
  const audience = (d) => d.visibility === "ALL" ? "Everyone" : d.visibility === "BATCH" ? "Batch: " + (d.batch_name || "—") : "Group: " + (d.group_name || "—");
  return (
    <main className="wrap">
      <h1>Documents & Communication</h1>
      <p className="muted">Publish guidelines and project documents, send announcements and oversee group chats. College proofs stay in the restricted verification queue.</p>
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <section className="card">
        <h2>Publish Document</h2>
        <form className="form-grid" onSubmit={publish}>
          <div className="form-field"><label>Title</label><input className="input" required value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} /></div>
          <div className="form-field"><label>Type</label><select className="input" value={f.kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value }))}>{["GUIDELINE", "POLICY", "PROJECT_DOCUMENT", "REFERENCE", "ONBOARDING"].map((k) => <option key={k} value={k}>{k.replaceAll("_", " ")}</option>)}</select></div>
          <div className="form-field"><label>Visible To</label><select className="input" value={f.visibility} onChange={(e) => setF((x) => ({ ...x, visibility: e.target.value }))}><option value="ALL">Everyone</option><option value="BATCH">One batch</option><option value="GROUP">One group</option></select></div>
          {f.visibility === "BATCH" && <div className="form-field"><label>Batch</label><select className="input" required value={f.batchId} onChange={(e) => setF((x) => ({ ...x, batchId: e.target.value }))}><option value="">Select batch</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
          {f.visibility === "GROUP" && <div className="form-field"><label>Group</label><select className="input" required value={f.groupId} onChange={(e) => setF((x) => ({ ...x, groupId: e.target.value }))}><option value="">Select group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>}
          <div className="form-field"><label>File</label><input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div className="form-field"><label>Or External Link</label><input className="input" type="url" value={f.externalUrl} onChange={(e) => setF((x) => ({ ...x, externalUrl: e.target.value }))} /></div>
          <div className="form-actions"><button className="btn" disabled={busy}>Publish</button></div>
        </form>
      </section>
      <section className="card workflow-section">
        <h2>Published Documents</h2>
        {docs.length ? docs.map((d) => (
          <div className="workflow-row" key={d.id}>
            <div><b>{d.title}</b><p className="muted">{String(d.kind || "").replaceAll("_", " ")} · {audience(d)} · {new Date(d.created_at).toLocaleDateString()}</p></div>
            <div className="action-row">
              {d.external_url ? <a className="btn secondary" href={d.external_url} target="_blank" rel="noreferrer">Open Link</a> : <button className="btn secondary" onClick={() => download(d)}>Download</button>}
              <button className="btn danger" disabled={busy} onClick={() => remove(d)}>Remove</button>
            </div>
          </div>
        )) : <p className="muted">No documents published yet.</p>}
      </section>
      <section className="card">
        <h2>Send Announcement</h2>
        <form className="form-grid" onSubmit={announce}>
          <div className="form-field"><label>Title</label><input className="input" required value={note.title} onChange={(e) => setNote((x) => ({ ...x, title: e.target.value }))} /></div>
          <div className="form-field"><label>Audience</label><select className="input" value={note.batchId} onChange={(e) => setNote((x) => ({ ...x, batchId: e.target.value }))}><option value="">All interns and mentors</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}><label>Message</label><textarea className="input" required value={note.body} onChange={(e) => setNote((x) => ({ ...x, body: e.target.value }))} /></div>
          <div className="form-actions"><button className="btn" disabled={busy}>Send</button></div>
        </form>
      </section>
      <section className="card workflow-section">
        <h2>Group Chat Oversight</h2>
        <div className="form-field"><label>Group</label><select className="input" value={chatGroup} onChange={(e) => run(() => loadChat(e.target.value))}><option value="">Select group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        {chat.map((m) => (
          <div className="workflow-row" key={m.id}>
            <div><b>{m.sender_name}</b><p>{m.message}</p><small className="muted">{new Date(m.created_at).toLocaleString()}</small></div>
            {m.message !== "[Removed by Admin]" && <button className="btn secondary" disabled={busy} onClick={() => moderate(m)}>Remove</button>}
          </div>
        ))}
        {chatGroup && <form className="action-row" onSubmit={post}><input className="input" required placeholder="Message this group" value={message} onChange={(e) => setMessage(e.target.value)} /><button className="btn" disabled={busy}>Send</button></form>}
      </section>
    </main>
  );
}

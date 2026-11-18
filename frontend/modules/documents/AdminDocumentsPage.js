"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
export default function AdminDocumentsPage() {
  const blank = { title: "", kind: "GUIDELINE", visibility: "ALL", batchId: "", groupId: "", externalUrl: "" };
  const [docs, setDocs] = useState([]), [batches, setBatches] = useState([]), [groups, setGroups] = useState([]),
    [f, setF] = useState(blank), [file, setFile] = useState(null),
    [note, setNote] = useState({ title: "", body: "", batchId: "" }),
    [chatGroup, setChatGroup] = useState(""), [chat, setChat] = useState([]), [message, setMessage] = useState(""),
    [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [loading,setLoading]=useState(true), [activeTab,setActiveTab]=useState("documents"), [docSearch,setDocSearch]=useState(""), [docPage,setDocPage]=useState(1), [confirmTarget,setConfirmTarget]=useState(null);
  const load = () => {setLoading(true);return Promise.all([api("/admin/documents"), api("/admin/batches"), api("/admin/groups")])
    .then(([d, b, g]) => { setDocs(d); setBatches(b); setGroups(g.filter((x) => x.status === "ACTIVE")); })
    .catch((e) => setErr(e.message)).finally(()=>setLoading(false));};
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
  const moderate = (m) => run(async () => { await api("/admin/chat/" + m.id, { method: "DELETE" }); await loadChat(chatGroup); setConfirmTarget(null); }, "Message removed.");
  function post(e) {
    e.preventDefault();
    run(async () => { await api("/admin/groups/" + chatGroup + "/chat", { method: "POST", body: JSON.stringify({ message }) }); setMessage(""); await loadChat(chatGroup); });
  }
  const audience = (d) => d.visibility === "ALL" ? "Everyone" : d.visibility === "BATCH" ? "Batch: " + (d.batch_name || "—") : "Group: " + (d.group_name || "—");
  const visibleDocs=docs.filter(d=>[d.title,d.kind,d.batch_name,d.group_name].some(v=>String(v||"").toLowerCase().includes(docSearch.toLowerCase()))), totalPages=Math.max(1,Math.ceil(visibleDocs.length/8)),page=Math.min(docPage,totalPages);
  return (
    <main className="wrap admin-documents-modern">
      <h1>Documents & Communication</h1>
      <p className="muted">Publish guidelines and project documents, send announcements and oversee group chats. College proofs stay in the restricted verification queue.</p>
      <div className="documents-tabs" role="tablist" aria-label="Communication workspaces">{[["documents","Documents"],["announcements","Announcements"],["chat","Group chat"]].map(([id,label])=><button key={id} type="button" role="tab" id={"documents-tab-"+id} aria-controls={"documents-panel-"+id} aria-selected={activeTab===id} className={activeTab===id?"active":""} onClick={()=>{setActiveTab(id);setErr("");setMsg("");}}>{label}</button>)}</div>
      {msg && <p className="success" role="status">{msg}</p>}
      {loading&&<p role="status" className="muted">Loading documents and communication…</p>}
      {err && <p className="error" role="alert">{err}</p>}
      {activeTab==="documents"&&<div id="documents-panel-documents" role="tabpanel" aria-labelledby="documents-tab-documents"><section className="card">
        <h2>Publish document</h2><p className="muted">Share a file or external resource with the selected audience.</p>
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
        <div className="documents-list-head"><div><h2>Published documents</h2><p className="muted">Browse and manage shared resources.</p></div><span>{visibleDocs.length} documents</span></div><label className="documents-search-label">Search documents<input className="input" type="search" placeholder="Search by title, type or audience" value={docSearch} onChange={e=>{setDocSearch(e.target.value);setDocPage(1);}}/></label>
        {visibleDocs.length ? visibleDocs.slice((page-1)*8,page*8).map((d) => (
          <div className="workflow-row" key={d.id}>
            <div><b>{d.title}</b><p className="muted">{String(d.kind || "").replaceAll("_", " ")} · {audience(d)} · {new Date(d.created_at).toLocaleDateString()}</p></div>
            <div className="action-row">
              {d.external_url ? <a className="btn secondary" href={d.external_url} target="_blank" rel="noreferrer">Open Link</a> : <button className="btn secondary" onClick={() => download(d)}>Download</button>}
              <button className="btn danger" disabled={busy} onClick={() => setConfirmTarget({type:"document",item:d})}>Remove</button>
            </div>
          </div>
        )) : <p className="muted">{loading?"Loading documents…":docs.length?"No documents match your search.":"No documents published yet."}</p>}
        {visibleDocs.length>8&&<div className="documents-pagination"><span>Showing {(page-1)*8+1}–{Math.min(page*8,visibleDocs.length)} of {visibleDocs.length}</span><div className="action-row"><button type="button" className="btn secondary" disabled={page===1} onClick={()=>setDocPage(v=>Math.max(1,v-1))}>Previous</button><span>{page} / {totalPages}</span><button type="button" className="btn secondary" disabled={page===totalPages} onClick={()=>setDocPage(v=>v+1)}>Next</button></div></div>}
      </section></div>
      {activeTab==="announcements"&&<section id="documents-panel-announcements" role="tabpanel" aria-labelledby="documents-tab-announcements" className="card">
        <h2>Send announcement</h2><p className="muted">Choose recipients and write a clear message before sending.</p>
        <form className="form-grid" onSubmit={announce}>
          <div className="form-field"><label>Title</label><input className="input" required value={note.title} onChange={(e) => setNote((x) => ({ ...x, title: e.target.value }))} /></div>
          <div className="form-field"><label>Audience</label><select className="input" value={note.batchId} onChange={(e) => setNote((x) => ({ ...x, batchId: e.target.value }))}><option value="">All interns and mentors</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}><label>Message</label><textarea className="input" required value={note.body} onChange={(e) => setNote((x) => ({ ...x, body: e.target.value }))} /></div>
          <div className="form-actions"><button className="btn" disabled={busy}>Send</button></div>
        </form>
      </section>}
      {activeTab==="chat"&&<section id="documents-panel-chat" role="tabpanel" aria-labelledby="documents-tab-chat" className="card workflow-section">
        <h2>Group chat oversight</h2><p className="muted">Select a project group to review messages or communicate with members.</p>
        <div className="form-field"><label>Group</label><select className="input" value={chatGroup} onChange={(e) => run(() => loadChat(e.target.value))}><option value="">Select group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
        {chat.map((m) => (
          <div className="workflow-row" key={m.id}>
            <div><b>{m.sender_name}</b><p>{m.message}</p><small className="muted">{new Date(m.created_at).toLocaleString()}</small></div>
            {m.message !== "[Removed by Admin]" && <button className="btn secondary" disabled={busy} onClick={() => setConfirmTarget({type:"message",item:m})}>Remove</button>}
          </div>
        ))}
        {chatGroup&&!chat.length&&<p className="muted">No messages in this group yet.</p>}
        {chatGroup && <form className="action-row" onSubmit={post}><input className="input" required placeholder="Message this group" value={message} onChange={(e) => setMessage(e.target.value)} /><button className="btn" disabled={busy}>Send</button></form>}
      </section>}
      {confirmTarget&&<div className="documents-modal-backdrop"><div className="card documents-confirm" role="dialog" aria-modal="true" aria-labelledby="documents-confirm-title"><h2 id="documents-confirm-title">Confirm removal</h2><p>{confirmTarget.type==="document"?`Remove "${confirmTarget.item.title}"? Users will lose access to this document.`:"Remove this message from the group chat?"}</p><div className="action-row"><button type="button" className="btn secondary" disabled={busy} onClick={()=>setConfirmTarget(null)}>Cancel</button><button type="button" className="btn danger" disabled={busy} onClick={()=>confirmTarget.type==="document"?remove(confirmTarget.item):moderate(confirmTarget.item)}>{busy?"Removing…":"Remove"}</button></div></div></div>}
      <style jsx global>{` .admin-documents-modern{color:#111;padding-top:24px}.admin-documents-modern h1{font-size:clamp(25px,3vw,32px);margin-bottom:8px}.admin-documents-modern>.muted{line-height:1.6}.admin-documents-modern .documents-tabs{display:flex;flex-wrap:wrap;gap:8px;background:#eef1f8;border:1px solid #dfe5f1;padding:7px;border-radius:20px;margin:22px 0}.admin-documents-modern .documents-tabs button{min-height:44px;border:0;background:transparent;color:#111;font-weight:700;padding:10px 20px;border-radius:999px;cursor:pointer}.admin-documents-modern .documents-tabs button.active{background:linear-gradient(125deg,#9149f7,#6e5bf7,#5c9cf8);color:white;box-shadow:0 5px 15px #6454ee38}.admin-documents-modern .documents-tabs button:focus-visible{outline:3px solid #6e5bf7;outline-offset:2px}.admin-documents-modern .card{border-radius:20px;padding:24px;margin:18px 0}.admin-documents-modern .card h2{font-size:21px;margin:0 0 8px}.admin-documents-modern .card>p.muted{font-size:13px;margin:0 0 20px}.admin-documents-modern .form-grid{gap:16px}.admin-documents-modern .form-field label,.admin-documents-modern .documents-search-label{color:#111;font-weight:650;font-size:13px}.admin-documents-modern .input{width:100%;min-height:44px;border:1.5px solid #6f9bfa;border-radius:10px;color:#111;background:#fff;box-sizing:border-box}.admin-documents-modern .input:focus-visible{outline:3px solid #9fc1ff;outline-offset:1px}.admin-documents-modern textarea.input{min-height:110px;resize:vertical}.admin-documents-modern .form-actions{display:flex;align-items:end;justify-content:flex-end}.admin-documents-modern .btn{min-height:44px;border-radius:999px}.admin-documents-modern .documents-list-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.admin-documents-modern .documents-list-head span{background:#eef1fb;border-radius:999px;padding:8px 12px;font-size:12px;white-space:nowrap}.admin-documents-modern .documents-search-label{display:flex;flex-direction:column;gap:7px;margin:18px 0}.admin-documents-modern .workflow-row{gap:14px;padding:16px 0}.admin-documents-modern .documents-pagination{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding-top:16px;font-size:12px}.documents-modal-backdrop{position:fixed;inset:0;z-index:9999;background:#11182799;display:flex;align-items:center;justify-content:center;padding:16px}.documents-confirm{width:min(100%,460px);padding:24px;border-radius:20px;background:#fff}.documents-confirm p{line-height:1.6;color:#111}.documents-confirm .action-row{justify-content:flex-end;flex-wrap:wrap}@media(max-width:650px){.admin-documents-modern{padding-top:18px}.admin-documents-modern .card{padding:16px}.admin-documents-modern .documents-tabs{display:grid;grid-template-columns:1fr}.admin-documents-modern .documents-tabs button{width:100%}.admin-documents-modern .form-grid{grid-template-columns:1fr}.admin-documents-modern .form-actions{justify-content:stretch}.admin-documents-modern .form-actions button{width:100%}.admin-documents-modern .documents-list-head{align-items:flex-start;flex-direction:column}.admin-documents-modern .workflow-row{flex-direction:column;align-items:stretch}} `}</style>
    </main>
  );
}

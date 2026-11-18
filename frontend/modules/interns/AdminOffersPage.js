"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
const fmt = (x) => (x ? String(x).slice(0, 10) : "—");
export default function AdminOffersPage() {
  const [alloc, setAlloc] = useState([]),
    [letters, setLetters] = useState([]),
    [templates, setTemplates] = useState([]),
    [selected, setSelected] = useState(null),
    [preview, setPreview] = useState(null),
    [tpl, setTpl] = useState({
      name: "GAINT Internship Offer Letter",
      signatory: "Authorized Signatory, GAINT Clout Technologies",
      body: "Dear {{student_name}},\n\nWe are pleased to offer you an internship with GAINT Clout Technologies under {{batch}} from {{from_date}} to {{to_date}} ({{duration}}).\n\nCollege: {{college}}\nReference: {{reference_number}}\n\nWe look forward to your contribution and learning during the internship period.\n\nRegards,\nGAINT Clout Technologies",
    }),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [feedbackArea,setFeedbackArea]=useState("createTemplate"),
    [busy, setBusy] = useState(false),
    [issueAt, setIssueAt] = useState(""),
    [dates, setDates] = useState({}),
    [letterhead,setLetterhead]=useState(null),
    [letterheadFile,setLetterheadFile]=useState(null),
    [letterheadBusy,setLetterheadBusy]=useState(false),
    [letterheadError,setLetterheadError]=useState(""),
    [letterheadMessage,setLetterheadMessage]=useState("");
  const loadLetterhead=()=>api("/report-assets/offer-letterhead").then(x=>setLetterhead(x.asset)).catch(e=>setLetterheadError(e.message));
  async function uploadLetterhead(){if(!letterheadFile)return;setLetterheadError("");setLetterheadMessage("");setLetterheadBusy(true);try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new Error("Unable to read file"));reader.readAsDataURL(letterheadFile)});await api("/report-assets/offer-letterhead",{method:"PUT",body:JSON.stringify({mimeType:letterheadFile.type,data})});setLetterheadMessage("Company letterhead uploaded.");setLetterheadFile(null);await loadLetterhead()}catch(e){setLetterheadError(e.message)}finally{setLetterheadBusy(false)}}
  async function previewLetterhead(){try{const blob=await apiBlob("/report-assets/offer-letterhead/file");const url=URL.createObjectURL(blob);window.open(url,"_blank","noopener,noreferrer");setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){setLetterheadError(e.message)}}
  async function removeLetterhead(){setLetterheadBusy(true);setLetterheadError("");try{await api("/report-assets/offer-letterhead",{method:"DELETE"});setLetterheadMessage("Letterhead removed.");await loadLetterhead()}catch(e){setLetterheadError(e.message)}finally{setLetterheadBusy(false)}}
  const load = () =>
    Promise.all([
      api("/admin/allocations"),
      api("/admin/offer-letters"),
      api("/admin/offer-letter-templates"),
    ])
      .then(([a, l, t]) => {
        setAlloc(a);
        setLetters(l);
        setTemplates(t);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    loadLetterhead();
  }, []);
  async function createTemplate(e) {setFeedbackArea("createTemplate");
    e.preventDefault();
    try {
      setBusy(true);
      await api("/admin/offer-letter-templates", {
        method: "POST",
        body: JSON.stringify(tpl),
      });
      setMsg("Offer letter template saved.");
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function draft(a) {setFeedbackArea("draft");
    if (!templates.length)
      return setErr("Create an active offer letter template first.");
    try {
      setBusy(true);
      await api("/admin/offer-letters", {
        method: "POST",
        body: JSON.stringify({
          allocationId: a.id,
          templateId: templates[0].id,
          fromDate: dates[a.id]?.from || undefined,
          toDate: dates[a.id]?.to || undefined,
        }),
      });
      setMsg(
        "Draft offer letter created. Preview and approve it before issue.",
      );
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function show(l) {
    try {
      setPreview(await api("/admin/offer-letters/" + l.id + "/preview"));
      setSelected(l);
      if (l.status === "DRAFT") {
        await api("/admin/offer-letters/" + l.id + "/mark-previewed", { method: "POST", body: "{}" });
        load();
      }
    } catch (e) {
      setErr(e.message);
    }
  }
  async function action(l, type) {setFeedbackArea("action");
    let body = {};
    if (type === "reissue" || type === "revoke") {
      const reason = prompt("Reason is required:");
      if (!reason) return;
      body = { reason };
    }
    if (type === "issue") {
      if (!issueAt) return setErr("Declare the issue date and time before issuing.");
      body = { issueAt: new Date(issueAt).toISOString() };
    }
    try {
      setBusy(true);
      await api("/admin/offer-letters/" + l.id + "/" + type, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMsg("Offer letter " + type + " completed.");
      setPreview(null);
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="wrap admin-offers-page">
      <div className="intern-head">
        <div>
          <h1>Offer Letter Management</h1>
          <p className="muted">
            Draft → Preview → Approve → Issue. Reissue and revoke actions are
            versioned and audited.
          </p>
        </div>
        <span className="badge">
          {letters.filter((x) => ["ISSUED", "REISSUED"].includes(x.status)).length} issued
        </span>
      </div>
      <section className="card letterhead-settings"><h2>Company letterhead settings</h2><p className="muted">Upload your company letterhead. Supported formats: PDF, DOCX, PNG and JPG (maximum 4 MB).</p><p className="muted">Document upload and storage are supported. Applying the letterhead to generated offer letters requires the separate document-rendering integration.</p>{letterhead&&<p className="muted">Current letterhead: {letterhead.mime_type.split("/").pop()} · Updated {new Date(letterhead.updated_at).toLocaleString()}</p>}<div className="form-field"><label htmlFor="offer-letterhead-file">Choose letterhead</label><input id="offer-letterhead-file" className="input" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" onChange={e=>{const file=e.target.files?.[0]||null;setLetterheadError(file&&file.size>4*1024*1024?"File must be 4 MB or smaller.":"");setLetterheadFile(file&&file.size<=4*1024*1024?file:null)}} /></div><div className="action-row" style={{justifyContent:"flex-start"}}><button className="btn" type="button" disabled={!letterheadFile||letterheadBusy} onClick={uploadLetterhead}>Upload letterhead</button>{letterhead&&<><button className="btn secondary" type="button" onClick={previewLetterhead}>View file</button><button className="btn danger" type="button" disabled={letterheadBusy} onClick={removeLetterhead}>Remove</button></>}</div>{letterheadError&&<p className="error" role="alert">{letterheadError}</p>}{letterheadMessage&&<p className="success" role="status">{letterheadMessage}</p>}</section>
      {!templates.length && (
        <section className="card">
          <h2>Create Offer Letter Template</h2>{feedbackArea==="createTemplate"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
          <form onSubmit={createTemplate}>
            <div className="form-grid">
              <div className="form-field">
                <label>Template Name</label>
                <input
                  className="input"
                  value={tpl.name}
                  onChange={(e) =>
                    setTpl((x) => ({ ...x, name: e.target.value }))
                  }
                />
              </div>
              <div className="form-field">
                <label>Signatory</label>
                <input
                  className="input"
                  value={tpl.signatory}
                  onChange={(e) =>
                    setTpl((x) => ({ ...x, signatory: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="form-field">
              <label>Letter Body</label>
              <textarea
                className="input offer-template"
                value={tpl.body}
                onChange={(e) =>
                  setTpl((x) => ({ ...x, body: e.target.value }))
                }
              />
              <span className="field-help">
                Variables: {"{{student_name}}"}, {"{{college}}"}, {"{{batch}}"},{" "}
                {"{{from_date}}"}, {"{{to_date}}"}, {"{{duration}}"},{" "}
                {"{{reference_number}}"}
              </span>
            </div>
            <button className="btn" disabled={busy}>
              Save Template
            </button>
          </form>
        </section>
      )}
      <section className="card workflow-section">
        <h2>Eligible Internship Allotments</h2>{feedbackArea==="action"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}{feedbackArea==="draft"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        {alloc
          .filter((a) =>
            ["ALLOTMENT_VERIFIED", "ALLOTTED_WITH_OVERRIDE"].includes(a.status),
          )
          .map((a) => {
            const l = letters.find((x) => x.allocation_id === a.id);
            return (
              <div className="workflow-row" key={a.id}>
                <div>
                  <b>{a.full_name}</b>
                  <div className="muted">
                    {a.college_name} · {a.batch_name} · {fmt(a.intern_start)} →{" "}
                    {fmt(a.intern_end)}
                  </div>
                </div>
                <div className="action-row">
                  {!l ? (
                    <>
                      <input className="input" type="date" aria-label="Offer From date" defaultValue={fmt(a.intern_start)} onChange={(e) => setDates((d) => ({ ...d, [a.id]: { ...d[a.id], from: e.target.value } }))} />
                      <input className="input" type="date" aria-label="Offer To date" defaultValue={fmt(a.intern_end)} onChange={(e) => setDates((d) => ({ ...d, [a.id]: { ...d[a.id], to: e.target.value } }))} />
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => draft(a)}
                      >
                        Create Draft
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="status-pill">{l.status}</span>
                      <button className="btn secondary" onClick={() => show(l)}>
                        Preview
                      </button>
                      {l.status === "PREVIEWED" && (
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => action(l, "approve")}
                        >
                          Approve
                        </button>
                      )}
                      {l.status === "APPROVED" && (
                        <>
                          <input
                            className="input"
                            type="datetime-local"
                            aria-label="Offer letter issue date and time"
                            value={issueAt}
                            onChange={(e) => setIssueAt(e.target.value)}
                          />
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() => action(l, "issue")}
                          >
                            Issue
                          </button>
                        </>
                      )}
                      {["ISSUED", "REISSUED"].includes(l.status) && (
                        <>
                          <button
                            className="btn secondary"
                            onClick={() => action(l, "reissue")}
                          >
                            Reissue
                          </button>
                          <button
                            className="btn danger"
                            onClick={() => action(l, "revoke")}
                          >
                            Revoke
                          </button>
                        </>
                      )}
                      {l.status === "REVOKED" && (
                        <button
                          className="btn secondary"
                          onClick={() => action(l, "reissue")}
                        >
                          Create Reissue Draft
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </section>
      {preview && (
        <div className="modal-backdrop" onMouseDown={() => setPreview(null)}>
          <section
            className="modal-card offer-preview"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="verification-title">
              <div>
                <span className="eyebrow">GAINT CLOUT TECHNOLOGIES</span>
                <h2>Internship Offer Letter</h2>
              </div>
              <button className="icon-close" onClick={() => setPreview(null)}>
                ×
              </button>
            </div>
            <div className="offer-ref">
              <b>{preview.reference_number}</b>
              <span>Status: {preview.status}</span>
            </div>
            <div className="letter-body">{preview.rendered_body}</div>
            {preview.signatory && (
              <p className="offer-sign">
                <b>{preview.signatory}</b>
              </p>
            )}
            <div className="action-row">
              {preview.status === "DRAFT" && (
                <button
                  className="btn"
                  onClick={() => action(preview, "approve")}
                >
                  Approve Letter
                </button>
              )}
              {preview.status === "APPROVED" && (
                <button
                  className="btn"
                  onClick={() => action(preview, "issue")}
                >
                  Issue to Intern
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      <style jsx global>{`.admin-offers-page{max-width:1240px;margin-inline:auto;padding:24px 28px 72px;color:#111}
.admin-offers-page .intern-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin:18px 0 26px}
.admin-offers-page .intern-head h1{font-size:clamp(28px,3vw,36px);font-weight:700;letter-spacing:-.035em;color:#111;margin:0 0 8px}
.admin-offers-page .intern-head p{font-size:15px;line-height:1.6;color:#525252;margin:0}
.admin-offers-page>.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:24px 26px;margin-bottom:18px;box-shadow:0 5px 22px rgba(15,23,42,.04)}
.admin-offers-page h2{font-size:20px;font-weight:650;letter-spacing:-.02em;color:#111;margin:0 0 18px}
.admin-offers-page .workflow-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;padding:18px 0;border-top:1px solid #edf0f3}
.admin-offers-page .workflow-row:first-of-type{border-top:0}
.admin-offers-page .workflow-row>div:first-child{min-width:0}
.admin-offers-page .workflow-row b{display:block;font-size:15px;font-weight:650;color:#111;margin-bottom:5px}
.admin-offers-page .workflow-row .muted{font-size:13px;line-height:1.6;color:#525252;overflow-wrap:anywhere}
.admin-offers-page .action-row{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap}
.admin-offers-page .btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:9px 15px;border-radius:10px;font-size:13px;font-weight:650;line-height:1.25;white-space:nowrap;box-sizing:border-box}
.admin-offers-page .btn:not(.secondary):not(.danger){background:#075b3b;border:1px solid #075b3b;color:#fff}
.admin-offers-page .btn:not(.secondary):not(.danger):hover{background:#06472f;border-color:#06472f}
.admin-offers-page .btn.secondary{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}
.admin-offers-page .btn.secondary:hover{background:#2563eb;border-color:#2563eb;color:#fff}
.admin-offers-page .btn.danger{background:#b4232d;border:1px solid #b4232d;color:#fff}
.admin-offers-page .btn.danger:hover{background:#941b24}
.admin-offers-page .status-pill{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:6px 10px;border-radius:999px;background:#e8f5ec;color:#17633d;font-size:11px;font-weight:700;white-space:nowrap}
.admin-offers-page .input{width:100%;min-width:0;min-height:42px;margin:0;padding:9px 11px;border:1.5px solid #93b4ed;border-radius:9px;color:#111;background:#fff;font-size:13px;box-sizing:border-box}
.admin-offers-page .action-row>.input{width:auto;min-width:145px;max-width:180px}
.admin-offers-page .input:focus{outline:0;border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe}
.admin-offers-page button:focus-visible,.admin-offers-page input:focus-visible,.admin-offers-page textarea:focus-visible{outline:3px solid #bfdbfe;outline-offset:2px}
.admin-offers-page .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.admin-offers-page .form-field{display:flex;flex-direction:column;gap:7px;margin:0 0 16px;min-width:0}
.admin-offers-page .form-field label{font-size:13px;font-weight:650;color:#262626}
.admin-offers-page .offer-template{min-height:220px;resize:vertical;line-height:1.6}
.admin-offers-page .field-help{font-size:12px;line-height:1.6;color:#525252}
.admin-offers-page .offer-preview{max-width:760px}
.admin-offers-page .offer-ref{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px}
.admin-offers-page .letter-body{padding:26px 8px;font-size:14px;line-height:1.9;color:#222;white-space:pre-wrap}
.admin-offers-page .offer-sign{margin-top:20px;font-size:14px;color:#111}
@media(max-width:900px){.admin-offers-page .workflow-row{grid-template-columns:minmax(0,1fr)}.admin-offers-page .action-row{justify-content:flex-start}.admin-offers-page .action-row>.input{flex:1;min-width:150px}}
@media(max-width:600px){.admin-offers-page{padding:18px 14px 48px}.admin-offers-page>.card{padding:20px 16px}.admin-offers-page .intern-head{flex-direction:column}.admin-offers-page .form-grid{grid-template-columns:1fr}.admin-offers-page .action-row>.btn{flex:1}.admin-offers-page .action-row>.input{width:100%;max-width:none}.admin-offers-page .offer-ref{flex-direction:column}}`}</style>
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
const fmt = (x) => (x ? String(x).slice(0, 10) : "—");
export default function AdminOffersPage() {
  const [alloc, setAlloc] = useState([]),
    [letters, setLetters] = useState([]),
    [templates, setTemplates] = useState([]),
    [selected, setSelected] = useState(null),
    [pdfPreview,setPdfPreview]=useState(null),
    [preview, setPreview] = useState(null),
    [editingOffer,setEditingOffer]=useState(false),
    [editBody,setEditBody]=useState(""),
    [editSignatory,setEditSignatory]=useState(""),
    [editBusy,setEditBusy]=useState(false),
    [editError,setEditError]=useState(""),
    [editMessage,setEditMessage]=useState(""),
    [revisionReason,setRevisionReason]=useState(""),
    [revisionReasonOpen,setRevisionReasonOpen]=useState(false),
    [tpl, setTpl] = useState({
      name: "GAINT Internship Offer Letter",
      signatory: "Authorized Signatory, GAINT Clout Technologies",
      body: "On behalf of GAINT CLOUT TECHNOLOGIES PVT LTD, I am delighted to extend an internship opportunity to you with our expert team. The programme is scheduled to begin on {{from_date}} and will continue until {{to_date}} ({{duration}}). Please bring the necessary documents and your complete profile on your first day.\n\nIf you have any questions about this offer, please contact our front office. We look forward to welcoming you as you begin your career with Gaint Clout Technologies Pvt Ltd.",
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
    [letterheadMessage,setLetterheadMessage]=useState(""),
    [signature,setSignature]=useState(null),
    [signatureFile,setSignatureFile]=useState(null),
    [signatureBusy,setSignatureBusy]=useState(false),
    [signatureMessage,setSignatureMessage]=useState(""),
    [signatureError,setSignatureError]=useState(""),
    [watermark,setWatermark]=useState(null),
    [watermarkFile,setWatermarkFile]=useState(null),
    [watermarkBusy,setWatermarkBusy]=useState(false),
    [watermarkError,setWatermarkError]=useState(""),
    [watermarkMessage,setWatermarkMessage]=useState("");
  const loadWatermark=()=>api("/report-assets/offer-watermark").then(x=>setWatermark(x.asset)).catch(e=>setWatermarkError(e.message));
  async function uploadWatermark(){if(!watermarkFile)return;setWatermarkBusy(true);setWatermarkError("");setWatermarkMessage("");try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new Error("Unable to read watermark"));reader.readAsDataURL(watermarkFile)});await api("/report-assets/offer-watermark",{method:"PUT",body:JSON.stringify({mimeType:watermarkFile.type,data})});setWatermarkMessage("Globe watermark saved. View offer PDF to check its appearance.");setWatermarkFile(null);await loadWatermark()}catch(e){setWatermarkError(e.message)}finally{setWatermarkBusy(false)}}
  async function viewWatermark(){try{const blob=await apiBlob("/report-assets/offer-watermark/file");const url=URL.createObjectURL(blob);window.open(url,"_blank","noopener,noreferrer");setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){setWatermarkError(e.message)}}
  async function removeWatermark(){setWatermarkBusy(true);setWatermarkError("");try{await api("/report-assets/offer-watermark",{method:"DELETE"});setWatermarkMessage("Globe watermark removed.");await loadWatermark()}catch(e){setWatermarkError(e.message)}finally{setWatermarkBusy(false)}}
  const loadSignature=()=>api("/report-assets/offer-signature").then(x=>setSignature(x.asset)).catch(e=>setSignatureError(e.message));
  async function uploadSignature(){if(!signatureFile)return;setSignatureBusy(true);setSignatureError("");setSignatureMessage("");try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new Error("Unable to read signature image"));reader.readAsDataURL(signatureFile)});await api("/report-assets/offer-signature",{method:"PUT",body:JSON.stringify({mimeType:signatureFile.type,data})});setSignatureMessage("Offer signature saved successfully.");setSignatureFile(null);await loadSignature()}catch(e){setSignatureError(e.message)}finally{setSignatureBusy(false)}}
  async function viewSignature(){try{const blob=await apiBlob("/report-assets/offer-signature/file");const url=URL.createObjectURL(blob);window.open(url,"_blank","noopener,noreferrer");setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){setSignatureError(e.message)}}
  async function removeSignature(){setSignatureBusy(true);setSignatureError("");try{await api("/report-assets/offer-signature",{method:"DELETE"});setSignatureMessage("Offer signature removed.");await loadSignature()}catch(e){setSignatureError(e.message)}finally{setSignatureBusy(false)}}
  const loadLetterhead=()=>api("/report-assets/offer-letterhead").then(x=>setLetterhead(x.asset)).catch(e=>setLetterheadError(e.message));
  async function uploadLetterhead(){if(!letterheadFile)return;setLetterheadError("");setLetterheadMessage("");setLetterheadBusy(true);try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(new Error("Unable to read file"));reader.readAsDataURL(letterheadFile)});await api("/report-assets/offer-letterhead",{method:"PUT",body:JSON.stringify({mimeType:letterheadFile.type,data})});setLetterheadMessage("Official GAINT letterhead saved. Open View offer PDF below to verify the layout.");setLetterheadFile(null);await loadLetterhead()}catch(e){setLetterheadError(e.message)}finally{setLetterheadBusy(false)}}
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
    loadSignature();
    loadWatermark();
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
  async function showPdf(l) {try {const blob=await apiBlob("/admin/offer-letters/"+l.id+"/pdf");const url=URL.createObjectURL(blob);setPdfPreview(old=>{if(old?.url)URL.revokeObjectURL(old.url);return {url,name:l.student_name_snapshot||"Intern",reference:l.reference_number||"Offer"}})}catch(e){setErr(e.message)}}
  function closePdf(){setPdfPreview(old=>{if(old?.url)URL.revokeObjectURL(old.url);return null})}
  function downloadPdf(){if(!pdfPreview)return;const a=document.createElement("a");a.href=pdfPreview.url;a.download="GAINT-Offer-"+pdfPreview.reference.replace(/[^a-zA-Z0-9_-]/g,"")+".pdf";document.body.appendChild(a);a.click();a.remove()}
  async function show(l) {
    try {
      const detail=await api("/admin/offer-letters/" + l.id + "/preview");
      setPreview(detail);
      setEditBody(detail.rendered_body||"");
      setEditSignatory(detail.signatory||"");
      setEditingOffer(false);setEditError("");setEditMessage("");
      setSelected(l);
      if (l.status === "DRAFT") {
        await api("/admin/offer-letters/" + l.id + "/mark-previewed", { method: "POST", body: "{}" });
        setPreview(current=>current?.id===l.id?{...current,status:"PREVIEWED"}:current);
        load();
      }
    } catch (e) {
      setErr(e.message);
    }
  }
  async function saveOfferContent(){if(!preview)return;setEditBusy(true);setEditError("");setEditMessage("");try{await api("/admin/offer-letters/"+preview.id+"/content",{method:"PUT",body:JSON.stringify({body:editBody,signatory:editSignatory})});const detail=await api("/admin/offer-letters/"+preview.id+"/preview");setPreview(detail);setSelected(detail);setEditingOffer(false);setEditMessage("Changes saved. Review the updated PDF and approve the revised letter.");await load()}catch(e){setEditError(e.message)}finally{setEditBusy(false)}}
  async function startOfferRevision(){if(!preview)return;if(!revisionReason.trim()){setEditError("Enter a reason for creating this revision.");return;}setEditBusy(true);setEditError("");try{await api("/admin/offer-letters/"+preview.id+"/reissue",{method:"POST",body:JSON.stringify({reason:revisionReason.trim()})});const detail=await api("/admin/offer-letters/"+preview.id+"/preview");setPreview(detail);setSelected(detail);setEditBody(detail.rendered_body||"");setEditSignatory(detail.signatory||"");setEditingOffer(true);setRevisionReasonOpen(false);setRevisionReason("");setEditMessage("Revision draft created. The previous issued version remains in version history.");await load()}catch(e){setEditError(e.message)}finally{setEditBusy(false)}}
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
      <section className="card letterhead-settings"><h2>Official offer letter template</h2><p className="muted">Upload the approved GAINT letterhead with its original globe watermark, gold borders and footer. PDF is recommended; DOCX, PNG and JPG are also supported (maximum 4 MB).</p><p className="muted">Uploading replaces the current master letterhead for newly generated offer PDFs. Preview an issued offer below to verify the layout before downloading.</p>{letterhead&&<p className="muted">Uploaded letterhead: {letterhead.original_filename || ({ "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"Company letterhead.docx","application/pdf":"Company letterhead.pdf","image/png":"Company letterhead.png","image/jpeg":"Company letterhead.jpg" }[letterhead.mime_type] || "Company letterhead")} · Updated {new Date(letterhead.updated_at).toLocaleString()}</p>}<div className="form-field"><label htmlFor="offer-letterhead-file">Choose letterhead</label><input id="offer-letterhead-file" className="input letterhead-file-input" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg" onChange={e=>{const file=e.target.files?.[0]||null;setLetterheadError(file&&file.size>4*1024*1024?"File must be 4 MB or smaller.":"");setLetterheadFile(file&&file.size<=4*1024*1024?file:null)}} /></div><div className="action-row" style={{justifyContent:"flex-start"}}><button className="btn" type="button" disabled={!letterheadFile||letterheadBusy} onClick={uploadLetterhead}>Upload letterhead</button>{letterhead&&<><button className="btn secondary" type="button" onClick={previewLetterhead}>View file</button><button className="btn danger" type="button" disabled={letterheadBusy} onClick={removeLetterhead}>Remove</button></>}</div>{letterheadError&&<p className="error" role="alert">{letterheadError}</p>}{letterheadMessage&&<p className="success" role="status">{letterheadMessage}</p>}</section>
      <section className="card letterhead-settings">
        <h2>Globe watermark settings</h2>
        <p className="muted">Upload the original GAINT globe artwork separately from the letterhead. A transparent PNG is recommended. Maximum 2 MB.</p>
        {watermark&&<p className="muted">Globe watermark uploaded · Updated {new Date(watermark.updated_at).toLocaleString()}</p>}
        <div className="form-field"><label htmlFor="offer-watermark-file">Choose globe watermark image</label><input id="offer-watermark-file" className="input letterhead-file-input" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={e=>{const file=e.target.files?.[0]||null;const valid=file&&["image/png","image/jpeg"].includes(file.type)&&file.size<=2*1024*1024;setWatermarkError(file&&!valid?"Select PNG or JPG up to 2 MB.":"");setWatermarkFile(valid?file:null)}}/></div>
        <div className="action-row" style={{justifyContent:"flex-start"}}><button className="btn" type="button" disabled={!watermarkFile||watermarkBusy} onClick={uploadWatermark}>Upload watermark</button>{watermark&&<><button className="btn secondary" type="button" onClick={viewWatermark}>View watermark</button><button className="btn danger" type="button" disabled={watermarkBusy} onClick={removeWatermark}>Remove</button></>}</div>
        {watermarkError&&<p className="error" role="alert">{watermarkError}</p>}{watermarkMessage&&<p className="success" role="status">{watermarkMessage}</p>}
      </section>
      <section className="card letterhead-settings">
        <h2>Offer letter signature</h2>
        <p className="muted">Upload the authorized company signatory's signature. It appears above the signatory name in the official offer PDF, beside the company stamp.</p>
        {signature&&<p className="muted">Signature uploaded · Updated {new Date(signature.updated_at).toLocaleString()}</p>}
        <div className="form-field">
          <label htmlFor="offer-signature-file">Signature image (PNG or JPG, maximum 1 MB)</label>
          <input id="offer-signature-file" className="input letterhead-file-input" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={e=>{const file=e.target.files?.[0]||null;const valid=file&&["image/png","image/jpeg"].includes(file.type)&&file.size<=1024*1024;setSignatureError(file&&!valid?"Select a PNG or JPG image no larger than 1 MB.":"");setSignatureFile(valid?file:null)}}/>
        </div>
        <div className="action-row" style={{justifyContent:"flex-start"}}>
          <button className="btn" type="button" disabled={!signatureFile||signatureBusy} onClick={uploadSignature}>Upload signature</button>
          {signature&&<><button className="btn secondary" type="button" onClick={viewSignature}>View signature</button><button className="btn danger" type="button" disabled={signatureBusy} onClick={removeSignature}>Remove</button></>}
        </div>
        {signatureError&&<p className="error" role="alert">{signatureError}</p>}
        {signatureMessage&&<p className="success" role="status">{signatureMessage}</p>}
      </section>
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
                      <button className="btn secondary" onClick={() => show(l)}>Preview details</button><button className="btn secondary" onClick={() => showPdf(l)}>View offer PDF</button>
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
            {editingOffer?<div className="offer-edit-fields"><label htmlFor="offer-edit-body">Offer letter content</label><textarea id="offer-edit-body" className="input" rows={12} maxLength={6000} value={editBody} onChange={e=>setEditBody(e.target.value)}/><label htmlFor="offer-edit-signatory">Authorized signatory</label><input id="offer-edit-signatory" className="input" maxLength={200} value={editSignatory} onChange={e=>setEditSignatory(e.target.value)}/><p className="muted">Saving returns this offer to Draft. Preview and approve it again before issue.</p></div>:<><div className="letter-body">{preview.rendered_body}</div>{preview.signatory&&<p className="offer-sign"><b>{preview.signatory}</b></p>}</>}
            {revisionReasonOpen&&!editingOffer&&<div className="offer-edit-fields"><label htmlFor="offer-revision-reason">Reason for reissuing this offer letter <span aria-hidden="true">*</span></label><textarea id="offer-revision-reason" className="input" rows={3} maxLength={500} placeholder="Example: Correcting the internship offer wording" value={revisionReason} onChange={e=>{setRevisionReason(e.target.value);setEditError("");}}/><p className="muted">This reason is recorded in the offer history. The previous issued version is retained.</p><div className="action-row"><button type="button" className="btn" disabled={editBusy||!revisionReason.trim()} onClick={startOfferRevision}>Continue editing</button><button type="button" className="btn secondary" disabled={editBusy} onClick={()=>{setRevisionReasonOpen(false);setRevisionReason("");setEditError("");}}>Cancel</button></div></div>}
            {editError&&<p className="error" role="alert">{editError}</p>}{editMessage&&<p className="success" role="status">{editMessage}</p>}
            <div className="action-row">
              {editingOffer?<><button className="btn" disabled={editBusy||!editBody.trim()||!editSignatory.trim()} onClick={saveOfferContent}>Save changes</button><button className="btn secondary" disabled={editBusy} onClick={()=>setEditingOffer(false)}>Cancel</button></>:<>{["DRAFT","PREVIEWED","APPROVED"].includes(preview.status)&&<button className="btn secondary" onClick={()=>setEditingOffer(true)}>Edit content</button>}{!revisionReasonOpen&&["ISSUED","REISSUED","REVOKED"].includes(preview.status)&&<button className="btn secondary" disabled={editBusy} onClick={()=>{setRevisionReasonOpen(true);setRevisionReason("");setEditError("");}}>Create revision to edit</button>}</>}
              {!editingOffer && preview.status === "PREVIEWED" && (
                <button
                  className="btn"
                  onClick={() => action(preview, "approve")}
                >
                  Approve Letter
                </button>
              )}
              {!editingOffer && preview.status === "APPROVED" && (
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
      {pdfPreview&&<div className="offer-pdf-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closePdf()}}><section className="offer-pdf-dialog" role="dialog" aria-modal="true" aria-label="Offer letter PDF preview"><header><div><h2>Offer letter preview</h2><p>{pdfPreview.name} · {pdfPreview.reference}</p></div><div className="action-row"><button type="button" className="btn secondary" onClick={downloadPdf}>Download PDF</button><button type="button" className="btn secondary" onClick={closePdf} aria-label="Close preview">Close</button></div></header><iframe src={pdfPreview.url+"#toolbar=0&navpanes=0&view=FitH"} title="Official GAINT offer letter PDF"/></section></div>}
      <style jsx global>{`.offer-pdf-overlay{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.75);display:flex;align-items:center;justify-content:center;padding:20px}.offer-pdf-dialog{display:flex;flex-direction:column;width:min(980px,100%);height:min(95vh,100%);background:white;border-radius:16px;overflow:hidden;box-shadow:0 25px 80px rgba(0,0,0,.3)}.offer-pdf-dialog header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 20px;border-bottom:1px solid #e2e8f0}.offer-pdf-dialog h2{font-size:18px;color:#111;margin:0}.offer-pdf-dialog p{font-size:12px;color:#525252;margin:4px 0 0}.offer-pdf-dialog iframe{flex:1;width:100%;border:0;background:#525252}.offer-pdf-dialog .btn{min-height:38px;border-radius:9px;padding:8px 14px;background:#eff6ff;color:#111;border:1px solid #bfdbfe}@media(max-width:600px){.offer-pdf-overlay{padding:5px}.offer-pdf-dialog header{flex-wrap:wrap}}
.admin-offers-page .offer-edit-fields{display:flex;flex-direction:column;gap:10px;margin:16px 0}.admin-offers-page .offer-edit-fields label{font-weight:650;color:#111}.admin-offers-page .offer-edit-fields textarea{min-height:230px;line-height:1.6;resize:vertical}.admin-offers-page .offer-edit-fields .input{border:1.5px solid #93b4ed;color:#111;background:#fff}.admin-offers-page .letterhead-settings{display:flex;flex-direction:column;gap:12px}
.admin-offers-page .letterhead-settings h2{margin-bottom:0}
.admin-offers-page .letterhead-settings p{margin:0;line-height:1.5}
.admin-offers-page .letterhead-settings .form-field{margin:4px 0}
.admin-offers-page .letterhead-settings .form-field label{display:block;font-weight:650;margin-bottom:8px;color:#111}
.admin-offers-page .letterhead-file-input{height:auto;min-height:54px;padding:9px 12px;border:1.5px solid #93b4ed;border-radius:10px;background:#f8fbff}
.admin-offers-page .letterhead-file-input::file-selector-button{padding:9px 16px;margin-right:14px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#111;font:inherit;font-weight:650;cursor:pointer}
.admin-offers-page .letterhead-file-input::file-selector-button:hover{background:#dbeafe}
.admin-offers-page .letterhead-settings .action-row{justify-content:flex-start!important;gap:10px}
.admin-offers-page .letterhead-settings .btn{min-height:42px;min-width:116px;border-radius:10px}
.admin-offers-page .letterhead-settings .btn:not(.secondary):not(.danger){background:#2563eb;border-color:#2563eb}
.admin-offers-page .letterhead-settings .btn:not(.secondary):not(.danger):hover{background:#1d4ed8;border-color:#1d4ed8}
.admin-offers-page{max-width:1240px;margin-inline:auto;padding:24px 28px 72px;color:#111}
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

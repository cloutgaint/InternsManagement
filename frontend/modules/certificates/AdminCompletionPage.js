"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
export default function AdminCompletionPage() {
  const [rows, setRows] = useState([]),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [feedbackId,setFeedbackId]=useState(null),
    [dialog,setDialog]=useState(null),
    [dialogReason,setDialogReason]=useState(""),
    [dialogExtra,setDialogExtra]=useState(""),
    [dialogError,setDialogError]=useState(""),
    [dialogBusy,setDialogBusy]=useState(false);
  const load = () =>
    api("/admin/completions")
      .then(setRows)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function approve(x) {setFeedbackId(x.intern_id);setErr("");setMsg("");
    try {
      await api("/admin/completions/" + x.intern_id + "/decision", {
        method: "POST",
        body: JSON.stringify({ status: "APPROVED", reason: "" }),
      });
      setMsg("Completion approved.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  function openDialog(x,action){setFeedbackId(x.intern_id);setErr("");setMsg("");setDialog({x,action});setDialogReason("");setDialogExtra("");setDialogError("");}
  function closeDialog(){if(dialogBusy)return;setDialog(null);setDialogError("");}
  async function confirmDialog(e){
    e.preventDefault();
    if(!dialog||dialogBusy)return;
    const {x,action}=dialog,reason=dialogReason.trim(),extra=dialogExtra.trim();
    if(["WITHDRAWN","TERMINATED","INCOMPLETE","EXTENDED"].includes(action)&&!reason){setDialogError("Please provide a reason.");return;}
    if(action==="EXTENDED"&&(!/^\\d{4}-\\d{2}-\\d{2}$/.test(extra)||Number.isNaN(Date.parse(extra)))){setDialogError("Select a valid new internship end date.");return;}
    if(action==="OFFLINE"&&!extra){setDialogError("Enter the certificate serial or reference number.");return;}
    setDialogBusy(true);setDialogError("");setErr("");setMsg("");
    try{
      if(action==="DELETE"){await api("/admin/interns/"+x.user_id,{method:"DELETE"});setMsg("Student removed from active records.");}
      else if(action==="WITHDRAWN"||action==="TERMINATED"){await api("/admin/completions/"+x.intern_id+"/exit",{method:"POST",body:JSON.stringify({type:action,reason})});setMsg("Internship marked "+action.toLowerCase()+".");}
      else if(action==="OFFLINE"){await api("/admin/certificates/"+x.intern_id+"/issue",{method:"POST",body:JSON.stringify({mode:"OFFLINE",serialNumber:extra})});setMsg("Offline certificate recorded.");}
      else{await api("/admin/completions/"+x.intern_id+"/decision",{method:"POST",body:JSON.stringify({status:action,reason,extendedTo:action==="EXTENDED"?extra:undefined})});setMsg("Internship marked "+action.toLowerCase()+".");}
      setDialog(null);await load();
    }catch(error){setDialogError(error.message||"Unable to complete the action.");}
    finally{setDialogBusy(false);}
  }
  async function cert(x) {setFeedbackId(x.intern_id);setErr("");setMsg("");
    try {
      await api("/admin/certificates/" + x.intern_id + "/issue", {
        method: "POST",
        body: JSON.stringify({ mode: "IN_APP" }),
      });
      setMsg("Certificate issued.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function download(x){try{const b=await apiBlob("/admin/certificates/"+x.certificate_db_id+"/file"),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=(x.certificate_id||"certificate")+".pdf";a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)}catch(e){setErr(e.message)}}
  return (
    <main className="wrap completion-page">
      <div className="completion-page-heading"><div><span className="completion-page-eyebrow">Internship management</span><h1>Completion & Certificates</h1><p>Review internship outcomes, manage student exits and issue certificates.</p></div><span className="completion-page-count">{rows.length} students</span></div>
      {dialog&&<div className="completion-dialog-overlay" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)closeDialog();}}>
        <section className="completion-dialog" role="dialog" aria-modal="true" aria-labelledby="completion-dialog-title" aria-describedby="completion-dialog-description" onKeyDown={(e)=>{if(e.key==="Escape"){e.preventDefault();closeDialog();}}}>
          <div className="completion-dialog-header"><span className="completion-dialog-brand">GAINT SkillBridge</span><button type="button" className="completion-dialog-close" onClick={closeDialog} disabled={dialogBusy} aria-label="Close dialog">×</button></div>
          <h2 id="completion-dialog-title">{({DELETE:"Delete Student",WITHDRAWN:"Withdraw Internship",TERMINATED:"Terminate Internship",INCOMPLETE:"Mark Incomplete",EXTENDED:"Extend Internship",OFFLINE:"Record Offline Certificate"})[dialog.action]}</h2>
          <p id="completion-dialog-description" className="muted">{dialog.action==="DELETE"?'Remove "'+dialog.x.full_name+'" from active student and completion records? Login will be disabled, but historical records are retained.':"Student: "+dialog.x.full_name}</p>
          <form onSubmit={confirmDialog}>
            {["WITHDRAWN","TERMINATED","INCOMPLETE","EXTENDED"].includes(dialog.action)&&<label className="completion-dialog-field">Reason <span className="completion-dialog-required">*</span><textarea className="input" value={dialogReason} onChange={(e)=>setDialogReason(e.target.value)} rows={3} maxLength={2000} placeholder="Enter the reason for this decision" required autoFocus/></label>}
            {dialog.action==="EXTENDED"&&<label className="completion-dialog-field">New internship end date <span className="completion-dialog-required">*</span><input className="input" type="date" value={dialogExtra} onChange={(e)=>setDialogExtra(e.target.value)} required/></label>}
            {dialog.action==="OFFLINE"&&<label className="completion-dialog-field">Certificate serial / reference number <span className="completion-dialog-required">*</span><input className="input" value={dialogExtra} onChange={(e)=>setDialogExtra(e.target.value)} maxLength={200} required autoFocus/></label>}
            {dialogError&&<p className="error" role="alert">{dialogError}</p>}
            <div className="completion-dialog-actions"><button type="button" className="btn secondary" onClick={closeDialog} disabled={dialogBusy}>Cancel</button><button type="submit" className={"btn "+(dialog.action==="DELETE"||dialog.action==="TERMINATED"?"danger":"")} disabled={dialogBusy}>{dialogBusy?"Processing...":dialog.action==="DELETE"?"Delete Student":"Confirm"}</button></div>
          </form>
        </section>
      </div>}
      {rows.map((x) => (
        <section className="card admin-completion-row" key={x.intern_id}>{feedbackId===x.intern_id&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
          <div className="admin-completion-info">
            <b>{x.full_name}</b>
            <div className="muted">
              Evaluation: {x.individual_marks ?? "Pending"} · Completion:{" "}
              {({ APPROVED: "Successfully Completed", INCOMPLETE: "Incomplete", REJECTED: "Incomplete", EXTENDED: "Extended" })[x.completion_status] || "Pending"} · Certificate:{" "}
              {x.certificate_status || "Not issued"} {x.exit_type ? "· Exit: "+x.exit_type : ""} {x.certificate_id ? "· "+x.certificate_id : ""}
            </div>
          </div>
          <div className="action-row admin-completion-actions">
            <button type="button" className="btn danger" onClick={()=>openDialog(x,"DELETE")}>Delete Student</button>
            {!x.exit_type && x.individual_marks != null &&
              x.completion_status !== "APPROVED" && (
                <>
                  <button className="btn" onClick={() => approve(x)}>
                    Mark Successfully Completed
                  </button>
                  <button className="btn secondary" onClick={() => openDialog(x, "INCOMPLETE")}>
                    Mark Incomplete
                  </button>
                  <button className="btn secondary" onClick={() => openDialog(x, "EXTENDED")}>
                    Extend
                  </button>
                </>
              )}
            {x.certificate_status === "ISSUED" && x.certificate_mode !== "OFFLINE" && <button className="btn secondary" onClick={()=>download(x)}>Download Certificate</button>}{!x.exit_type && x.completion_status === "APPROVED" &&
              x.certificate_status !== "ISSUED" && (
                <>
                  <button className="btn" onClick={() => cert(x)}>
                    Issue In-App Certificate
                  </button>
                  <button className="btn secondary" onClick={() => openDialog(x, "OFFLINE")}>
                    Record Offline Certificate
                  </button>
                </>
              )}
            {!x.exit_type && x.certificate_status !== "ISSUED" && <><button className="btn secondary" onClick={()=>openDialog(x,"WITHDRAWN")}>Withdraw</button><button className="btn secondary" onClick={()=>openDialog(x,"TERMINATED")}>Terminate</button></>}
          </div>
        </section>
      ))}
      <style jsx global>{`
        .completion-page{max-width:1200px;margin-inline:auto;padding-bottom:70px}
        .completion-page-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:26px 0 28px}
        .completion-page-eyebrow{display:block;font-size:14px;font-weight:600;color:#08734d;margin-bottom:9px}
        .completion-page-heading h1{font-size:clamp(29px,3vw,38px);line-height:1.2;letter-spacing:-.025em;font-weight:650;margin:0 0 10px;color:#142e24}
        .completion-page-heading p{font-size:16px;line-height:1.6;color:#5c7268;margin:0}
        .completion-page-count{flex-shrink:0;background:#e9f5ee;border:1px solid #cce8d7;color:#075d3d;padding:10px 17px;border-radius:999px;font-size:14px;font-weight:650}
        .completion-page .admin-completion-row{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:24px 26px;margin:0 0 14px;border:1px solid #d9e8e0;border-radius:20px;background:#fff;box-shadow:0 6px 22px rgba(20,65,42,.045);transition:border-color .2s,box-shadow .2s}
        .completion-page .admin-completion-row:hover{border-color:#a8d2bc;box-shadow:0 10px 28px rgba(20,65,42,.075)}
        .completion-page .admin-completion-info{flex:1;min-width:0}
        .completion-page .admin-completion-info>b{display:block;font-size:19px;font-weight:650;color:#183428;margin-bottom:8px}
        .completion-page .admin-completion-info .muted{font-size:15px;line-height:1.65;color:#5a7066}
        .completion-page .admin-completion-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}
        .completion-page .admin-completion-actions .btn{min-height:44px;padding:11px 17px;border-radius:999px;font-size:14px;font-weight:600;white-space:nowrap}
        .completion-page .admin-completion-actions .btn.danger{background:#dc2626;border-color:#dc2626;color:#fff}
        .completion-page .admin-completion-actions .btn.secondary{background:#eef5f1;border:1px solid #d7e6dd;color:#163d2c}
        .completion-page .admin-completion-actions .btn:hover{filter:brightness(.95)}
        .completion-page .admin-completion-actions .btn.danger:hover{background:#b91c1c;color:#fff}
        @media(max-width:820px){.completion-page-heading{align-items:flex-start}.completion-page .admin-completion-row{align-items:flex-start;flex-direction:column}.completion-page .admin-completion-actions{justify-content:flex-start;width:100%}}
        @media(max-width:520px){.completion-page-heading{flex-direction:column}.completion-page .admin-completion-row{padding:20px}.completion-page .admin-completion-actions .btn{flex:1}}

        .completion-dialog-overlay{position:fixed;inset:0;z-index:9999;background:rgba(13,31,25,.52);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
        .completion-dialog{width:min(100%,560px);max-height:calc(100vh - 40px);overflow-y:auto;background:#fff;border:1px solid #dbe7e0;border-radius:22px;padding:32px;box-shadow:0 28px 80px rgba(8,39,26,.22);color:#182d23}
        .completion-dialog-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
        .completion-dialog-brand{font-size:17px;letter-spacing:0;text-transform:none;color:#075f3e;font-weight:650}
        .completion-dialog-close{width:38px;height:38px;border:0;border-radius:50%;background:#eef5f0;color:#254535;font-size:24px;cursor:pointer;line-height:1}
        .completion-dialog h2{font-size:28px;font-weight:650;line-height:1.2;margin:0 0 12px}
        .completion-dialog p.muted{font-size:16px;line-height:1.65;margin:0 0 24px}
        .completion-dialog-field{display:flex;flex-direction:column;gap:10px;font-size:15px;font-weight:600;margin-bottom:17px}
        .completion-dialog-field .input{width:100%;border:1.5px solid #3b82f6;border-radius:8px;min-height:48px;padding:12px 15px;font-size:16px;font:inherit;font-weight:400;resize:vertical}
        .completion-dialog-field .input:focus{outline:3px solid #dbeafe;outline-offset:1px;border-color:#1d4ed8}
        .completion-dialog-required{color:#dc2626}
        .completion-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px;flex-wrap:wrap}
        .completion-dialog-actions .btn{border-radius:999px;min-width:116px;min-height:46px;font-size:15px;font-weight:600}
        .completion-dialog-actions .btn:not(.secondary):not(.danger){background:#2563eb;color:#fff;border-color:#2563eb}
        .completion-dialog-actions .btn.danger{background:#dc2626;color:#fff;border-color:#dc2626}
        .completion-dialog-actions .btn.secondary{background:#edf3f0;color:#18382b;border-color:#d8e5dd}
        @media(max-width:520px){.completion-dialog{padding:24px 20px}.completion-dialog h2{font-size:24px}.completion-dialog-brand{font-size:16px}.completion-dialog-actions .btn{flex:1}}
      `}</style>
    </main>
  );
}

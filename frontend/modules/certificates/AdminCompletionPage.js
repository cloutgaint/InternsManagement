"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
export default function AdminCompletionPage() {
  const [rows, setRows] = useState([]),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState("");
  const load = () =>
    api("/admin/completions")
      .then(setRows)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function approve(x) {
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
  async function recordExit(x,type){const reason=prompt("Reason for "+type.toLowerCase()+":");if(!reason?.trim())return;if(!confirm("Confirm "+type.toLowerCase()+" for "+x.full_name+"? This prevents completion certification."))return;try{await api("/admin/completions/"+x.intern_id+"/exit",{method:"POST",body:JSON.stringify({type,reason:reason.trim()})});setMsg("Internship marked "+type.toLowerCase()+".");setErr("");load()}catch(e){setErr(e.message)}}
  async function removeStudent(x) {
    if(!window.confirm(`Remove "${x.full_name}" from active student and completion records? Login will be disabled, but historical records are retained.`))return;
    setErr("");setMsg("");
    try{await api("/admin/interns/"+x.user_id,{method:"DELETE"});setMsg("Student removed from active records.");await load();}
    catch(e){setErr(e.message);}
  }
  async function cert(x) {
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
    <main className="wrap">
      <h1>Completion & Certificates</h1>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      {rows.map((x) => (
        <section className="card workflow-row" key={x.intern_id}>
          <div>
            <b>{x.full_name}</b>
            <div className="muted">
              Evaluation: {x.individual_marks ?? "Pending"} · Completion:{" "}
              {x.completion_status || "Pending"} · Certificate:{" "}
              {x.certificate_status || "Not issued"} {x.exit_type ? "· Exit: "+x.exit_type : ""} {x.certificate_id ? "· "+x.certificate_id : ""}
            </div>
          </div>
          <div className="action-row">
            <button type="button" className="btn danger" onClick={()=>removeStudent(x)}>Delete Student</button>
            {!x.exit_type && x.individual_marks != null &&
              x.completion_status !== "APPROVED" && (
                <button className="btn" onClick={() => approve(x)}>
                  Approve Completion
                </button>
              )}
            {x.certificate_status === "ISSUED" && <button className="btn secondary" onClick={()=>download(x)}>Download Certificate</button>}{!x.exit_type && x.completion_status === "APPROVED" &&
              x.certificate_status !== "ISSUED" && (
                <button className="btn" onClick={() => cert(x)}>
                  Issue Certificate
                </button>
              )}
            {!x.exit_type && x.certificate_status !== "ISSUED" && <><button className="btn secondary" onClick={()=>recordExit(x,"WITHDRAWN")}>Withdraw</button><button className="btn secondary" onClick={()=>recordExit(x,"TERMINATED")}>Terminate</button></>}
          </div>
        </section>
      ))}
    </main>
  );
}

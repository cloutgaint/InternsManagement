"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
export default function InternCertificatePage() {
  const [d, setD] = useState(null),
    [err, setErr] = useState("");
  useEffect(() => {
    api("/intern/completion")
      .then(setD)
      .catch((e) => setErr(e.message));
  }, []);
  async function dl() {
    try {
      const b = await apiBlob("/intern/certificate/file"),
        u = URL.createObjectURL(b),
        a = document.createElement("a");
      a.href = u;
      a.download =
        (d.certificate.certificate_id || "GAINT-Certificate") + ".pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
    } catch (e) {
      setErr(e.message);
    }
  }
  if (!d) return <main className="wrap">{err || "Loading completion…"}</main>;
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Completion & Certificate</h1>
          <p className="muted">
            Final mentor evaluation, Admin approval and your issued internship
            certificate.
          </p>
        </div>
      </div>
      {err && <p className="error">{err}</p>}
      <div className="completion-flow">
        <section className="card">
          <h2>1. Final Evaluation</h2>
          {d.evaluation ? (
            <>
              <div className="detail-grid">
                <div>
                  <b>Group Marks</b>
                  <span>{d.evaluation.group_marks}</span>
                </div>
                <div>
                  <b>Individual Marks</b>
                  <span>{d.evaluation.individual_marks}</span>
                </div>
                <div>
                  <b>Recommendation</b>
                  <span>{d.evaluation.recommendation}</span>
                </div>
              </div>
              <p>
                <b>Mentor Feedback:</b> {d.evaluation.mentor_feedback}
              </p>
            </>
          ) : (
            <p className="muted">Awaiting Mentor final evaluation.</p>
          )}
        </section>
        <section className="card">
          <h2>2. Completion Approval</h2>
          <span className="status-pill">{d.exit?.type || ({ APPROVED: "SUCCESSFULLY COMPLETED", INCOMPLETE: "INCOMPLETE", REJECTED: "INCOMPLETE", EXTENDED: "EXTENDED" })[d.approval?.status] || "PENDING"}</span>
          {d.approval?.extended_to && <p>Extended to {String(d.approval.extended_to).slice(0, 10)}.</p>}
          {(d.exit?.reason || d.approval?.reason) && <p>{d.exit?.reason || d.approval.reason}</p>}
          <p className="muted">College completion report: {d.collegeReport ? "Generated" : "Not generated yet"}</p>
        </section>
        <section className="card">
          <h2>3. Certificate</h2>
          {d.certificate?.status === "ISSUED" ? (
            <>
              <p>
                <b>{d.certificate.certificate_id}</b>
              </p>
              <p>Issued: {String(d.certificate.issue_date).slice(0, 10)}</p>
              {d.certificate.mode === "OFFLINE" ? (
                <p>Offline certificate{d.certificate.serial_number ? " · Serial " + d.certificate.serial_number : ""}. GAINT will provide your copy.</p>
              ) : (
                <button className="btn" onClick={dl}>
                  Download Certificate PDF
                </button>
              )}
              <p className="muted">Anyone can check it at /verify-certificate?id={d.certificate.certificate_id}</p>
            </>
          ) : (
            <p className="muted">
              Certificate becomes available after completion approval and issue.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

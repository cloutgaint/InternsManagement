"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
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
    [dates, setDates] = useState({});
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
    <main className="wrap">
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
    </main>
  );
}

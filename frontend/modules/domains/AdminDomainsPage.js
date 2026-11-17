"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
import Link from "next/link";
export default function AdminDomainsPage() {
  const [rows, setRows] = useState([]),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(""),
    [domains, setDomains] = useState([]),
    [other, setOther] = useState({}),[feedbackId,setFeedbackId]=useState(null);
  const load = () =>
    Promise.all([api("/admin/domain-recommendations"), api("/admin/domains")])
      .then(([r, d]) => {
        setRows(r);
        setDomains(d.filter((x) => x.active));
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function calculate(x) {
    setFeedbackId(x.intern_id);setErr("");setMsg("");
    try {
      setBusy(x.intern_id);
      await api("/admin/domain-recommendations/" + x.intern_id + "/calculate", {
        method: "POST",
        body: JSON.stringify({ batchId: x.batch_id }),
      });
      setMsg("Domain recommendation calculated for " + x.full_name + ".");
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  async function confirm(x, d) {
    setFeedbackId(x.intern_id);setErr("");setMsg("");
    const top = x.recommendations?.[0]?.domainId;
    let reason;
    if (d.domainId !== top) {
      reason = prompt("Reason for confirming " + d.domainName + " instead of the top recommendation:");
      if (!reason?.trim()) return;
    } else if (
      !window.confirm(
        "Confirm " +
          d.domainName +
          " as the final domain for " +
          x.full_name +
          "?",
      )
    )
      return;
    try {
      setBusy(x.intern_id);
      await api("/admin/domain-confirm", {
        method: "POST",
        body: JSON.stringify({
          internId: x.intern_id,
          batchId: x.batch_id,
          domainId: d.domainId,
          reason,
        }),
      });
      setMsg("Final domain confirmed for " + x.full_name + ".");
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="wrap admin-domains-page">
      <div className="intern-head">
        <div>
          <h1>Domain Recommendations</h1>
          <p className="muted">
            System-generated recommendations from evaluated domain assessment
            results. Admin makes the final confirmation.
          </p>
        </div>
      </div>
      <section className="card workflow-section">
        {rows.map((x) => (
          <div className="domain-rec-card" key={x.intern_id + "-" + x.batch_id}>{feedbackId===x.intern_id&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
            <div className="verification-title">
              <div>
                <h3>{x.full_name}</h3>
                <p className="muted">
                  {x.batch_name} · Preferences:{" "}
                  {(x.preferences || []).join(", ") || "Not provided"}
                </p>
              </div>
              {x.final_domain_name ? (
                <span className="status-pill status-verified">
                  CONFIRMED: {x.final_domain_name}
                </span>
              ) : null}
              {x.final_domain_id && <Link className="btn secondary" href="/admin/work" title="Change this intern's Frontend, Backend or custom project role">Change Project Role</Link>}
              {(

                <button
                  className="btn secondary"
                  disabled={busy === x.intern_id}
                  onClick={() => calculate(x)}
                >
                  {busy === x.intern_id
                    ? "Calculating…"
                    : "Calculate / Refresh"}
                </button>
              )}
            </div>
            {!(x.recommendations || []).length ? (
              <p className="muted">
                No calculated recommendation yet. Evaluated domain assessment
                results are required.
              </p>
            ) : (
              <div className="domain-ranking">
                {x.recommendations.map((d, i) => (
                  <div className="domain-score" key={d.domainId}>
                    <div>
                      <b>
                        #{i + 1} {d.domainName}
                      </b>
                      <small>
                        Assessment {d.assessmentScore}% · Preference bonus{" "}
                        {d.preferenceBonus} · Evidence {d.evidence?.earned}/
                        {d.evidence?.possible}
                      </small>
                    </div>
                    <strong>{d.recommendationScore}</strong>
                    {x.final_domain_id !== d.domainId && (
                      <button className="btn" onClick={() => confirm(x, d)}>
                        {x.final_domain_id ? "Change to This Domain" : "Confirm Domain"}
                      </button>
                    )}
                  </div>
                ))}
                <div className="action-row">
                  <select className="input" aria-label={"Choose a different domain for " + x.full_name} value={other[x.intern_id] || ""} onChange={(e) => setOther((o) => ({ ...o, [x.intern_id]: e.target.value }))}>
                    <option value="">{x.final_domain_id?"Change confirmed domain…":"Assign a domain…"}</option>
                    {domains.filter((d) => d.id !== x.final_domain_id && !x.recommendations.some((r) => r.domainId === d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button className="btn secondary" disabled={!other[x.intern_id]} onClick={() => confirm(x, { domainId: other[x.intern_id], domainName: domains.find((d) => d.id === other[x.intern_id])?.name })}>{x.final_domain_id?"Change Domain":"Assign"}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
      <div className="proof-alert">
        <b>Recommendation rule</b>
        <span>
          90% of the recommendation score comes from evaluated domain assessment
          performance. Up to 10 points reflect the student's stated domain
          preference. The system recommends; Admin confirms or changes the final domain and records a reason when departing from the recommendation.
        </span>
      </div>
      <style jsx global>{`.admin-domains-page{max-width:1240px;margin-inline:auto;padding:24px 28px 72px;color:#111}
.admin-domains-page .intern-head{margin:16px 0 25px}
.admin-domains-page .intern-head h1{font-size:clamp(28px,3vw,36px);font-weight:700;letter-spacing:-.035em;color:#111;margin:0 0 8px}
.admin-domains-page .intern-head p{max-width:820px;font-size:15px;line-height:1.6;color:#525252;margin:0}
.admin-domains-page>.card{background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:24px 26px;margin-bottom:17px;box-shadow:0 5px 20px rgba(15,23,42,.035)}
.admin-domains-page .domain-rec-card{padding:20px 0;border-bottom:1px solid #edf0f4}
.admin-domains-page .domain-rec-card:first-child{padding-top:0}
.admin-domains-page .domain-rec-card:last-child{border-bottom:0;padding-bottom:0}
.admin-domains-page .verification-title{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.admin-domains-page .verification-title h3{font-size:17px;font-weight:700;color:#111;margin:0 0 5px}
.admin-domains-page .verification-title .muted{font-size:12px;line-height:1.5;color:#525252;margin:0}
.admin-domains-page .status-pill{display:inline-flex;align-items:center;padding:7px 11px;border-radius:999px;background:#e8f5ec;color:#17633d;font-size:11px;font-weight:700}
.admin-domains-page .btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px 14px;border-radius:9px;background:#075b3b;border:1px solid #075b3b;color:#fff;font-size:12px;font-weight:650;line-height:1.25}
.admin-domains-page .btn:hover:not(:disabled){background:#06472f;border-color:#06472f}
.admin-domains-page .btn.secondary{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}
.admin-domains-page .btn.secondary:hover:not(:disabled){background:#2563eb;border-color:#2563eb;color:#fff}
.admin-domains-page .btn:disabled{opacity:.55;cursor:not-allowed}
.admin-domains-page button:focus-visible,.admin-domains-page select:focus-visible{outline:3px solid #bfdbfe;outline-offset:2px}
.admin-domains-page .domain-ranking{display:grid;gap:10px;margin-top:15px}
.admin-domains-page .domain-score{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:14px;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#fafbfc}
.admin-domains-page .domain-score>div{display:grid;gap:6px;min-width:0}
.admin-domains-page .domain-score b{font-size:14px;font-weight:700;color:#111}
.admin-domains-page .domain-score small{font-size:12px;line-height:1.5;color:#525252}
.admin-domains-page .domain-score>strong{display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:42px;padding:0 9px;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-size:15px}
.admin-domains-page .domain-ranking>.action-row{display:flex;align-items:center;justify-content:flex-end;gap:9px;margin-top:5px}
.admin-domains-page .domain-ranking .input{width:auto;min-width:220px;max-width:320px;height:42px;min-height:42px;margin:0;padding:9px 11px;border:1.5px solid #93b4ed;border-radius:9px;background:#fff;color:#111;font-size:13px}
.admin-domains-page .domain-ranking .input:focus{outline:0;border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe}
.admin-domains-page .proof-alert{display:flex;flex-direction:column;gap:7px;padding:17px 19px;border:1px solid #bfdbfe;border-radius:13px;background:#f5f9ff;color:#1e3a5f;font-size:13px;line-height:1.6}
.admin-domains-page .proof-alert b{font-size:13px;font-weight:700;color:#1e40af}
@media(max-width:760px){.admin-domains-page{padding:18px 14px 48px}.admin-domains-page>.card{padding:20px 16px}.admin-domains-page .domain-score{grid-template-columns:minmax(0,1fr) auto}.admin-domains-page .domain-score>.btn{grid-column:1/-1;width:100%}.admin-domains-page .domain-ranking>.action-row{justify-content:stretch;flex-direction:column}.admin-domains-page .domain-ranking .input,.admin-domains-page .domain-ranking .action-row .btn{width:100%;max-width:none}}
@media(max-width:480px){.admin-domains-page .verification-title{flex-direction:column}.admin-domains-page .domain-score{grid-template-columns:1fr}.admin-domains-page .domain-score>strong{justify-self:start}}`}</style>
    </main>
  );
}

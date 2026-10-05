"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function AdminDomainsPage() {
  const [rows, setRows] = useState([]),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState("");
  const load = () =>
    api("/admin/domain-recommendations")
      .then(setRows)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function calculate(x) {
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
    if (
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
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Domain Recommendations</h1>
          <p className="muted">
            System-generated recommendations from evaluated domain assessment
            results. Admin makes the final confirmation.
          </p>
        </div>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <section className="card workflow-section">
        {rows.map((x) => (
          <div className="domain-rec-card" key={x.intern_id + "-" + x.batch_id}>
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
              ) : (
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
                    {!x.final_domain_id && (
                      <button className="btn" onClick={() => confirm(x, d)}>
                        Confirm Domain
                      </button>
                    )}
                  </div>
                ))}
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
          preference. The system recommends; Admin confirms the final domain.
        </span>
      </div>
    </main>
  );
}

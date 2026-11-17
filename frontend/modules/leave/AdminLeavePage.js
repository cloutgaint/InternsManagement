"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
const displayStatus = (value) => String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const fmt = (d) => (d ? String(d).slice(0, 10) : "—");
export default function AdminLeavePage() {
  const [requests, setRequests] = useState([]),
    [holidays, setHolidays] = useState([]),
    [batches, setBatches] = useState([]),
    [holiday, setHoliday] = useState({ batchId: "", day: "", name: "" }),
    [reason, setReason] = useState({}),
    [limits, setLimits] = useState({}),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [feedbackArea,setFeedbackArea]=useState("decide");
  const load = () =>
    Promise.all([
      api("/admin/leave-requests"),
      api("/admin/holidays"),
      api("/admin/batches"),
    ])
      .then(([r, h, b]) => {
        setRequests(r);
        setHolidays(h);
        setBatches(b);
        setLimits(
          Object.fromEntries(b.map((x) => [x.id, x.leave_limit_days ?? 3])),
        );
        if (!holiday.batchId && b[0])
          setHoliday((x) => ({ ...x, batchId: b[0].id }));
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function decide(x, status) {setFeedbackArea("decide");
    try {
      await api("/admin/leave-requests/" + x.id + "/decision", {
        method: "POST",
        body: JSON.stringify({ status, reason: reason[x.id] || "" }),
      });
      setMsg("Leave " + status.toLowerCase() + ".");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function addHoliday(e) {setFeedbackArea("addHoliday");
    e.preventDefault();
    try {
      await api("/admin/holidays", {
        method: "POST",
        body: JSON.stringify(holiday),
      });
      setHoliday((x) => ({ ...x, day: "", name: "" }));
      setMsg("Holiday calendar updated.");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function saveLimit(b) {setFeedbackArea("saveLimit");
    try {
      await api("/admin/batches/" + b.id + "/leave-policy", {
        method: "PATCH",
        body: JSON.stringify({ leaveLimitDays: Number(limits[b.id]) }),
      });
      setMsg("Leave policy updated for " + b.name + ".");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap admin-leave-page">
      <div className="intern-head">
        <div>
          <h1>Leave & Holiday Management</h1>
          <p className="muted">
            Configure batch leave limits and holidays, then approve or reject
            intern leave requests.
          </p>
        </div>
      </div>
      <section className="card leave-panel">
        <h2>Batch Leave Policy</h2>{["saveLimit"].includes(feedbackArea)&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        {batches.map((b) => (
          <div className="workflow-row" key={b.id}>
            <div>
              <b>{b.name}</b>
              <div className="muted">
                Maximum approved working-day leave during the internship
                allocation.
              </div>
            </div>
            <div className="action-row">
              <input
                className="input leave-limit"
                type="number"
                min="0"
                max="60"
                value={limits[b.id] ?? 3}
                onChange={(e) =>
                  setLimits((x) => ({ ...x, [b.id]: e.target.value }))
                }
              />
              <button className="btn secondary" onClick={() => saveLimit(b)}>
                Save Limit
              </button>
            </div>
          </div>
        ))}
      </section>
      <section className="card leave-panel">
        <h2>Holiday Calendar</h2>{["addHoliday"].includes(feedbackArea)&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        <form className="form-grid" onSubmit={addHoliday}>
          <label>
            Batch
            <select
              className="input"
              value={holiday.batchId}
              onChange={(e) =>
                setHoliday((x) => ({ ...x, batchId: e.target.value }))
              }
            >
              {batches.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input
              className="input"
              type="date"
              required
              value={holiday.day}
              onChange={(e) =>
                setHoliday((x) => ({ ...x, day: e.target.value }))
              }
            />
          </label>
          <label>
            Holiday Name
            <input
              className="input"
              required
              value={holiday.name}
              onChange={(e) =>
                setHoliday((x) => ({ ...x, name: e.target.value }))
              }
            />
          </label>
          <div className="form-actions">
            <button className="btn">Add / Update Holiday</button>
          </div>
        </form>
        <div className="master-tags">
          {holidays.map((h) => (
            <span key={h.id}>
              {h.batch_name}: {fmt(h.day)} · {h.name}
            </span>
          ))}
        </div>
      </section>
      <section className="card workflow-section leave-panel">
        <h2>Leave approval queue</h2>{["decide"].includes(feedbackArea)&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        {!requests.length && <p className="muted">No leave requests to review.</p>}
        {requests.map((x) => (
          <div className="leave-admin-row" key={x.id}>
            <div>
              <b>{x.full_name}</b>
              <div className="muted">
                {x.batch_name || "No batch"} · {fmt(x.from_date)} to{" "}
                {fmt(x.to_date)} · {x.requested_days} working day(s)
              </div>
              <p>{x.reason}</p>
              <small>
                Approved usage: {x.approved_days || 0}/{x.leave_limit_days ?? 0}{" "}
                days
              </small>
            </div>
            <span className="status-pill">{displayStatus(x.status)}</span>
            {x.status === "REQUESTED" && (
              <div className="face-admin-actions">
                <input
                  className="input"
                  placeholder="Reason required when rejecting"
                  value={reason[x.id] || ""}
                  onChange={(e) =>
                    setReason((r) => ({ ...r, [x.id]: e.target.value }))
                  }
                />
                <div className="action-row">
                  <button className="btn" onClick={() => decide(x, "APPROVED")}>
                    Approve
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => decide(x, "REJECTED")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
      <style jsx global>{`.admin-leave-page{max-width:1200px;margin-inline:auto;padding-bottom:72px;color:#111}.admin-leave-page .intern-head{margin:28px 0 26px}.admin-leave-page .intern-head h1{font-size:clamp(28px,3vw,36px);font-weight:650;color:#111}.admin-leave-page .intern-head .muted{font-size:16px;color:#333}.admin-leave-page .leave-panel{background:#fff;border:1px solid #dce6e2;border-radius:20px;padding:26px 28px;margin-bottom:20px;box-shadow:0 8px 28px rgba(20,40,30,.035)}.admin-leave-page .leave-panel h2{font-size:22px;font-weight:650;color:#111;margin:0 0 20px}.admin-leave-page .workflow-row{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 0;border-bottom:1px solid #e3eae6}.admin-leave-page .workflow-row:last-child{border-bottom:0}.admin-leave-page .workflow-row .action-row{display:flex;align-items:center;gap:12px;flex-shrink:0}.admin-leave-page .workflow-row .leave-limit{width:90px;min-width:90px;text-align:center}.admin-leave-page .input{min-height:46px;border:1px solid #75a7ff;border-radius:10px;color:#111;background:#fff;font-size:15px;padding:10px 13px}.admin-leave-page .input:hover{border-color:#2563eb}.admin-leave-page .input:focus{outline:0;border:2px solid #2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}.admin-leave-page .btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 20px;border-radius:999px;font-size:14px;font-weight:600;white-space:normal;text-align:center}.admin-leave-page .btn.secondary{background:#e8f0ff;color:#1645a4}.admin-leave-page .btn.secondary:hover{background:#2563eb;color:#fff}.admin-leave-page form.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 20px;align-items:end}.admin-leave-page form.form-grid>label{display:flex;flex-direction:column;gap:8px;min-width:0;font-size:14px;font-weight:600;color:#111}.admin-leave-page form.form-grid .input{width:100%;box-sizing:border-box}.admin-leave-page form.form-grid .form-actions{display:flex;align-items:end;justify-content:flex-end;margin:0}.admin-leave-page .master-tags{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.admin-leave-page .master-tags span{font-size:13px;line-height:1.5;padding:8px 12px;border-radius:999px;background:#f3f7f5;border:1px solid #dce6e2;color:#111}.admin-leave-page .leave-admin-row{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:20px 0;border-bottom:1px solid #e3eae6}.admin-leave-page .leave-admin-row:last-child{border-bottom:0}.admin-leave-page .leave-admin-row>div:first-child{flex:1;min-width:220px}.admin-leave-page .leave-admin-row .status-pill{font-size:13px;text-transform:none;letter-spacing:normal}.admin-leave-page .leave-admin-row .face-admin-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.admin-leave-page .leave-admin-row .face-admin-actions .input{min-width:210px;flex:1}@media(max-width:720px){.admin-leave-page .leave-panel{padding:20px 16px}.admin-leave-page .workflow-row{align-items:stretch;flex-direction:column}.admin-leave-page form.form-grid{grid-template-columns:1fr}.admin-leave-page form.form-grid .form-actions{justify-content:stretch}.admin-leave-page form.form-grid .form-actions .btn{width:100%}}.admin-leave-page .leave-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.admin-leave-page .leave-panel h2{font-size:20px;font-weight:650;letter-spacing:-.02em;color:#111;margin:0 0 5px}.admin-leave-page .leave-section-heading p{font-size:14px;line-height:1.5;color:#525252;margin:0}.admin-leave-page .leave-section-count{flex:none;border:1px solid #dbeafe;background:#eff6ff;color:#1e40af;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:650}.admin-leave-page .holiday-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:20px}.admin-leave-page .holiday-item{display:flex;align-items:center;gap:12px;min-width:0;padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa}.admin-leave-page .holiday-date{width:48px;height:48px;flex:none;border-radius:10px;background:#eff6ff;color:#1d4ed8;display:flex;flex-direction:column;align-items:center;justify-content:center}.admin-leave-page .holiday-date span{font-size:17px;font-weight:700;line-height:1.1}.admin-leave-page .holiday-date small{font-size:10px;font-weight:600}.admin-leave-page .holiday-details{display:flex;flex-direction:column;gap:4px;min-width:0}.admin-leave-page .holiday-details strong{font-size:14px;font-weight:650;color:#111;overflow-wrap:anywhere}.admin-leave-page .holiday-details span{font-size:12px;color:#525252}.admin-leave-page .leave-empty{display:flex;flex-direction:column;align-items:center;gap:5px;padding:24px 12px;color:#525252;font-size:14px;text-align:center}.admin-leave-page .leave-empty strong{color:#111}.admin-leave-page .leave-admin-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px 18px}.admin-leave-page .leave-status{justify-self:end;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:650;background:#fef3c7;color:#92400e;white-space:nowrap}.admin-leave-page .leave-status.approved{background:#dcfce7;color:#166534}.admin-leave-page .leave-status.rejected{background:#fee2e2;color:#991b1b}.admin-leave-page button:focus-visible,.admin-leave-page input:focus-visible,.admin-leave-page select:focus-visible{outline:3px solid #bfdbfe;outline-offset:2px}@media(max-width:760px){.admin-leave-page .holiday-list{grid-template-columns:1fr}.admin-leave-page .leave-admin-row{grid-template-columns:minmax(0,1fr)}.admin-leave-page .leave-status{justify-self:start}}@media(max-width:420px){.admin-leave-page .leave-section-heading{flex-direction:column}}`}</style>
    </main>
  );
}

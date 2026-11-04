"use client";
import { useState } from "react";
import { api } from "@/shared/api/client";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Everything Blueprint Section 23 keeps configurable per batch.
export default function BatchSettings({ batch, onSaved }) {
  const [open, setOpen] = useState(false), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [note, setNote] = useState("");
  const initial = () => ({
    name: batch.name, code: batch.code, startDate: String(batch.start_date).slice(0, 10), endDate: String(batch.end_date).slice(0, 10), mode: batch.mode, status: batch.status,
    workingDays: batch.working_days || [1, 2, 3, 4, 5], lateAfter: String(batch.late_after || "09:30").slice(0, 5), minAttendance: batch.min_attendance ?? 75, leaveLimitDays: batch.leave_limit_days ?? 3,
    groupWeight: batch.group_weight ?? 60, individualWeight: batch.individual_weight ?? 40, individualPassMark: batch.individual_pass_mark ?? 40,
    groupComposition: batch.group_composition || "SINGLE_DOMAIN", groupSize: batch.group_size ?? 5, certificateMode: batch.certificate_mode || "IN_APP",
  });
  const [f, setF] = useState(initial);
  const [taskRule, setTaskRule] = useState({ weekday: 1, time: "09:00", dueAfterDays: 6 });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const numeric = ["minAttendance", "leaveLimitDays", "groupWeight", "individualWeight", "individualPassMark", "groupSize"];
  const run = async (work) => {
    setErr(""); setNote("");
    try { setBusy(true); await work(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      await api("/admin/batches/" + batch.id, { method: "PATCH", body: JSON.stringify({ ...f, ...Object.fromEntries(numeric.map((k) => [k, Number(f[k])])) }) });
      setNote("Batch settings saved.");
      onSaved?.();
    });
  };
  const scheduleTasks = () => run(async () => {
    const r = await api("/admin/batches/" + batch.id + "/schedule-tasks", { method: "POST", body: JSON.stringify({ ...taskRule, weekday: Number(taskRule.weekday), dueAfterDays: Number(taskRule.dueAfterDays) }) });
    setNote(r.length + " weekly task(s) scheduled from templates.");
  });
  const scheduleReviews = () => run(async () => {
    const r = await api("/admin/batches/" + batch.id + "/schedule-reviews", { method: "POST", body: JSON.stringify({ everyDays: 14 }) });
    setNote(r.created + " fortnight review(s) scheduled.");
  });
  if (!open) return <button type="button" className="btn secondary" onClick={() => { setF(initial()); setOpen(true); }}>Configure</button>;
  return (
    <div style={{ width: "100%" }}>
      {err && <p className="error" role="alert">{err}</p>}
      {note && <p className="success" role="status">{note}</p>}
      <form className="form-grid" onSubmit={save}>
        {[["name", "Batch Name", "text"], ["code", "Batch Code", "text"], ["startDate", "Start Date", "date"], ["endDate", "End Date", "date"], ["lateAfter", "Late After", "time"], ["minAttendance", "Minimum Attendance %", "number"], ["leaveLimitDays", "Leave Limit (days)", "number"], ["groupWeight", "Group Marks %", "number"], ["individualWeight", "Individual Marks %", "number"], ["individualPassMark", "Individual Pass Mark", "number"], ["groupSize", "Group Size", "number"]].map(([k, label, type]) => (
          <div className="form-field" key={k}><label>{label}</label><input className="input" type={type} required value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>
        ))}
        {[["mode", "Attendance Mode", [["ONSITE", "On-site"], ["REMOTE", "Remote"], ["HYBRID", "Hybrid"]]], ["status", "Status", [["DRAFT", "Draft"], ["ACTIVE", "Active"], ["COMPLETED", "Completed"], ["ARCHIVED", "Archived"]]], ["groupComposition", "Group Composition", [["SINGLE_DOMAIN", "Single domain"], ["CROSS_FUNCTIONAL", "Cross-functional"]]], ["certificateMode", "Certificate Mode", [["IN_APP", "In-app"], ["OFFLINE", "Offline"]]]].map(([k, label, options]) => (
          <div className="form-field" key={k}><label>{label}</label><select className="input" value={f[k]} onChange={(e) => set(k, e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        ))}
        <fieldset className="form-field" style={{ gridColumn: "1 / -1" }}>
          <legend>Working Days</legend>
          {DAYS.map((d, i) => (
            <label key={d} style={{ marginRight: 12 }}>
              <input type="checkbox" checked={f.workingDays.includes(i)} onChange={(e) => set("workingDays", e.target.checked ? [...f.workingDays, i].sort() : f.workingDays.filter((x) => x !== i))} /> {d}
            </label>
          ))}
        </fieldset>
        <div className="form-actions action-row">
          <button className="btn" disabled={busy}>Save Settings</button>
          <button type="button" className="btn secondary" onClick={() => setOpen(false)}>Close</button>
        </div>
      </form>
      <h3>Automatic Schedules</h3>
      <div className="form-grid">
        <div className="form-field"><label>Task Release Day</label><select className="input" value={taskRule.weekday} onChange={(e) => setTaskRule((x) => ({ ...x, weekday: e.target.value }))}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
        <div className="form-field"><label>Release Time</label><input className="input" type="time" value={taskRule.time} onChange={(e) => setTaskRule((x) => ({ ...x, time: e.target.value }))} /></div>
        <div className="form-field"><label>Due After (days)</label><input className="input" type="number" min="1" max="60" value={taskRule.dueAfterDays} onChange={(e) => setTaskRule((x) => ({ ...x, dueAfterDays: e.target.value }))} /></div>
      </div>
      <div className="action-row">
        <button type="button" className="btn secondary" disabled={busy} onClick={scheduleTasks}>Schedule Weekly Tasks from Templates</button>
        <button type="button" className="btn secondary" disabled={busy} onClick={scheduleReviews}>Schedule Fortnight Reviews</button>
      </div>
    </div>
  );
}

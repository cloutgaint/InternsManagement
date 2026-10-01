"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
export default function Page() {
  const [groups, setGroups] = useState([]),
    [mentors, setMentors] = useState([]),
    [domains, setDomains] = useState([]),
    [selected, setSelected] = useState({}),
    [reason, setReason] = useState({}),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState("");
  const load = () =>
    Promise.all([
      api("/admin/groups"),
      api("/admin/mentors"),
      api("/admin/domains"),
    ])
      .then(([g, m, d]) => {
        setGroups(g.filter((x) => x.status === "ACTIVE"));
        setMentors(m);
        setDomains(d);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function assign(g, reassign = false) {
    const mentorId = selected[g.id];
    if (!mentorId) return setErr("Select a mentor first.");
    const detail = await api("/admin/groups/" + g.id + "/manage");
    const domainId = detail.members[0]?.final_domain_id || null;
    try {
      setBusy(g.id);
      await api(
        "/admin/groups/" + g.id + "/mentor" + (reassign ? "/reassign" : ""),
        {
          method: "POST",
          body: JSON.stringify({
            mentorId,
            domainId,
            isLead: true,
            reason: reason[g.id] || "",
          }),
        },
      );
      setMsg(
        (reassign ? "Mentor reassigned" : "Mentor assigned") +
          " for " +
          g.name +
          ".",
      );
      setReason((x) => ({ ...x, [g.id]: "" }));
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
          <h1>Mentor Assignment</h1>
          <p className="muted">
            Assign or reassign mentors using expertise and workload capacity
            instead of first-mentor selection.
          </p>
        </div>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <section className="card">
        <div className="mentor-capacity-grid">
          {mentors.map((m) => (
            <div className="mentor-capacity" key={m.id}>
              <b>{m.full_name}</b>
              <small>{m.email}</small>
              <span>
                Groups {m.assigned_groups || 0}/{m.max_groups}
              </span>
              <span>
                Interns {m.assigned_interns || 0}/{m.max_interns}
              </span>
              <small>
                Expertise: {(m.expertise || []).join(", ") || "General"}
              </small>
            </div>
          ))}
        </div>
      </section>
      {groups.map((g) => (
        <section className="card mentor-group" key={g.id}>
          <div>
            <h3>{g.name}</h3>
            <p className="muted">
              {g.lead_mentor_id
                ? "Lead mentor assigned"
                : "No lead mentor assigned"}
            </p>
          </div>
          <div className="mentor-controls">
            <select
              className="input"
              value={selected[g.id] || ""}
              onChange={(e) =>
                setSelected((x) => ({ ...x, [g.id]: e.target.value }))
              }
            >
              <option value="">Select mentor</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} — {m.assigned_groups || 0}/{m.max_groups}{" "}
                  groups, {m.assigned_interns || 0}/{m.max_interns} interns
                </option>
              ))}
            </select>
            {g.lead_mentor_id && (
              <input
                className="input"
                placeholder="Reason required for reassignment"
                value={reason[g.id] || ""}
                onChange={(e) =>
                  setReason((x) => ({ ...x, [g.id]: e.target.value }))
                }
              />
            )}
            <button
              className="btn"
              disabled={
                busy === g.id ||
                !selected[g.id] ||
                (g.lead_mentor_id && !reason[g.id])
              }
              onClick={() => assign(g, !!g.lead_mentor_id)}
            >
              {busy === g.id
                ? "Saving…"
                : g.lead_mentor_id
                  ? "Reassign Mentor"
                  : "Assign Mentor"}
            </button>
          </div>
        </section>
      ))}
    </main>
  );
}

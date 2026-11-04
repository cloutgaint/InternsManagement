"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function AdminMentorsPage() {
  const [newMentor,setNewMentor]=useState({fullName:"",email:"",password:"",expertise:"",maxGroups:5,maxInterns:30}),
    [groups, setGroups] = useState([]),
    [mentors, setMentors] = useState([]),
    [domains, setDomains] = useState([]),
    [selected, setSelected] = useState({}),
    [reason, setReason] = useState({}),
    [feedbackArea,setFeedbackArea]=useState("create"),
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
  async function createMentor(e) {
    e.preventDefault();setFeedbackArea("create");setErr("");setMsg("");
    try {
      setBusy("create");
      const body={...newMentor,expertise:newMentor.expertise.split(",").map(x=>x.trim()).filter(Boolean),maxGroups:Number(newMentor.maxGroups),maxInterns:Number(newMentor.maxInterns)};
      await api("/admin/mentors",{method:"POST",body:JSON.stringify(body)});
      setNewMentor({fullName:"",email:"",password:"",expertise:"",maxGroups:5,maxInterns:30});
      setMsg("Mentor account created. Share the initial credentials securely.");
      await load();
    } catch(e) {setErr(e.message);} finally {setBusy("");}
  }
  async function assign(g, reassign = false) {setFeedbackArea("assignment");
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
      <section className="card"><h2>Create Mentor Login</h2>{feedbackArea==="create"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}<p className="muted">Create an account, then assign the mentor to a group below. Use a unique email and a strong initial password.</p>
        <form className="form-grid" onSubmit={createMentor}>
          <div className="form-field"><label>Mentor Name</label><input className="input" required maxLength={150} value={newMentor.fullName} onChange={e=>setNewMentor(x=>({...x,fullName:e.target.value}))}/></div>
          <div className="form-field"><label>Login Email</label><input className="input" type="email" required value={newMentor.email} onChange={e=>setNewMentor(x=>({...x,email:e.target.value}))}/></div>
          <div className="form-field"><label>Initial Password</label><input className="input" type="password" minLength={12} required autoComplete="new-password" value={newMentor.password} onChange={e=>setNewMentor(x=>({...x,password:e.target.value}))}/><small>12+ characters with uppercase, lowercase, number and symbol.</small></div>
          <div className="form-field"><label>Expertise (comma separated)</label><input className="input" placeholder="Python, React, Cybersecurity" value={newMentor.expertise} onChange={e=>setNewMentor(x=>({...x,expertise:e.target.value}))}/></div>
          <div className="form-field"><label>Maximum Groups</label><input className="input" type="number" min={1} max={100} required value={newMentor.maxGroups} onChange={e=>setNewMentor(x=>({...x,maxGroups:e.target.value}))}/></div>
          <div className="form-field"><label>Maximum Interns</label><input className="input" type="number" min={1} max={1000} required value={newMentor.maxInterns} onChange={e=>setNewMentor(x=>({...x,maxInterns:e.target.value}))}/></div>
          <div className="form-actions"><button className="btn" disabled={busy==="create"}>{busy==="create"?"Creating…":"Create Mentor Account"}</button></div>
        </form>
      </section>
      <section className="card">
        <h2>Available Mentors</h2>{feedbackArea==="assignment"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}<div className="mentor-capacity-grid">
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

"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function AdminGroupsPage() {
  const [composition, setComposition] = useState("SINGLE_DOMAIN");
  const [batches, setBatches] = useState([]),
    [batchId, setBatchId] = useState(""),
    [size, setSize] = useState(5),
    [groups, setGroups] = useState([]),
    [interns, setInterns] = useState([]),
    [edit, setEdit] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [feedbackArea,setFeedbackArea]=useState("generate"),
    [busy, setBusy] = useState(false),
    [activeGroups, setActiveGroups] = useState([]),
    [manage, setManage] = useState(null);
  const loadBase = () =>
    Promise.all([
      api("/admin/batches"),
      api("/admin/interns"),
      api("/admin/groups"),
    ])
      .then(([b, i, g]) => {
        setBatches(b);
        setInterns(i);
        setActiveGroups(g.filter((x) => x.status === "ACTIVE"));
        if (!batchId && b[0]) setBatchId(b[0].id);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    loadBase();
  }, []);
  useEffect(() => {
    if (batchId)
      api("/admin/group-proposals/" + batchId)
        .then(setGroups)
        .catch((e) => setErr(e.message));
  }, [batchId]);
  async function generate() {setFeedbackArea("generate");
    if (!batchId) return;
    try {
      setBusy(true);
      const g = await api("/admin/group-proposals/" + batchId + "/generate", {
        method: "POST",
        body: JSON.stringify({ groupSize: Number(size), composition }),
      });
      setGroups(g);
      setMsg(
        g.length +
          " system group proposal(s) generated. Review before approval.",
      );
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function approve(g) {setFeedbackArea("approve");
    try {
      await api("/admin/group-proposals/" + g.id + "/approve", {
        method: "POST",
        body: "{}",
      });
      setMsg(g.name + " approved and activated.");
      setGroups((x) => x.filter((v) => v.id !== g.id));
    } catch (e) {
      setErr(e.message);
    }
  }
  async function saveEdit() {setFeedbackArea("saveEdit");
    try {
      await api("/admin/group-proposals/" + edit.id, {
        method: "PATCH",
        body: JSON.stringify({
          name: edit.name,
          internIds: edit.members.map((x) => x.internId),
        }),
      });
      setEdit(null);
      setMsg("Group proposal updated.");
      setGroups(await api("/admin/group-proposals/" + batchId));
    } catch (e) {
      setErr(e.message);
    }
  }
  async function mergeGroup(g) {
    const others = activeGroups.filter((x) => x.id !== g.id && x.batch_id === g.batch_id);
    if (!others.length) return setErr("There is no other active group in this batch.");
    const name = prompt("Merge " + g.name + " into which group?\n" + others.map((x) => x.name).join("\n"));
    if (!name) return;
    const target = others.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (!target) return setErr("No active group in this batch has that name.");
    try {
      setErr("");
      await api("/admin/groups/" + g.id + "/merge", { method: "POST", body: JSON.stringify({ targetGroupId: target.id }) });
      setMsg(g.name + " merged into " + target.name + ".");
      await loadBase();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function splitGroup(g) {
    try {
      setErr("");
      const data = await api("/admin/groups/" + g.id + "/manage");
      const list = data.members.map((m, i) => i + 1 + ". " + m.full_name).join("\n");
      const picks = prompt("Numbers of the interns to move (comma separated):\n" + list);
      if (!picks) return;
      const internIds = picks.split(",").map((x) => data.members[Number(x.trim()) - 1]?.intern_id).filter(Boolean);
      const name = prompt("Name for the new group:");
      if (!name?.trim()) return;
      await api("/admin/groups/" + g.id + "/split", { method: "POST", body: JSON.stringify({ internIds, name: name.trim() }) });
      setMsg("Group split. Assign a mentor and project to " + name.trim() + ".");
      await loadBase();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function openManage(g) {
    try {
      setManage(await api("/admin/groups/" + g.id + "/manage"));
    } catch (e) {
      setErr(e.message);
    }
  }
  async function deleteGroup(g) {
    if(!window.confirm("Delete team "+g.name+"? This cannot be undone. Assigned projects, mentors or tasks must be removed first."))return;
    setErr("");setMsg("");setBusy(true);
    try{
      await api("/admin/groups/"+g.id,{method:"DELETE"});
      setMsg(g.name+" deleted.");
      if(manage?.id===g.id)setManage(null);
      await loadBase();
      if(batchId)setGroups(await api("/admin/group-proposals/"+batchId));
    }catch(e){setErr(e.message);}finally{setBusy(false);}
  }
  async function saveMembers() {
    try {
      await api("/admin/groups/" + manage.id + "/members", {
        method: "PATCH",
        body: JSON.stringify({
          internIds: manage.members.map((x) => x.intern_id),
        }),
      });
      setMsg("Group membership rebalanced.");
      setManage(await api("/admin/groups/" + manage.id + "/manage"));
      loadBase();
    } catch (e) {
      setErr(e.message);
    }
  }
  function toggleManage(i) {
    setManage((x) => ({
      ...x,
      members: x.members.some((m) => m.intern_id === i.id)
        ? x.members.filter((m) => m.intern_id !== i.id)
        : [
            ...x.members,
            {
              intern_id: i.id,
              full_name: i.full_name,
              final_domain_id: i.final_domain_id,
              domain_name: i.final_domain,
            },
          ],
    }));
  }
  function toggle(id) {
    setEdit((x) => ({
      ...x,
      members: x.members.some((m) => m.internId === id)
        ? x.members.filter((m) => m.internId !== id)
        : [
            ...x.members,
            { internId: id, name: interns.find((i) => i.id === id)?.full_name },
          ],
    }));
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Automatic Group Proposals</h1>
          <p className="muted">
            The system proposes groups from confirmed domains and capacity
            rules. Admin reviews, edits and approves each proposal.
          </p>
        </div>
      </div>
      <section className="card">
        <div className="form-grid">
          <div className="form-field">
            <label>Batch</label>
            <select
              className="input"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Composition</label>
            <select className="input" value={composition} onChange={(e) => setComposition(e.target.value)}>
              <option value="SINGLE_DOMAIN">Single domain teams</option>
              <option value="CROSS_FUNCTIONAL">Cross-functional teams</option>
            </select>
          </div>
          <div className="form-field">
            <label>Target Group Size</label>
            <input
              className="input"
              type="number"
              min="2"
              max="20"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </div>
        </div>
        <button className="btn" disabled={busy || !batchId} onClick={generate}>
          {busy ? "Generating…" : "Generate System Proposals"}
        </button>
      </section>
      <section className="card workflow-section">
        <h2>Active Groups — Member Rebalancing</h2>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}
        {activeGroups
          .filter((g) => !batchId || g.batch_id === batchId)
          .map((g) => (
            <div className="workflow-row" key={g.id}>
              <div>
                <b>{g.name}</b>
                <div className="muted">
                  {g.type} · {g.status}
                </div>
              </div>
              <div className="action-row">
                <button className="btn secondary" onClick={() => openManage(g)}>
                  Manage Members
                </button>
                <button className="btn secondary" disabled={busy} onClick={() => mergeGroup(g)}>
                  Merge Into…
                </button>
                <button className="btn secondary" disabled={busy} onClick={() => splitGroup(g)}>
                  Split…
                </button>
                <button className="btn secondary" disabled={busy} onClick={() => deleteGroup(g)}>Delete Team</button>
              </div>
            </div>
          ))}
      </section>
      <section className="card workflow-section">
        <h2>Admin Review</h2>{feedbackArea==="approve"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        {!groups.length ? (
          <p className="muted">No draft proposals for this batch.</p>
        ) : (
          groups.map((g) => (
            <div className="group-proposal" key={g.id}>
              <div className="verification-title">
                <div>
                  <h3>{g.name}</h3>
                  <p className="muted">
                    {g.domain_name || g.domainName} ·{" "}
                    {g.member_count ?? g.members?.length ?? 0} interns ·
                    SYSTEM_DRAFT
                  </p>
                </div>
                <div className="action-row">
                  <button
                    className="btn secondary"
                    onClick={() => setEdit({ ...g, members: g.members || [] })}
                  >
                    Review / Edit
                  </button>
                  <button className="btn" onClick={() => approve(g)}>
                    Approve Group
                  </button>
                </div>
              </div>
              <div className="master-tags">
                {(g.members || []).map((m) => (
                  <span key={m.internId}>{m.name}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
      {edit && (
        <div className="modal-backdrop" onMouseDown={() => setEdit(null)}>
          <section
            className="modal-card assessment-review"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="verification-title">
              <h2>Edit System Proposal</h2>{feedbackArea==="saveEdit"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
              <button className="icon-close" onClick={() => setEdit(null)}>
                ×
              </button>
            </div>
            <label>
              Group Name
              <input
                className="input"
                value={edit.name}
                onChange={(e) =>
                  setEdit((x) => ({ ...x, name: e.target.value }))
                }
              />
            </label>
            <div className="group-member-picker">
              {interns
                .filter((i) => i.batch_id === batchId && i.final_domain_id)
                .map((i) => (
                  <label key={i.id}>
                    <input
                      type="checkbox"
                      checked={edit.members.some((m) => m.internId === i.id)}
                      onChange={() => toggle(i.id)}
                    />
                    <span>
                      {i.full_name} · {i.domain_name || "Confirmed domain"}
                    </span>
                  </label>
                ))}
            </div>
            <div className="form-actions">
              <button className="btn" onClick={saveEdit}>
                Save Proposal
              </button>
            </div>
          </section>
        </div>
      )}
      {manage && (
        <div className="modal-backdrop" onMouseDown={() => setManage(null)}>
          <section
            className="modal-card assessment-review"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="verification-title">
              <div>
                <h2>Rebalance {manage.name}</h2>
                <p className="muted">
                  Add/remove eligible interns. Batch and active-group conflicts are validated by the server.
                </p>
              </div>
              <button className="icon-close" onClick={() => setManage(null)}>
                ×
              </button>
            </div>
            <div className="group-member-picker">
              {interns
                .filter(
                  (i) =>
                    i.batch_id === manage.batch_id &&
                    (manage.type !== "SINGLE_DOMAIN" ||
                      !manage.members.length ||
                      i.final_domain_id === manage.members[0].final_domain_id),
                )
                .map((i) => (
                  <label key={i.id}>
                    <input
                      type="checkbox"
                      checked={manage.members.some((m) => m.intern_id === i.id)}
                      onChange={() => toggleManage(i)}
                    />
                    <span>
                      {i.full_name} · {i.final_domain || "Confirmed domain"}
                    </span>
                  </label>
                ))}
            </div>
            <p className="muted">{manage.members.length} member(s) selected</p>
            <div className="form-actions">
              <button className="btn" onClick={saveMembers}>
                Save Rebalanced Group
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

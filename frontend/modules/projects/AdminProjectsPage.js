"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
const empty = () => ({
  title: "",
  description: "",
  domainIds: [],
  milestones: [{ title: "", week: "", output: "" }],
  toolsMethods: "",
  resources: "",
  durationSuitability: "",
  deliverableTypes: [],
  status: "ACTIVE",
});
export default function AdminProjectsPage() {
  const [projects, setProjects] = useState([]),
    [domains, setDomains] = useState([]),
    [colleges,setColleges]=useState([]),[batches,setBatches]=useState([]),[interns,setInterns]=useState([]),[projectGroup,setProjectGroup]=useState({projectId:"",collegeId:"",batchId:"",internIds:[]}),
    [groups, setGroups] = useState([]),
    [assignments, setAssignments] = useState([]),
    [form, setForm] = useState(empty()),
    [editId, setEditId] = useState(""),
    [choice, setChoice] = useState({}),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [feedbackArea,setFeedbackArea]=useState("save");
  const load = () =>
    Promise.all([
      api("/admin/projects"),
      api("/admin/domains"),
      api("/admin/groups"),
      api("/admin/project-assignments"),
      api("/admin/colleges"),api("/admin/batches"),api("/admin/interns"),
    ])
      .then(([p, d, g, a, co, ba, ins]) => {setColleges(co);setBatches(ba);setInterns(ins);
        setProjects(p);
        setDomains(d);
        setGroups(g.filter((x) => x.status === "ACTIVE"));
        setAssignments(a);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  function toggleDomain(id) {
    setForm((x) => ({
      ...x,
      domainIds: x.domainIds.includes(id)
        ? x.domainIds.filter((v) => v !== id)
        : [...x.domainIds, id],
    }));
  }
  function milestone(i, k, v) {
    setForm((x) => ({
      ...x,
      milestones: x.milestones.map((m, n) => (n === i ? { ...m, [k]: v } : m)),
    }));
  }
  async function save(e) {setFeedbackArea("save");
    e.preventDefault();
    try {
      const path = editId ? "/admin/projects/" + editId : "/admin/projects";
      await api(path, {
        method: editId ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      setMsg(editId ? "Project updated." : "Project created.");
      setForm(empty());
      setEditId("");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  async function createProjectGroup(e){
    e.preventDefault();setErr("");setMsg("");setFeedbackArea("group");
    try{
      const result=await api("/admin/project-groups",{method:"POST",body:JSON.stringify({projectId:projectGroup.projectId,batchId:projectGroup.batchId,internIds:projectGroup.internIds})});
      setMsg("Project group created with "+result.internCount+" intern(s). Assign their individual roles and mentors in Internship Management.");
      setProjectGroup({projectId:"",collegeId:"",batchId:"",internIds:[]});await load();
    }catch(e){setErr(e.message);}
  }
  function edit(p) {
    setEditId(p.id);
    setForm({
      title: p.title || "",
      description: p.description || "",
      domainIds: p.domain_ids || [],
      milestones: p.milestones?.length
        ? p.milestones
        : [{ title: "", week: "", output: "" }],
      toolsMethods: p.tools_methods || "",
      resources: p.resources || "",
      durationSuitability: p.duration_suitability || "",
      deliverableTypes: p.deliverable_types || [],
      status: p.status || "ACTIVE",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function assign(g) {setFeedbackArea("assign");
    const projectId = choice[g.id];
    if (!projectId) return;
    try {
      await api("/admin/project-assignments", {
        method: "POST",
        body: JSON.stringify({ projectId, groupId: g.id }),
      });
      setMsg("Project assigned to " + g.name + ".");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Project Master</h1>
          <p className="muted">
            Configure complete internship projects, milestones, resources, tools
            and required deliverables.
          </p>
        </div>
      </div>
      <section className="card workflow-section"><h2>Project → College → Batch → Interns</h2><p className="muted">The project itself forms the group. Interns already assigned to an active project cannot be selected again.</p>{feedbackArea==="group"&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}<form onSubmit={createProjectGroup} className="form-grid"><label>Project<select className="input" required value={projectGroup.projectId} onChange={e=>setProjectGroup(x=>({...x,projectId:e.target.value}))}><option value="">Select existing project</option>{projects.filter(p=>p.status==="ACTIVE").map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label><label>College<select className="input" required value={projectGroup.collegeId} onChange={e=>setProjectGroup(x=>({...x,collegeId:e.target.value,batchId:"",internIds:[]}))}><option value="">Select college</option>{colleges.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Batch<select className="input" required value={projectGroup.batchId} onChange={e=>setProjectGroup(x=>({...x,batchId:e.target.value,internIds:[]}))}><option value="">Select batch</option>{batches.filter(b=>b.college_id===projectGroup.collegeId).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><div style={{gridColumn:"1 / -1"}}><b>Available interns</b>{interns.filter(i=>i.batch_id===projectGroup.batchId&&!groups.some(g=>g.batch_id===projectGroup.batchId&&g.status==="ACTIVE"&&false)).map(i=><label key={i.id} style={{display:"flex",gap:8,marginTop:8}}><input type="checkbox" checked={projectGroup.internIds.includes(i.id)} onChange={e=>setProjectGroup(x=>({...x,internIds:e.target.checked?[...x.internIds,i.id]:x.internIds.filter(id=>id!==i.id)}))}/>{i.full_name}</label>)}</div><div className="form-actions"><button className="btn" disabled={!projectGroup.internIds.length}>Create Project Group</button></div></form></section>
      <section className="card">
        <h2>{editId ? "Edit Project" : "Create Project"}</h2>{["save"].includes(feedbackArea)&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="form-field">
              <label>Project Title</label>
              <input
                className="input"
                required
                value={form.title}
                onChange={(e) =>
                  setForm((x) => ({ ...x, title: e.target.value }))
                }
              />
            </div>
            <div className="form-field">
              <label>Duration Suitability</label>
              <input
                className="input"
                placeholder="45 days / 4 months / Both"
                value={form.durationSuitability}
                onChange={(e) =>
                  setForm((x) => ({
                    ...x,
                    durationSuitability: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <label>
            Description
            <textarea
              className="input project-textarea"
              value={form.description}
              onChange={(e) =>
                setForm((x) => ({ ...x, description: e.target.value }))
              }
            />
          </label>
          <h3>Applicable Domains</h3>
          <div className="master-tags">
            {domains.map((d) => (
              <label key={d.id}>
                <input
                  type="checkbox"
                  checked={form.domainIds.includes(d.id)}
                  onChange={() => toggleDomain(d.id)}
                />{" "}
                {d.name}
              </label>
            ))}
          </div>
          <div className="form-grid">
            <label>
              Tools / Methods
              <textarea
                className="input"
                value={form.toolsMethods}
                onChange={(e) =>
                  setForm((x) => ({ ...x, toolsMethods: e.target.value }))
                }
              />
            </label>
            <label>
              Resources / References
              <textarea
                className="input"
                value={form.resources}
                onChange={(e) =>
                  setForm((x) => ({ ...x, resources: e.target.value }))
                }
              />
            </label>
          </div>
          <h3>Milestones</h3>
          {form.milestones.map((m, i) => (
            <div className="project-milestone" key={i}>
              <input
                className="input"
                placeholder="Milestone title"
                value={m.title}
                onChange={(e) => milestone(i, "title", e.target.value)}
              />
              <input
                className="input"
                placeholder="Week / target"
                value={m.week}
                onChange={(e) => milestone(i, "week", e.target.value)}
              />
              <input
                className="input"
                placeholder="Expected output"
                value={m.output}
                onChange={(e) => milestone(i, "output", e.target.value)}
              />
              {form.milestones.length > 1 && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() =>
                    setForm((x) => ({
                      ...x,
                      milestones: x.milestones.filter((_, n) => n !== i),
                    }))
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              setForm((x) => ({
                ...x,
                milestones: [
                  ...x.milestones,
                  { title: "", week: "", output: "" },
                ],
              }))
            }
          >
            + Milestone
          </button>
          <h3>Deliverable Types</h3>
          <div className="deliverable-picks">
            {[
              "GitHub Repository",
              "Source Code",
              "Report",
              "PPT",
              "Demo Video",
              "Deployed URL",
              "Dataset",
              "Notebook",
            ].map((d) => (
              <label key={d}>
                <input
                  type="checkbox"
                  checked={form.deliverableTypes.includes(d)}
                  onChange={(e) =>
                    setForm((x) => ({
                      ...x,
                      deliverableTypes: e.target.checked
                        ? [...x.deliverableTypes, d]
                        : x.deliverableTypes.filter((v) => v !== d),
                    }))
                  }
                />
                {d}
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn">
              {editId ? "Save Changes" : "Create Project"}
            </button>
            {editId && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setEditId("");
                  setForm(empty());
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>
      <section className="card workflow-section">
        <h2>Project Library</h2>
        {projects.map((p) => (
          <div className="workflow-row" key={p.id}>
            <div>
              <b>{p.title}</b>
              <div className="muted">
                {p.duration_suitability || "Any duration"} ·{" "}
                {(p.milestones || []).length} milestones ·{" "}
                {(p.deliverable_types || []).join(", ")}
              </div>
            </div>
            <button className="btn secondary" onClick={() => edit(p)}>
              Edit
            </button>
          </div>
        ))}
      </section>
      <section className="card workflow-section">
        <h2>Project Assignment</h2>{["assign"].includes(feedbackArea)&&<>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}</>}
        {groups.map((g) => {
          const current = assignments.find(
            (a) => a.group_id === g.id && a.status === "ASSIGNED",
          );
          return (
            <div className="workflow-row" key={g.id}>
              <div>
                <b>{g.name}</b>
                <div className="muted">
                  Current: {current?.project_title || "Not assigned"}
                </div>
              </div>
              <div className="action-row">
                <select
                  className="input"
                  value={choice[g.id] || ""}
                  onChange={(e) =>
                    setChoice((x) => ({ ...x, [g.id]: e.target.value }))
                  }
                >
                  <option value="">Select project</option>
                  {projects
                    .filter((p) => p.status === "ACTIVE")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
                <button
                  className="btn"
                  disabled={!choice[g.id]}
                  onClick={() => assign(g)}
                >
                  {current ? "Replace Project" : "Assign Project"}
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

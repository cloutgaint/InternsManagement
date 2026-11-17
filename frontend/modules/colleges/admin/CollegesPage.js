"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createCollege,
  getColleges,
  updateCollege,
  deleteCollege,
} from "../api/colleges.api";
import { api } from "@/shared/api/client";
const blank = {
  name: "",
  code: "",
  university: "",
  college_type: "",
  state: "",
  district: "", 
  city: "",
  address: "",
  pin_code: "",
  email: "",
  phone: "",
  website: "",
  coordinator_name: "",
  coordinator_email: "",
  coordinator_mobile: "",
  active: true,
};
const groups = [
  {
    title: "Basic Information",
    fields: [
      ["name", "Official College Name", true],
      ["code", "College Code", true],
      ["university", "University / Affiliation", true],
      ["college_type", "College Type", true],
    ],
  },
  {
    title: "Location Details",
    fields: [
      ["state", "State", true],
      ["city", "City / Town", true],
      ["address", "Full College Address", true],
    ],
  },
  {
    title: "Contact & Coordinator Details",
    fields: [
      ["email", "Official College Email"],
      ["phone", "College Contact Number"],
      ["website", "College Website"],
      ["coordinator_name", "Coordinator Name"],
      ["coordinator_mobile", "Coordinator Mobile"],
    ],
  },
];
const types = [
  "Engineering College",
  "Degree College",
  "Polytechnic",
  "University",
  "Other",
];
function CollegeFields({ value, onChange, required }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  return (
    <>
      {groups.map((group) => (
        <div key={group.title} style={{ gridColumn: "1 / -1" }}>
          <h3 className="form-section-title">{group.title}</h3>
          <div className="form-grid">
            {group.fields.map(([key, label, mandatory]) => (
              <div className="form-field" key={key}>
                <label
                  htmlFor={"college-" + (required ? "new-" : "edit-") + key}
                >
                  {label}
                  {required && mandatory ? " *" : ""}
                </label>
                {key === "college_type" ? (
                  <select
                    id={"college-" + (required ? "new-" : "edit-") + key}
                    className="input"
                    value={value[key] || ""}
                    onChange={(e) => set(key, e.target.value)}
                    required={required && !!mandatory}
                  >
                    <option value="">Select college type</option>
                    {types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                ) : key === "address" ? (
                  <textarea
                    id={"college-" + (required ? "new-" : "edit-") + key}
                    className="input"
                    rows={2}
                    value={value[key] || ""}
                    onChange={(e) => set(key, e.target.value)}
                    required={required && !!mandatory}
                  />
                ) : (
                  <input
                    id={"college-" + (required ? "new-" : "edit-") + key}
                    className="input"
                    type={
                      key.includes("email")
                        ? "email"
                        : key === "website"
                          ? "url"
                          : "text"
                    }
                    inputMode={
                      key === "pin_code" || key === "coordinator_mobile"
                        ? "numeric"
                        : undefined
                    }
                    maxLength={
                      key === "pin_code"
                        ? 6
                        : key === "coordinator_mobile"
                          ? 10
                          : undefined
                    }
                    pattern={
                      key === "pin_code"
                        ? "[0-9]{6}"
                        : key === "coordinator_mobile"
                          ? "[0-9]{10}"
                          : undefined
                    }
                    value={value[key] || ""}
                    onChange={(e) => set(key, e.target.value)}
                    required={required && !!mandatory}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="form-field" style={{ gridColumn: "1 / -1" }}>
        <label>
          <input
            type="checkbox"
            checked={!!value.active}
            onChange={(e) => set("active", e.target.checked)}
          />{" "}
          Active for Student Registration
        </label>
      </div>
    </>
  );
}
export default function Page() {
  const [accounts, setAccounts] = useState([]),
    [account, setAccount] = useState({
      collegeId: "",
      fullName: "",
      email: "",
      password: "",
    }),
    [rows, setRows] = useState([]),
    [form, setForm] = useState(blank),
    [edit, setEdit] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    Promise.all([getColleges(), api("/college-coordinator/accounts")])
      .then(([c, a]) => {
        setRows(c);
        setAccounts(a);
      })
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function add(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      setBusy(true);
      await createCollege(form);
      setForm({ ...blank });
      setMsg("College added to the registration master.");
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      setBusy(true);
      await updateCollege(edit.id, edit);
      setEdit(null);
      setMsg("College updated successfully.");
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function createCoordinator(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      setBusy(true);
      await api("/college-coordinator/accounts", {
        method: "POST",
        body: JSON.stringify(account),
      });
      setAccount({ collegeId: "", fullName: "", email: "", password: "" });
      setMsg(
        "College coordinator login created. Share credentials securely and ask the coordinator to configure MFA.",
      );
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleCoordinator(a) {
    try {
      setBusy(true);
      await api("/college-coordinator/accounts/" + a.user_id, {
        method: "PATCH",
        body: JSON.stringify({ active: !a.is_active }),
      });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(c) {
    if (
      !window.confirm(
        `Remove "${c.name}" from College Master and student registration? Existing student and internship history will be preserved.`,
      )
    )
      return;
    setErr("");
    setMsg("");
    try {
      setBusy(true);
      await deleteCollege(c.id);
      setMsg(
        "College removed from the master list. Historical records are preserved.",
      );
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="wrap admin-colleges-page">
      <div className="intern-head">
        <div>
          <h1>College Master</h1>
          <p className="muted">
            Manage college profiles available to students during registration.
            Inactive colleges are hidden from new applications.
          </p>
        </div>
        <span className="badge">
          {rows.filter((x) => x.active).length} active
        </span>
      </div>
      <section className="card">
        <h2>Add College</h2>{err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}
        <form className="form-grid" onSubmit={add}>
          <CollegeFields value={form} onChange={setForm} required />
          <div className="form-actions">
            <button className="btn" disabled={busy}>
              {busy ? "Saving…" : "Add College"}
            </button>
          </div>
        </form>
      </section>
      <section className="card">
        <h2>Semester Batch Management</h2>
        <p className="muted">
          Create separate batches for each college and semester. Batch codes
          must be unique.
        </p>
        <Link className="btn" href="/admin/batches">
          Add / View Semester Batches
        </Link>
      </section>
      <section className="card">
        <h2>Create College Coordinator Login</h2>
        <p className="muted">
          Only GAINT Admin can create accounts. Each coordinator can view only
          their college.
        </p>
        <form className="form-grid" onSubmit={createCoordinator}>
          <div className="form-field">
            <label>College</label>
            <select
              className="input"
              required
              value={account.collegeId}
              onChange={(e) =>
                setAccount((x) => ({ ...x, collegeId: e.target.value }))
              }
            >
              <option value="">Select college</option>
              {rows
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="form-field">
            <label>Coordinator Name</label>
            <input
              className="input"
              required
              value={account.fullName}
              onChange={(e) =>
                setAccount((x) => ({ ...x, fullName: e.target.value }))
              }
            />
          </div>
          <div className="form-field">
            <label>Login Email</label>
            <input
              className="input"
              type="email"
              required
              value={account.email}
              onChange={(e) =>
                setAccount((x) => ({ ...x, email: e.target.value }))
              }
            />
          </div>
          <div className="form-field">
            <label>Initial Password (12+ characters)</label>
            <input
              className="input"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
              value={account.password}
              onChange={(e) =>
                setAccount((x) => ({ ...x, password: e.target.value }))
              }
            />
          </div>
          <div className="form-actions">
            <button className="btn" disabled={busy}>
              Create Coordinator Login
            </button>
          </div>
        </form>
      </section>
      <section className="card workflow-section">
        <h2>Coordinator Accounts</h2>
        {accounts.map((a) => (
          <div className="workflow-row" key={a.user_id}>
            <div>
              <b>{a.full_name}</b>
              <p className="muted">
                {a.college_name} · {a.email} ·{" "}
                {a.is_active ? "Active" : "Disabled"}
              </p>
            </div>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => toggleCoordinator(a)}
            >
              {a.is_active ? "Disable Login" : "Enable Login"}
            </button>
          </div>
        ))}
      </section>
      <section className="card workflow-section">
        <h2>Managed Colleges</h2>
        {!rows.length ? (
          <p className="muted">No colleges have been added yet.</p>
        ) : (
          rows.map((c) => (
            <div className="workflow-row" key={c.id}>
              {edit?.id === c.id ? (
                <form onSubmit={save} style={{ width: "100%" }}>
                  <div className="form-grid">
                    <CollegeFields value={edit} onChange={setEdit} />
                  </div>
                  <div className="action-row">
                    <button className="btn" disabled={busy}>
                      Save Changes
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => setEdit(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div>
                    <b>{c.name}</b>
                    <p className="muted">
                      {[c.code, c.university, c.city, c.district, c.state]
                        .filter(Boolean)
                        .join(" · ") || "College profile incomplete"}
                    </p>
                  </div>
                  <div className="action-row">
                    <span
                      className={
                        "status-pill " + (c.active ? "status-verified" : "")
                      }
                    >
                      {c.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => setEdit({ ...blank, ...c })}
                    >
                      Edit
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => remove(c)}
                      style={{ color: "#a32626" }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </section>
      <style jsx global>{`.admin-colleges-page{max-width:1180px;margin-inline:auto;padding-bottom:72px;color:#111}
.admin-colleges-page .intern-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin:28px 0 24px}
.admin-colleges-page .intern-head h1{font-size:clamp(27px,3vw,34px);font-weight:700;letter-spacing:-.035em;color:#111;margin:0 0 8px}
.admin-colleges-page .intern-head .muted{font-size:14px;line-height:1.65;color:#525252;max-width:760px}
.admin-colleges-page>.card{background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:25px 27px;margin:0 0 17px;box-shadow:0 4px 18px rgba(15,23,42,.035)}
.admin-colleges-page>.card h2{font-size:19px;font-weight:700;letter-spacing:-.02em;color:#111;margin:0 0 15px}
.admin-colleges-page .form-section-title{font-size:13px;font-weight:700;color:#111;margin:8px 0 12px;padding-bottom:9px;border-bottom:1px solid #edf0f4}
.admin-colleges-page .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 18px}
.admin-colleges-page .form-field{display:flex;flex-direction:column;gap:7px;min-width:0}
.admin-colleges-page .form-field label{font-size:12px;font-weight:650;color:#262626}
.admin-colleges-page .input{width:100%;min-width:0;min-height:44px;box-sizing:border-box;padding:10px 12px;border:1.5px solid #93b4ed;border-radius:9px;background:#fff;color:#111;font-size:14px;transition:border-color .15s,box-shadow .15s}
.admin-colleges-page textarea.input{min-height:78px;resize:vertical}
.admin-colleges-page .input:hover{border-color:#2563eb}
.admin-colleges-page .input:focus{outline:0;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.13)}
.admin-colleges-page .form-actions{display:flex;justify-content:flex-start;align-items:center;grid-column:1/-1;margin-top:3px}
.admin-colleges-page .btn{display:inline-flex;align-items:center;justify-content:center;min-height:43px;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:650;line-height:1.2;text-align:center}
.admin-colleges-page .btn:not(.secondary){background:#075b3b;color:#fff;border:1px solid #075b3b}
.admin-colleges-page .btn:not(.secondary):hover{background:#064b32;box-shadow:0 3px 9px rgba(7,91,59,.16)}
.admin-colleges-page .btn.secondary{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.admin-colleges-page .btn.secondary:hover{background:#2563eb;color:#fff;border-color:#2563eb}
.admin-colleges-page button:focus-visible,.admin-colleges-page input:focus-visible,.admin-colleges-page select:focus-visible,.admin-colleges-page textarea:focus-visible{outline:3px solid #bfdbfe;outline-offset:2px}
.admin-colleges-page .workflow-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 0;border-top:1px solid #edf0f4}
.admin-colleges-page .workflow-row:last-child{padding-bottom:0}
.admin-colleges-page .workflow-row>div:first-child{flex:1;min-width:0}
.admin-colleges-page .workflow-row b{font-size:14px;font-weight:700;color:#111}
.admin-colleges-page .workflow-row .muted{font-size:12px;line-height:1.55;color:#525252;margin:5px 0 0;overflow-wrap:anywhere}
.admin-colleges-page .workflow-row .action-row{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.admin-colleges-page .status-pill{font-size:11px;font-weight:700;letter-spacing:0;padding:6px 10px;border-radius:999px;white-space:nowrap}
.admin-colleges-page .college-edit{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;width:100%}
.admin-colleges-page .college-edit label{grid-column:1/-1;font-size:12px;color:#262626}
@media(max-width:760px){.admin-colleges-page>.card{padding:20px 17px}.admin-colleges-page .workflow-row{align-items:flex-start;flex-direction:column}.admin-colleges-page .workflow-row .action-row{justify-content:flex-start}.admin-colleges-page .college-edit{grid-template-columns:1fr}}
@media(max-width:520px){.admin-colleges-page .form-grid{grid-template-columns:1fr}.admin-colleges-page .intern-head{flex-direction:column}.admin-colleges-page>.card .form-actions .btn{width:100%}}`}</style>
    </main>
  );
}

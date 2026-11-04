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
    <main className="wrap">
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
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <section className="card">
        <h2>Add College</h2>
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
    </main>
  );
}

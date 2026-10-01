"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
export default function Page() {
  const [rows, setRows] = useState([]),
    [form, setForm] = useState({ name: "", university: "" }),
    [edit, setEdit] = useState(null),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/admin/colleges")
      .then(setRows)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  async function add(e) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) return setErr("College name is required.");
    try {
      setBusy(true);
      await api("/admin/colleges", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", university: "" });
      setMsg("College added to the registration master.");
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(c) {
    try {
      setBusy(true);
      await api("/admin/colleges/" + c.id, {
        method: "PATCH",
        body: JSON.stringify({
          name: edit.name,
          university: edit.university,
          active: edit.active,
        }),
      });
      setEdit(null);
      setMsg("College updated successfully.");
      load();
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
            Control the colleges students can select during registration.
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
          <div className="form-field">
            <label>Official College Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-field">
            <label>University / Affiliation</label>
            <input
              className="input"
              value={form.university}
              onChange={(e) =>
                setForm((x) => ({ ...x, university: e.target.value }))
              }
            />
          </div>
          <div className="form-actions">
            <button className="btn" disabled={busy}>
              Add College
            </button>
          </div>
        </form>
      </section>
      <section className="card workflow-section">
        <h2>Managed Colleges</h2>
        {!rows.length ? (
          <p className="muted">No colleges have been added yet.</p>
        ) : (
          rows.map((c) => (
            <div className="workflow-row" key={c.id}>
              {edit?.id === c.id ? (
                <>
                  <div className="college-edit">
                    <input
                      className="input"
                      value={edit.name}
                      onChange={(e) =>
                        setEdit((x) => ({ ...x, name: e.target.value }))
                      }
                    />
                    <input
                      className="input"
                      value={edit.university || ""}
                      onChange={(e) =>
                        setEdit((x) => ({ ...x, university: e.target.value }))
                      }
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={edit.active}
                        onChange={(e) =>
                          setEdit((x) => ({ ...x, active: e.target.checked }))
                        }
                      />{" "}
                      Active for registration
                    </label>
                  </div>
                  <div className="action-row">
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => save(c)}
                    >
                      Save
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => setEdit(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <b>{c.name}</b>
                    <p className="muted">
                      {c.university || "University not specified"} ·{" "}
                      {c.active ? "Active" : "Inactive"}
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
                      onClick={() => setEdit({ ...c })}
                    >
                      Edit
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

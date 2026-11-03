"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
export default function AdminAuditPage() {
  const [rows, setRows] = useState([]),
    [q, setQ] = useState(""),
    [page,setPage] = useState(1);
  const pageSize=10;
  useEffect(() => {
    api("/admin/audit").then(setRows);
  }, []);
  const r = rows.filter((x) =>
    (x.action + " " + (x.entity_type || "") + " " + (x.entity_id || ""))
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  const totalPages=Math.max(1,Math.ceil(r.length/pageSize));
  const currentPage=Math.min(page,totalPages);
  const visible=r.slice((currentPage-1)*pageSize,currentPage*pageSize);
  return (
    <main className="wrap">
      <div className="intern-head">
        <div>
          <h1>Audit Log</h1>
          <p className="muted">
            Immutable activity history for critical administrative and mentor
            workflow actions.
          </p>
        </div>
      </div>
      <input
        className="input"
        placeholder="Search action, entity type or ID"
        value={q}
        onChange={(e) => {setQ(e.target.value);setPage(1);}}
      />
      <section className="card audit-list">
        {visible.map((x) => (
          <article className="audit-row" key={x.id}>
            <div>
              <b>{x.action}</b>
              <small>
                {x.entity_type} · {x.entity_id}
              </small>
            </div>
            <div>
              <span>{new Date(x.created_at).toLocaleString()}</span>
              <small>{x.ip || ""}</small>
            </div>
            <details>
              <summary>Change details</summary>
              <pre>
                {JSON.stringify(
                  { before: x.before_data, after: x.after_data },
                  null,
                  2,
                )}
              </pre>
            </details>
          </article>
        ))}
      </section>
      <div className="admin-pagination"><span>{r.length ? `${(currentPage-1)*pageSize+1}–${Math.min(currentPage*pageSize,r.length)} of ${r.length}` : "No audit entries"}</span><div className="action-row"><button className="btn secondary" type="button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</button><span>Page {currentPage} of {totalPages}</span><button className="btn secondary" type="button" disabled={currentPage===totalPages} onClick={()=>setPage(currentPage+1)}>Next</button></div></div>
    </main>
  );
}

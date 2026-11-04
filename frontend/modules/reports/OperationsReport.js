"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
function Table({ title, rows, columns }) {
  return (
    <section className="card workflow-section">
      <h2>{title}</h2>
      {rows?.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{columns.map(([, label]) => <th key={label} style={{ textAlign: "left", padding: 6 }}>{label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{columns.map(([k, label]) => <td key={label} style={{ padding: 6 }}>{r[k] === null || r[k] === undefined ? "—" : String(r[k]).replaceAll("_", " ")}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : <p className="muted">No data yet.</p>}
    </section>
  );
}
export default function OperationsReport() {
  const [d, setD] = useState(null), [err, setErr] = useState("");
  useEffect(() => { api("/admin/reports/operations").then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="error" role="alert">{err}</p>;
  if (!d) return <p className="muted">Loading operational reports…</p>;
  const pref = d.preferenceVsConfirmed || {};
  const status = [["status", "Status"], ["n", "Count"]];
  return (
    <>
      <p className="muted">Average proof verification turnaround: {d.proofTurnaroundHours ?? "—"} hours. Interns placed in their first-choice domain: {pref.first_choice ?? 0} of {pref.confirmed ?? 0} confirmed.</p>
      <Table title="Interns by College" rows={d.byCollege} columns={[["name", "College"], ["interns", "Interns"]]} />
      <Table title="Interns by Batch" rows={d.byBatch} columns={[["name", "Batch"], ["status", "Status"], ["interns", "Interns"]]} />
      <Table title="Interns by Confirmed Domain" rows={d.byDomain} columns={[["name", "Domain"], ["interns", "Interns"]]} />
      <Table title="College Proof Status" rows={d.proofStatus} columns={status} />
      <Table title="Proof Overrides" rows={d.overrides} columns={[["full_name", "Intern"], ["reason", "Reason"], ["override_due_date", "Proof Due"]]} />
      <Table title="College Date Mismatches" rows={d.mismatches} columns={[["full_name", "Intern"], ["batch_name", "Batch"], ["intern_start", "From"], ["intern_end", "To"], ["override_reason", "Override"]]} />
      <Table title="Offer Letters" rows={d.offerStatus} columns={status} />
      <Table title="Face Enrollment" rows={d.faceStatus} columns={status} />
      <Table title="Assessment Sections" rows={d.assessment} columns={[["name", "Assessment"], ["section", "Section"], ["avg_score", "Average Score"], ["attempts", "Attempts"]]} />
      <Table title="Daily Report Compliance" rows={d.dailyCompliance} columns={[["batch_name", "Batch"], ["expected", "Days Present"], ["morning", "Morning Reports"], ["evening", "Evening Reports"]]} />
      <Table title="Weekly Tasks" rows={d.tasks} columns={[["title", "Task"], ["status", "Status"], ["submissions", "Submissions"], ["late", "Late"], ["pending_evaluation", "To Evaluate"]]} />
      <Table title="Fortnight Reviews" rows={d.reviews} columns={[["group_name", "Group"], ["period_no", "Fortnight"], ["status", "Status"], ["group_marks", "Group Marks"], ["individual_avg", "Individual Average"]]} />
      <Table title="Mentor Workload" rows={d.mentorLoad} columns={[["full_name", "Mentor"], ["groups", "Groups"], ["max_groups", "Max Groups"], ["interns", "Interns"], ["max_interns", "Max Interns"]]} />
      <Table title="Internship Outcomes" rows={d.outcomes} columns={[["outcome", "Outcome"], ["n", "Count"]]} />
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
const statusLabel = (value) => String(value || "Released").toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export default function InternTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState({});
  useEffect(() => {
    api("/intern/dashboard").then((data) => setTasks(data.tasks || [])).catch((error) => setErr(error.message));
  }, []);
  return (
    <main className="mx-auto max-w-[1100px] px-5 pb-10 pt-6 text-black">
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold text-black">Weekly tasks</h1>
        <p className="text-sm text-[#4b5563]">Released assignments. Work submission and reviews are handled offline.</p>
      </div>
      {err && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">{err}</p>}
      {tasks.length > 0 && <div className="mb-3 text-sm font-medium text-[#4b5563]">{tasks.length} released {tasks.length === 1 ? "task" : "tasks"}</div>}
      <div className="space-y-3">
        {tasks.map((task, index) => {
          const open = Boolean(expanded[task.id]);
          return (
            <section className="overflow-hidden rounded-2xl border border-[#dce5e1] bg-white shadow-[0_5px_20px_rgba(0,0,0,.035)]" key={task.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs font-semibold text-[#52665b]">Assignment {index + 1}</p>
                  <h2 className="m-0 text-base font-bold leading-snug text-black">{task.title}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex min-h-7 items-center justify-center rounded-full bg-[#e8f3eb] px-3 text-xs font-semibold text-black">{statusLabel(task.status)}</span>
                  <button type="button" aria-expanded={open} aria-controls={`task-details-${task.id}`} onClick={() => setExpanded((prev) => ({ ...prev, [task.id]: !prev[task.id] }))} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-blue-500 bg-white px-3 text-sm font-semibold text-black transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">{open ? "Hide details" : "View details"}</button>
                </div>
              </div>
              {open && <div id={`task-details-${task.id}`} className="space-y-3 border-t border-[#e4ebe7] bg-[#f8faf9] px-5 py-4 text-sm leading-6 text-black">
                {task.description && <div><h3 className="mb-1 font-semibold">Description</h3><p className="m-0 whitespace-pre-wrap">{task.description}</p></div>}
                {task.expected_output && <div><h3 className="mb-1 font-semibold">Expected output</h3><p className="m-0 whitespace-pre-wrap">{task.expected_output}</p></div>}
              </div>}
            </section>
          );
        })}
        {!tasks.length && !err && <section className="rounded-2xl border border-[#dce5e1] bg-white p-6 text-sm text-[#4b5563]">No released tasks are assigned to you.</section>}
      </div>
    </main>
  );
}

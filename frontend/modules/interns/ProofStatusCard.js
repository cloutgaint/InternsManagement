"use client";
import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";
const PROOF_TYPES = ["College Allotment Order", "No Objection Certificate (NOC)", "Internship Permission / Recommendation Letter", "Bonafide Certificate with internship permission", "Other"];

const button =
  "cursor-pointer rounded-[9px] border-0 font-bold transition-all duration-[180ms] ease-[ease] hover:-translate-y-px hover:bg-[#06472f] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-55";
const s = {
  card: "rounded-[14px] border border-[#dbe5df] bg-white p-[18px] shadow-[0_8px_28px_rgba(20,45,31,.055)]",
  title: "mt-0 text-[19px]",
  success: "rounded-lg border border-current bg-[#e8f7ed] p-2.5 text-[#176331]",
  error: "rounded-lg border border-current bg-[#ffe9e9] p-2.5 text-[#8b1f1f]",
  row: "flex justify-between gap-4 border-b border-[#e4ebe7] py-[11px] last:border-b-0",
  pill: "whitespace-nowrap rounded-full bg-[#edf2ef] px-2 py-[5px] text-[10px] font-extrabold",
  muted: "text-[#65756c]",
  fileBtn: button + " bg-[#e8f0eb] px-4 py-[11px] text-[#123]",
  alert: "mx-0 my-3.5 flex flex-col gap-1.5 rounded-[10px] border border-[#ecd39e] bg-[#fff4df] px-[15px] py-[13px] text-[#745514]",
  form: "grid grid-cols-2 gap-x-[22px] gap-y-0.5 max-[760px]:grid-cols-1",
  label: "mb-px block text-[14px] font-semibold",
  input: "mb-2.5 mt-[7px] min-h-[42px] w-full rounded-lg border border-[#cbd9d1] bg-white p-[11px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#4b8b6d] focus:shadow-[0_0_0_3px_rgba(7,91,59,.09)]",
  actions: "mt-[18px] flex justify-end",
  submit: button + " min-w-[170px] bg-[#0c5132] px-4 py-[11px] text-white max-[760px]:w-full",
};
export default function ProofStatusCard({ hidden = false }) {
  const blank = { proofType: "", issuingAuthority: "", referenceNumber: "", issueDate: "", approvedFrom: "", approvedTo: "" };
  const [proofs, setProofs] = useState([]), [f, setF] = useState(blank), [files, setFiles] = useState([]), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const load = () => api("/intern/proofs").then(setProofs).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const p = proofs[0];
  if (!p) return null;
  async function view(index) {
    try {
      const u = URL.createObjectURL(await apiBlob("/intern/proofs/" + p.id + "/file?index=" + index));
      window.open(u, "_blank");
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (e) { setErr(e.message); }
  }
  async function submit(e) {
    e.preventDefault();
    setErr("");
    const body = new FormData();
    Object.entries(f).forEach(([k, v]) => body.append(k, v));
    files.forEach((x) => body.append("proofFiles", x));
    try {
      setBusy(true);
      await api("/intern/proofs", { method: "POST", body });
      setMsg("College proof submitted for Admin review.");
      setF(blank);
      await load();
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  const names = Array.isArray(p.file_names) ? p.file_names : [];
  return (
    <section className={s.card + (hidden ? " hidden" : "")}>
      <h2 className={s.title}>College Permission Proof</h2>
      {msg && <p className={s.success} role="status">{msg}</p>}
      {err && <p className={s.error} role="alert">{err}</p>}
      <div className={s.row}>
        <span><b>{p.batch_order_id ? "Covered by batch allotment order" : p.proof_type}</b><br /><small>Reference {p.reference_number} · Version {p.version}</small></span>
        <span className={s.pill}>{String(p.status).replaceAll("_", " ")}</span>
      </div>
      {p.reason && <p className={s.muted}>Admin note: {p.reason}</p>}
      {names.map((name, i) => <button type="button" key={i} className={s.fileBtn} onClick={() => view(i)}>View {name}</button>)}
      {p.status === "OVERRIDE" && (
        <>
          <p className={s.alert}>Admin approved your account with an override{p.override_due_date ? " until " + p.override_due_date : ""}. Please submit your college proof.</p>
          <form className={s.form} onSubmit={submit}>
            <div><label className={s.label}>Proof Type</label><select className={s.input} required value={f.proofType} onChange={(e) => setF((x) => ({ ...x, proofType: e.target.value }))}><option value="">Select proof type</option>{PROOF_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            {[["issuingAuthority", "Issuing Authority", "text"], ["referenceNumber", "Reference Number", "text"], ["issueDate", "Issue Date", "date"], ["approvedFrom", "Approved From", "date"], ["approvedTo", "Approved To", "date"]].map(([k, label, type]) => (
              <div key={k}><label className={s.label}>{label}</label><input className={s.input} type={type} required value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></div>
            ))}
            <div><label className={s.label}>Files (up to 2)</label><input className={s.input} type="file" multiple required accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFiles([...e.target.files])} /></div>
            <div className={s.actions}><button className={s.submit} disabled={busy}>Submit Proof</button></div>
          </form>
        </>
      )}
    </section>
  );
}

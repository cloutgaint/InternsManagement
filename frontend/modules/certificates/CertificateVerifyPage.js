"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { api } from "@/shared/api/client";
export default function CertificateVerifyPage() {
  const router = useRouter();
  const [id, setId] = useState(""), [result, setResult] = useState(null), [err, setErr] = useState("");
  async function check(value) {
    setResult(null); setErr("");
    try { setResult(await api("/public/certificates/" + encodeURIComponent(value.trim()))); } catch (e) { setErr(e.message); }
  }
  useEffect(() => { if (router.query.id) { setId(String(router.query.id)); check(String(router.query.id)); } }, [router.query.id]);
  return (
    <main className="wrap">
      <h1>Verify a Certificate</h1>
      <p className="muted">Enter the certificate ID printed on a GAINT completion certificate.</p>
      <section className="card">
        <form className="action-row" onSubmit={(e) => { e.preventDefault(); check(id); }}>
          <input className="input" required aria-label="Certificate ID" placeholder="GAINT-CERT-…" value={id} onChange={(e) => setId(e.target.value)} />
          <button className="btn">Verify</button>
        </form>
        {err && <p className="error" role="alert">{err}</p>}
        {result?.valid && (
          <div className="detail-grid proof-meta">
            <div><b>Status</b><span>Valid certificate</span></div>
            <div><b>Name</b><span>{result.name}</span></div>
            <div><b>Domain</b><span>{result.domain || "—"}</span></div>
            <div><b>Period</b><span>{result.period || "—"}</span></div>
            <div><b>Issued</b><span>{result.issueDate}</span></div>
          </div>
        )}
      </section>
    </main>
  );
}

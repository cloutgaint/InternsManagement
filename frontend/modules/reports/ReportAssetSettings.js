"use client";
import {useEffect,useState} from "react";
import {api,apiBlob} from "@/shared/api/client";
export default function ReportAssetSettings({kind="stamp"}){
 const stamp=kind==="stamp",title=stamp?"Official Company Stamp":"My Mentor Signature";
 const [asset,setAsset]=useState(null),[image,setImage]=useState(""),[file,setFile]=useState(null),[err,setErr]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 async function load(){try{const x=await api("/report-assets/mine");setAsset(x.asset);if(x.asset){const b=await apiBlob("/report-assets/mine/image");setImage(URL.createObjectURL(b));}else setImage("");}catch(e){setErr(e.message);}}
 useEffect(()=>{load();return()=>{};},[]);
 async function upload(e){e.preventDefault();if(!file)return;setBusy(true);setErr("");setMsg("");try{if(!["image/png","image/jpeg"].includes(file.type)||file.size>1024*1024)throw Error("Select PNG or JPG under 1 MB");const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(Error("Could not read image"));reader.readAsDataURL(file);});await api("/report-assets/mine",{method:"PUT",body:JSON.stringify({mimeType:file.type,data})});setMsg(title+" saved.");setFile(null);await load();}catch(e){setErr(e.message);}finally{setBusy(false);}}
 async function remove(){if(!window.confirm("Remove "+title+"? Finalized report snapshots will remain unchanged."))return;setBusy(true);setErr("");try{await api("/report-assets/mine",{method:"DELETE"});setMsg(title+" removed.");await load();}catch(e){setErr(e.message);}finally{setBusy(false);}}
 return <main className="wrap report-asset-page">
  <div className="intern-head"><div><h1>{title}</h1><p className="muted">{stamp?"Manage the official stamp used in KLU fortnight reports.":"Manage your signature used when finalizing KLU fortnight reports."}</p></div></div>
  <section className="card report-asset-card">
    <div className="report-asset-heading"><div><h2>{stamp?"Company stamp":"Mentor signature"}</h2><p className="muted">Preview the current image and upload a replacement when needed.</p></div><span className="report-asset-status">{asset?"Uploaded":"Not uploaded"}</span></div>
    {err&&<p className="error" role="alert">{err}</p>}{msg&&<p className="success" role="status">{msg}</p>}
    <div className="report-asset-preview" aria-label={asset?"Current uploaded image":"No image uploaded"}>{image?<img src={image} alt={title}/>:<div className="report-asset-empty"><strong>No image uploaded</strong><span>Select a PNG or JPG file below to get started.</span></div>}</div>
    {asset&&<p className="report-asset-updated">Last updated: {new Date(asset.updated_at).toLocaleString()}</p>}
    <form onSubmit={upload} className="report-asset-form">
      <label htmlFor="report-asset-file">Upload {stamp?"stamp":"signature"}</label>
      <p className="muted">PNG or JPG, maximum file size 1 MB.</p>
      <input id="report-asset-file" className="input" type="file" accept="image/png,image/jpeg" onChange={e=>{setFile(e.target.files?.[0]||null);setErr("");}}/>
      {file&&<p className="report-asset-selected">Selected: {file.name} ({(file.size/1024).toFixed(0)} KB)</p>}
      <div className="report-asset-actions"><button className="btn" disabled={busy||!file}>{busy?"Saving…":asset?"Replace image":"Upload image"}</button>{asset&&<button className="btn report-asset-remove" type="button" disabled={busy} onClick={remove}>Remove</button>}</div>
    </form>
  </section>
  <style jsx global>{`
    .report-asset-page{color:#111}.report-asset-page .report-asset-card{max-width:760px;padding:26px;border:1px solid #d9e6df;border-radius:18px;box-shadow:0 8px 28px #103f2710}
    .report-asset-page .report-asset-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
    .report-asset-page .report-asset-heading h2{font-size:21px;color:#111;margin:0 0 6px}
    .report-asset-page .report-asset-heading p{font-size:13px;margin:0}
    .report-asset-page .report-asset-status{border-radius:999px;padding:7px 12px;background:#e6f4eb;color:#075b3b;font-size:12px;font-weight:700;white-space:nowrap}
    .report-asset-page .report-asset-preview{min-height:200px;display:flex;align-items:center;justify-content:center;padding:22px;border:1px dashed #b9d3c3;border-radius:14px;background:#f8fbf9}
    .report-asset-page .report-asset-preview img{display:block;max-width:100%;max-height:175px;object-fit:contain}
    .report-asset-page .report-asset-empty{display:flex;flex-direction:column;align-items:center;gap:8px;color:#374151;text-align:center}
    .report-asset-page .report-asset-empty span{font-size:13px}
    .report-asset-page .report-asset-updated{font-size:12px;color:#4b5563;margin:10px 0 0}
    .report-asset-page .report-asset-form{margin-top:22px}.report-asset-page .report-asset-form>label{display:block;font-size:13px;font-weight:700;color:#111;margin-bottom:5px}
    .report-asset-page .report-asset-form>.muted{font-size:12px;margin:0 0 10px}
    .report-asset-page .report-asset-form input[type=file]{min-height:48px;width:100%;padding:9px;border:1.5px solid #7ea7ef;border-radius:9px;background:#fff;color:#111}
    .report-asset-page .report-asset-form input[type=file]:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
    .report-asset-page .report-asset-selected{font-size:12px;color:#374151;overflow-wrap:anywhere}
    .report-asset-page .report-asset-actions{display:flex;gap:10px;align-items:center;margin-top:18px}
    .report-asset-page .report-asset-actions .btn{min-height:44px;padding:10px 18px;border-radius:10px;background:#065f46;color:#fff}
    .report-asset-page .report-asset-actions .btn:hover:not(:disabled){background:#064e3b;color:#fff}
    .report-asset-page .report-asset-actions .report-asset-remove{background:#b42332;color:#fff}
    .report-asset-page .report-asset-actions .report-asset-remove:hover:not(:disabled){background:#91202a;color:#fff}
    .report-asset-page .report-asset-actions .btn:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
    @media(max-width:600px){.report-asset-page .report-asset-card{padding:17px}.report-asset-page .report-asset-heading{flex-direction:column}.report-asset-page .report-asset-actions{flex-wrap:wrap}.report-asset-page .report-asset-actions .btn{flex:1}}
  `}</style>
 </main>;
}

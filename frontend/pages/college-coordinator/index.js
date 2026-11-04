import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/router";
import {api} from "@/shared/api/client";
const label=s=>String(s||"").replaceAll("_"," ");
const date=s=>s?String(s).slice(0,10):"—";
export default function CollegeCoordinatorDashboard(){
  const router=useRouter();
  const [data,setData]=useState(null),[err,setErr]=useState(""),[loading,setLoading]=useState(true),[tab,setTab]=useState("overview"),[batch,setBatch]=useState(""),[search,setSearch]=useState(""),[status,setStatus]=useState("ALL");
  useEffect(()=>{
    if(sessionStorage.getItem("role")!=="COLLEGE_COORDINATOR"){router.replace("/login?role=college");return;}
    let active=true;
    api("/college-coordinator/dashboard").then(x=>{if(active)setData(x);}).catch(e=>{if(active)setErr(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[router]);
  const batches=data?.batches||[],all=data?.interns||[];
  const filtered=useMemo(()=>all.filter(i=>(!batch||i.batch_id===batch)&&(!status||status==="ALL"||i.status===status)&&(!search||[i.full_name,i.roll_number,i.batch_name].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase())))),[all,batch,search,status]);
  const active=all.filter(i=>i.status==="ACTIVE").length,unallocated=all.filter(i=>!i.batch_id).length,awaiting=all.filter(i=>i.status!=="ACTIVE").length;
  const selectBatch=id=>{setBatch(id);setTab("interns");};
  return <main className="wrap cc-page">
    <header className="cc-header"><div><p className="cc-eyebrow">COLLEGE WORKSPACE</p><h1>College Coordinator</h1><p className="muted">{data?.college?.college_name||"College internship monitoring"}</p></div><span className="cc-viewonly">View-only access</span></header>
    {err&&<p className="error" role="alert">{err}</p>}
    {loading?<section className="card cc-panel">Loading your college dashboard…</section>:data&&<>
      <nav className="cc-tabs" aria-label="College dashboard sections">
        {[["overview","Overview"],["batches","Semester Batches"],["interns","College Interns"]].map(([key,title])=><button key={key} type="button" className={tab===key?"cc-tab selected":"cc-tab"} onClick={()=>setTab(key)} aria-current={tab===key?"page":undefined}>{title}{key==="batches"&&<span>{batches.length}</span>}{key==="interns"&&<span>{all.length}</span>}</button>)}
      </nav>
      {tab==="overview"&&<div className="cc-stack">
        <section className="cc-stats" aria-label="College statistics">
          {[["Total Interns",all.length,"All registered students"],["Active Interns",active,"Active accounts"],["Semester Batches",batches.length,"Created for your college"],["Not Allocated",unallocated,"Awaiting batch allocation"]].map(([name,value,hint])=><article className="cc-stat" key={name}><p>{name}</p><strong>{value}</strong><small>{hint}</small></article>)}
        </section>
        <div className="cc-two">
          <section className="card cc-panel"><div className="cc-section-head"><div><h2>Semester Batches</h2><p>Manage your view by academic intake</p></div><button className="cc-link" onClick={()=>setTab("batches")}>View all</button></div>{batches.length?batches.slice(0,4).map(b=><button key={b.id} className="cc-line cc-click" onClick={()=>selectBatch(b.id)}><span><b>{b.name}</b><small>{b.semester||"Semester not set"} · {b.code}</small></span><span className="cc-count">{b.intern_count} interns</span></button>):<div className="cc-empty">No semester batches created yet. GAINT Admin can create batches and allocate students.</div>}</section>
          <section className="card cc-panel"><div className="cc-section-head"><div><h2>Student Status</h2><p>Registration and allocation summary</p></div></div><div className="cc-line"><span>Active accounts</span><strong>{active}</strong></div><div className="cc-line"><span>Other registration statuses</span><strong>{awaiting}</strong></div><div className="cc-line"><span>Not allocated to a batch</span><strong>{unallocated}</strong></div><button className="cc-primary" onClick={()=>{setBatch("");setStatus("ALL");setTab("interns");}}>View all interns</button></section>
        </div>
      </div>}
      {tab==="batches"&&<section className="card cc-panel"><div className="cc-section-head"><div><h2>Semester Batches</h2><p>Each semester and intake is listed separately.</p></div><span className="cc-muted-count">{batches.length} batches</span></div>{batches.length?<div className="cc-batch-grid">{batches.map(b=><article key={b.id} className="cc-batch"><div className="cc-batch-top"><span className="cc-chip">{b.semester||"Semester not set"}</span><span className="cc-count">{b.intern_count} interns</span></div><h3>{b.name}</h3><p>{b.code}</p><small>{date(b.start_date)} – {date(b.end_date)}</small><button className="cc-secondary" onClick={()=>selectBatch(b.id)}>View batch interns</button></article>)}</div>:<div className="cc-empty">No batches have been created for this college. Contact GAINT Admin to add semester batches.</div>}</section>}
      {tab==="interns"&&<section className="card cc-panel"><div className="cc-section-head"><div><h2>College Interns</h2><p>Students registered under your college</p></div><span className="cc-muted-count">{filtered.length} of {all.length} interns</span></div>
        <div className="cc-filters"><input aria-label="Search interns" className="input" placeholder="Search name, roll number or batch" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter by batch" className="input" value={batch} onChange={e=>setBatch(e.target.value)}><option value="">All batches</option>{batches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.semester||"—"}</option>)}</select><select aria-label="Filter by status" className="input" value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All statuses</option>{[...new Set(all.map(i=>i.status).filter(Boolean))].map(s=><option key={s} value={s}>{label(s)}</option>)}</select></div>
        {filtered.length?<div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Student</th><th>Roll Number</th><th>Semester</th><th>Batch</th><th>Status</th></tr></thead><tbody>{filtered.map(i=><tr key={i.id}><td><strong>{i.full_name}</strong></td><td>{i.roll_number||"—"}</td><td>{i.year_semester||"—"}</td><td>{i.batch_name||"Not allotted"}</td><td><span className={i.status==="ACTIVE"?"cc-status active":"cc-status"}>{label(i.status)}</span></td></tr>)}</tbody></table></div>:<div className="cc-empty">No interns match these filters.</div>}
      </section>}
    </>}
    <style jsx>{`
      .cc-page{padding-top:28px;padding-bottom:48px;max-width:1160px}
      .cc-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}
      .cc-header h1{font-size:30px;letter-spacing:-.8px;margin:3px 0 8px}
      .cc-header .muted{margin:0}.cc-eyebrow{font-size:11px;font-weight:800;letter-spacing:1.3px;color:#087044;margin:0}
      .cc-viewonly{font-size:12px;color:#466052;background:#e8f3ed;padding:9px 13px;border-radius:999px;white-space:nowrap}
      .cc-tabs{display:flex;gap:8px;border-bottom:1px solid #dce7e0;margin-bottom:22px;overflow-x:auto}
      .cc-tab{border:0;background:transparent;padding:13px 17px;color:#566b60;font-weight:700;white-space:nowrap;cursor:pointer;border-bottom:3px solid transparent}
      .cc-tab.selected{color:#075b38;border-bottom-color:#075b38}.cc-tab span{margin-left:8px;background:#e8eee9;border-radius:20px;padding:2px 7px;font-size:11px}
      .cc-stack{display:grid;gap:18px}.cc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      .cc-stat{background:white;border:1px solid #e0e8e2;border-radius:14px;padding:20px;box-shadow:0 5px 16px rgba(16,49,30,.03)}
      .cc-stat p{margin:0;color:#607168;font-size:13px;font-weight:650}.cc-stat strong{display:block;font-size:32px;line-height:1.3;margin:9px 0;color:#142d21}.cc-stat small{color:#78877e;font-size:11px}
      .cc-two{display:grid;grid-template-columns:1.15fr .85fr;gap:18px}.cc-panel{padding:22px;border-radius:14px}
      .cc-section-head{display:flex;justify-content:space-between;align-items:start;gap:14px;margin-bottom:20px}.cc-section-head h2{font-size:19px;margin:0 0 5px}.cc-section-head p{font-size:13px;color:#728178;margin:0}
      .cc-line{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #edf1ed;text-align:left;width:100%}
      .cc-line:last-of-type{border-bottom:0}.cc-line b{font-size:14px}.cc-line small{display:block;color:#7b897f;margin-top:5px}.cc-click{border-top:0;border-left:0;border-right:0;background:transparent;cursor:pointer}
      .cc-click:hover{color:#07613a}.cc-count{font-size:12px;font-weight:700;color:#286146;white-space:nowrap}
      .cc-link{border:0;background:transparent;color:#087044;font-weight:700;cursor:pointer}
      .cc-primary,.cc-secondary{border:0;background:#075b38;color:white;border-radius:9px;padding:11px 15px;font-weight:700;cursor:pointer;margin-top:18px}
      .cc-secondary{background:#eaf4ee;color:#075b38;margin-top:16px}.cc-muted-count{font-size:12px;color:#6d8073}
      .cc-batch-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .cc-batch{border:1px solid #e2eae4;border-radius:12px;padding:18px;display:flex;flex-direction:column;align-items:flex-start}
      .cc-batch-top{display:flex;justify-content:space-between;width:100%;gap:10px;align-items:center}.cc-chip{font-size:11px;font-weight:750;color:#11663f;background:#e7f3eb;padding:6px 9px;border-radius:7px}
      .cc-batch h3{font-size:17px;margin:18px 0 4px}.cc-batch p{font-size:12px;color:#718078;margin:0 0 14px}.cc-batch small{color:#67776e}.cc-batch .cc-secondary{margin-top:auto;transform:translateY(12px)}
      .cc-filters{display:grid;grid-template-columns:1.4fr 1fr .8fr;gap:10px;margin-bottom:18px}.cc-filters .input{width:100%;min-width:0}
      .cc-table-wrap{overflow-x:auto}.cc-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px}
      .cc-table th{background:#f4f8f5;color:#65786c;font-size:11px;text-transform:uppercase;letter-spacing:.4px;padding:14px}
      .cc-table td{padding:16px 14px;border-bottom:1px solid #edf1ed;color:#41564a}.cc-table td strong{color:#1b3425}
      .cc-status{display:inline-block;background:#fff2e6;color:#8d5520;padding:6px 9px;border-radius:7px;font-size:11px;font-weight:750;white-space:nowrap}
      .cc-status.active{background:#e5f4eb;color:#14683e}.cc-empty{text-align:center;padding:35px 16px;color:#7b897f;font-size:13px;background:#f8faf8;border-radius:10px}
      @media(max-width:900px){.cc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.cc-two{grid-template-columns:1fr}.cc-batch-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:600px){.cc-page{padding-top:18px}.cc-header{align-items:flex-start}.cc-header h1{font-size:24px}.cc-viewonly{font-size:10px}.cc-stats,.cc-batch-grid{grid-template-columns:1fr 1fr}.cc-stat{padding:14px}.cc-stat strong{font-size:26px}.cc-panel{padding:16px}.cc-filters{grid-template-columns:1fr}.cc-batch-grid{grid-template-columns:1fr}}
    `}</style>
  </main>;
}

"use client";
import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";

export default function NotificationsPage() {
  const [notifications,setNotifications]=useState([]);
  const [filter,setFilter]=useState("all");
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [msg,setMsg]=useState("");
  async function load() {
    setLoading(true);
    try {setNotifications(await api("/notifications"));setErr("");}
    catch(e){setErr(e.message||"Unable to load notifications.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  const unread=notifications.filter(x=>!x.read_at).length;
  const filtered=notifications.filter(x=>filter==="all"||(filter==="unread"?!x.read_at:!!x.read_at));
  const pageCount=Math.max(1,Math.ceil(filtered.length/10));
  const activePage=Math.min(page,pageCount);
  const visible=filtered.slice((activePage-1)*10,activePage*10);
  async function open(x) {
    if(busy)return;
    setBusy(true);setErr("");setMsg("");
    try {
      if(!x.read_at){
        await api("/notifications/"+encodeURIComponent(x.id)+"/read",{method:"POST",body:"{}"});
        setNotifications(current=>current.map(item=>item.id===x.id?{...item,read_at:new Date().toISOString()}:item));
      }
      if(x.action_url){
        const target=new URL(x.action_url,window.location.origin);
        if(target.origin!==window.location.origin||!["http:","https:"].includes(target.protocol))throw new Error("Notification link is not supported.");
        window.location.assign(target.pathname+target.search+target.hash);
      }else setMsg("Notification marked as read.");
    }catch(e){setErr(e.message||"Unable to open notification.");}
    finally{setBusy(false);}
  }
  async function readAll() {
    if(busy||unread===0)return;
    setBusy(true);setErr("");setMsg("");
    try{
      await api("/notifications/read-all",{method:"POST",body:"{}"});
      setNotifications(current=>current.map(x=>({...x,read_at:x.read_at||new Date().toISOString()})));
      setMsg("All notifications marked as read.");
    }catch(e){setErr(e.message||"Unable to update notifications.");}
    finally{setBusy(false);}
  }
  function dateLabel(value){
    const d=new Date(value);
    return Number.isNaN(d.getTime())?"Date unavailable":d.toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"});
  }
  return (
    <main className="wrap notifications-modern">
      <div className="notifications-heading">
        <div><h1>Notifications</h1><p className="muted">Review important updates and take action when needed.</p></div>
        <button type="button" className="btn secondary" disabled={busy||loading||!unread} onClick={readAll}>{busy?"Updating…":"Mark all as read"}</button>
      </div>
      <div className="notifications-overview" aria-live="polite"><span><strong>{notifications.length}</strong> Total notifications</span><span className="notifications-unread-total"><strong>{unread}</strong> Unread</span></div>
      <div className="notifications-tabs" role="group" aria-label="Filter notifications">
        {[["all","All"],["unread","Unread"],["read","Read"]].map(([key,label])=><button key={key} type="button" aria-pressed={filter===key} className={filter===key?"active":""} onClick={()=>{setFilter(key);setPage(1);}}>{label}{key==="unread"&&unread>0?<span className="notifications-tab-count">{unread}</span>:null}</button>)}
      </div>
      {err&&<div className="error" role="alert">{err} <button className="btn secondary" type="button" onClick={load}>Try again</button></div>}
      {msg&&<p className="success" role="status">{msg}</p>}
      <section className="card notifications-list" aria-label="Notification list">
        {loading?<div className="notifications-empty" role="status">Loading notifications…</div>:visible.length?visible.map(x=><button type="button" className={"notifications-item"+(!x.read_at?" is-unread":"")} key={x.id} disabled={busy} onClick={()=>open(x)}>
          <span className="notifications-icon" aria-hidden="true">{x.read_at?"✓":"!"}</span>
          <span className="notifications-item-content"><span className="notifications-item-title">{x.title}</span><span className="notifications-item-body">{x.body}</span><span className="notifications-item-date">{dateLabel(x.created_at)}</span></span>
          <span className="notifications-item-side">{!x.read_at&&<span className="notifications-unread-badge">Unread</span>}{x.action_url&&<span className="notifications-open-label">View details <span aria-hidden="true">→</span></span>}</span>
        </button>):<div className="notifications-empty"><strong>{filter==="unread"?"You're all caught up":filter==="read"?"No read notifications":"No notifications yet"}</strong><p>{filter==="unread"?"There are no unread notifications.":filter==="read"?"Notifications you open will appear here.":"Important updates will appear here when available."}</p></div>}
      </section>
      {!loading&&filtered.length>10&&<div className="notifications-pagination"><span>Showing {(activePage-1)*10+1}–{Math.min(activePage*10,filtered.length)} of {filtered.length}</span><div><button className="btn secondary" disabled={activePage===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button><span>Page {activePage} of {pageCount}</span><button className="btn secondary" disabled={activePage===pageCount} onClick={()=>setPage(p=>Math.min(pageCount,p+1))}>Next</button></div></div>}
      <style jsx global>{`
        .notifications-modern{max-width:1160px;padding-top:28px;color:#111}
        .notifications-modern .notifications-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}
        .notifications-modern h1{font-size:clamp(26px,3vw,32px);margin:0 0 8px;color:#111}
        .notifications-modern .notifications-heading p{margin:0;font-size:14px;line-height:1.6}
        .notifications-modern .notifications-overview{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 20px}
        .notifications-modern .notifications-overview>span{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #dfe8e3;border-radius:14px;padding:12px 16px;font-size:13px}
        .notifications-modern .notifications-overview strong{font-size:19px}
        .notifications-modern .notifications-unread-total{background:#f2efff!important;border-color:#e2d8ff!important}
        .notifications-modern .notifications-tabs{display:flex;gap:8px;background:#eef1f8;border:1px solid #dfe5f1;padding:7px;border-radius:18px;margin-bottom:18px;width:fit-content;max-width:100%}
        .notifications-modern .notifications-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:10px 20px;border:0;border-radius:999px;background:transparent;color:#111;font-weight:700;cursor:pointer}
        .notifications-modern .notifications-tabs button.active{background:linear-gradient(125deg,#9149f7,#6e5bf7,#5c9cf8);color:#fff;box-shadow:0 5px 15px #6454ee38}
        .notifications-modern .notifications-tabs button:focus-visible,.notifications-modern .notifications-item:focus-visible{outline:3px solid #6e5bf7;outline-offset:2px}
        .notifications-modern .notifications-tab-count{border-radius:999px;background:#ffffff33;padding:2px 7px}
        .notifications-modern .notifications-list{padding:8px 20px;border-radius:20px;overflow:hidden}
        .notifications-modern .notifications-item{display:flex;width:100%;align-items:flex-start;gap:14px;padding:20px 12px;text-align:left;background:#fff;color:#111;border:0;border-bottom:1px solid #e7eeea;cursor:pointer;min-height:90px}
        .notifications-modern .notifications-item:last-child{border-bottom:0}
        .notifications-modern .notifications-item.is-unread{background:#f8f7ff}
        .notifications-modern .notifications-item:hover:not(:disabled){background:#f0f4ff}
        .notifications-modern .notifications-item:disabled{cursor:wait;opacity:.7}
        .notifications-modern .notifications-icon{display:flex;align-items:center;justify-content:center;flex:0 0 38px;width:38px;height:38px;border-radius:12px;background:#e9edf0;color:#374151;font-weight:800}
        .notifications-modern .is-unread .notifications-icon{background:#e9e2ff;color:#6737d6}
        .notifications-modern .notifications-item-content{display:flex;flex:1;min-width:0;flex-direction:column;gap:6px}
        .notifications-modern .notifications-item-title{font-weight:750;font-size:15px;line-height:1.4}
        .notifications-modern .notifications-item-body{font-size:13px;line-height:1.55;color:#374151;overflow-wrap:anywhere}
        .notifications-modern .notifications-item-date{font-size:12px;color:#5b6470}
        .notifications-modern .notifications-item-side{display:flex;align-items:flex-end;flex-direction:column;gap:10px;flex-shrink:0}
        .notifications-modern .notifications-unread-badge{padding:6px 10px;border-radius:999px;background:#e9e2ff;color:#5127a5;font-size:11px;font-weight:750}
        .notifications-modern .notifications-open-label{font-size:12px;font-weight:700;color:#4d45aa}
        .notifications-modern .notifications-empty{padding:50px 18px;text-align:center;color:#111}
        .notifications-modern .notifications-empty strong{font-size:17px}
        .notifications-modern .notifications-empty p{font-size:13px;color:#4b5563}
        .notifications-modern .notifications-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:18px;font-size:12px}
        .notifications-modern .notifications-pagination>div{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        @media(max-width:650px){.notifications-modern{padding-top:18px}.notifications-modern .notifications-heading{align-items:flex-start;flex-direction:column}.notifications-modern .notifications-tabs{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.notifications-modern .notifications-tabs button{padding:10px 6px}.notifications-modern .notifications-list{padding:5px 10px}.notifications-modern .notifications-item{padding:16px 6px;gap:10px}.notifications-modern .notifications-item-side{gap:6px}.notifications-modern .notifications-open-label{font-size:11px}.notifications-modern .notifications-icon{width:32px;height:32px;flex-basis:32px}}
      `}</style>
    </main>
  );
}

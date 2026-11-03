"use client";
import {useEffect,useState} from "react";
import {api} from "@/shared/api/client";
export default function MentorFinalSubmissionsPage(){
 const [rows,setRows]=useState([]),[feedback,setFeedback]=useState({}),[error,setError]=useState(""),[message,setMessage]=useState("");
 const load=()=>api("/mentor/final-project-submissions").then(setRows).catch(e=>setError(e.message));
 useEffect(()=>{load();},[]);
 async function decide(id,status){setError("");setMessage("");try{await api("/mentor/final-project-submissions/"+id+"/review",{method:"POST",body:JSON.stringify({status,feedback:feedback[id]||""})});setMessage("Review saved.");load();}catch(e){setError(e.message);}}
 return <main className="wrap"><h1>Final Project Reviews</h1>{error&&<p className="error">{error}</p>}{message&&<p className="success">{message}</p>}{!rows.length&&<p>No submissions assigned to you.</p>}{rows.map(x=><section className="card" key={x.id}><h2>{x.project_title} · {x.group_name}</h2><p>Status: {x.status}</p>{x.repository_url&&<p><a href={x.repository_url} target="_blank" rel="noopener noreferrer">Repository</a></p>}{x.demo_url&&<p><a href={x.demo_url} target="_blank" rel="noopener noreferrer">Demo</a></p>}{x.document_title&&<p>Document: {x.document_title}</p>}{x.notes&&<p>{x.notes}</p>}<label>Mentor feedback<textarea className="input" value={feedback[x.id]??x.mentor_feedback??""} maxLength={5000} onChange={e=>setFeedback(v=>({...v,[x.id]:e.target.value}))}/></label><div className="action-row"><button className="btn" onClick={()=>decide(x.id,"ACCEPTED")}>Accept</button><button className="btn secondary" onClick={()=>decide(x.id,"REVISION_REQUESTED")}>Request revision</button></div></section>)}</main>;
}

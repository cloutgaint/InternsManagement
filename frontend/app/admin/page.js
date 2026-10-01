"use client";
import {useEffect,useState} from 'react';
import Dashboard from '../../components/Dashboard';
import {api,apiBlob} from '../../lib/api';

export default function Page(){
 const [proofs,setProofs]=useState([]),[err,setErr]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState('');
 async function load(){try{setErr('');setProofs(await api('/admin/proofs'))}catch(e){setErr(e.message)}}
 useEffect(()=>{load()},[]);
 async function view(id){try{setErr('');const b=await apiBlob('/admin/proofs/'+id+'/file');const url=URL.createObjectURL(b);window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){setErr(e.message)}}
 async function decide(id,outcome){let reason='';if(outcome!=='VERIFIED'){reason=window.prompt(outcome==='REUPLOAD_REQUESTED'?'Enter what the student must correct:':'Enter rejection reason:')||'';if(!reason)return}try{setBusy(id);setErr('');setSuccess('');await api('/admin/proofs/'+id+'/verify',{method:'POST',body:JSON.stringify({outcome,reason})});setSuccess(outcome==='VERIFIED'?'Proof verified successfully. You can now approve the student account.':outcome==='REUPLOAD_REQUESTED'?'Re-upload request saved successfully.':'Proof rejected successfully.');await load()}catch(e){setErr(e.message)}finally{setBusy('')}}
 async function approve(p){let overrideReason='';if(p.status!=='VERIFIED'){overrideReason=window.prompt('Super Admin override reason:')||'';if(!overrideReason)return}try{setBusy(p.id);setErr('');setSuccess('');await api('/admin/interns/'+p.user_id+'/approve',{method:'POST',body:JSON.stringify({overrideReason})});setSuccess(p.full_name+' account has been activated successfully. The student can now sign in.');await load()}catch(e){setErr(e.message)}finally{setBusy('')}}
 return <><Dashboard role="GAINT Admin" path="/admin/dashboard"/><main className="wrap"><div className="card" style={{margin:'20px auto',maxWidth:1200}}>
  <h2>Student Permission Proof Verification</h2>
  <p>Verify the student's college permission proof, then approve the student account to enable login.</p>
  {err&&<p className="error">{err}</p>}{success&&<p className="success">{success}</p>}
  {!proofs.length?<p>No permission proofs submitted yet.</p>:<div style={{display:'grid',gap:16}}>{proofs.map(p=><section key={p.id} className="card" style={{padding:18}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}>
    <div><strong style={{fontSize:18}}>{p.full_name}</strong><div style={{marginTop:4}}>{p.email} · {p.mobile}</div></div>
    <div><strong>Proof:</strong> {p.status} &nbsp; <strong>Account:</strong> {p.is_active?'ACTIVE':p.account_status}</div>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'10px 18px',marginTop:16}}>
    <div><strong>Roll No.</strong><br/>{p.roll_number||'-'}</div><div><strong>College</strong><br/>{p.college_name||'-'}</div>
    <div><strong>University</strong><br/>{p.university||'-'}</div><div><strong>Program / Branch</strong><br/>{p.program||'-'} / {p.branch||'-'}</div>
    <div><strong>Year / Semester</strong><br/>{p.year_semester||'-'}</div><div><strong>Proof Type</strong><br/>{p.proof_type||'-'}</div>
    <div><strong>Reference</strong><br/>{p.reference_number||'-'}</div><div><strong>Issuing Authority</strong><br/>{p.issuing_authority||'-'}</div>
    <div><strong>Issue Date</strong><br/>{p.issue_date?String(p.issue_date).slice(0,10):'-'}</div><div><strong>Approved Period</strong><br/>{p.approved_from?String(p.approved_from).slice(0,10):'-'} to {p.approved_to?String(p.approved_to).slice(0,10):'-'}</div>
    <div><strong>Coordinator</strong><br/>{p.coordinator_name||'-'}{p.coordinator_designation?' ('+p.coordinator_designation+')':''}</div><div><strong>Coordinator Contact</strong><br/>{p.coordinator_email||'-'} / {p.coordinator_phone||'-'}</div>
   </div>
   {p.reason&&<p className="error" style={{marginTop:12}}>Reason: {p.reason}</p>}
   <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}>
    <button className="btn" type="button" onClick={()=>view(p.id)}>View Proof</button>
    {p.status!=='VERIFIED'&&<button className="btn" disabled={busy===p.id} type="button" onClick={()=>decide(p.id,'VERIFIED')}>Verify Proof</button>}
    {p.status!=='REUPLOAD_REQUESTED'&&<button className="btn" disabled={busy===p.id} type="button" onClick={()=>decide(p.id,'REUPLOAD_REQUESTED')}>Request Re-upload</button>}
    {p.status!=='REJECTED'&&<button className="btn" disabled={busy===p.id} type="button" onClick={()=>decide(p.id,'REJECTED')}>Reject Proof</button>}
    {!p.is_active&&p.status==='VERIFIED'&&<button className="btn" disabled={busy===p.id} type="button" onClick={()=>approve(p)}>Approve Account</button>}
   </div>
  </section>)}</div>}
 </div></main></>
}

"use client";
import {useState} from 'react';import {api} from '../../lib/api';
const PROGRAMS=['B.Tech','B.E.','B.Sc','BCA','MCA','M.Tech','MBA','Diploma','Other'];
const BRANCHES=['CSE','IT','ECE','EEE','Mechanical','Civil','AI & ML','Data Science','Cyber Security','Other'];
export default function Register(){
 const [f,setF]=useState({email:'',password:'',fullName:'',mobile:'',program:'',programOther:'',branch:'',branchOther:'',rollNumber:'',allotmentReference:'',issuingAuthority:'',issueDate:'',approvedFrom:'',approvedTo:'',preferredDomains:[],consentGenuine:false,consentStorage:false}),[file,setFile]=useState(null),[msg,setMsg]=useState(''),[err,setErr]=useState('');
 const set=(k,v)=>setF(x=>({...x,[k]:v}));
 async function submit(e){e.preventDefault();setErr('');setMsg('');try{if(!file)throw new Error('Please upload the allotment order.');const body=new FormData();Object.entries(f).forEach(([k,v])=>body.append(k,Array.isArray(v)?JSON.stringify(v):String(v)));body.append('allotmentOrder',file);await api('/auth/register',{method:'POST',body});setMsg('Application received. Your allotment order is pending Admin verification. Login remains disabled until verification and Admin approval.')}catch(x){setErr(x.message)}}
 return <main className="wrap"><div className="card" style={{maxWidth:760,margin:'30px auto'}}><h1>Intern Application</h1>{msg&&<p className="success">{msg}</p>}{err&&<p className="error">{err}</p>}<form onSubmit={submit}>
 <label>Full name</label><input className="input" value={f.fullName} onChange={e=>set('fullName',e.target.value)} required/>
 <label>Email</label><input className="input" type="email" value={f.email} onChange={e=>set('email',e.target.value)} required/>
 <label>Mobile</label><input className="input" value={f.mobile} onChange={e=>set('mobile',e.target.value)}/>
 <label>Program</label><select className="input" value={f.program} onChange={e=>{set('program',e.target.value);if(e.target.value!=='Other')set('programOther','')}} required><option value="">Select program</option>{PROGRAMS.map(x=><option key={x}>{x}</option>)}</select>
 {f.program==='Other'&&<><label>Enter Program Name</label><input className="input" value={f.programOther} onChange={e=>set('programOther',e.target.value)} required placeholder="Enter your program"/></>}
 <label>Branch / Department</label><select className="input" value={f.branch} onChange={e=>{set('branch',e.target.value);if(e.target.value!=='Other')set('branchOther','')}} required><option value="">Select branch / department</option>{BRANCHES.map(x=><option key={x}>{x}</option>)}</select>
 {f.branch==='Other'&&<><label>Enter Branch / Specialization</label><input className="input" value={f.branchOther} onChange={e=>set('branchOther',e.target.value)} required placeholder="Enter your branch or specialization"/></>}
 <label>Roll / Registration No.</label><input className="input" value={f.rollNumber} onChange={e=>set('rollNumber',e.target.value)}/>
 <h3 style={{marginTop:24}}>Allotment Order</h3><p className="muted">Upload the college/institution allotment order for Admin verification.</p>
 <label>Allotment Order Number / Reference</label><input className="input" value={f.allotmentReference} onChange={e=>set('allotmentReference',e.target.value)} required/>
 <label>Issuing Authority / College</label><input className="input" value={f.issuingAuthority} onChange={e=>set('issuingAuthority',e.target.value)} required/>
 <label>Issue Date</label><input className="input" type="date" value={f.issueDate} max={new Date().toISOString().slice(0,10)} onChange={e=>set('issueDate',e.target.value)} required/>
 <label>Approved Internship From (optional)</label><input className="input" type="date" value={f.approvedFrom} onChange={e=>set('approvedFrom',e.target.value)}/>
 <label>Approved Internship To (optional)</label><input className="input" type="date" value={f.approvedTo} min={f.approvedFrom||undefined} onChange={e=>set('approvedTo',e.target.value)}/>
 <label>Upload Allotment Order (PDF/JPG/PNG, max 5 MB)</label><input className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0]||null)} required/>
 <label>Password (10+ characters)</label><input className="input" type="password" minLength="10" onChange={e=>set('password',e.target.value)} required/>
 <label><input type="checkbox" checked={f.consentGenuine} onChange={e=>set('consentGenuine',e.target.checked)} required/> I confirm submitted college documents are genuine.</label><br/>
 <label><input type="checkbox" checked={f.consentStorage} onChange={e=>set('consentStorage',e.target.checked)} required/> I consent to storage/verification for internship administration.</label>
 <p><button className="btn">Submit application</button></p></form></div></main>}

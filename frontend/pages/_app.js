import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import "@/shared/globals.css";
import {api,apiBlob} from "@/shared/api/client";
export default function App({ Component, pageProps }) {
  const router=useRouter();
  const pageHistory=useRef([]);
  const [session,setSession]=useState({token:null,role:null});
  const [profileOpen,setProfileOpen]=useState(false),[profile,setProfile]=useState(null),[photo,setPhoto]=useState("");
  const profileRef=useRef(null);
  useEffect(()=>{
    const sync=()=>setSession({token:sessionStorage.getItem("token"),role:sessionStorage.getItem("role")});
    sync();window.addEventListener("storage",sync);window.addEventListener("focus",sync);
    return ()=>{window.removeEventListener("storage",sync);window.removeEventListener("focus",sync);};
  },[router.asPath]);
  useEffect(()=>{setProfileOpen(false);},[router.asPath]);
  useEffect(()=>{if(!session.token){setProfile(null);setPhoto("");return;}let active=true,url="";api("/auth/me").then(u=>{if(active)setProfile(u);}).catch(()=>{});if(session.role==="INTERN"){api("/intern/dashboard").then(d=>{if(active)setProfile(x=>({...x,...d.profile}));}).catch(()=>{});apiBlob("/intern/profile-photo").then(b=>{url=URL.createObjectURL(b);if(active)setPhoto(url);else URL.revokeObjectURL(url);}).catch(()=>{});}return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[session.token,session.role]);
  useEffect(()=>{if(!profileOpen)return;const close=e=>{if(!profileRef.current?.contains(e.target))setProfileOpen(false);};const esc=e=>{if(e.key==="Escape")setProfileOpen(false);};document.addEventListener("pointerdown",close);document.addEventListener("keydown",esc);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",esc);};},[profileOpen]);
  const loggedIn=!!session.token;
  const role=session.role||"";
  const home=role.includes("ADMIN")?"/admin":role==="MENTOR"?"/mentor":role==="COLLEGE_COORDINATOR"?"/college-coordinator":"/intern";
  useEffect(()=>{
    if(!loggedIn){pageHistory.current=[];return;}
    const path=router.asPath;
    if(!(path===home||path.startsWith(home+"/")))return;
    if(["/login","/register","/"].includes(path.split("?")[0]))return;
    const history=pageHistory.current;
    if(history[history.length-1]!==path)history.push(path);
    if(history.length>30)history.shift();
  },[loggedIn,router.asPath,home]);
  const links=loggedIn?[{href:home,label:role.includes("ADMIN")?"Admin Dashboard":role==="MENTOR"?"Mentor Dashboard":role==="COLLEGE_COORDINATOR"?"College Coordinator Dashboard":"Student Dashboard"},{href:"/notifications",label:"Notifications"},{href:"/account/password",label:"Password"}]:[{href:"/",label:"Home"},{href:"/login",label:"Student Login"},{href:"/login?role=admin",label:"Admin Login"},{href:"/login?role=college",label:"Coordinator Login"},{href:"/register",label:"Student Registration"}];
  function goBack(){
    if(!loggedIn){router.push("/");return;}
    const history=pageHistory.current;
    if(history[history.length-1]===router.asPath)history.pop();
    const previous=history.pop();
    router.push(previous&&previous!==router.asPath?previous:home);
  }
  function logout(){
    pageHistory.current=[];setProfileOpen(false);setProfile(null);setPhoto("");
    sessionStorage.removeItem("token");sessionStorage.removeItem("role");
    setSession({token:null,role:null});router.replace("/login");
  }
  return <>
    <Head><title>GAINT Intern Management</title><meta name="description" content="End-to-end internship lifecycle management"/></Head>
    <header className="top glass-top"><div className="glass-nav-shell">
      <Link href="/" className="glass-brand" aria-label="GAINT Intern Management home"><span className="glass-brand-mark" aria-hidden="true">G</span><span className="glass-brand-copy"><strong>GAINT</strong><small>Intern Management</small></span></Link>
      <nav className="nav glass-nav" aria-label="Main navigation">
        {links.map(({href,label})=><Link key={href} href={href} aria-current={router.pathname===href?"page":undefined} className={"glass-nav-link"+(router.pathname===href?" is-active":"")+(!loggedIn&&href==="/register"?" glass-nav-cta":"")}>{label}</Link>)}
        {loggedIn&&<div className="nav-profile" ref={profileRef}><button type="button" className="nav-profile-trigger" aria-label="Open my profile" aria-expanded={profileOpen} aria-haspopup="dialog" onClick={()=>setProfileOpen(v=>!v)}>{photo?<img src={photo} alt="" className="nav-profile-avatar"/>:<span className="nav-profile-avatar nav-profile-initial">{(profile?.full_name||profile?.email||"U").charAt(0).toUpperCase()}</span>}<span className="nav-profile-label">My Profile</span><span aria-hidden="true">⌄</span></button>{profileOpen&&<section className="nav-profile-menu" role="dialog" aria-label="My profile"><div className="nav-profile-top">{photo?<img src={photo} alt="Registered profile" className="nav-profile-large"/>:<span className="nav-profile-large nav-profile-initial">{(profile?.full_name||profile?.email||"U").charAt(0).toUpperCase()}</span>}<div><strong>{profile?.full_name||"My Account"}</strong><small>{profile?.email||"Signed in"}</small><span className="nav-profile-role">{profile?.role||role}</span></div></div>{role==="INTERN"&&<div className="nav-profile-details"><div><span>Roll Number</span><b>{profile?.roll_number||"—"}</b></div><div><span>Program</span><b>{profile?.program||"—"}</b></div><div><span>Branch</span><b>{profile?.branch||"—"}</b></div><div><span>Mobile</span><b>{profile?.mobile||"—"}</b></div><div><span>University</span><b>{profile?.university||"—"}</b></div></div>}<Link className="nav-profile-home" href={home} onClick={()=>setProfileOpen(false)}>Go to Dashboard</Link><button type="button" className="nav-profile-signout" onClick={logout}>Log Out</button></section>}</div>}
      </nav>
    </div></header>
    {router.pathname!=="/"&&(!loggedIn||router.asPath!==home)&&<div className="page-back-bar"><div className="page-back-inner"><button type="button" className="page-back-button" onClick={goBack} aria-label="Go back to previous page"><span aria-hidden="true">←</span> Back</button></div></div>}
    <Component {...pageProps}/>
  </>;
}

import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import "@/shared/globals.css";
export default function App({ Component, pageProps }) {
  const router=useRouter();
  const pageHistory=useRef([]);
  const [session,setSession]=useState({token:null,role:null});
  useEffect(()=>{
    const sync=()=>setSession({token:localStorage.getItem("token"),role:localStorage.getItem("role")});
    sync();window.addEventListener("storage",sync);window.addEventListener("focus",sync);
    return ()=>{window.removeEventListener("storage",sync);window.removeEventListener("focus",sync);};
  },[router.asPath]);
  const loggedIn=!!session.token;
  const role=session.role||"";
  const home=role.includes("ADMIN")?"/admin":role==="MENTOR"?"/mentor":"/intern";
  useEffect(()=>{
    if(!loggedIn){pageHistory.current=[];return;}
    const path=router.asPath;
    if(!(path===home||path.startsWith(home+"/")))return;
    if(["/login","/register","/"].includes(path.split("?")[0]))return;
    const history=pageHistory.current;
    if(history[history.length-1]!==path)history.push(path);
    if(history.length>30)history.shift();
  },[loggedIn,router.asPath,home]);
  const links=loggedIn?[{href:home,label:role.includes("ADMIN")?"Admin Dashboard":role==="MENTOR"?"Mentor Dashboard":"Student Dashboard"}]:[{href:"/",label:"Home"},{href:"/login",label:"Student Login"},{href:"/login?role=admin",label:"Admin Login"},{href:"/register",label:"Student Registration"}];
  function goBack(){
    if(!loggedIn){router.push("/");return;}
    const history=pageHistory.current;
    if(history[history.length-1]===router.asPath)history.pop();
    const previous=history.pop();
    router.push(previous&&previous!==router.asPath?previous:home);
  }
  function logout(){
    pageHistory.current=[];
    localStorage.removeItem("token");localStorage.removeItem("role");
    setSession({token:null,role:null});router.replace("/login");
  }
  return <>
    <Head><title>GAINT Intern Management</title><meta name="description" content="End-to-end internship lifecycle management"/></Head>
    <header className="top glass-top"><div className="glass-nav-shell">
      <Link href="/" className="glass-brand" aria-label="GAINT Intern Management home"><span className="glass-brand-mark" aria-hidden="true">G</span><span className="glass-brand-copy"><strong>GAINT</strong><small>Intern Management</small></span></Link>
      <nav className="nav glass-nav" aria-label="Main navigation">
        {links.map(({href,label})=><Link key={href} href={href} aria-current={router.pathname===href?"page":undefined} className={"glass-nav-link"+(router.pathname===href?" is-active":"")+(!loggedIn&&href==="/register"?" glass-nav-cta":"")}>{label}</Link>)}
        {loggedIn&&<button type="button" className="glass-nav-link glass-logout" onClick={logout} aria-label="Log out of your account">Log Out</button>}
      </nav>
    </div></header>
    {router.pathname!=="/"&&(!loggedIn||router.asPath!==home)&&<div className="page-back-bar"><div className="page-back-inner"><button type="button" className="page-back-button" onClick={goBack} aria-label="Go back to previous page"><span aria-hidden="true">←</span> Back</button></div></div>}
    <Component {...pageProps}/>
  </>;
}

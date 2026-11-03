import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import "@/shared/globals.css";
export default function App({ Component, pageProps }) {
  const router=useRouter();
  const [session,setSession]=useState({token:null,role:null});
  useEffect(()=>{
    const sync=()=>setSession({token:localStorage.getItem("token"),role:localStorage.getItem("role")});
    sync();window.addEventListener("storage",sync);window.addEventListener("focus",sync);
    return ()=>{window.removeEventListener("storage",sync);window.removeEventListener("focus",sync);};
  },[router.asPath]);
  const loggedIn=!!session.token;
  const role=session.role||"";
  const home=role.includes("ADMIN")?"/admin":role==="MENTOR"?"/mentor":"/intern";
  const links=loggedIn?[{href:home,label:role.includes("ADMIN")?"Admin Dashboard":role==="MENTOR"?"Mentor Dashboard":"Student Dashboard"}]:[{href:"/",label:"Home"},{href:"/login",label:"Student Login"},{href:"/register",label:"Student Registration"}];
  function goBack(){
    const fallback=loggedIn?home:"/";
    const previous=document.referrer;
    if(window.history.length>1&&previous){
      try{if(new URL(previous).origin===window.location.origin){router.back();return;}}catch{}
    }
    router.push(fallback);
  }
  function logout(){
    localStorage.removeItem("token");localStorage.removeItem("role");
    setSession({token:null,role:null});router.replace("/login");
  }
  return <>
    <Head><title>GAINT Intern Management</title><meta name="description" content="End-to-end internship lifecycle management"/></Head>
    <header className="top glass-top"><div className="glass-nav-shell">
      <Link href="/" className="glass-brand" aria-label="GAINT Intern Management home"><span className="glass-brand-mark" aria-hidden="true">G</span><span className="glass-brand-copy"><strong>GAINT</strong><small>Intern Management</small></span></Link>
      <nav className="nav glass-nav" aria-label="Main navigation">
        {router.pathname!=="/"&&<button type="button" className="glass-nav-link glass-back" onClick={goBack} aria-label="Go back to previous page"><span aria-hidden="true">←</span> Back</button>}
        {links.map(({href,label})=><Link key={href} href={href} aria-current={router.pathname===href?"page":undefined} className={"glass-nav-link"+(router.pathname===href?" is-active":"")+(!loggedIn&&href==="/register"?" glass-nav-cta":"")}>{label}</Link>)}
        {loggedIn&&<button type="button" className="glass-nav-link glass-logout" onClick={logout} aria-label="Log out of your account">Log Out</button>}
      </nav>
    </div></header>
    <Component {...pageProps}/>
  </>;
}

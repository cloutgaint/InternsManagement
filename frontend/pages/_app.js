import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import "@/shared/globals.css";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const links = [{href:"/",label:"Home"},{href:"/login",label:"Student Login"},{href:"/register",label:"Student Registration"}];
  return (
    <>
      <Head>
        <title>GAINT Intern Management</title>
        <meta name="description" content="End-to-end internship lifecycle management"/>
      </Head>
      <header className="top glass-top">
        <div className="glass-nav-shell">
          <Link href="/" className="glass-brand" aria-label="GAINT Intern Management home">
            <span className="glass-brand-mark" aria-hidden="true">G</span>
            <span className="glass-brand-copy"><strong>GAINT</strong><small>Intern Management</small></span>
          </Link>
          <nav className="nav glass-nav" aria-label="Main navigation">
            {links.map(({href,label})=><Link key={href} href={href} aria-current={router.pathname===href?"page":undefined} className={"glass-nav-link"+(router.pathname===href?" is-active":"")+(href==="/register"?" glass-nav-cta":"")}>{label}</Link>)}
          </nav>
        </div>
      </header>
      <Component {...pageProps}/>
    </>
  );
}

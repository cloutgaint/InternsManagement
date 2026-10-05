import Head from "next/head";
import "@/shared/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>GAINT Intern Management</title>
        <meta
          name="description"
          content="End-to-end internship lifecycle management"
        />
      </Head>
      <header className="top">
        <b>GAINT Intern Management</b>
        <nav className="nav">
          <a href="/">Home</a>
          <a href="/login">Login</a>
          <a href="/register">Apply</a>
        </nav>
      </header>
      <Component {...pageProps} />
    </>
  );
}

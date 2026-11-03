import Link from "next/link";
const steps=[
{number:"01",title:"Register",description:"Create your student account and select your college."},
{number:"02",title:"Get verified",description:"Submit your college details and complete account verification."},
{number:"03",title:"Begin your internship",description:"Access your internship activities and track your progress."}
];
export default function Home(){return <main className="simple-home">
<section className="simple-home-hero"><div className="simple-home-container"><div className="simple-home-hero-content"><span className="simple-home-eyebrow">GAINT INTERN MANAGEMENT</span><h1>Your internship starts here.</h1><p>A single place to register, complete college verification, manage your internship activities and track your progress through completion.</p><div className="simple-home-actions"><Link href="/register" className="simple-home-primary">Apply for Internship <span aria-hidden="true">↗</span></Link><Link href="/login" className="simple-home-secondary">Student Login <span aria-hidden="true">→</span></Link></div><div className="simple-home-note"><span aria-hidden="true">✓</span> For students enrolled in participating colleges</div></div></div></section>
<section className="simple-home-process"><div className="simple-home-container"><div className="simple-home-section-head"><span className="simple-home-eyebrow">HOW IT WORKS</span><h2>Three steps to get started</h2><p>Follow a simple process from registration to your internship workspace.</p></div><div className="simple-home-steps">{steps.map(x=><div className="simple-home-step" key={x.number}><span className="simple-home-step-number">{x.number}</span><div><h3>{x.title}</h3><p>{x.description}</p></div></div>)}</div></div></section>
<section className="simple-home-bottom"><div className="simple-home-container simple-home-bottom-inner"><div><h2>Ready to begin?</h2><p>Register your details to start the application process.</p></div><Link href="/register" className="simple-home-primary">Start Application <span aria-hidden="true">↗</span></Link></div></section>
</main>;}

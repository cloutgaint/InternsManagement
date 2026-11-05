import {useEffect} from "react";
import {useRouter} from "next/router";
export default function Page(){const router=useRouter();useEffect(()=>{router.replace("/admin/projects");},[router]);return <main className="wrap"><p className="muted">Opening Project Management…</p></main>;}

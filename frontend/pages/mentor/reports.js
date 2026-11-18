"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import MentorReportsPage from "@/modules/reports/MentorReportsPage";

export default function Page() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  useEffect(() => {
    const currentRole = sessionStorage.getItem("role");
    setRole(currentRole || "UNAUTHENTICATED");
    if (currentRole === "ADMIN") router.replace("/admin/fortnight");
    else if (currentRole !== "MENTOR") router.replace("/login");
  }, [router]);
  if (role !== "MENTOR") return <main className="wrap" role="status" aria-live="polite"><p className="muted">Opening your authorized reports workspace…</p></main>;
  return <MentorReportsPage />;
}

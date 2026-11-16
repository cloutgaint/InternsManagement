import { useEffect, useState } from "react";
import { api, apiBlob } from "@/shared/api/client";

export function useAppSession(routeKey) {
  const [session, setSession] = useState({ token: null, role: null });
  const [profile, setProfile] = useState(null);
  const [photo, setPhoto] = useState("");

  useEffect(() => {
    const sync = () => setSession({
      token: sessionStorage.getItem("token"),
      role: sessionStorage.getItem("role"),
    });
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, [routeKey]);

  useEffect(() => {
    if (!session.token) {
      setProfile(null);
      setPhoto("");
      return undefined;
    }
    let active = true;
    let photoUrl = "";
    api("/auth/me").then((user) => { if (active) setProfile(user); }).catch(() => {});
    if (session.role === "INTERN") {
      api("/intern/dashboard").then((dashboard) => {
        if (active) setProfile((current) => ({ ...current, ...dashboard.profile }));
      }).catch(() => {});
      apiBlob("/intern/profile-photo").then((blob) => {
        photoUrl = URL.createObjectURL(blob);
        if (active) setPhoto(photoUrl);
        else URL.revokeObjectURL(photoUrl);
      }).catch(() => {});
    }
    return () => {
      active = false;
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [session.token, session.role]);

  function clearSession() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");
    setSession({ token: null, role: null });
    setProfile(null);
    setPhoto("");
  }

  return { session, profile, photo, clearSession };
}

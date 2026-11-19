// Production traffic is routed through the same HTTPS origin by Caddy.
// Keep the direct localhost API URL only for local Next.js development.
const configuredApi = process.env.NEXT_PUBLIC_API_URL?.trim();
if (process.env.NODE_ENV === "production" && configuredApi && !configuredApi.startsWith("/") && !configuredApi.startsWith("https://")) {
  throw new Error("NEXT_PUBLIC_API_URL must be HTTPS or a same-origin path in production");
}
export const API = (configuredApi || (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:8000/api")).replace(/\\/$/, "");

function headers(options, token) {
  const isForm = options.body instanceof FormData;
  return {
    ...(!isForm ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
}

function storedToken() {
  return typeof window !== "undefined" ? sessionStorage.getItem("token") : null;
}

export async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: headers(options, storedToken()),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiBlob(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: headers(options, storedToken()),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Request failed");
  }
  return response.blob();
}

export const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

function headers(options, token) {
  const isForm = options.body instanceof FormData;
  return {
    ...(!isForm ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
}

function storedToken() {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null;
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

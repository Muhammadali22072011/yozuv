const API =
  typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("yozuv_access");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const t = getToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined" && options.auth !== false) {
    localStorage.removeItem("yozuv_access");
    localStorage.removeItem("yozuv_refresh");
    if (!window.location.pathname.startsWith("/auth/")) {
      window.location.href = "/auth/login";
    }
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiBase(): string {
  return API;
}

const API = "https://yozuv.onrender.com";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("yozuv_access");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("yozuv_refresh");
}

function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("yozuv_access");
  localStorage.removeItem("yozuv_refresh");
}

// In-flight refresh promise — coalesces parallel 401s into a single /refresh
// call so a page that fires 4 requests at once doesn't trigger 4 refreshes.
let refreshInFlight: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = getRefreshToken();
  if (!refresh) return null;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token: string; refresh_token: string };
      if (typeof window !== "undefined") {
        localStorage.setItem("yozuv_access", data.access_token);
        localStorage.setItem("yozuv_refresh", data.refresh_token);
      }
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function doFetch(path: string, options: RequestInit, token: string | null) {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API}${path}`, { ...options, headers });
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const wantAuth = options.auth !== false;
  let token = wantAuth ? getToken() : null;
  let res = await doFetch(path, options, token);

  // Single transparent retry: if access token rejected, refresh and retry once.
  if (res.status === 401 && wantAuth && typeof window !== "undefined") {
    const newToken = await tryRefresh();
    if (newToken) {
      res = await doFetch(path, options, newToken);
    }
    if (res.status === 401) {
      clearTokens();
      if (!window.location.pathname.startsWith("/auth/")) {
        window.location.href = "/auth/login";
      }
      throw new Error("Session expired");
    }
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

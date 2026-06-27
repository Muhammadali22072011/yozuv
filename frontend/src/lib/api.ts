// Build-time env var (Next.js inlines NEXT_PUBLIC_* into the client bundle).
// The render.com URL stays as a fallback so a miss-configured deploy still
// boots, but production should always set NEXT_PUBLIC_API_URL explicitly.
const ENV_API = process.env.NEXT_PUBLIC_API_URL;
if (
  !ENV_API &&
  process.env.NODE_ENV === "production" &&
  typeof window !== "undefined"
) {
  // Loud, not silent: a credentialed client shouldn't quietly default to a
  // hardcoded backend. Surface the misconfiguration so it gets fixed.
  console.error(
    "[yozuv] NEXT_PUBLIC_API_URL is not set — using the default host. Set it explicitly in production."
  );
}
const API = ENV_API || "https://yozuv.onrender.com";

/** Error thrown by apiFetch for any non-2xx response, carrying the HTTP
 * status so callers can distinguish "not found / not onboarded" (404) from
 * transient failures (500/502/network) instead of treating every error the
 * same. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("yozuv_access");
}

// --- Active business (multi-business) ---------------------------------------
// Which of the user's businesses every authed request acts against. Sent as
// the X-Business-Id header so the backend's get_active_business resolves the
// right one. Null = let the backend fall back to the primary business.
const ACTIVE_BIZ_KEY = "yozuv_active_business";

export function getActiveBusinessId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_BIZ_KEY);
}

export function setActiveBusinessId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_BIZ_KEY, id);
  else localStorage.removeItem(ACTIVE_BIZ_KEY);
  // Let listeners (the switcher, data hooks) react without a full reload.
  window.dispatchEvent(new CustomEvent("yozuv:business-changed", { detail: id }));
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
  // Carry the active business on authed requests so the backend acts against
  // the one the user picked in the switcher. Don't override a header a caller
  // set explicitly.
  if (token && !headers.has("X-Business-Id")) {
    const bizId = getActiveBusinessId();
    if (bizId) headers.set("X-Business-Id", bizId);
  }
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
    let detailMessage: string | null = null;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object" && "detail" in parsed) {
        const detail = (parsed as { detail: unknown }).detail;
        if (typeof detail === "string") {
          detailMessage = detail;
        } else if (Array.isArray(detail)) {
          const message = detail
            .map((item) =>
              item && typeof item === "object" && "msg" in item
                ? String((item as { msg: unknown }).msg)
                : String(item)
            )
            .join("; ");
          if (message) detailMessage = message;
        }
      }
    } catch {
      // Non-JSON body (JSON.parse threw) — fall through to raw text below.
    }
    throw new ApiError(detailMessage || text || res.statusText, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiBase(): string {
  return API;
}

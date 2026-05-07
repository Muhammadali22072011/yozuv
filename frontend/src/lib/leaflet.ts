// Tiny client-only Leaflet bootstrapper shared by every map view.
// Keeps the leaflet CSS/JS off the SSR bundle and dedupes <script> tags
// when several map components mount on the same page.

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

declare global {
  interface Window {
    L?: any;
  }
}

let inflight: Promise<any> | null = null;

export function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("leaflet: server-side load attempted"));
  }
  if (window.L) return Promise.resolve(window.L);
  if (inflight) return inflight;

  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }

  inflight = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${LEAFLET_JS}"]`,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", () => reject(new Error("leaflet load failed")));
      if (window.L) resolve(window.L);
      return;
    }
    const s = document.createElement("script");
    s.src = LEAFLET_JS;
    s.async = true;
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error("leaflet load failed"));
    document.body.appendChild(s);
  });
  return inflight;
}

export const TASHKENT = { lat: 41.3111, lng: 69.2797 };

"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";

type Latlng = { lat: number; lng: number };

type Props = {
  value: Latlng | null;
  onChange: (v: Latlng) => void;
  onAddressLookup?: (address: string) => void;
  height?: number;
};

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const TASHKENT: Latlng = { lat: 41.3111, lng: 69.2797 };

declare global {
  interface Window {
    L?: any;
  }
}

function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.L) return Promise.resolve(window.L);

  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
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
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=uz`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return "";
    const data = (await res.json()) as { display_name?: string };
    return data.display_name || "";
  } catch {
    return "";
  }
}

export function MapPicker({ value, onChange, onAddressLookup, height = 280 }: Props) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapDivRef.current) return;
        const start = value || TASHKENT;
        const map = L.map(mapDivRef.current, {
          center: [start.lat, start.lng],
          zoom: value ? 15 : 11,
          scrollWheelZoom: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(map);

        const handlePoint = async (lat: number, lng: number) => {
          marker.setLatLng([lat, lng]);
          onChange({ lat, lng });
          if (onAddressLookup) {
            const addr = await reverseGeocode(lat, lng);
            if (addr) onAddressLookup(addr);
          }
        };

        map.on("click", (e: any) => handlePoint(e.latlng.lat, e.latlng.lng));
        marker.on("dragend", () => {
          const ll = marker.getLatLng();
          handlePoint(ll.lat, ll.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
        setReady(true);
      })
      .catch(() => setReady(false));

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !value || !mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([value.lat, value.lng]);
    mapRef.current.setView([value.lat, value.lng], Math.max(mapRef.current.getZoom(), 14));
  }, [ready, value]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        onChange({ lat: latitude, lng: longitude });
        if (onAddressLookup) {
          const addr = await reverseGeocode(latitude, longitude);
          if (addr) onAddressLookup(addr);
        }
        setBusy(false);
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={mapDivRef}
        className="overflow-hidden rounded-3xl bg-ink-50 shadow-soft ring-1 ring-ink-100"
        style={{ height }}
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className="tap inline-flex items-center gap-2 rounded-2xl bg-indigo-50 px-3.5 py-2 text-[13px] font-semibold text-indigo-700 transition disabled:opacity-50"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-white/70 text-indigo-600">
            <Navigation className="h-3.5 w-3.5" />
          </span>
          {busy ? "Kutilmoqda…" : "Mening joylashuvim"}
        </button>
        <div className="inline-flex items-center gap-1.5 rounded-2xl bg-ink-50 px-3 py-1.5 text-[11px] font-medium text-ink-400">
          <MapPin className="h-3 w-3 text-ink-300" />
          {value ? (
            <span className="tnum text-ink-500">{`${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}</span>
          ) : (
            "Xaritani bosing yoki marker'ni suring"
          )}
        </div>
      </div>
    </div>
  );
}

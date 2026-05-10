"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Star } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { loadLeaflet, TASHKENT } from "@/lib/leaflet";

type CatalogItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  logo_url: string;
  language: string;
  viloyat: string;
  tuman: string;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  reviews_count: number;
  distance_km: number | null;
};

const CATEGORY_ICON: Record<string, string> = {
  barbershop: "💈",
  salon: "💇",
  dentist: "🦷",
  tutor: "📚",
  photo: "📸",
  massage: "💆",
  fitness: "🏋",
  clinic: "⚕️",
  other: "📦",
};

const BOT_USERNAME =
  process.env.NEXT_PUBLIC_BOT_USERNAME || "Yozuv_cl_bot";

export default function CatalogMapPage() {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the catalog. The endpoint returns the full active set already
  // bounded by limit=100 (which is the catalog router default upper).
  // Map view doesn't need offset/sort; it just plots everything that
  // has coordinates.
  useEffect(() => {
    let cancelled = false;
    apiFetch<CatalogItem[]>("/api/business/catalog?limit=100", { auth: false })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message || "Yuklashda xatolik");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!items || !mapDivRef.current) return;

    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapDivRef.current) return;

        // Tear down any previous instance — happens during HMR or when
        // the dataset re-fetches.
        if (mapRef.current) {
          try {
            mapRef.current.remove();
          } catch {
            // ignore
          }
          mapRef.current = null;
          markersRef.current = [];
        }

        const map = L.map(mapDivRef.current, {
          center: [TASHKENT.lat, TASHKENT.lng],
          zoom: 11,
          scrollWheelZoom: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        const withCoords = items.filter(
          (it) => it.latitude !== null && it.longitude !== null,
        );
        if (withCoords.length === 0) {
          mapRef.current = map;
          return;
        }

        const markers: any[] = [];
        for (const it of withCoords) {
          const stars = "⭐" + (it.rating || 0).toFixed(1);
          const meta = it.reviews_count ? `${stars} · ${it.reviews_count} ta sharh` : "";
          const cat = CATEGORY_ICON[it.category] || "📦";
          const popupHtml = `
            <div style="min-width:180px">
              <div style="font-weight:700;font-size:14px;margin-bottom:2px">
                ${cat} ${escapeHtml(it.name)}
              </div>
              ${meta ? `<div style="font-size:12px;color:#888">${meta}</div>` : ""}
              ${it.address ? `<div style="font-size:12px;color:#444;margin-top:4px">${escapeHtml(it.address)}</div>` : ""}
              <a href="https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(it.slug)}"
                 target="_blank" rel="noopener"
                 style="display:inline-block;margin-top:8px;padding:6px 10px;border-radius:8px;background:#4853F5;color:#fff;font-weight:700;font-size:12px;text-decoration:none">
                Yozilish
              </a>
            </div>
          `;
          const m = L.marker([it.latitude!, it.longitude!]).addTo(map);
          m.bindPopup(popupHtml);
          markers.push(m);
        }

        // Auto-fit bounds so every business is on screen.
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));

        mapRef.current = map;
        markersRef.current = markers;
      })
      .catch(() => setError("Xaritani yuklab bo'lmadi"));

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
        markersRef.current = [];
      }
    };
  }, [items]);

  return (
    <main className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-indigo-600" />
          <span className="font-display text-lg font-extrabold tracking-tight text-ink-900">
            Yaqin biznes
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-ink-500">
          <Star className="h-3.5 w-3.5" />
          {items ? `${items.length} ta biznes` : "Yuklanmoqda…"}
        </div>
      </header>

      {error && (
        <div className="px-4 py-6 text-center text-sm text-coral">{error}</div>
      )}

      {!items && !error && (
        <div className="flex h-[calc(100vh-56px)] items-center justify-center text-ink-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Xarita yuklanmoqda…
        </div>
      )}

      <div
        ref={mapDivRef}
        // 100vh minus the header height so the map fills the screen
        // on a phone WebApp without forcing a page-level scroll.
        style={{ height: "calc(100vh - 56px)" }}
      />
    </main>
  );
}

// Minimal HTML escape for the popup template — Leaflet will inject the
// string as-is, so anything user-supplied (name/address) needs guarding.
function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

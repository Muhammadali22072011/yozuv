"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import { ScreenHeader, Tour, YzLoader, BookingSheet } from "@/components/yz";
import type { ClientLite, ServiceLite, TourStep } from "@/components/yz";
import { apiFetch } from "@/lib/api";
import type { BookingRow } from "@/types";
import { usePageTour } from "@/lib/use-page-tour";

const CALENDAR_TOUR: TourStep[] = [
  {
    targetSelector: "[data-tour='calendar-grid']",
    title: "Hafta jadvalingiz",
    body:
      "Bu yerda 7 kun × 14 soat to'r — har bir kvadrat 1 soat. Mavjud bronlar rangli kartalar bo'lib chiqadi. Bir qarashda haftaning qaysi soati zich, qaysisi bo'sh — ko'rinib turadi.",
    mode: "info",
  },
  {
    targetSelector: "[data-tour='calendar-nav']",
    title: "Haftani almashtirish",
    body:
      "Strelkalar bilan keyingi/oldingi haftaga o'ting. \"Bugun\" tugmasi sizni har doim joriy haftaga qaytaradi.",
    mode: "info",
  },
];

// Calendar week-view dashboard.
//
// The list view at /dashboard/bookings is fine for "today" but useless
// for "do I have anything Friday afternoon next week?" The week grid
// puts seven days × 24 hours on screen, with each booking rendered as
// a card placed at its slot. Clicking a card opens the existing
// BookingSheet for edit/cancel/complete.
//
// Day picker, time-slot grid, status colours — all inline. Drag-drop
// rescheduling is out of scope for v1; an owner can still tap a card
// and use the sheet's date/time edit (#feat/edit-booking already
// shipped) for the same effect.

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00 - 21:00
const HOUR_PX = 56; // height in CSS px for one hour

function startOfWeek(d: Date): Date {
  // Monday-first week — local convention in UZ/RU. JS getDay() is
  // Sun=0; we want Mon=0.
  const day = (d.getDay() + 6) % 7;
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - day);
  return out;
}

function fmtDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDay(d: Date, lang: string): string {
  const days =
    lang === "ru"
      ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
      : ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
  const idx = (d.getDay() + 6) % 7;
  return days[idx];
}

function statusColor(s: BookingRow["status"]): {
  bg: string;
  border: string;
  text: string;
} {
  switch (s) {
    case "CONFIRMED":
      return { bg: "#EEF0FF", border: "#4853F5", text: "#1F2C7F" };
    case "PENDING":
      return { bg: "#FFF3DA", border: "#A8751A", text: "#5C3F0A" };
    case "COMPLETED":
      return { bg: "#E6FAF3", border: "#22C8A8", text: "#0F5A4B" };
    case "CANCELLED":
      return { bg: "#FFE7E3", border: "#C93A2A", text: "#7A2118" };
    default:
      return { bg: "#F1F2F5", border: "#9AA0AB", text: "#454B57" };
  }
}

function parseHM(t: string): { h: number; m: number } {
  // server emits HH:MM[:SS] — split on colon, take the first two.
  const [hStr, mStr] = (t || "00:00").split(":");
  return { h: parseInt(hStr || "0", 10), m: parseInt(mStr || "0", 10) };
}

function hmDiffMinutes(a: string, b: string): number {
  const A = parseHM(a);
  const B = parseHM(b);
  return Math.max(0, B.h * 60 + B.m - (A.h * 60 + A.m));
}

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date()));
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [active, setActive] = useState<BookingRow | null>(null);
  const tour = usePageTour("calendar_v1", CALENDAR_TOUR);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [weekStart]);

  async function load() {
    // Fetch the whole week's bookings in one shot. The list endpoint
    // already supports offset/limit but not date-range — week == 7
    // calls would be wasteful, so we pull the last+next 200 rows
    // ordered desc and filter client-side. For the typical owner
    // (5–30 bookings/day) this stays well under the 200 cap.
    const [list, svc, cli] = await Promise.all([
      apiFetch<BookingRow[]>("/api/business/me/bookings?limit=200"),
      apiFetch<ServiceLite[]>("/api/business/me/services").catch(() => []),
      apiFetch<{ clients: ClientLite[] }>("/api/business/me/dashboard")
        .then((d) => d.clients || [])
        .catch(() => []),
    ]);
    setBookings(list);
    setServices(svc);
    setClients(cli);
  }

  useEffect(() => {
    load().catch(() => setBookings([]));
  }, []);

  const byDay = useMemo(() => {
    const map: Record<string, BookingRow[]> = {};
    for (const d of days) map[fmtDateISO(d)] = [];
    for (const b of bookings || []) {
      const iso = b.date.slice(0, 10);
      if (map[iso]) map[iso].push(b);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [bookings, days]);

  if (!bookings) return <YzLoader fullscreen />;

  const todayIso = fmtDateISO(new Date());

  return (
    <div>
      <ScreenHeader
        title="Kalendar"
        back="/dashboard"
        right={
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700"
          >
            Bugun
          </button>
        }
      />

      <div data-tour="calendar-nav" className="mt-2 flex items-center justify-between px-4 md:px-0">
        <button
          onClick={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() - 7);
            setWeekStart(d);
          }}
          className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 font-display text-sm font-bold text-ink-900">
          <CalIcon className="h-4 w-4 text-indigo-600" />
          {weekStart.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
          })}
          <span className="text-ink-400">—</span>
          {(() => {
            const end = new Date(weekStart);
            end.setDate(end.getDate() + 6);
            return end.toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "short",
            });
          })()}
        </div>
        <button
          onClick={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + 7);
            setWeekStart(d);
          }}
          className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-700"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div data-tour="calendar-grid" className="mt-3 overflow-x-auto px-4 md:px-0">
        <div className="min-w-[880px]">
          {/* Day header row */}
          <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-ink-100">
            <div />
            {days.map((d) => {
              const iso = fmtDateISO(d);
              const isToday = iso === todayIso;
              return (
                <div
                  key={iso}
                  className={`px-2 py-2 text-center ${isToday ? "bg-indigo-50" : ""}`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                    {fmtDay(d, "uz")}
                  </div>
                  <div
                    className={`font-display text-base font-extrabold ${
                      isToday ? "text-indigo-700" : "text-ink-900"
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hours x days grid */}
          <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))]">
            {/* Hours column */}
            <div>
              {HOURS.map((h) => (
                <div
                  key={h}
                  style={{ height: HOUR_PX }}
                  className="border-b border-ink-100 px-2 pt-1 text-[10px] font-semibold text-ink-400"
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d) => {
              const iso = fmtDateISO(d);
              const dayBookings = byDay[iso] || [];
              return (
                <div
                  key={iso}
                  className="relative border-l border-ink-100"
                  style={{ height: HOUR_PX * HOURS.length }}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((_, i) => (
                    <div
                      key={i}
                      className="border-b border-ink-100"
                      style={{ height: HOUR_PX }}
                    />
                  ))}
                  {/* Booking cards positioned by start_time / end_time */}
                  {dayBookings.map((b) => {
                    const top =
                      ((parseHM(b.start_time).h - HOURS[0]) * 60 +
                        parseHM(b.start_time).m) *
                      (HOUR_PX / 60);
                    const height = Math.max(
                      18,
                      hmDiffMinutes(b.start_time, b.end_time) * (HOUR_PX / 60),
                    );
                    if (top < -HOUR_PX || top > HOUR_PX * HOURS.length) {
                      // Booking falls outside the visible 08–22 range;
                      // skip rather than overflow into the next day.
                      return null;
                    }
                    const c = statusColor(b.status);
                    const svc = services.find((s) => s.id === b.service_id);
                    const cli = clients.find((x) => x.id === b.client_id);
                    return (
                      <button
                        key={b.id}
                        onClick={() => setActive(b)}
                        className="absolute left-1 right-1 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left transition-transform hover:scale-[1.01]"
                        style={{
                          top,
                          height,
                          background: c.bg,
                          borderLeftColor: c.border,
                          color: c.text,
                        }}
                      >
                        <div className="text-[10px] font-bold leading-tight">
                          {b.start_time.slice(0, 5)}
                        </div>
                        <div className="truncate text-[11px] font-extrabold">
                          {svc?.name || "Xizmat"}
                        </div>
                        {height > 28 && (
                          <div className="truncate text-[10px] opacity-80">
                            {cli
                              ? `${cli.first_name || ""} ${cli.last_name || ""}`.trim() || "Mijoz"
                              : "Mijoz"}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <BookingSheet
        open={!!active}
        onOpenChange={(v) => !v && setActive(null)}
        booking={active}
        services={services}
        clients={clients}
        onChanged={load}
      />

      <Tour open={tour.open} steps={tour.steps} onClose={tour.dismiss} />
    </div>
  );
}

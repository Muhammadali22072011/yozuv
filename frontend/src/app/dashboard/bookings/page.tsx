"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarX2, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import {
  BookingSheet,
  NewBookingSheet,
  ScreenHeader,
  TimelineBlock,
  TourFloat,
  hm,
  isoFor,
  weekdayShort,
} from "@/components/yz";
import type { ClientLite, ServiceLite, TourStep } from "@/components/yz";
import { apiFetch } from "@/lib/api";
import type { BookingRow, BookingStatus } from "@/types";
import { cn } from "@/lib/utils";
import { usePageTour } from "@/lib/use-page-tour";

const BOOKINGS_TOUR: TourStep[] = [
  {
    targetSelector: "[data-tour='bookings-list']",
    title: "Hamma yozilishlar",
    body:
      "Bu yerda kun bo'yicha bronlar ro'yxati. Holatlar ranglar bilan ajratilgan: ko'k — tasdiqlangan, sariq — kutilmoqda, yashil — yakunlangan, qizil — bekor qilingan. Bron kartasini bosib batafsil ochiladi.",
    mode: "info",
  },
];

// Default daytime hours; the actual range is widened below if a booking
// falls outside it, so 21:00 / 07:00 bookings don't disappear from the
// day timeline.
const DEFAULT_HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 08..19
const STATUS_FILTERS: { key: "ALL" | BookingStatus; label: string }[] = [
  { key: "ALL", label: "Hammasi" },
  { key: "PENDING", label: "Kutilmoqda" },
  { key: "CONFIRMED", label: "Tasdiqlangan" },
  { key: "COMPLETED", label: "Yakunlangan" },
  { key: "CANCELLED", label: "Bekor" },
];

const UZ_MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];

export default function BookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [view, setView] = useState<"day" | "week">("day");
  const [filter, setFilter] = useState<"ALL" | BookingStatus>("ALL");
  const [active, setActive] = useState<BookingRow | null>(null);
  const tour = usePageTour("bookings_v1", BOOKINGS_TOUR);
  const [newOpen, setNewOpen] = useState<string | null>(null);

  async function load() {
    const [b, s, c] = await Promise.all([
      apiFetch<BookingRow[]>("/api/business/me/bookings?limit=200").catch(() => []),
      apiFetch<ServiceLite[]>("/api/business/me/services").catch(() => []),
      apiFetch<ClientLite[]>("/api/business/me/clients").catch(() => []),
    ]);
    setRows(b);
    setServices(s);
    setClients(c);
  }

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("yz:bookings-changed", h);
    return () => window.removeEventListener("yz:bookings-changed", h);
  }, []);

  const weekDays = useMemo(() => {
    const monday = new Date(selected);
    const dow = (monday.getDay() + 6) % 7; // Mon=0
    monday.setDate(monday.getDate() - dow);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [selected]);

  const selectedISO = isoFor(selected);
  const visible = useMemo(() => {
    let base = rows;
    if (filter !== "ALL") base = base.filter((r) => r.status === filter);
    if (view === "day") base = base.filter((r) => r.date === selectedISO);
    return base;
  }, [rows, filter, view, selectedISO]);

  const today = new Date();
  const isToday = (d: Date) => isoFor(d) === isoFor(today);

  const hours = useMemo(() => {
    const set = new Set<number>(DEFAULT_HOURS);
    for (const b of visible) {
      const h = parseInt(b.start_time, 10);
      if (!Number.isNaN(h)) set.add(h);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [visible]);

  return (
    <div>
      <ScreenHeader
        title="Yozilishlar"
        subtitle={`${UZ_MONTHS[selected.getMonth()]} ${selected.getFullYear()}`}
        right={
          <button className="grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-soft tap">
            <Search className="h-5 w-5 text-ink-900" />
          </button>
        }
      />

      {/* Week strip */}
      <div className="mt-1 flex items-center gap-2 px-4 md:px-0">
        <button
          onClick={() => {
            const d = new Date(selected);
            d.setDate(d.getDate() - 7);
            setSelected(d);
          }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-ink-700 shadow-soft-sm tap"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <div className="flex flex-1 gap-2">
          {weekDays.map((d) => {
            const iso = isoFor(d);
            const active = iso === selectedISO;
            return (
              <button
                key={iso}
                onClick={() => setSelected(d)}
                className={cn(
                  "tap flex-1 rounded-2xl py-2.5 text-center transition-all",
                  active ? "text-white" : "bg-white text-ink-900 shadow-soft-sm"
                )}
                style={
                  active
                    ? {
                        background: "linear-gradient(135deg,#7C5CFF,#4853F5)",
                        boxShadow: "0 14px 28px -14px rgba(72,83,245,0.6)",
                      }
                    : undefined
                }
              >
                <div
                  className={cn(
                    "text-[11px] font-bold",
                    active ? "text-white/75" : "text-ink-400"
                  )}
                >
                  {weekdayShort(d)}
                </div>
                <div className="tnum mt-0.5 font-display text-lg font-extrabold tracking-tighter">
                  {d.getDate()}
                </div>
                {isToday(d) && (
                  <div
                    className={cn(
                      "mx-auto mt-0.5 h-1 w-1 rounded-full",
                      active ? "bg-lemon" : "bg-indigo-600"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => {
            const d = new Date(selected);
            d.setDate(d.getDate() + 7);
            setSelected(d);
          }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-ink-700 shadow-soft-sm tap"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>

      {/* View toggle + filters */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-4 md:px-0">
        <div className="inline-flex rounded-2xl bg-ink-100 p-1">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "tap rounded-xl px-4 py-1.5 font-display text-[13px] font-bold transition-all",
                view === v ? "bg-white text-ink-900 shadow-soft-sm" : "text-ink-500"
              )}
            >
              {v === "day" ? "Kun" : "Hafta"}
            </button>
          ))}
        </div>
        <div className="text-[13px] font-semibold text-ink-500">
          <span className="tnum">{visible.length}</span> ta yozilish
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto scroll px-4 md:px-0">
        {STATUS_FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === "ALL" ? rows.length : rows.filter((r) => r.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn("chip tap", active && "chip-active")}
            >
              {f.label}
              <span className={active ? "opacity-70" : "opacity-60"}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline / list */}
      <div data-tour="bookings-list" className="mt-4 px-4 md:px-0">
        {view === "day" ? (
          <div>
            {hours.map((h) => {
              const hStr = `${String(h).padStart(2, "0")}:00`;
              const matching = visible.filter((b) => parseInt(b.start_time) === h);
              return (
                <div key={h} className="flex items-start gap-3 min-h-[68px]">
                  <div className="tnum w-12 shrink-0 pt-2 font-mono text-xs font-bold text-ink-400">
                    {hStr}
                  </div>
                  <div className="min-h-[60px] flex-1 border-t border-ink-100 pt-2 pb-2">
                    {matching.length === 0 ? (
                      <button
                        onClick={() => setNewOpen(hStr)}
                        className="tap flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-ink-200 text-xs font-semibold text-ink-300 transition-colors hover:border-indigo-200 hover:text-indigo-400"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.4} /> Bo‘sh slot
                      </button>
                    ) : (
                      matching.map((b) => (
                        <TimelineBlock
                          key={b.id}
                          b={b}
                          services={services}
                          clients={clients}
                          onClick={() => setActive(b)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div data-tour="bookings-list" className="grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
            {visible.length === 0 ? (
              <div className="card-soft col-span-full flex flex-col items-center gap-3 px-6 py-10 text-center">
                <div className="tile-indigo grid h-14 w-14 place-items-center rounded-2xl p-0">
                  <CalendarX2 className="h-6 w-6 text-indigo-500" strokeWidth={2} />
                </div>
                <div className="text-sm font-semibold text-ink-400">Yozilish yo‘q</div>
              </div>
            ) : (
              visible.map((b) => (
                <div key={b.id} className="card-soft p-3.5">
                  <div className="eyebrow tnum">
                    {b.date} · {hm(b.start_time)}
                  </div>
                  <div className="mt-2.5">
                    <TimelineBlock
                      b={b}
                      services={services}
                      clients={clients}
                      onClick={() => setActive(b)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <BookingSheet
        open={!!active}
        onOpenChange={(v) => !v && setActive(null)}
        booking={active}
        services={services}
        clients={clients}
        onChanged={load}
      />

      <NewBookingSheet
        open={!!newOpen}
        onOpenChange={(v) => !v && setNewOpen(null)}
        defaultDate={selectedISO}
        defaultTime={newOpen || undefined}
        onCreated={() => {
          load();
          setNewOpen(null);
        }}
      />

      <TourFloat tour={tour} />
    </div>
  );
}

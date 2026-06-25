"use client";

import { useEffect, useState } from "react";
import { CalendarOff, Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { ScreenHeader, useToast } from "@/components/yz";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type Day = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  is_working: boolean;
};

type Holiday = {
  id: string;
  date: string;
  reason: string;
};

const DAY_NAMES = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
  "Yakshanba",
];

function toHM(t: string): string {
  return (t || "").slice(0, 5);
}

function toHMS(t: string): string {
  if (!t) return "09:00:00";
  return t.length === 5 ? `${t}:00` : t;
}

// API uses 0=Mon..6=Sun based on the prototype labels
export default function SchedulePage() {
  const toast = useToast();
  const [rows, setRows] = useState<Day[]>([]);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<number | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState<string>("");
  const [holidayReason, setHolidayReason] = useState<string>("");
  const [addingHoliday, setAddingHoliday] = useState(false);

  async function loadHolidays() {
    const got = await apiFetch<Holiday[]>("/api/business/me/holidays").catch(() => []);
    setHolidays(got);
  }

  async function addHoliday() {
    if (!holidayDate) {
      toast("Sanani tanlang");
      return;
    }
    setAddingHoliday(true);
    try {
      await apiFetch("/api/business/me/holidays", {
        method: "POST",
        body: JSON.stringify({ date: holidayDate, reason: holidayReason }),
      });
      setHolidayDate("");
      setHolidayReason("");
      await loadHolidays();
      toast("Dam olish kuni qo'shildi");
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setAddingHoliday(false);
    }
  }

  async function removeHoliday(id: string) {
    try {
      await apiFetch(`/api/business/me/holidays/${id}`, { method: "DELETE" });
      setHolidays((h) => h.filter((x) => x.id !== id));
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    }
  }

  async function load() {
    const got = await apiFetch<Day[]>("/api/business/me/schedule").catch(() => []);
    if (got.length === 0) {
      setRows(
        Array.from({ length: 7 }).map((_, i) => ({
          day_of_week: i,
          start_time: "09:00:00",
          end_time: "20:00:00",
          break_start: null,
          break_end: null,
          is_working: i < 6,
        }))
      );
      return;
    }
    const byDow: Record<number, Day> = {};
    got.forEach((d) => (byDow[d.day_of_week] = d));
    setRows(
      Array.from({ length: 7 }).map((_, i) =>
        byDow[i] ?? {
          day_of_week: i,
          start_time: "09:00:00",
          end_time: "20:00:00",
          break_start: null,
          break_end: null,
          is_working: false,
        }
      )
    );
  }

  useEffect(() => {
    load();
    loadHolidays();
  }, []);

  function update(i: number, patch: Partial<Day>) {
    setRows((r) => r.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function toggle(i: number) {
    const d = rows[i];
    update(i, { is_working: !d.is_working });
  }

  async function save() {
    const bad = rows.find(
      (d) => d.is_working && toHM(d.start_time) >= toHM(d.end_time)
    );
    if (bad) {
      toast(
        `${DAY_NAMES[bad.day_of_week]}: boshlanish vaqti tugash vaqtidan oldin bo'lishi kerak`
      );
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/business/me/schedule", {
        method: "PUT",
        body: JSON.stringify({
          days: rows.map((d) => ({
            day_of_week: d.day_of_week,
            start_time: toHMS(d.start_time),
            end_time: toHMS(d.end_time),
            break_start: d.break_start ? toHMS(d.break_start) : null,
            break_end: d.break_end ? toHMS(d.break_end) : null,
            is_working: d.is_working,
          })),
        }),
      });
      toast("Jadval saqlandi");
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <ScreenHeader
        title="Ish jadvali"
        subtitle="Haftalik ish kunlari"
        right={
          <button onClick={save} disabled={saving} className="btn-primary px-4 py-2.5 text-sm">
            {saving ? "…" : "Saqlash"}
          </button>
        }
      />

      <div className="mt-2 px-4 md:px-0">
        <div className="card-soft divide-y divide-ink-100 p-2">
          {rows.map((d, i) => (
            <div key={d.day_of_week} className="px-2.5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div
                    className={cn(
                      "font-display text-[15px] font-bold tracking-tight",
                      d.is_working ? "text-ink-900" : "text-ink-300"
                    )}
                  >
                    {DAY_NAMES[i]}
                  </div>
                  <div className="mt-1">
                    {d.is_working ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 tnum text-xs font-bold text-success">
                        <Clock3 className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {toHM(d.start_time)} – {toHM(d.end_time)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-400">
                        <CalendarOff className="h-3.5 w-3.5" strokeWidth={2.2} />
                        Dam olish kuni
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggle(i)}
                  className={cn(
                    "h-[28px] w-12 rounded-full p-[3px] transition-colors tap",
                    d.is_working ? "bg-indigo-600" : "bg-ink-200"
                  )}
                  aria-label={d.is_working ? "Yopish" : "Ochish"}
                >
                  <span
                    className={cn(
                      "block h-[22px] w-[22px] rounded-full bg-white shadow-soft-sm transition-transform",
                      d.is_working ? "translate-x-[19px]" : ""
                    )}
                  />
                </button>
                {d.is_working && (
                  <button
                    onClick={() => setEdit(edit === i ? null : i)}
                    className={cn(
                      "ml-0.5 inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-bold tap transition-colors",
                      edit === i
                        ? "bg-indigo-600 text-white"
                        : "bg-indigo-50 text-indigo-700"
                    )}
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />
                    {edit === i ? "Yopish" : "Tahrir"}
                  </button>
                )}
              </div>

              {d.is_working && edit === i && (
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-ink-50 p-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink-500">Boshlanish</label>
                    <input
                      type="time"
                      value={toHM(d.start_time)}
                      onChange={(e) => update(i, { start_time: e.target.value })}
                      className="yz-input mt-1 tnum"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-500">Tugash</label>
                    <input
                      type="time"
                      value={toHM(d.end_time)}
                      onChange={(e) => update(i, { end_time: e.target.value })}
                      className="yz-input mt-1 tnum"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 px-4 md:px-0">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-coral/10 text-coral">
            <CalendarOff className="h-4.5 w-4.5" strokeWidth={2.2} />
          </div>
          <div>
            <div className="font-display text-[15px] font-extrabold tracking-tight text-ink-900">
              Dam olish kunlari
            </div>
            <div className="mt-0.5 text-xs text-ink-400">
              Bir kunlik bayramlar va ta'tillar
            </div>
          </div>
        </div>

        <div className="card-soft p-3.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-ink-500">Sana</label>
              <input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="yz-input mt-1"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-ink-500">Sabab</label>
              <input
                type="text"
                value={holidayReason}
                onChange={(e) => setHolidayReason(e.target.value)}
                placeholder="Masalan: Hayit"
                className="yz-input mt-1"
              />
            </div>
            <button
              onClick={addHoliday}
              disabled={addingHoliday || !holidayDate}
              className="btn-primary inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Qo'shish
            </button>
          </div>

          <div className="mt-3.5">
            {holidays.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-3xl bg-ink-50 px-5 py-7 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/70 text-ink-300 shadow-soft-sm">
                  <CalendarOff className="h-6 w-6" strokeWidth={2} />
                </div>
                <div className="text-sm font-medium text-ink-400">
                  Hozircha dam olish kunlari yo'q
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {holidays.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center gap-3 rounded-2xl bg-ink-50 px-3 py-2.5"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-coral shadow-soft-sm">
                      <CalendarOff className="h-4.5 w-4.5" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="tnum font-display text-sm font-bold text-ink-900">
                        {h.date}
                      </div>
                      {h.reason && (
                        <div className="mt-0.5 truncate text-xs text-ink-400">
                          {h.reason}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeHoliday(h.id)}
                      className="grid h-9 w-9 place-items-center rounded-xl bg-danger-bg text-danger tap"
                      aria-label="O'chirish"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

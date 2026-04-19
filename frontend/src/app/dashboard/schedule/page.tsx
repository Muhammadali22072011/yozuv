"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type Day = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  is_working: boolean;
};

const days = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

function toHM(t: string): string {
  return (t || "").slice(0, 5);
}

function toHMS(t: string): string {
  if (!t) return "09:00:00";
  return t.length === 5 ? `${t}:00` : t;
}

export default function SchedulePage() {
  const [rows, setRows] = useState<Day[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const got = await apiFetch<Day[]>("/api/business/me/schedule");
    if (got.length === 0) {
      setRows(
        Array.from({ length: 7 }).map((_, i) => ({
          day_of_week: i,
          start_time: "09:00:00",
          end_time: "18:00:00",
          break_start: null,
          break_end: null,
          is_working: i < 5,
        }))
      );
    } else {
      const byDow: Record<number, Day> = {};
      got.forEach((d) => (byDow[d.day_of_week] = d));
      setRows(
        Array.from({ length: 7 }).map((_, i) =>
          byDow[i] ?? {
            day_of_week: i,
            start_time: "09:00:00",
            end_time: "18:00:00",
            break_start: null,
            break_end: null,
            is_working: false,
          }
        )
      );
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  function update(i: number, patch: Partial<Day>) {
    setRows((r) => r.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function save() {
    setMsg("");
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
      setMsg("Saqlandi ✓");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg((e as Error).message || "Xatolik");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Jadval</h2>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-ink/60">{msg}</span>}
          <Button onClick={save}>Saqlash</Button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.day_of_week}
            className="rounded-xl border border-ink/10 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">{days[r.day_of_week]}</div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={r.is_working}
                  onChange={(e) => update(i, { is_working: e.target.checked })}
                />
                {r.is_working ? "Ochiq" : "Yopiq"}
              </label>
            </div>
            {r.is_working && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-ink/60">Boshlanish</label>
                  <input
                    type="time"
                    value={toHM(r.start_time)}
                    onChange={(e) => update(i, { start_time: e.target.value })}
                    className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink/60">Tugash</label>
                  <input
                    type="time"
                    value={toHM(r.end_time)}
                    onChange={(e) => update(i, { end_time: e.target.value })}
                    className="mt-1 w-full rounded-md border border-ink/10 p-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

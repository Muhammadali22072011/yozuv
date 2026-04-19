"use client";

import { useMemo } from "react";
import type { BookingRow } from "@/types";

type Props = {
  rows: BookingRow[];
  month: Date;
  selectedDate: string | null;
  onMonthChange: (d: Date) => void;
  onSelectDate: (iso: string | null) => void;
};

const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const MONTHS_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingsCalendar({ rows, month, selectedDate, onMonthChange, onSelectDate }: Props) {
  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.date, (map.get(r.date) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const { cells, monthLabel } = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(year, m, 1);
    const last = new Date(year, m + 1, 0);
    // Monday = 0, Sunday = 6
    const leading = (first.getDay() + 6) % 7;
    const cells: { iso: string; day: number; inMonth: boolean }[] = [];
    // leading days from previous month
    for (let i = leading; i > 0; i--) {
      const d = new Date(year, m, 1 - i);
      cells.push({ iso: toISO(d), day: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push({ iso: toISO(new Date(year, m, d)), day: d, inMonth: true });
    }
    // trailing to fill 6 rows × 7 cols = 42
    while (cells.length < 42) {
      const d = new Date(year, m + 1, cells.length - leading - last.getDate() + 1);
      cells.push({ iso: toISO(d), day: d.getDate(), inMonth: false });
    }
    return { cells, monthLabel: `${MONTHS_UZ[m]} ${year}` };
  }, [month]);

  const todayISO = toISO(new Date());

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="rounded-full border border-border px-3 py-1 text-sm hover:bg-cream"
          aria-label="Previous month"
        >
          ◀
        </button>
        <div className="text-sm font-semibold">{monthLabel}</div>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="rounded-full border border-border px-3 py-1 text-sm hover:bg-cream"
          aria-label="Next month"
        >
          ▶
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-ink/40">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const count = countsByDate.get(c.iso) ?? 0;
          const isSelected = selectedDate === c.iso;
          const isToday = c.iso === todayISO;
          const base =
            "relative aspect-square rounded-lg text-sm flex flex-col items-center justify-center transition " +
            (c.inMonth ? "text-ink" : "text-ink/25") +
            " " +
            (isSelected
              ? "bg-ink text-white"
              : count > 0
              ? "bg-cream hover:bg-cream/70 cursor-pointer"
              : "hover:bg-cream cursor-pointer");
          return (
            <button
              key={c.iso}
              type="button"
              onClick={() => onSelectDate(isSelected ? null : c.iso)}
              className={base}
            >
              <span className={isToday && !isSelected ? "font-bold text-brand" : ""}>{c.day}</span>
              {count > 0 && (
                <span
                  className={
                    "mt-0.5 text-[10px] leading-none " +
                    (isSelected ? "text-white/80" : "text-ink/60")
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-3 flex items-center justify-between text-xs text-ink/60">
          <span>Sana: {selectedDate}</span>
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="text-brand hover:underline"
          >
            Tozalash
          </button>
        </div>
      )}
    </div>
  );
}

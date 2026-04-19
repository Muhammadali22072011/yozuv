"use client";

import { useEffect, useState } from "react";
import { BookingsList, type ClientLite, type ServiceLite } from "@/components/dashboard/BookingsList";
import { BookingsCalendar } from "@/components/dashboard/BookingsCalendar";
import { apiFetch } from "@/lib/api";
import type { BookingRow, BookingStatus } from "@/types";

const STATUS_FILTERS: { key: "ALL" | BookingStatus; label: string }[] = [
  { key: "ALL", label: "Hammasi" },
  { key: "PENDING", label: "Kutilmoqda" },
  { key: "CONFIRMED", label: "Tasdiqlangan" },
  { key: "COMPLETED", label: "Yakunlangan" },
  { key: "CANCELLED", label: "Bekor" },
];

export default function BookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [filter, setFilter] = useState<"ALL" | BookingStatus>("ALL");
  const [month, setMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  async function load() {
    const [b, s, c] = await Promise.all([
      apiFetch<BookingRow[]>("/api/business/me/bookings?limit=100"),
      apiFetch<ServiceLite[]>("/api/business/me/services").catch(() => []),
      apiFetch<ClientLite[]>("/api/business/me/clients").catch(() => []),
    ]);
    setRows(b);
    setServices(s);
    setClients(c);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const byStatus = filter === "ALL" ? rows : rows.filter((r) => r.status === filter);
  const visible = selectedDate ? byStatus.filter((r) => r.date === selectedDate) : byStatus;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Barcha yozilishlar</h2>
        <p className="mt-1 text-sm text-ink/60">{rows.length} ta yozilish</p>
      </div>

      <BookingsCalendar
        rows={rows}
        month={month}
        selectedDate={selectedDate}
        onMonthChange={setMonth}
        onSelectDate={setSelectedDate}
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = filter === f.key;
          const count =
            f.key === "ALL" ? rows.length : rows.filter((r) => r.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                "rounded-full px-4 py-1.5 text-sm " +
                (active
                  ? "bg-ink text-white"
                  : "border border-border bg-white text-ink/70 hover:bg-cream")
              }
            >
              {f.label}
              <span className={"ml-1.5 text-xs " + (active ? "text-white/70" : "text-ink/40")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <BookingsList rows={visible} services={services} clients={clients} onChanged={load} />
    </div>
  );
}

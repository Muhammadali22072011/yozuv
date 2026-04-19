"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

type Period = "today" | "week" | "month" | "year";

const DAYS_BY_PERIOD: Record<Period, number> = {
  today: 1,
  week: 7,
  month: 30,
  year: 365,
};

function shortDate(iso: string) {
  return iso.slice(5).replace("-", "/");
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [rev, setRev] = useState<{ date: string; amount: number }[]>([]);
  const [bookings, setBookings] = useState<{ date: string; bookings: number }[]>([]);
  const [popular, setPopular] = useState<{ service_id: string; name: string; bookings: number }[]>([]);
  const [summary, setSummary] = useState({ bookings_count: 0, revenue: 0, clients_count: 0 });

  useEffect(() => {
    const days = DAYS_BY_PERIOD[period];
    Promise.all([
      apiFetch<{ date: string; amount: number }[]>(`/api/business/me/analytics/revenue?days=${days}`).catch(() => []),
      apiFetch<{ date: string; bookings: number }[]>(
        `/api/business/me/analytics/bookings-by-day?days=${days}`
      ).catch(() => []),
      apiFetch<{ service_id: string; name: string; bookings: number }[]>(
        "/api/business/me/analytics/popular-services"
      ).catch(() => []),
      apiFetch<{ bookings_count: number; revenue: number; clients_count: number }>(
        `/api/business/me/analytics/summary?period=${period}`
      ).catch(() => ({ bookings_count: 0, revenue: 0, clients_count: 0 })),
    ]).then(([r, b, p, s]) => {
      setRev(r);
      setBookings(b);
      setPopular(p);
      setSummary(s);
    });
  }, [period]);

  const revSum = rev.reduce((a, x) => a + x.amount, 0);
  const bookingsSum = bookings.reduce((a, x) => a + x.bookings, 0);
  const hasRev = revSum > 0;
  const hasBookings = bookingsSum > 0;

  const bars = bookings.map((x) => ({ name: shortDate(x.date), bookings: x.bookings }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl">Analitika</h2>
        <p className="mt-1 text-sm text-ink/60">Haqiqiy yozilishlar va daromad bo&apos;yicha ko&apos;rsatkichlar</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["today", "Bugun"],
            ["week", "Hafta"],
            ["month", "Oy"],
            ["year", "Yil"],
          ] as const
        ).map(([p, label]) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              period === p ? "bg-ink text-white" : "bg-cream hover:bg-ochre/20"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-ink/50">Yozilishlar</div>
          <div className="mt-2 font-serif text-2xl">{summary.bookings_count}</div>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-ink/50">Daromad</div>
          <div className="mt-2 font-serif text-2xl">
            {summary.revenue.toLocaleString("uz-UZ")} so&apos;m
          </div>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-ink/50">Mijozlar</div>
          <div className="mt-2 font-serif text-2xl">{summary.clients_count}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daromad dinamikasi</CardTitle>
          </CardHeader>
          <CardContent>
            {hasRev ? (
              <RevenueChart data={rev} />
            ) : (
              <div className="grid h-60 place-items-center rounded-xl border border-dashed border-ink/10 bg-cream/30 text-center text-sm text-ink/50">
                <div>
                  Hozircha daromad yo&apos;q.
                  <div className="mt-1 text-xs">Yozilishlar paydo bo&apos;lgach, grafik chiziladi.</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yozilishlar soni (kunlik)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {hasBookings ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                  <Tooltip
                    formatter={(v: number) => [`${v} ta yozilish`, "Yozilishlar"]}
                    labelFormatter={(l) => `Sana: ${l}`}
                    contentStyle={{ borderRadius: 12, border: "1px solid #E5E5E5", fontSize: 12 }}
                  />
                  <Bar dataKey="bookings" fill="#111111" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-ink/10 bg-cream/30 text-center text-sm text-ink/50">
                <div>
                  Tanlangan davrda yozilish bo&apos;lmagan.
                  <div className="mt-1 text-xs">QR-broshyurani chop etib, mijozlarga tarqating.</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mashhur xizmatlar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {popular.length === 0 ? (
            <p className="text-ink/50">Hali ma&apos;lumot yo&apos;q.</p>
          ) : (
            popular.map((p) => (
              <div
                key={p.service_id}
                className="flex items-center justify-between rounded-lg bg-cream px-3 py-2"
              >
                <span>{p.name}</span>
                <span className="text-ink/60">{p.bookings} ta</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

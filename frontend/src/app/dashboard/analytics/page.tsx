"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { ScreenHeader, SectionLabel, fmtShort, fmtSum } from "@/components/yz";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const RevenueChart = dynamic(() => import("./RevenueChart").then((m) => m.RevenueChart), {
  ssr: false,
  loading: () => <div className="h-28" />,
});

type Period = "today" | "week" | "month" | "year";
const DAYS_BY_PERIOD: Record<Period, number> = { today: 1, week: 7, month: 30, year: 365 };

const WEEK_LABELS = ["Ya", "Du", "Se", "Cho", "Pa", "Ju", "Sh"];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [rev, setRev] = useState<{ date: string; amount: number }[]>([]);
  const [bookings, setBookings] = useState<{ date: string; bookings: number }[]>([]);
  const [popular, setPopular] = useState<{ service_id: string; name: string; bookings: number; revenue?: number }[]>([]);
  const [summary, setSummary] = useState({ bookings_count: 0, revenue: 0, clients_count: 0 });
  const [prevSummary, setPrevSummary] = useState<{ revenue: number } | null>(null);

  useEffect(() => {
    const days = DAYS_BY_PERIOD[period];
    Promise.all([
      apiFetch<{ date: string; amount: number }[]>(
        `/api/business/me/analytics/revenue?days=${days}`
      ).catch(() => []),
      apiFetch<{ date: string; bookings: number }[]>(
        `/api/business/me/analytics/bookings-by-day?days=${days}`
      ).catch(() => []),
      apiFetch<{ service_id: string; name: string; bookings: number; revenue?: number }[]>(
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
      // previous period approx from earlier half of revenue series
      if (r.length > 1) {
        const half = Math.floor(r.length / 2);
        const prev = r.slice(0, half).reduce((a, x) => a + x.amount, 0);
        setPrevSummary({ revenue: prev });
      } else {
        setPrevSummary(null);
      }
    });
  }, [period]);

  const revSum = rev.reduce((a, x) => a + x.amount, 0);
  const bars = bookings.slice(-7).map((x) => {
    const d = new Date(x.date);
    return { day: WEEK_LABELS[d.getDay()], value: x.bookings };
  });
  const maxBar = Math.max(1, ...bars.map((b) => b.value));
  const highlightIdx = bars.reduce((acc, cur, i) => (cur.value >= (bars[acc]?.value || 0) ? i : acc), 0);

  const pctChange = prevSummary && prevSummary.revenue > 0
    ? Math.round(((revSum - prevSummary.revenue) / prevSummary.revenue) * 100)
    : null;

  const topTotal = popular.reduce((a, x) => a + (x.revenue || 0), 0);
  const topColors = ["#FFC94A", "#4853F5", "#FF9FB5", "#22C8A8", "#B8A6FF"];

  return (
    <div>
      <ScreenHeader title="Analitika" subtitle="Biznesingiz natijalari" />

      <div className="mt-1 flex gap-2 px-4 md:px-0">
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
            onClick={() => setPeriod(p)}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-center font-display text-[13px] font-bold transition-colors",
              period === p
                ? "bg-ink-900 text-white shadow-[0_4px_12px_rgba(11,15,31,0.2)]"
                : "bg-white text-ink-500 shadow-soft"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 px-4 md:px-0">
        <div
          className="relative overflow-hidden rounded-[22px] p-5 text-white shadow-soft"
          style={{ background: "linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)" }}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-indigo-500/30 blur-2xl" />
          <div className="relative">
            <div className="text-xs font-bold uppercase tracking-wide text-white/70">
              Davr daromadi
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <div className="font-display text-4xl font-extrabold tracking-tight">
                {fmtSum(summary.revenue)}
              </div>
              <div className="text-sm font-semibold text-white/70">so‘m</div>
            </div>
            {pctChange !== null && (
              <div
                className={cn(
                  "mt-2.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold",
                  pctChange >= 0 ? "bg-mint/20 text-mint" : "bg-coral/25 text-coral"
                )}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {pctChange >= 0 ? "+" : ""}
                {pctChange}% o‘tgan davrga
              </div>
            )}
          </div>

          {bars.length > 0 && (
            <div className="relative mt-5 h-28">
              <RevenueChart bars={bars} maxBar={maxBar} highlightIdx={highlightIdx} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 px-4 md:grid-cols-4 md:px-0">
        <MiniStat label="Yozilishlar" value={summary.bookings_count} color="#4853F5" />
        <MiniStat label="Yangi mijoz" value={summary.clients_count} color="#22C8A8" />
        <MiniStat
          label="O‘rtacha chek"
          value={
            summary.bookings_count
              ? `${fmtShort(Math.round(summary.revenue / summary.bookings_count))}`
              : "—"
          }
          color="#FFC94A"
        />
        <MiniStat
          label="Daromad"
          value={fmtShort(summary.revenue)}
          color="#FF7A6B"
        />
      </div>

      <div className="mt-5 px-4 md:px-0">
        <SectionLabel title="Eng mashhur xizmatlar" />
        <div className="card-soft mt-2.5 p-4">
          {popular.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">Hali ma‘lumot yo‘q</p>
          ) : (
            popular.slice(0, 5).map((p, i) => {
              const color = topColors[i % topColors.length];
              const pct = topTotal > 0 ? ((p.revenue || 0) / topTotal) * 100 : 0;
              return (
                <div key={p.service_id} className={i > 0 ? "mt-3.5" : ""}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
                      <span className="font-display text-sm font-bold text-ink-900">
                        {p.name}
                      </span>
                    </div>
                    <span className="font-display text-[13px] font-extrabold text-ink-900">
                      {p.revenue ? fmtSum(p.revenue) : `${p.bookings} ta`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(8, pct)}%`, background: color }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-ink-400">
                    {p.bookings} ta yozilish
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: React.ReactNode;
  color: string;
}) {
  return (
    <div className="card-soft p-3.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{label}</div>
      <div
        className="mt-1 font-display text-[22px] font-extrabold tracking-tight"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, QrCode, Scissors, Settings } from "lucide-react";
import { BookingsList, type ClientLite, type ServiceLite } from "@/components/dashboard/BookingsList";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { apiFetch } from "@/lib/api";
import type { BookingRow, BusinessMe } from "@/types";

type Sub = { plan: string; status: string; expires_at: string | null };

export default function DashboardHome() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [biz, setBiz] = useState<BusinessMe | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [summary, setSummary] = useState({ bookings: 0, revenue: 0, clients: 0 });
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [svcCount, setSvcCount] = useState(0);
  const [schedCount, setSchedCount] = useState(0);

  async function load() {
    const s = await apiFetch<{ bookings_count: number; revenue: number; clients_count: number }>(
      "/api/business/me/analytics/summary?period=week"
    );
    setSummary({ bookings: s.bookings_count, revenue: s.revenue, clients: s.clients_count });
    const today = new Date().toISOString().slice(0, 10);
    const b = await apiFetch<BookingRow[]>(`/api/business/me/bookings?booking_date=${today}`);
    setBookings(b);
    const svc = await apiFetch<ServiceLite[]>("/api/business/me/services").catch(() => []);
    setServices(svc);
    setSvcCount(svc.length);
    const cli = await apiFetch<ClientLite[]>("/api/business/me/clients").catch(() => []);
    setClients(cli);
    const sch = await apiFetch<{ is_working: boolean }[]>("/api/business/me/schedule").catch(() => []);
    setSchedCount(sch.filter((x) => x.is_working).length);
    const subNow = await apiFetch<Sub>("/api/subscription").catch(() => null);
    setSub(subNow);
  }

  useEffect(() => {
    apiFetch<BusinessMe>("/api/business/me")
      .then((b) => {
        setBiz(b);
        setReady(true);
        load().catch(() => {});
      })
      .catch(() => router.replace("/dashboard/onboarding"));
  }, [router]);

  if (!ready) return <p className="text-sm text-ink/60">Yuklanmoqda…</p>;

  const setupDone = svcCount > 0 && schedCount > 0;
  const trialDaysLeft = sub?.expires_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(sub.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card p-5">
        <div className="text-xs uppercase tracking-wide text-ink/50">Biznesingiz</div>
        <h1 className="mt-1 text-2xl font-semibold">{biz?.name}</h1>
        <p className="mt-2 text-xs text-ink/60">
          Mijozlar havolasi:{" "}
          <span className="font-mono text-ink">t.me/Yozuv_cl_bot?start={biz?.slug}</span>
        </p>
        {sub && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1 text-xs">
            {sub.plan === "TRIAL" ? `🎁 Trial: ${trialDaysLeft} kun qoldi` : `✅ ${sub.plan}`}
          </div>
        )}
      </div>

      {!setupDone && (
        <div className="card p-4">
          <div className="text-lg font-semibold">Birinchi qadamlar</div>
          <p className="mt-1 text-sm text-ink/70">
            Mijozlar yozila olishi uchun xizmatlar va jadvalni sozlang.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <Link
              href="/dashboard/services"
              className="flex items-center justify-between rounded-xl bg-cream p-3 text-sm hover:bg-cream/70"
            >
              <span className="flex items-center gap-2">
                <Scissors className="h-4 w-4" />
                {svcCount > 0 ? `${svcCount} ta xizmat` : "Xizmat qo'shish"}
              </span>
              <ArrowRight className="h-4 w-4 text-ink/40" />
            </Link>
            <Link
              href="/dashboard/schedule"
              className="flex items-center justify-between rounded-xl bg-cream p-3 text-sm hover:bg-cream/70"
            >
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {schedCount > 0 ? `${schedCount} ish kuni` : "Jadvalni sozlash"}
              </span>
              <ArrowRight className="h-4 w-4 text-ink/40" />
            </Link>
          </div>
        </div>
      )}

      <StatsCards bookings={summary.bookings} revenue={summary.revenue} clients={summary.clients} />

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Bugungi yozilishlar</h3>
          <Link href="/dashboard/bookings" className="text-xs text-brand hover:underline">
            Barchasini ko&apos;rish
          </Link>
        </div>
        <div className="mt-4">
          <BookingsList
            rows={bookings}
            services={services}
            clients={clients}
            onChanged={load}
            emptyMessage="Bugun hali yozilish yo'q."
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link
          href="/dashboard/qr"
          className="card flex items-center gap-3 p-4 hover:bg-cream"
        >
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-cream text-ink">
            <QrCode className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium">QR / Broshyura</div>
            <div className="text-xs text-ink/60">Chop eting va osib qo&apos;ying</div>
          </div>
        </Link>
        <Link
          href="/dashboard/profile"
          className="card flex items-center gap-3 p-4 hover:bg-cream"
        >
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-cream text-ink">
            <Settings className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium">Profil</div>
            <div className="text-xs text-ink/60">Logotip, matnlar, rejim</div>
          </div>
        </Link>
        <Link
          href="/dashboard/settings"
          className="card flex items-center gap-3 p-4 hover:bg-cream"
        >
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-cream text-ink">
            💳
          </div>
          <div>
            <div className="text-sm font-medium">To&apos;lov</div>
            <div className="text-xs text-ink/60">Obunani uzaytirish</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

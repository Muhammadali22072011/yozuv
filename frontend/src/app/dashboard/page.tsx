"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Copy,
  HelpCircle,
  Phone,
  QrCode,
  Scissors,
  Share2,
  Star,
  Tag,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { BookingRow, BusinessMe } from "@/types";
import {
  BookingCard,
  BookingSheet,
  HelpDrawer,
  HeroGradient,
  NotificationSheet,
  SectionLabel,
  Tour,
  WelcomeModal,
  YzLoader,
  YzLogo,
  callPhone,
  fmtShort,
  fmtSum,
  hm,
  longDate,
  todayISO,
  useToast,
} from "@/components/yz";
import type { ClientLite, NotificationItem, ServiceLite, TourStep } from "@/components/yz";
import { StatusBadge } from "@/components/yz/StatusBadge";
import { hasSeenTour, markTourSeen } from "@/lib/tour-state";
import { startOnboarding } from "@/lib/onboarding";

const DASHBOARD_TOUR_ID = "dashboard_v1";

const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="hero-stats"]',
    title: "Bugungi statistika",
    body: "Bu yerda bugungi bronlar, kunlik daromad va haftadagi mijozlar soni ko'rinadi. Ish jarayonini bir qarashda baholash uchun.",
  },
  {
    targetSelector: '[data-tour="bell"]',
    title: "Bildirishnomalar",
    body: "Yangi bron, otmen, izoh — hammasi shu yerda. Yon ustidagi raqam — hali ko'rmagan xabarlar soni.",
  },
  {
    targetSelector: '[data-tour="quick-actions"]',
    title: "Tezkor amallar",
    body: "QR kod, promo-kodlar, xizmatlar va baholar — eng tez-tez ishlatadigan bo'limlar shu yerda.",
  },
  {
    targetSelector: '[data-tour="bot-link"]',
    title: "Mijozlar havolangiz",
    body: "Bossangiz havola buferiga ko'chiriladi. WhatsApp, Instagram yoki vizit kartochkasiga joylashtiring — har bir bosish sizga mijoz olib keladi.",
  },
  {
    targetSelector: '[data-tour="help"]',
    title: "Yordam",
    body: "Biror nima noaniq bo'lsa — bu tugma orqali tez-tez beriladigan savollarga javoblar va support bilan bog'lanish.",
  },
];

type Sub = { plan: string; status: string; expires_at: string | null };

export default function DashboardHome() {
  const router = useRouter();
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [biz, setBiz] = useState<BusinessMe | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [me, setMe] = useState<{ first_name: string; last_name: string } | null>(null);
  const [summary, setSummary] = useState({ bookings: 0, revenue: 0, clients: 0, weekRevenue: 0 });
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [promoCount, setPromoCount] = useState(0);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [svcCount, setSvcCount] = useState(0);
  const [activeBooking, setActiveBooking] = useState<BookingRow | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Tutorial state — welcome modal first, then optional guided tour.
  // Auto-shown only on the very first visit; the "?" button always
  // reopens the help drawer regardless.
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  type DashboardBundle = {
    business: BusinessMe;
    user: { first_name: string; last_name: string };
    summary: {
      today: { bookings_count: number; revenue: number };
      week: { revenue: number; clients_count: number };
    };
    bookings_today: BookingRow[];
    services: ServiceLite[];
    clients: ClientLite[];
    counts: { active_promo: number; reviews: number; services: number };
    subscription: Sub | null;
  };

  async function load() {
    const data = await apiFetch<DashboardBundle>("/api/business/me/dashboard");
    setBiz(data.business);
    setMe(data.user);
    setSummary({
      bookings: data.summary.today.bookings_count,
      revenue: data.summary.today.revenue,
      weekRevenue: data.summary.week.revenue,
      clients: data.summary.week.clients_count,
    });
    setBookings(data.bookings_today);
    setServices(data.services);
    setSvcCount(data.counts.services);
    setClients(data.clients);
    setPromoCount(data.counts.active_promo);
    setReviewsCount(data.counts.reviews);
    setSub(data.subscription);
  }

  useEffect(() => {
    const onChanged = () => load().catch(() => {});
    window.addEventListener("yz:bookings-changed", onChanged);
    load()
      .then(() => setReady(true))
      .catch(() => router.replace("/dashboard/onboarding"));
    return () => window.removeEventListener("yz:bookings-changed", onChanged);
  }, [router]);

  // First-visit tutorial. Triggered after the dashboard fully renders
  // (otherwise the tour anchors aren't in the DOM yet). Marks "seen"
  // when the user finishes OR skips so we don't pester them again.
  useEffect(() => {
    if (!ready) return;
    if (hasSeenTour(DASHBOARD_TOUR_ID)) return;
    setWelcomeOpen(true);
  }, [ready]);

  function skipWelcome() {
    // User clicked "O'zim ko'raman" — they don't want the guided tour
    // at all. Mark seen and bail; no onboarding chain, no nag again.
    markTourSeen(DASHBOARD_TOUR_ID);
    setWelcomeOpen(false);
    setTourOpen(false);
  }

  function finishDashboardTour(completed: boolean) {
    // The dashboard's own 5-step tour just ended. Mark it seen either way.
    // Only when the user actually FINISHED it do we kick off the multi-page
    // onboarding chain — X-ing out / skipping must NOT drag them through all
    // 7 pages (that was the bug: the X button force-started the whole chain).
    markTourSeen(DASHBOARD_TOUR_ID);
    setTourOpen(false);
    if (completed) {
      setTimeout(() => {
        startOnboarding((p) => router.push(p));
      }, 250);
    }
  }

  function startTour() {
    setWelcomeOpen(false);
    // Defer one tick so the modal close-animation doesn't fight the
    // tour mounting and the spotlight measures the right rectangle.
    setTimeout(() => setTourOpen(true), 50);
  }

  async function loadNotifications() {
    setNotifLoading(true);
    try {
      const r = await apiFetch<{ items: NotificationItem[] }>(
        "/api/business/me/notifications"
      );
      setNotifs(r.items || []);
      const lastSeen = Number(
        (typeof window !== "undefined" && localStorage.getItem("yozuv_notif_last_seen")) ||
          0
      );
      const unread = (r.items || []).filter(
        (n) => new Date(n.created_at).getTime() > lastSeen
      ).length;
      setUnreadCount(unread);
    } catch {
      // silent: notifications are non-critical
    } finally {
      setNotifLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;
    loadNotifications();

    // Server-Sent Events: the backend pushes a tiny event whenever a
    // notification-worthy thing happens (booking_new, booking_cancelled,
    // review_new). Listening lets us re-fetch only when there's
    // actually new data instead of polling every 60 seconds.
    //
    // Native EventSource doesn't support custom headers, so we tag the
    // access token onto the URL — the SSE endpoint reads either header
    // or `?token=` (same pattern get_owned_business_download already
    // uses for PDF downloads). If the browser closes the stream we
    // don't bother retrying — useEffect will rebuild it on the next
    // mount, and we still keep a 5-min safety poll so a misbehaving
    // proxy can't strand the bell.
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("yozuv_access")
        : null;
    let es: EventSource | null = null;
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || "https://yozuv.onrender.com";
      const url =
        `${base}/api/business/me/notifications/stream` +
        (token ? `?token=${encodeURIComponent(token)}` : "");
      es = new EventSource(url, { withCredentials: false });
      const onEvent = () => loadNotifications();
      es.addEventListener("booking_new", onEvent);
      es.addEventListener("booking_cancelled", onEvent);
      es.addEventListener("review_new", onEvent);
      es.addEventListener("subscription_expiring", onEvent);
      es.addEventListener("subscription_expired", onEvent);
    } catch {
      // EventSource ctor can throw on iOS Telegram WebView in rare
      // cases. Fall back to the safety poll below.
    }

    // Safety net: if SSE silently dies (proxy timeout, mobile network
    // sleep) the user still sees fresh notifications within 5 minutes.
    const poll = window.setInterval(loadNotifications, 5 * 60_000);
    return () => {
      if (es) es.close();
      window.clearInterval(poll);
    };
  }, [ready]);

  function openNotifications() {
    if (typeof window !== "undefined") {
      localStorage.setItem("yozuv_notif_last_seen", String(Date.now()));
    }
    setUnreadCount(0);
    setNotifOpen(true);
    loadNotifications();
  }

  if (!ready || !biz) {
    return <YzLoader fullscreen />;
  }

  const ownerFirst = (me?.first_name || biz.name.split(" ")[0] || "").trim() || "Yozuv";
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "Yozuv_cl_bot";
  const botLink = `t.me/${botUsername}?start=${biz.slug}`;
  const plan = sub?.plan || "FREE";
  // "Keyingi yozilish" = the next UPCOMING booking, not just the first
  // non-cancelled row (which could be a past/completed one). Take active
  // bookings whose start time hasn't passed yet, earliest first.
  const nowHM = (() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  })();
  const next = bookings
    .filter(
      (b) =>
        (b.status === "PENDING" || b.status === "CONFIRMED") &&
        b.start_time.slice(0, 5) >= nowHM
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];

  return (
    <div className="-mx-4 md:-mx-0">
      {/* Hero */}
      <HeroGradient>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <YzLogo size={34} variant="light" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">
                YOZUV · {plan}
              </div>
              <div className="font-display text-[17px] font-bold tracking-tight text-white">
                {biz.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-tour="help"
              onClick={() => setHelpOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-2xl bg-white/18 backdrop-blur tap"
              aria-label="Yordam"
            >
              <HelpCircle className="h-5 w-5 text-white" strokeWidth={2} />
            </button>
            <button
              data-tour="bell"
              onClick={openNotifications}
              className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white/18 backdrop-blur tap"
              aria-label="Bildirishnomalar"
            >
              <Bell className="h-5 w-5 text-white" strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-coral px-1 text-[10px] font-extrabold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-7">
          <div className="text-sm font-medium text-white/70">Assalomu alaykum,</div>
          <div className="mt-0.5 font-display text-[28px] font-extrabold tracking-tight text-white">
            {ownerFirst} 👋
          </div>
          <div className="mt-1.5 text-sm font-medium text-white/85">{longDate(new Date())}</div>
        </div>
      </HeroGradient>

      {/* Stats card pulled up */}
      <div className="relative -mt-16 px-4 md:px-0">
        <div data-tour="hero-stats" className="rounded-3xl bg-white p-5 shadow-soft-lg">
          <div className="grid grid-cols-3 gap-0 divide-x divide-ink-200">
            <StatBox label="Bugun" value={summary.bookings} sub="yozilish" color="#4853F5" />
            <StatBox
              label="Daromad"
              value={fmtShort(summary.revenue)}
              sub="so‘m"
              color="#22C8A8"
            />
            {/* No trend badge: today's revenue ÷ week revenue is not a
                period-over-period change. Re-add once the backend returns a
                comparable prior-period figure. */}
            <StatBox
              label="Mijozlar"
              value={summary.clients}
              sub="hafta"
              color="#FFC94A"
            />
          </div>
        </div>
      </div>

      {/* Next booking */}
      {next && (
        <div className="mt-6 px-4 md:px-0">
          <SectionLabel title="Keyingi yozilish" action="Jadval" href="/dashboard/bookings" />
          <button
            onClick={() => setActiveBooking(next)}
            className="mt-2.5 flex w-full items-center gap-3.5 rounded-[22px] border-[1.5px] border-indigo-100 bg-white p-4 shadow-soft tap"
          >
            <div
              className="min-w-[64px] rounded-2xl px-3 py-2.5 text-center"
              style={{ background: "linear-gradient(135deg,#EEF0FF,#E0E4FF)" }}
            >
              <div className="font-display text-[22px] font-extrabold tracking-tight text-indigo-700">
                {hm(next.start_time)}
              </div>
              <div className="-mt-0.5 text-[11px] font-semibold text-ink-500">
                {(parseInt(next.end_time) - parseInt(next.start_time)) * 60 +
                  (parseInt(next.end_time.slice(3, 5)) - parseInt(next.start_time.slice(3, 5)))}{" "}
                daq
              </div>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate font-display text-[15px] font-bold tracking-tight text-ink-900">
                {clientName(next, clients)}
              </div>
              <div className="truncate text-[13px] text-ink-500">
                {services.find((s) => s.id === next.service_id)?.name || "Xizmat"}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <StatusBadge status={next.status} compact />
                <span className="text-xs font-bold text-ink-900">
                  {fmtSum(next.payment_amount)} so‘m
                </span>
              </div>
            </div>
            <span
              onClick={(e) => {
                e.stopPropagation();
                callPhone(clients.find((c) => c.id === next.client_id)?.phone);
              }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50"
            >
              <Phone className="h-4.5 w-4.5 text-indigo-600" />
            </span>
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-6 px-4 md:px-0">
        <SectionLabel title="Tezkor amallar" />
        <div data-tour="quick-actions" className="mt-2.5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <QuickTile
            href="/dashboard/qr"
            label="QR kod"
            sub="Broshyura va havola"
            bg="#FFF3DA"
            icon={<QrCode className="h-5 w-5 text-warn" />}
          />
          <QuickTile
            href="/dashboard/promo"
            label="Promo-kodlar"
            sub={`${promoCount} ta faol`}
            bg="#E6FAF3"
            icon={<Tag className="h-5 w-5 text-success" />}
          />
          <QuickTile
            href="/dashboard/services"
            label="Xizmatlar"
            sub={`${svcCount} ta`}
            bg="#EEF0FF"
            icon={<Scissors className="h-5 w-5 text-indigo-600" />}
          />
          <QuickTile
            href="/dashboard/reviews"
            label="Baholar"
            sub={`${reviewsCount} ta sharh`}
            bg="#FFE7E3"
            icon={<Star className="h-5 w-5 text-coral" />}
          />
        </div>
      </div>

      {/* Today timeline */}
      <div className="mt-6 px-4 md:px-0">
        <SectionLabel title="Bugungi kun" action="Barchasi" href="/dashboard/bookings" />
        <div className="mt-2.5 flex flex-col gap-2">
          {bookings.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-400">
              Bugun hali yozilish yo‘q
            </div>
          ) : (
            bookings
              .slice(0, 4)
              .map((b) => (
                <BookingCard
                  key={b.id}
                  b={b}
                  services={services}
                  clients={clients}
                  onClick={() => setActiveBooking(b)}
                />
              ))
          )}
        </div>
      </div>

      {/* Bot link */}
      <div className="mt-6 px-4 md:px-0">
        <button
          data-tour="bot-link"
          onClick={() => {
            navigator.clipboard?.writeText(`https://${botLink}`);
            toast("Havola nusxalandi");
          }}
          className="relative flex w-full items-center gap-3.5 overflow-hidden rounded-[22px] p-4 text-left tap"
          style={{ background: "linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)" }}
        >
          <div className="pointer-events-none absolute -right-5 -top-5 h-32 w-32 rounded-full bg-indigo-500/30 blur-2xl" />
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/14 backdrop-blur">
            <Share2 className="h-5 w-5 text-white" />
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="font-display text-[15px] font-bold tracking-tight text-white">
              Mijozlar havolangiz
            </div>
            <div className="mt-0.5 truncate font-mono text-xs text-white/70">{botLink}</div>
          </div>
          <div className="relative flex items-center gap-1.5 rounded-xl bg-white/14 px-3 py-2 text-xs font-bold text-white">
            <Copy className="h-3.5 w-3.5" /> Nusxa
          </div>
        </button>
      </div>

      <BookingSheet
        open={!!activeBooking}
        onOpenChange={(v) => !v && setActiveBooking(null)}
        booking={activeBooking}
        services={services}
        clients={clients}
        onChanged={load}
      />

      <NotificationSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={notifs}
        loading={notifLoading}
      />

      <WelcomeModal
        open={welcomeOpen}
        ownerName={ownerFirst}
        onTour={startTour}
        onSkip={skipWelcome}
      />

      <Tour
        open={tourOpen}
        steps={DASHBOARD_TOUR_STEPS}
        onClose={finishDashboardTour}
      />

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function clientName(b: BookingRow, clients: ClientLite[]) {
  const c = clients.find((x) => x.id === b.client_id);
  return c ? `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Mijoz" : "Mijoz";
}

function StatBox({
  label,
  value,
  sub,
  color,
  trend,
}: {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  trend?: string;
}) {
  return (
    <div className="px-2 text-center first:pl-0 last:pr-0">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{label}</div>
      <div
        className="mt-1 font-display text-2xl font-extrabold tracking-tight"
        style={{ color }}
      >
        {value}
      </div>
      <div className="-mt-0.5 text-[11px] font-semibold text-ink-500">{sub}</div>
      {trend && (
        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#E6FAF3] px-2 py-0.5 text-[10px] font-bold text-success">
          <TrendingUp className="h-3 w-3" strokeWidth={2.4} />
          {trend}
        </div>
      )}
    </div>
  );
}

function QuickTile({
  href,
  label,
  sub,
  bg,
  icon,
}: {
  href: string;
  label: string;
  sub: string;
  bg: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="card-soft flex flex-col gap-2.5 p-3.5 tap">
      <div
        className="grid h-10 w-10 place-items-center rounded-xl"
        style={{ background: bg }}
      >
        {icon}
      </div>
      <div>
        <div className="font-display text-sm font-bold tracking-tight text-ink-900">{label}</div>
        <div className="mt-0.5 text-xs text-ink-400">{sub}</div>
      </div>
    </Link>
  );
}


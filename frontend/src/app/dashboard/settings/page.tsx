"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  CreditCard,
  GraduationCap,
  HelpCircle,
  KeyRound,
  LogOut,
  MapPin,
  Pencil,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import { Avatar, ScreenHeader, useToast } from "@/components/yz";
import { apiBase, apiFetch, getToken } from "@/lib/api";
import { startOnboarding } from "@/lib/onboarding";
import type { BusinessMe } from "@/types";

type CardCreateResp = {
  transaction_id: string;
  amount: number;
  card_number: string;
  card_holder: string;
  payment_comment: string;
};

type TxStatus = {
  transaction_id: string;
  status: string;
  amount: number;
  plan: string;
};

type Plan = "MONTHLY" | "YEARLY";

type LoginMethod = {
  provider: string;
  label: string;
  connected: boolean;
  detail: string | null;
};

export default function SettingsPage() {
  const toast = useToast();
  const router = useRouter();
  const [biz, setBiz] = useState<BusinessMe | null>(null);
  const [me, setMe] = useState<{ first_name: string; last_name: string } | null>(null);
  const [sub, setSub] = useState<{ plan: string; status: string; expires_at: string | null } | null>(null);
  const [info, setInfo] = useState<CardCreateResp | null>(null);
  const [plan, setPlan] = useState<Plan>("MONTHLY");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<TxStatus | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<BusinessMe>("/api/business/me"),
      apiFetch<{ first_name: string; last_name: string }>("/api/auth/me").catch(() => null),
      apiFetch<{ plan: string; status: string; expires_at: string | null }>(
        "/api/subscription"
      ).catch(() => null),
    ])
      .then(([b, u, s]) => {
        setBiz(b);
        setMe(u);
        setSub(s);
      })
      .catch(() => {});
  }, []);

  const startCardPayment = async (selectedPlan: Plan) => {
    setStatus(null);
    setFile(null);
    setComment("");
    try {
      const r = await apiFetch<CardCreateResp>("/api/payments/card/create", {
        method: "POST",
        body: JSON.stringify({ plan: selectedPlan }),
      });
      setInfo(r);
      setPlan(selectedPlan);
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    }
  };

  const uploadReceipt = async () => {
    if (!info || !file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("transaction_id", info.transaction_id);
      fd.append("comment", comment);
      fd.append("file", file);
      const token = getToken();
      const res = await fetch(`${apiBase()}/api/payments/card/upload-receipt`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      const data = (await res.json()) as TxStatus;
      setStatus(data);
      toast("Chek yuklandi");
      pollStatus(info.transaction_id);
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setUploading(false);
    }
  };

  // One active poller at a time, with its handles in a ref so we can cancel
  // a previous poll before starting a new one and clean up on unmount —
  // otherwise re-uploading started a second interval and navigating away
  // left an interval running (setState-after-unmount) for up to 10 minutes.
  const pollRef = useRef<{
    interval?: ReturnType<typeof setInterval>;
    timeout?: ReturnType<typeof setTimeout>;
  }>({});

  const stopPoll = () => {
    if (pollRef.current.interval) clearInterval(pollRef.current.interval);
    if (pollRef.current.timeout) clearTimeout(pollRef.current.timeout);
    pollRef.current = {};
  };

  useEffect(() => stopPoll, []);

  const pollStatus = (txId: string) => {
    stopPoll();
    const interval = setInterval(async () => {
      try {
        const s = await apiFetch<TxStatus>(`/api/payments/status/${txId}`);
        setStatus(s);
        if (s.status.endsWith("COMPLETED") || s.status === "COMPLETED") {
          stopPoll();
          toast("To‘lov tasdiqlandi");
          const fresh = await apiFetch<{
            plan: string;
            status: string;
            expires_at: string | null;
          }>("/api/subscription").catch(() => null);
          setSub(fresh);
        } else if (s.status.includes("REJECTED") || s.status.includes("FAILED")) {
          stopPoll();
          toast("To‘lov rad etildi");
        }
      } catch {}
    }, 4000);
    pollRef.current.interval = interval;
    pollRef.current.timeout = setTimeout(stopPoll, 10 * 60 * 1000);
  };

  function logout() {
    localStorage.removeItem("yozuv_access");
    localStorage.removeItem("yozuv_refresh");
    window.location.href = "/auth/login";
  }

  // Owner's new-booking alerts. Persisted server-side on the business
  // (notifications_enabled) — the bot checks it before pinging the owner.
  // Seeded from biz once it loads (see the effect below).
  const [notifOn, setNotifOn] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  useEffect(() => {
    if (biz) setNotifOn(biz.notifications_enabled ?? true);
  }, [biz]);
  async function toggleNotif() {
    if (notifSaving) return;
    const next = !notifOn;
    setNotifOn(next); // optimistic
    setNotifSaving(true);
    try {
      await apiFetch("/api/business/me", {
        method: "PUT",
        body: JSON.stringify({ notifications_enabled: next }),
      });
      setBiz((b) => (b ? { ...b, notifications_enabled: next } : b));
      toast(next ? "Bildirishnomalar yoqildi" : "Bildirishnomalar o'chirildi");
    } catch {
      setNotifOn(!next); // revert on failure
      toast("Saqlashda xatolik");
    } finally {
      setNotifSaving(false);
    }
  }

  function replayTours() {
    // Kick off the full guided sequence again — startOnboarding wipes
    // tour-seen flags, sets the active onboarding cursor, and routes
    // the user to the first page (Profil). Each per-page tour will
    // auto-fire and auto-advance to the next page on dismiss.
    toast("Qo'llanma qaytadan boshlanmoqda…");
    startOnboarding((p) => router.push(p));
  }

  function openSupport() {
    const supportUrl =
      process.env.NEXT_PUBLIC_SUPPORT_TG_URL || "https://t.me/zimdevuz";
    if (typeof window !== "undefined") {
      const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(supportUrl);
      } else {
        window.open(supportUrl, "_blank");
      }
    }
  }

  const [methods, setMethods] = useState<LoginMethod[]>([]);
  async function loadIdentities() {
    try {
      const r = await apiFetch<{ methods: LoginMethod[] }>("/api/auth/identities");
      setMethods(r.methods);
    } catch {
      // non-fatal — the section just stays empty
    }
  }
  useEffect(() => {
    loadIdentities();
    // Surface the result of a Google-link round-trip (?linked / ?link_error),
    // then clean the query so a refresh doesn't re-toast.
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      if (q.get("linked") === "google") toast("Google hisobi ulandi");
      else if (q.get("link_error") === "google_taken")
        toast("Bu Google boshqa hisobga ulangan");
      if (q.get("linked") || q.get("link_error")) {
        window.history.replaceState({}, "", "/dashboard/settings");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectGoogle() {
    const token = getToken();
    if (!token) return;
    try {
      // Fetch a dedicated 5-min, link-scoped token with the Bearer header so
      // a general access token never travels in the URL (logs/history/Referer).
      const { link_token } = await apiFetch<{ link_token: string }>(
        "/api/auth/google/link-token",
        { method: "POST" },
      );
      window.location.href = `${apiBase()}/api/auth/google/start?link=1&token=${encodeURIComponent(link_token)}`;
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    }
  }
  async function disconnectGoogle() {
    try {
      await apiFetch("/api/auth/identities/google", { method: "DELETE" });
      toast("Google uzildi");
      loadIdentities();
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    }
  }

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function deleteAccount() {
    setDeleting(true);
    try {
      await apiFetch("/api/auth/account", { method: "DELETE" });
      // Account is gone — drop tokens and bounce to login. No toast: the
      // page is navigating away.
      localStorage.removeItem("yozuv_access");
      localStorage.removeItem("yozuv_refresh");
      window.location.href = "/auth/login";
    } catch (e) {
      toast((e as Error).message || "Xatolik");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const ownerName =
    `${me?.first_name || ""} ${me?.last_name || ""}`.trim() || biz?.name || "—";

  const expiryFmt = (() => {
    if (!sub?.expires_at) return null;
    try {
      const d = new Date(sub.expires_at);
      const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
      const left = Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
      return { date: `${d.getDate()}-${months[d.getMonth()]} ${d.getFullYear()}`, leftDays: left };
    } catch {
      return null;
    }
  })();

  return (
    <div>
      <ScreenHeader title="Sozlamalar" />

      <div className="mt-2 flex flex-col gap-5 px-4 md:px-0">
        {/* Profile card */}
        <div className="card-lg flex items-center gap-4 p-4">
          <Avatar name={ownerName} size={56} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[18px] font-extrabold tracking-tighter text-ink-900">
              {ownerName}
            </div>
            <div className="truncate text-[13px] font-medium text-ink-500">
              {biz?.name || "—"}
            </div>
            {sub && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-indigo-600">
                💎 {sub.plan}
              </div>
            )}
          </div>
          <Link
            href="/dashboard/profile"
            className="grid h-10 w-10 place-items-center rounded-2xl bg-ink-100 text-ink-500 tap"
            aria-label="Tahrir"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </div>

        {methods.length > 0 && (
          <Section title="Kirish usullari">
            {methods.map((m) => (
              <div key={m.provider} className="flex items-center gap-3 px-4 py-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[14px] font-bold text-ink-900">
                    {m.label}
                  </div>
                  <div className="truncate text-[12px] text-ink-500">
                    {m.connected ? m.detail || "Ulangan" : "Ulanmagan"}
                  </div>
                </div>
                {m.provider === "google" ? (
                  m.connected ? (
                    <button
                      onClick={disconnectGoogle}
                      className="rounded-xl bg-ink-100 px-3 py-1.5 text-xs font-bold text-ink-600 tap"
                    >
                      Uzish
                    </button>
                  ) : (
                    <button
                      onClick={connectGoogle}
                      className="rounded-xl bg-ink-900 px-3 py-1.5 text-xs font-bold text-white tap"
                    >
                      Ulash
                    </button>
                  )
                ) : (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      m.connected
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-ink-100 text-ink-400"
                    }`}
                  >
                    {m.connected ? "Ulangan" : "—"}
                  </span>
                )}
              </div>
            ))}
          </Section>
        )}

        <Section title="Biznes">
          <Row
            href="/dashboard/profile"
            icon={<SettingsIcon className="h-5 w-5 text-indigo-600" />}
            bg="#EEF0FF"
            label="Profil"
            sub="Logotip, matnlar, rejim"
          />
          <Row
            href="/dashboard/schedule"
            icon={<ClipboardList className="h-5 w-5 text-warn" />}
            bg="#FFF3DA"
            label="Ish jadvali"
            sub="Haftalik ish kunlari"
          />
          {biz?.address && (
            <Row
              icon={<MapPin className="h-5 w-5 text-indigo-600" />}
              bg="#EEF0FF"
              label="Manzil"
              sub={biz.address}
            />
          )}
        </Section>

        <Section title="Obuna">
          {sub && (
            <div className="flex items-start gap-3 px-2 py-3">
              <div
                className="grid h-11 w-11 place-items-center rounded-2xl"
                style={{ background: "var(--success-bg)" }}
              >
                <CreditCard className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[15px] font-bold tracking-tight text-ink-900">
                    {sub.plan === "TRIAL" ? "Bepul sinov" : sub.plan === "MONTHLY" ? "Oylik" : sub.plan === "YEARLY" ? "Yillik" : sub.plan}
                  </span>
                  <span
                    className={
                      sub.status === "ACTIVE" ? "pill-success" : "pill-muted"
                    }
                  >
                    {sub.status === "ACTIVE" ? "FAOL" : sub.status}
                  </span>
                </div>
                {expiryFmt && (
                  <div className="mt-0.5 text-xs text-ink-500">
                    {expiryFmt.date} gacha ·{" "}
                    <span className={expiryFmt.leftDays <= 3 ? "font-bold text-coral" : "font-bold text-ink-700"}>
                      {expiryFmt.leftDays} kun qoldi
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {!info ? (
            <div className="flex flex-col gap-2.5 p-2">
              <button
                onClick={() => startCardPayment("MONTHLY")}
                className="btn-primary justify-center text-sm"
              >
                Oylik uzaytirish
              </button>
              <button
                onClick={() => startCardPayment("YEARLY")}
                className="btn-soft justify-center text-sm"
              >
                Yillik uzaytirish
              </button>
            </div>
          ) : (
            <div className="rounded-3xl bg-ink-50 p-4">
              <div className="eyebrow">Quyidagi kartaga o‘tkazing</div>
              <div className="mt-1.5 tnum font-mono text-[19px] font-bold tracking-wider text-ink-900">
                {info.card_number || "—"}
              </div>
              {info.card_holder && (
                <div className="text-sm text-ink-500">{info.card_holder}</div>
              )}
              <div className="mt-2.5 tnum font-display text-[15px] font-bold tracking-tight text-ink-900">
                {new Intl.NumberFormat("uz-UZ").format(info.amount)} so‘m · {plan}
              </div>
              {info.payment_comment && (
                <div className="mt-2.5 rounded-2xl bg-white p-3 text-sm text-ink-700 shadow-soft-sm">
                  {info.payment_comment}
                </div>
              )}
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Izoh (ixtiyoriy)"
                className="yz-input mt-3"
              />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm text-ink-500 file:mr-3 file:rounded-xl file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:font-display file:text-sm file:font-bold file:text-ink-700"
              />
              <div className="mt-3 flex gap-2.5">
                <button
                  onClick={() => setInfo(null)}
                  className="flex-1 rounded-2xl bg-ink-100 py-4 font-display text-sm font-bold text-ink-700 tap"
                >
                  Bekor
                </button>
                <button
                  onClick={uploadReceipt}
                  disabled={!file || uploading}
                  className="btn-primary flex-[2] text-sm"
                >
                  {uploading ? "Yuklanmoqda…" : "Chekni yuborish"}
                </button>
              </div>
              {status && (
                <div className="mt-2.5 text-xs text-ink-500">
                  Holati: <span className="tnum font-mono font-semibold text-ink-700">{status.status}</span>
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="Boshqa">
          <Row
            onClick={toggleNotif}
            icon={<Bell className="h-5 w-5 text-coral" />}
            bg="#FFE7E3"
            label="Bildirishnomalar"
            sub={notifOn ? "Yoqilgan" : "O'chirilgan"}
            right={
              <span
                className={`relative h-6 w-10 rounded-full transition-colors ${notifOn ? "bg-indigo-600 shadow-[0_4px_12px_-4px_rgba(72,83,245,0.6)]" : "bg-ink-200"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${notifOn ? "translate-x-[18px]" : "translate-x-0.5"}`}
                />
              </span>
            }
          />
          <Row
            onClick={replayTours}
            icon={<GraduationCap className="h-5 w-5 text-indigo-600" />}
            bg="#EEF0FF"
            label="Qo'llanmani qayta ko'rish"
            sub="Har bir sahifa o'z izohini qaytadan ko'rsatadi"
          />
          <Row
            href="/dashboard/security"
            icon={<KeyRound className="h-5 w-5 text-indigo-600" />}
            bg="#EEF0FF"
            label="Login va parol"
            sub="Ilovaga Telegramsiz kirish uchun parol o‘rnating"
          />
          <Row
            onClick={openSupport}
            icon={<HelpCircle className="h-5 w-5 text-success" />}
            bg="#E6FAF3"
            label="Yordam"
            sub="Savollar va qo‘llab-quvvatlash"
          />
          <Row
            onClick={logout}
            icon={<LogOut className="h-5 w-5 text-coral" />}
            bg="#FFE7E3"
            label="Chiqish"
            danger
          />
        </Section>

        <Section title="Xavfli zona">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="block w-full text-left tap"
            >
              <div className="flex items-center gap-3.5 rounded-2xl px-2.5 py-3 transition-colors hover:bg-coral/5">
                <div
                  className="grid h-11 w-11 place-items-center rounded-2xl"
                  style={{ background: "#FFE7E3" }}
                >
                  <Trash2 className="h-5 w-5 text-coral" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[15px] font-bold tracking-tight text-[#C93A2A]">
                    Akkauntni o‘chirish
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-400">
                    Biznes, mijozlar va barcha ma’lumotlar butunlay o‘chadi
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-300" />
              </div>
            </button>
          ) : (
            <div className="rounded-2xl bg-coral/5 p-4">
              <div className="font-display text-[15px] font-bold tracking-tight text-[#C93A2A]">
                Akkauntni butunlay o‘chirasizmi?
              </div>
              <div className="mt-1 text-[13px] leading-snug text-ink-600">
                Biznesingiz, xizmatlar, bandlovlar, jadval va obuna qaytarib
                bo‘lmaydigan tarzda o‘chiriladi. Bu amalni bekor qilib
                bo‘lmaydi.
              </div>
              <div className="mt-3 flex gap-2.5">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 rounded-2xl bg-ink-100 py-3.5 font-display text-sm font-bold text-ink-700 tap"
                >
                  Bekor
                </button>
                <button
                  onClick={deleteAccount}
                  disabled={deleting}
                  className="flex-1 rounded-2xl bg-coral py-3.5 font-display text-sm font-bold text-white tap disabled:opacity-60"
                >
                  {deleting ? "O‘chirilmoqda…" : "Ha, o‘chirish"}
                </button>
              </div>
            </div>
          )}
        </Section>

        <div className="py-6 text-center eyebrow text-ink-300">
          Yozuv · 2.4.1
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow px-1 pb-2.5">{title}</div>
      <div className="card-lg overflow-hidden p-2">{children}</div>
    </div>
  );
}

function Row({
  icon,
  bg,
  label,
  sub,
  href,
  onClick,
  danger,
  right,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  sub?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  const content = (
    <div className="flex items-center gap-3.5 rounded-2xl px-2.5 py-3 transition-colors hover:bg-ink-50">
      <div
        className="grid h-11 w-11 place-items-center rounded-2xl"
        style={{ background: bg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`font-display text-[15px] font-bold tracking-tight ${
            danger ? "text-[#C93A2A]" : "text-ink-900"
          }`}
        >
          {label}
        </div>
        {sub && <div className="mt-0.5 truncate text-xs text-ink-400">{sub}</div>}
      </div>
      {right ?? <ChevronRight className="h-4 w-4 text-ink-300" />}
    </div>
  );
  if (href) return <Link href={href} className="block tap">{content}</Link>;
  return (
    <button onClick={onClick} className="block w-full text-left tap">
      {content}
    </button>
  );
}

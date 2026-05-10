"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  CreditCard,
  GraduationCap,
  HelpCircle,
  LogOut,
  MapPin,
  Pencil,
  Settings as SettingsIcon,
} from "lucide-react";
import { Avatar, ScreenHeader, useToast } from "@/components/yz";
import { apiBase, apiFetch, getToken } from "@/lib/api";
import { resetTours } from "@/lib/tour-state";
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

export default function SettingsPage() {
  const toast = useToast();
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

  const pollStatus = (txId: string) => {
    const interval = setInterval(async () => {
      try {
        const s = await apiFetch<TxStatus>(`/api/payments/status/${txId}`);
        setStatus(s);
        if (s.status.endsWith("COMPLETED") || s.status === "COMPLETED") {
          clearInterval(interval);
          toast("To‘lov tasdiqlandi");
          const fresh = await apiFetch<{
            plan: string;
            status: string;
            expires_at: string | null;
          }>("/api/subscription").catch(() => null);
          setSub(fresh);
        } else if (s.status.includes("REJECTED") || s.status.includes("FAILED")) {
          clearInterval(interval);
          toast("To‘lov rad etildi");
        }
      } catch {}
    }, 4000);
    setTimeout(() => clearInterval(interval), 10 * 60 * 1000);
  };

  function logout() {
    localStorage.removeItem("yozuv_access");
    localStorage.removeItem("yozuv_refresh");
    window.location.href = "/auth/login";
  }

  const [notifOn, setNotifOn] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("yozuv_notif_on");
      if (saved !== null) setNotifOn(saved === "1");
    }
  }, []);
  function toggleNotif() {
    setNotifOn((v) => {
      const next = !v;
      if (typeof window !== "undefined") localStorage.setItem("yozuv_notif_on", next ? "1" : "0");
      toast(next ? "Bildirishnomalar yoqildi" : "Bildirishnomalar o'chirildi");
      return next;
    });
  }

  function replayTours() {
    // Wipe the localStorage flag so every page's tour fires again next
    // time the user lands on it. We don't auto-navigate — the user can
    // open whichever page they want a refresher on.
    resetTours();
    toast("Obuchenie qaytadan ishga tushirildi");
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

      <div className="mt-2 flex flex-col gap-4 px-4 md:px-0">
        {/* Profile card */}
        <div className="card-soft flex items-center gap-3.5 p-4">
          <Avatar name={ownerName} size={56} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[17px] font-extrabold tracking-tight text-ink-900">
              {ownerName}
            </div>
            <div className="truncate text-[13px] font-medium text-ink-500">
              {biz?.name || "—"}
            </div>
            {sub && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
                💎 {sub.plan}
              </div>
            )}
          </div>
          <Link
            href="/dashboard/profile"
            className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-500 tap"
            aria-label="Tahrir"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </div>

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
                className="grid h-10 w-10 place-items-center rounded-xl"
                style={{ background: "#E6FAF3" }}
              >
                <CreditCard className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-ink-900">
                    {sub.plan === "TRIAL" ? "Bepul sinov" : sub.plan === "MONTHLY" ? "Oylik" : sub.plan === "YEARLY" ? "Yillik" : sub.plan}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      sub.status === "ACTIVE" ? "bg-[#E6FAF3] text-success" : "bg-ink-100 text-ink-500"
                    }`}
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
            <div className="flex flex-col gap-2 rounded-2xl p-3">
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
            <div className="rounded-2xl bg-ink-50 p-3">
              <div className="text-xs font-semibold text-ink-500">
                Quyidagi kartaga o‘tkazing
              </div>
              <div className="mt-1 font-mono text-[17px] font-bold tracking-wider text-ink-900">
                {info.card_number || "—"}
              </div>
              {info.card_holder && (
                <div className="text-sm text-ink-500">{info.card_holder}</div>
              )}
              <div className="mt-2 text-sm font-semibold">
                {new Intl.NumberFormat("uz-UZ").format(info.amount)} so‘m · {plan}
              </div>
              {info.payment_comment && (
                <div className="mt-2 rounded-xl bg-white p-3 text-sm text-ink-700">
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
                className="mt-2 block w-full text-sm"
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setInfo(null)}
                  className="flex-1 rounded-2xl bg-ink-100 py-3 text-sm font-bold text-ink-700 tap"
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
                <div className="mt-2 text-xs text-ink-500">
                  Holati: <span className="font-mono">{status.status}</span>
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
                className={`relative h-5 w-9 rounded-full transition-colors ${notifOn ? "bg-indigo-600" : "bg-ink-200"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${notifOn ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </span>
            }
          />
          <Row
            onClick={replayTours}
            icon={<GraduationCap className="h-5 w-5 text-indigo-600" />}
            bg="#EEF0FF"
            label="Obuchenie qaytadan"
            sub="Har bir sahifa o'z izohini qaytadan ko'rsatadi"
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

        <div className="py-5 text-center text-[11px] font-semibold text-ink-400">
          Yozuv · 2.4.1
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-1 pb-2 text-[12px] font-bold uppercase tracking-wide text-ink-400">
        {title}
      </div>
      <div className="card-soft overflow-hidden p-1.5">{children}</div>
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
    <div className="flex items-center gap-3 px-2 py-3">
      <div
        className="grid h-10 w-10 place-items-center rounded-xl"
        style={{ background: bg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`font-display text-sm font-bold ${
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

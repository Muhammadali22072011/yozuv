"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Lock, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Sub = {
  plan: string;
  status: string;
  expires_at: string | null;
  phase: string;
  days_left: number | null;
};

const GRACE_DAYS = 3;

// Top-of-dashboard renewal nudge / soft pay-wall. Manual-renewal billing
// means the owner must pay by hand before expiry — without a visible nudge
// (and a banner for owners whose Telegram bot dunning can't reach them) a
// paying business silently lapses. Escalates by lifecycle phase. Data is
// never deleted, so even the "locked" state stays warm, not punitive.
export function SubscriptionBanner() {
  const [sub, setSub] = useState<Sub | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiFetch<Sub>("/api/subscription")
        .then((s) => alive && setSub(s))
        .catch(() => alive && setSub(null));
    load();
    // Re-fetch when the user switches active business — each has its own sub.
    const onBiz = () => load();
    window.addEventListener("yozuv:business-changed", onBiz);
    return () => {
      alive = false;
      window.removeEventListener("yozuv:business-changed", onBiz);
    };
  }, []);

  if (!sub) return null;

  const { phase, days_left: d } = sub;
  // Active and comfortably far from expiry → nothing to nag about.
  if (phase === "active" && (d == null || d > 7)) return null;

  const locked = phase === "locked" || phase === "dormant";
  const grace = phase === "grace";

  let bg = "#FFF3DA";
  let fg = "#A8751A";
  let Icon = Clock;
  let title: string;
  let body: string;
  let cta = "Uzaytirish";

  if (locked) {
    bg = "#FFE7E3";
    fg = "#C93A2A";
    Icon = Lock;
    title = "Obuna tugadi";
    body =
      "Yangi yozuvlar vaqtincha to‘xtadi. Ma’lumotlaringiz joyida 🤍 — to‘lang va davom eting.";
    cta = "To‘lash";
  } else if (grace) {
    bg = "#FFE7E3";
    fg = "#C93A2A";
    Icon = AlertTriangle;
    const graceLeft = Math.max(0, GRACE_DAYS + (d ?? 0));
    title = "Obuna muddati tugadi";
    body = `Yangi yozuvlar yana ${graceLeft} kun ishlaydi. Uzaytiring — uzilish bo‘lmasin.`;
  } else {
    title = d === 0 ? "Obuna bugun tugaydi" : `Obuna tugashiga ${d} kun qoldi`;
    body = "Uzaytirib qo‘ying — hech narsa avtomatik yechilmaydi.";
  }

  return (
    <div
      className="mb-3 flex items-center gap-3 rounded-3xl p-3.5"
      style={{ background: bg }}
      role="status"
    >
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/70"
        style={{ color: fg }}
      >
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="font-display text-[14px] font-extrabold tracking-tight"
          style={{ color: fg }}
        >
          {title}
        </div>
        <div className="mt-0.5 text-[12px] leading-snug text-ink-600">{body}</div>
      </div>
      <Link
        href="/dashboard/settings"
        className="shrink-0 rounded-2xl px-4 py-2.5 font-display text-[13px] font-bold text-white tap"
        style={{ background: fg }}
      >
        {cta}
      </Link>
    </div>
  );
}

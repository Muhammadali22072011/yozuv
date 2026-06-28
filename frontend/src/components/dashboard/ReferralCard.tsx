"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  Clock,
  Gift,
  Share2,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/yz";
import { track } from "@/lib/analytics";

type Invitee = { name: string; joined_at: string | null; subscribed: boolean };
type Summary = {
  code: string;
  invited: number;
  subscribed: number;
  days_earned: number;
  invitees: Invitee[];
};

/**
 * B2B partner-program card: the "invite a friend business" ad (one-tap Telegram
 * share) plus live proof of who you invited and the free days you earned.
 * Self-fetching, so it can drop onto the dashboard home and settings alike.
 */
export function ReferralCard() {
  const toast = useToast();
  const [data, setData] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch<Summary>("/api/business/me/referrals")
      .then(setData)
      .catch(() => {});
  }, []);

  function share() {
    if (!data?.code) return;
    track("referral_share", { kind: "partner" });
    const bot = process.env.NEXT_PUBLIC_BOT_USERNAME || "Yozuv_cl_bot";
    const link = `https://t.me/${bot}?startapp=ref_${data.code}`;
    const text = "Yozuv'ga qo‘shiling — ikkalamizga +30 kun bepul";
    const tg = (
      window as unknown as {
        Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } };
      }
    ).Telegram?.WebApp;
    // Inside Telegram: native "send to…" contact picker.
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
      );
      return;
    }
    // Browser / APK: OS share sheet, else copy.
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: "Yozuv", text: `${text}: ${link}` }).catch(() => {});
      return;
    }
    navigator.clipboard
      ?.writeText(link)
      .then(() => toast("Havola nusxalandi"))
      .catch(() => {});
  }

  const invited = data?.invited ?? 0;
  const subscribed = data?.subscribed ?? 0;
  const days = data?.days_earned ?? 0;

  return (
    <div className="overflow-hidden rounded-4xl bg-white shadow-soft">
      {/* Ad header — the "reklama" */}
      <div
        className="relative p-5 text-white"
        style={{ background: "linear-gradient(135deg,#4853F5 0%,#7C3AED 100%)" }}
      >
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/80">
          <Gift className="h-4 w-4" /> Hamkor dasturi · +30 kun
        </div>
        <div className="relative mt-2 font-display text-[17px] font-extrabold leading-snug">
          Usta yoki salon egasini taklif qiling —{" "}
          <span className="text-white">ikkalangizga +30 kun bepul</span>
        </div>
        {data?.code ? (
          <button
            onClick={share}
            className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-display text-[15px] font-bold text-indigo-600 tap"
          >
            <Share2 className="h-4 w-4" /> Ulashish
          </button>
        ) : (
          <div className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-3 font-display text-[13px] font-semibold text-white/80">
            Hamkorlik havolasi tayyorlanmoqda…
          </div>
        )}
      </div>

      {/* Live proof — counts */}
      <div className="grid grid-cols-3 divide-x divide-ink-100">
        <Stat label="Taklif" value={invited} />
        <Stat label="Obuna" value={subscribed} />
        <Stat label="Bonus" value={`+${days}`} suffix="kun" />
      </div>

      {/* Who you invited */}
      {invited > 0 && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between border-t border-ink-100 px-5 py-3 text-left tap"
          >
            <span className="flex items-center gap-2 text-[13px] font-bold text-ink-700">
              <Users className="h-4 w-4 text-indigo-600" /> Kimlarni taklif qildingiz
            </span>
            <ChevronDown
              className={`h-4 w-4 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open && (
            <ul className="px-5 pb-4">
              {data?.invitees.map((inv, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between border-t border-ink-50 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink-900">
                    {inv.name}
                  </span>
                  {inv.subscribed ? (
                    <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-mint/10 px-2.5 py-1 text-[11px] font-bold text-mint">
                      <BadgeCheck className="h-3.5 w-3.5" /> Obuna bo‘ldi
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-bold text-ink-400">
                      <Clock className="h-3.5 w-3.5" /> Kutilmoqda
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="px-2 py-3 text-center">
      <div className="font-display text-[20px] font-extrabold text-ink-900">
        {value}
        {suffix && <span className="ml-0.5 text-[11px] font-bold text-ink-400">{suffix}</span>}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold text-ink-400">{label}</div>
    </div>
  );
}

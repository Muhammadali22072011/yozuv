"use client";

import { useEffect, useState } from "react";
import { Handshake, Users, CheckCircle2, BadgePercent, Copy, Share2 } from "lucide-react";
import { ScreenHeader, useToast } from "@/components/yz";
import { apiFetch } from "@/lib/api";

type PartnerReferral = {
  code: string;
  invited: number;
  paid: number;
  pending_discount_percent: number;
  reward_percent: number;
};

export default function PartnersPage() {
  const toast = useToast();
  const [data, setData] = useState<PartnerReferral | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    apiFetch<PartnerReferral>("/api/business/me/partner-referral")
      .then(setData)
      .catch(() => {});
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const link = data ? `${origin}/dashboard/onboarding?ref=${data.code}` : "";
  const inviteText = data
    ? `Yozuv — mijozlarni avtomatik yozib boruvchi bot. Ro'yxatdan o'tishda taklif kodi: ${data.code}\n${link}`
    : "";

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} nusxalandi`);
    } catch {
      toast("Nusxalab bo'lmadi");
    }
  }

  return (
    <div>
      <ScreenHeader
        title="Hamkorlik dasturi"
        subtitle="Boshqa biznesni taklif qiling — chegirma oling"
      />

      <div className="mt-4 space-y-3 px-4 md:px-0">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile
            icon={<Users className="h-5 w-5" strokeWidth={2} />}
            tone="bg-indigo-50 text-indigo-600"
            value={data?.invited ?? 0}
            label="Taklif qilindi"
          />
          <StatTile
            icon={<CheckCircle2 className="h-5 w-5" strokeWidth={2} />}
            tone="bg-[#E6FAF3] text-[#0E9577]"
            value={data?.paid ?? 0}
            label="To'lov qildi"
          />
          <StatTile
            icon={<BadgePercent className="h-5 w-5" strokeWidth={2} />}
            tone="bg-[#FFF3DA] text-[#A8751A]"
            value={data?.pending_discount_percent ?? 0}
            label="Chegirma %"
            suffix="%"
          />
        </div>

        {/* Pending discount banner */}
        {data && data.pending_discount_percent > 0 && (
          <div className="rounded-3xl bg-[#E6FAF3] p-4 text-[#0E9577]">
            <div className="font-display text-sm font-extrabold tracking-tight">
              🎁 Sizda -{data.pending_discount_percent}% chegirma bor!
            </div>
            <div className="mt-0.5 text-xs font-semibold">
              Keyingi obuna to'lovingizda avtomatik qo'llaniladi.
            </div>
          </div>
        )}

        {/* Your code */}
        <div className="card-soft p-4">
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl tile-indigo text-indigo-600">
              <Handshake className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="eyebrow">Sizning taklif kodingiz</div>
              <div className="mt-0.5 truncate font-mono font-display text-[22px] font-extrabold tracking-[2px] text-ink-900">
                {data?.code ?? "…"}
              </div>
            </div>
            <button
              onClick={() => data && copy(data.code, "Kod")}
              className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-100 text-ink-700 tap"
              aria-label="Kodni nusxalash"
            >
              <Copy className="h-4.5 w-4.5" strokeWidth={2.2} />
            </button>
          </div>

          <button
            onClick={() => copy(inviteText, "Taklif matni")}
            disabled={!data}
            className="btn-primary mt-3 w-full justify-center"
          >
            <Share2 className="mr-2 h-4 w-4" strokeWidth={2.4} /> Taklif matnini nusxalash
          </button>
        </div>

        {/* How it works */}
        <div className="card-soft p-4">
          <div className="mb-2 flex items-center gap-2">
            <Share2 className="h-4 w-4 text-indigo-600" strokeWidth={2.4} />
            <span className="font-display text-sm font-extrabold tracking-tight text-ink-900">
              Qanday ishlaydi?
            </span>
          </div>
          <ol className="space-y-2 text-sm font-semibold text-ink-600">
            <li className="flex gap-2">
              <span className="text-indigo-600">1.</span>
              Kodingizni boshqa biznes egasiga yuboring (barber, salon, klinika…).
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-600">2.</span>
              U ro'yxatdan o'tishda sizning kodingizni kiritadi.
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-600">3.</span>
              U birinchi obunani to'laganda — siz keyingi to'lovingizga{" "}
              <b>-{data?.reward_percent ?? 50}%</b> chegirma olasiz.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  tone,
  value,
  label,
  suffix = "",
}: {
  icon: React.ReactNode;
  tone: string;
  value: number;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="card-soft flex flex-col items-center gap-1.5 px-2 py-4 text-center">
      <span className={`grid h-9 w-9 place-items-center rounded-2xl ${tone}`}>{icon}</span>
      <span className="tnum font-display text-[22px] font-extrabold tracking-tighter text-ink-900">
        {value}
        {suffix}
      </span>
      <span className="text-[11px] font-semibold text-ink-400">{label}</span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Gift, Users, CheckCircle2, Clock, Share2 } from "lucide-react";
import { ScreenHeader, useToast } from "@/components/yz";
import { apiFetch } from "@/lib/api";

type ReferralConfig = {
  enabled: boolean;
  friend_percent: number;
  reward_percent: number;
  total: number;
  completed: number;
  pending: number;
};

export default function ReferralPage() {
  const toast = useToast();
  const [cfg, setCfg] = useState<ReferralConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [friend, setFriend] = useState("20");
  const [reward, setReward] = useState("15");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const r = await apiFetch<ReferralConfig>("/api/business/me/referral").catch(() => null);
    if (r) {
      setCfg(r);
      setEnabled(r.enabled);
      setFriend(String(r.friend_percent || 0));
      setReward(String(r.reward_percent || 0));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setErr("");
    const fp = parseInt(friend || "0", 10) || 0;
    const rp = parseInt(reward || "0", 10) || 0;
    if (fp < 0 || fp > 100 || rp < 0 || rp > 100) {
      setErr("Chegirma 0 dan 100 gacha bo'lishi kerak");
      return;
    }
    if (enabled && fp <= 0) {
      setErr("Do'st uchun chegirmani kiriting (0 dan katta)");
      return;
    }
    setSaving(true);
    try {
      const r = await apiFetch<ReferralConfig>("/api/business/me/referral", {
        method: "PATCH",
        body: JSON.stringify({
          enabled,
          friend_percent: fp,
          reward_percent: rp,
        }),
      });
      setCfg(r);
      toast("Saqlandi");
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <ScreenHeader
        title="Mijoz tavsiyasi"
        subtitle="Mijozlaringiz yangi mijoz olib keladi"
      />

      <div className="mt-4 space-y-3 px-4 md:px-0">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile
            icon={<Users className="h-5 w-5" strokeWidth={2} />}
            tone="bg-indigo-50 text-indigo-600"
            value={cfg?.total ?? 0}
            label="Takliflar"
          />
          <StatTile
            icon={<CheckCircle2 className="h-5 w-5" strokeWidth={2} />}
            tone="bg-[#E6FAF3] text-[#0E9577]"
            value={cfg?.completed ?? 0}
            label="Kelganlar"
          />
          <StatTile
            icon={<Clock className="h-5 w-5" strokeWidth={2} />}
            tone="bg-[#FFF3DA] text-[#A8751A]"
            value={cfg?.pending ?? 0}
            label="Kutilmoqda"
          />
        </div>

        {/* Enable toggle */}
        <div className="card-soft flex items-center gap-3.5 p-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl tile-indigo text-indigo-600">
            <Gift className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-extrabold tracking-tight text-ink-900">
              Dasturni yoqish
            </div>
            <div className="text-xs font-semibold text-ink-400">
              Mijozlar botda «Do'stni taklif qilish» tugmasini ko'radi
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors tap ${
              enabled ? "bg-indigo-600" : "bg-ink-200"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-soft-sm transition-all ${
                enabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        {/* Discounts */}
        <div className="card-soft space-y-3 p-4">
          <div>
            <label className="block text-xs font-semibold text-ink-500">
              Do'stga chegirma % (birinchi yozilishga)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={friend}
              onChange={(e) => setFriend(e.target.value)}
              className="yz-input mt-1"
              placeholder="20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-500">
              Taklif qilganga sovg'a % (keyingi tashrifga)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              className="yz-input mt-1"
              placeholder="15"
            />
            <p className="mt-1 text-[11px] font-semibold text-ink-400">
              Do'st kelganda — taklif qilgan mijozga bir martalik promokod beriladi.
            </p>
          </div>
          {err && <p className="text-sm text-[#C93A2A]">{err}</p>}
          <button onClick={save} disabled={saving} className="btn-primary w-full justify-center">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
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
              Mijoz botda «Do'stni taklif qilish» orqali shaxsiy havola oladi.
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-600">2.</span>
              Do'sti havola orqali kiradi va birinchi yozilishga chegirma oladi.
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-600">3.</span>
              Do'sti kelganda — taklif qilgan mijoz sovg'a promokod oladi.
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
}: {
  icon: React.ReactNode;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <div className="card-soft flex flex-col items-center gap-1.5 px-2 py-4 text-center">
      <span className={`grid h-9 w-9 place-items-center rounded-2xl ${tone}`}>{icon}</span>
      <span className="tnum font-display text-[22px] font-extrabold tracking-tighter text-ink-900">
        {value}
      </span>
      <span className="text-[11px] font-semibold text-ink-400">{label}</span>
    </div>
  );
}

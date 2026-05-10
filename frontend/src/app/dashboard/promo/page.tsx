"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ScreenHeader, Tour, useToast } from "@/components/yz";
import type { TourStep } from "@/components/yz";
import {
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetRoot,
} from "@/components/yz/Sheet";
import { apiFetch } from "@/lib/api";
import { usePageTour } from "@/lib/use-page-tour";

const PROMO_TOUR: TourStep[] = [
  {
    targetSelector: "[data-tour='promo-add']",
    title: "Birinchi promo-kodingiz",
    body:
      "Mijozlarga maxsus kod bering — masalan SUMMER20. Mijoz uni yozilishda kiritsa, narxdan chegirma avtomatik chiqib ketadi. Foydalanish chegarasini ham qo'ysangiz bo'ladi.",
    mode: "action",
  },
];

type Promo = {
  id: string;
  code: string;
  discount_percent: number;
  discount_amount: number;
  max_uses: number;
  uses_count: number;
  is_active: boolean;
};

export default function PromoPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Promo[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const tour = usePageTour("promo_v1", PROMO_TOUR);
  const [form, setForm] = useState({
    code: "",
    discount_percent: "10",
    discount_amount: "",
    max_uses: "0",
  });

  async function load() {
    const r = await apiFetch<Promo[]>("/api/business/me/promo-codes").catch(() => []);
    setRows(r);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!form.code.trim()) {
      setErr("Kod kiriting");
      return;
    }
    const pct = parseInt(form.discount_percent || "0", 10) || 0;
    const amt = parseInt(form.discount_amount || "0", 10) || 0;
    if (pct <= 0 && amt <= 0) {
      setErr("Foiz yoki summa chegirmasidan birini kiriting");
      return;
    }
    if (pct < 0 || pct > 100) {
      setErr("Chegirma foizi 1 dan 100 gacha bo'lishi kerak");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/business/me/promo-codes", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          discount_percent: pct,
          discount_amount: amt,
          max_uses: parseInt(form.max_uses || "0", 10) || 0,
        }),
      });
      setForm({ code: "", discount_percent: "10", discount_amount: "", max_uses: "0" });
      setFormOpen(false);
      toast("Promo-kod yaratildi");
      await load();
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string) {
    await apiFetch(`/api/business/me/promo-codes/${id}/toggle`, { method: "PATCH" }).catch(() => {});
    await load();
  }

  async function remove(id: string) {
    await apiFetch(`/api/business/me/promo-codes/${id}`, { method: "DELETE" }).catch(() => {});
    await load();
  }

  return (
    <div>
      <ScreenHeader
        title="Promo-kodlar"
        subtitle="Chegirma va aksiyalar"
        right={
          <button
            data-tour="promo-add"
            onClick={() => setFormOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-ink-900 text-white tap"
          >
            <Plus className="h-5 w-5" strokeWidth={2.6} />
          </button>
        }
      />

      <div className="mt-3 flex flex-col gap-3 px-4 md:px-0">
        {rows.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-400">
            Hali promo-kod yo‘q
          </div>
        ) : (
          rows.map((p) => {
            const pct = p.max_uses > 0 ? Math.round((p.uses_count / p.max_uses) * 100) : 0;
            const isPct = p.discount_percent > 0;
            const value = isPct
              ? `${p.discount_percent}%`
              : `${Math.round(p.discount_amount / 1000)}k`;
            return (
              <div
                key={p.id}
                className={`card-soft overflow-hidden ${!p.is_active ? "opacity-60" : ""}`}
              >
                <div
                  className="relative overflow-hidden p-5 text-white"
                  style={{
                    background: p.is_active
                      ? "linear-gradient(135deg,#5B6BFF,#3640D4)"
                      : "#848AA2",
                  }}
                >
                  <div className="pointer-events-none absolute -right-5 -top-5 h-28 w-28 rounded-full bg-white/12" />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                        Promo kod
                      </div>
                      <div className="mt-1 font-mono font-display text-[22px] font-extrabold tracking-[1px]">
                        {p.code}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-3xl font-extrabold tracking-tight">
                        {value}
                      </div>
                      <div className="text-[11px] font-semibold opacity-80">
                        {isPct ? "chegirma" : "so‘m"}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-ink-500">
                      {p.uses_count} / {p.max_uses > 0 ? p.max_uses : "∞"} marta ishlatilgan
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        p.is_active
                          ? "bg-[#E6FAF3] text-[#0E9577]"
                          : "bg-ink-100 text-ink-400"
                      }`}
                    >
                      {p.is_active ? "FAOL" : "TUGAGAN"}
                    </span>
                  </div>
                  {p.max_uses > 0 && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: p.is_active ? "#4853F5" : "#B9BECD",
                        }}
                      />
                    </div>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => toggle(p.id)}
                      className="flex-1 rounded-xl bg-ink-100 py-2 text-xs font-bold text-ink-700 tap"
                    >
                      {p.is_active ? "O‘chirish" : "Yoqish"}
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="flex-1 rounded-xl bg-[#FFE7E3] py-2 text-xs font-bold text-[#C93A2A] tap"
                    >
                      O‘chirish
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <SheetRoot open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent>
          <SheetHeader title="Yangi promo-kod" />
          <form onSubmit={add}>
            <SheetBody className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-500">Kod</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER20"
                  className="yz-input mt-1 font-mono uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-500">Chegirma %</label>
                  <input
                    type="number"
                    value={form.discount_percent}
                    onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                    className="yz-input mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-500">Yoki so‘m</label>
                  <input
                    type="number"
                    value={form.discount_amount}
                    onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
                    placeholder="10000"
                    className="yz-input mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500">
                  Maks. qo‘llanish (0 = cheksiz)
                </label>
                <input
                  type="number"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  className="yz-input mt-1"
                />
              </div>
              {err && <p className="text-sm text-[#C93A2A]">{err}</p>}
            </SheetBody>
            <SheetFooter>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex-1 rounded-2xl bg-ink-100 px-4 py-4 font-display text-[15px] font-bold text-ink-900 tap"
              >
                Bekor
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex-[2]">
                {saving ? "Saqlanmoqda…" : "Saqlash"}
              </button>
            </SheetFooter>
          </form>
        </SheetContent>
      </SheetRoot>

      <Tour open={tour.open} steps={tour.steps} onClose={tour.dismiss} />
    </div>
  );
}

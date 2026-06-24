"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { ScreenHeader, TourFloat, useToast } from "@/components/yz";
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

const SERVICES_TOUR: TourStep[] = [
  {
    targetSelector: "[data-tour='services-add']",
    title: "Xizmat qo'shish tugmasi",
    body:
      "Mana shu “+” tugmasi orqali yangi xizmat qo'shasiz. Soch olish, massaj, stomatologiya — har biri narxi va davomiyligi bilan. Mijoz aynan shu ro'yxatdan tanlaydi.",
    mode: "info",
  },
  {
    targetSelector: "[data-tour='services-list']",
    title: "Ro'yxat shu yerda",
    body:
      "Qo'shilgan xizmatlar shu zonada chiqadi. Har bir kartochkani bosib tahrirlasangiz, narx-vaqt o'zgartirsa bo'ladi. Tartibini ham o'zingiz xohlagancha qo'yasiz.",
    mode: "info",
  },
];

type Svc = {
  id: string;
  name: string;
  price: number;
  price_max: number | null;
  description: string | null;
  duration_minutes: number;
  is_active: boolean;
  order: number;
};

function formatPriceRange(price: number, priceMax: number | null | undefined): string {
  const base = price.toLocaleString("ru-RU").replace(/,/g, " ");
  if (priceMax != null && priceMax > price) {
    const upper = priceMax.toLocaleString("ru-RU").replace(/,/g, " ");
    return `${base}–${upper}`;
  }
  return base;
}

const SWATCHES = ["#C7CCFF", "#A3AAFF", "#FFC94A", "#FF9FB5", "#FF7A6B", "#22C8A8", "#7BC6FF", "#B8A6FF"];

export default function ServicesPage() {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<Svc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    price: "",
    price_max: "",
    description: "",
    duration_minutes: "30",
  });
  const [err, setErr] = useState("");
  const tour = usePageTour("services_v1", SERVICES_TOUR);

  async function load() {
    setLoadErr("");
    try {
      setRows(await apiFetch<Svc[]>("/api/business/me/services"));
    } catch (e) {
      const msg = (e as Error).message || "";
      if (/business not found/i.test(msg) || /404/.test(msg)) {
        router.replace("/dashboard/onboarding");
        return;
      }
      if (/401|not authenticated|invalid user/i.test(msg)) {
        router.replace("/auth/login");
        return;
      }
      setLoadErr(msg || "Xatolik");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", price: "", price_max: "", description: "", duration_minutes: "30" });
    setErr("");
    setFormOpen(true);
  }

  function openEdit(s: Svc) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      price: String(s.price),
      price_max: s.price_max != null ? String(s.price_max) : "",
      description: s.description || "",
      duration_minutes: String(s.duration_minutes),
    });
    setErr("");
    setFormOpen(true);
  }

  async function saveSvc(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!form.name.trim()) {
      setErr("Nom kiriting");
      return;
    }
    const priceVal = parseInt(form.price || "0", 10) || 0;
    const priceMaxRaw = form.price_max.trim();
    const priceMaxVal = priceMaxRaw ? parseInt(priceMaxRaw, 10) : null;
    if (priceMaxVal != null && Number.isNaN(priceMaxVal)) {
      setErr("Maks. narx noto‘g‘ri");
      return;
    }
    if (priceMaxVal != null && priceMaxVal > 0 && priceMaxVal <= priceVal) {
      setErr("Maks. narx asosiy narxdan katta bo‘lishi kerak");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        price: priceVal,
        price_max: priceMaxVal && priceMaxVal > 0 ? priceMaxVal : null,
        description: form.description.trim() || null,
        duration_minutes: parseInt(form.duration_minutes || "30", 10) || 30,
      };
      if (editingId) {
        await apiFetch(`/api/business/me/services/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast("Xizmat yangilandi");
      } else {
        await apiFetch("/api/business/me/services", {
          method: "POST",
          body: JSON.stringify({ ...payload, order: rows.length }),
        });
        toast("Xizmat qo‘shildi");
      }
      setForm({ name: "", price: "", price_max: "", description: "", duration_minutes: "30" });
      setEditingId(null);
      setFormOpen(false);
      await load();
    } catch (e) {
      setErr((e as Error).message || "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function removeSvc(id: string) {
    // Confirm before a destructive, one-tap delete (matches the staff page),
    // and surface failures instead of silently swallowing them.
    if (!window.confirm("Bu xizmatni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await apiFetch(`/api/business/me/services/${id}`, { method: "DELETE" });
      toast("Xizmat o'chirildi");
      await load();
    } catch (e) {
      toast((e as Error).message || "O'chirib bo'lmadi");
    }
  }

  async function toggle(id: string) {
    await apiFetch(`/api/business/me/services/${id}/toggle`, { method: "PATCH" }).catch(() => {});
    await load();
  }

  return (
    <div>
      <ScreenHeader
        title="Xizmatlar"
        subtitle={`${rows.length} ta xizmat`}
        right={
          <button
            data-tour="services-add"
            onClick={openCreate}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-ink-900 text-white tap"
          >
            <Plus className="h-5 w-5" strokeWidth={2.6} />
          </button>
        }
      />

      <div data-tour="services-list" className="mt-3 flex flex-col gap-2.5 px-4 md:px-0">
        {loadErr ? (
          <div className="rounded-[22px] bg-[#FFE7E3] p-4 text-sm text-[#C93A2A]">{loadErr}</div>
        ) : loading ? (
          <div className="rounded-[22px] bg-white p-6 text-center text-sm text-ink-400 shadow-soft">
            Yuklanmoqda…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-400">
            Hali xizmat yo‘q — yuqoridan qo‘shing
          </div>
        ) : (
          rows.map((s, i) => (
            <div key={s.id} className="card-soft flex items-center gap-3.5 p-3.5">
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl"
                style={{ background: SWATCHES[i % SWATCHES.length] }}
              >
                ✂️
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[15px] font-bold text-ink-900">
                  {s.name}
                </div>
                {s.description && (
                  <div className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                    {s.description}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-ink-400" />
                    {s.duration_minutes} daq
                  </span>
                  <span>·</span>
                  <button
                    onClick={() => toggle(s.id)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      s.is_active ? "bg-[#E6FAF3] text-[#0E9577]" : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {s.is_active ? "FAOL" : "O‘CHIQ"}
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-[13px] font-extrabold text-ink-900">
                  {formatPriceRange(s.price, s.price_max)}
                </div>
                <div className="text-[10px] font-semibold text-ink-400">so‘m</div>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => openEdit(s)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-700 tap"
                  aria-label="Tahrirlash"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => removeSvc(s.id)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-500 tap"
                  aria-label="O‘chirish"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <SheetRoot open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent>
          <SheetHeader title={editingId ? "Xizmatni tahrirlash" : "Yangi xizmat"} />
          <form id="svc-form" onSubmit={saveSvc}>
            <SheetBody className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-500">Xizmat nomi</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Soch olish"
                  className="yz-input mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-500">Narxi</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="50000"
                    className="yz-input mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-500">
                    Maks. narxi <span className="font-normal text-ink-400">(ixtiyoriy)</span>
                  </label>
                  <input
                    type="number"
                    value={form.price_max}
                    onChange={(e) => setForm({ ...form, price_max: e.target.value })}
                    placeholder="70000"
                    className="yz-input mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500">Daqiqa</label>
                <input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, duration_minutes: e.target.value })
                  }
                  className="yz-input mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500">
                  Izoh <span className="font-normal text-ink-400">(ixtiyoriy)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Qo‘shimcha ma’lumot, masalan: soch uzunligiga qarab narx farqlanadi"
                  rows={3}
                  className="yz-input mt-1 resize-none"
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

      <TourFloat tour={tour} />
    </div>
  );
}

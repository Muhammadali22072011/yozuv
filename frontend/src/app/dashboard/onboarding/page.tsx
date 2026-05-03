"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock, Plus, Trash2 } from "lucide-react";
import { HeroGradient } from "@/components/yz/HeroGradient";
import { YzLoader } from "@/components/yz/Loader";
import { YzLogo } from "@/components/yz/Logo";
import { MapPicker } from "@/components/yz/MapPicker";
import { apiFetch } from "@/lib/api";

const CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: "barbershop", label: "Barbershop", emoji: "💈" },
  { value: "salon", label: "Salon", emoji: "💇" },
  { value: "dentist", label: "Stomatologiya", emoji: "🦷" },
  { value: "tutor", label: "Repetitor", emoji: "📚" },
  { value: "photo", label: "Fotograf", emoji: "📸" },
  { value: "massage", label: "Massaj / Spa", emoji: "💆" },
  { value: "fitness", label: "Fitness", emoji: "🏋️" },
  { value: "clinic", label: "Klinika", emoji: "⚕️" },
  { value: "other", label: "Boshqa", emoji: "📦" },
];

const DAY_NAMES = [
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
  "Yakshanba",
];

type DraftService = { name: string; price: string; duration_minutes: string };
type DraftDay = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: boolean;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function defaultDays(): DraftDay[] {
  return Array.from({ length: 7 }).map((_, i) => ({
    day_of_week: i,
    start_time: "09:00",
    end_time: "20:00",
    is_working: i < 6,
  }));
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const [biz, setBiz] = useState({
    name: "",
    slug: "",
    category: "barbershop",
    description: "",
    address: "",
    phone: "",
    viloyat: "",
    tuman: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [services, setServices] = useState<DraftService[]>([
    { name: "", price: "", duration_minutes: "30" },
    { name: "", price: "", duration_minutes: "30" },
  ]);
  const [days, setDays] = useState<DraftDay[]>(defaultDays());

  useEffect(() => {
    apiFetch<{ id: string }>("/api/business/me")
      .then(() => router.replace("/dashboard"))
      .catch(() => setLoading(false));
  }, [router]);

  function next() {
    setErr("");
    if (step === 1) {
      if (!biz.name.trim() || !biz.slug.trim()) {
        setErr("Biznes nomi va URL-slug majburiy");
        return;
      }
      if (!biz.phone.trim()) {
        setErr("Telefon raqamingizni kiriting");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      const filled = services.filter((s) => s.name.trim());
      if (filled.length === 0) {
        setErr("Kamida 1 ta xizmat qo‘shing");
        return;
      }
      setStep(3);
      return;
    }
  }

  function back() {
    setErr("");
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  }

  async function finish() {
    setErr("");
    const filledSvc = services.filter((s) => s.name.trim());
    if (filledSvc.length === 0) {
      setErr("Kamida 1 ta xizmat qo‘shing");
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/business", {
        method: "POST",
        body: JSON.stringify({
          name: biz.name.trim(),
          slug: biz.slug.trim(),
          category: biz.category,
          description: biz.description.trim(),
          address: biz.address.trim(),
          phone: biz.phone.trim(),
          viloyat: biz.viloyat,
          tuman: biz.tuman,
          latitude: biz.latitude,
          longitude: biz.longitude,
        }),
      });

      for (let i = 0; i < filledSvc.length; i++) {
        const s = filledSvc[i];
        await apiFetch("/api/business/me/services", {
          method: "POST",
          body: JSON.stringify({
            name: s.name.trim(),
            price: parseInt(s.price || "0", 10) || 0,
            duration_minutes: parseInt(s.duration_minutes || "30", 10) || 30,
            order: i,
          }),
        });
      }

      await apiFetch("/api/business/me/schedule", {
        method: "PUT",
        body: JSON.stringify({
          days: days.map((d) => ({
            day_of_week: d.day_of_week,
            start_time: `${d.start_time}:00`,
            end_time: `${d.end_time}:00`,
            break_start: null,
            break_end: null,
            is_working: d.is_working,
          })),
        }),
      });

      router.replace("/dashboard");
    } catch (e) {
      setErr((e as Error).message || "Xatolik. Qayta urinib ko‘ring.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <YzLoader fullscreen />;
  }

  return (
    <main className="min-h-screen bg-ink-50">
      <HeroGradient className="rounded-b-[32px] pb-24">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <YzLogo size={36} variant="light" />
            <div className="font-display text-[17px] font-bold tracking-tight text-white">
              Yozuv
            </div>
          </div>
          <span className="rounded-full bg-white/14 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
            {step} / 3
          </span>
        </div>
        <div className="mx-auto mt-10 max-w-xl">
          <div className="text-sm font-semibold text-white/70">
            Onboarding · {step}-qadam
          </div>
          <h1 className="mt-1 font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-white">
            {step === 1 && "Biznesingizni yarating"}
            {step === 2 && "Xizmatlarni qo‘shing"}
            {step === 3 && "Ish vaqtingiz"}
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/80">
            {step === 1 && "Nom, kategoriya va asosiy ma'lumotlar."}
            {step === 2 && "2–3 ta xizmat — narx va davomiyligini kiriting."}
            {step === 3 && "Mijozlar qaysi vaqtda yozila olishini belgilang."}
          </p>
        </div>

        <div className="mx-auto mt-6 flex max-w-xl items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full ${
                step >= n ? "bg-white" : "bg-white/25"
              }`}
            />
          ))}
        </div>
      </HeroGradient>

      <div className="relative z-10 -mt-16 px-4 pb-24">
        <div className="mx-auto max-w-xl space-y-3">
          {step === 1 && (
            <Step1
              biz={biz}
              setBiz={setBiz}
              slugTouched={slugTouched}
              setSlugTouched={setSlugTouched}
            />
          )}

          {step === 2 && (
            <Step2 services={services} setServices={setServices} />
          )}

          {step === 3 && <Step3 days={days} setDays={setDays} />}

          {err && (
            <div className="rounded-2xl bg-[#FFE7E3] px-3.5 py-2.5 text-sm text-[#C93A2A]">
              {err}
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            {step > 1 && (
              <button
                type="button"
                onClick={back}
                disabled={submitting}
                className="flex-1 rounded-2xl bg-white px-4 py-3.5 font-display text-[15px] font-bold text-ink-900 shadow-soft tap"
              >
                Orqaga
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                className="btn-primary flex-[2] justify-center"
              >
                Davom etish <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={submitting}
                className="btn-primary flex-[2] justify-center"
              >
                {submitting ? "Saqlanmoqda…" : "Tayyor"}
                {!submitting && <Check className="ml-2 h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

type Step1Biz = {
  name: string;
  slug: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  viloyat: string;
  tuman: string;
  latitude: number | null;
  longitude: number | null;
};

function Step1({
  biz,
  setBiz,
  slugTouched,
  setSlugTouched,
}: {
  biz: Step1Biz;
  setBiz: React.Dispatch<React.SetStateAction<Step1Biz>>;
  slugTouched: boolean;
  setSlugTouched: (v: boolean) => void;
}) {
  const [viloyats, setViloyats] = useState<string[]>([]);
  const [tumans, setTumans] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<string[]>("/api/geo/viloyats", { auth: false })
      .then(setViloyats)
      .catch(() => setViloyats([]));
  }, []);

  useEffect(() => {
    if (!biz.viloyat) {
      setTumans([]);
      return;
    }
    apiFetch<string[]>(
      `/api/geo/tumans?viloyat=${encodeURIComponent(biz.viloyat)}`,
      { auth: false },
    )
      .then(setTumans)
      .catch(() => setTumans([]));
  }, [biz.viloyat]);

  return (
    <div className="card-soft space-y-4 p-5 md:p-6">
      <div>
        <label className="block text-xs font-semibold text-ink-500">
          Biznes nomi *
        </label>
        <input
          value={biz.name}
          onChange={(e) => {
            const n = e.target.value;
            setBiz((f) => ({
              ...f,
              name: n,
              slug: slugTouched ? f.slug : slugify(n),
            }));
          }}
          placeholder="Masalan: Barber Akbar"
          className="yz-input mt-1.5"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-500">URL-slug *</label>
        <input
          value={biz.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setBiz({ ...biz, slug: slugify(e.target.value) });
          }}
          placeholder="barber-akbar"
          className="yz-input mt-1.5 font-mono"
        />
        <div className="mt-2 rounded-2xl bg-ink-50 px-3 py-2 font-mono text-xs text-ink-500">
          t.me/Yozuv_cl_bot?start={biz.slug || "sizning-slug"}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-500">Kategoriya *</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => {
            const active = biz.category === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setBiz({ ...biz, category: c.value })}
                className={`flex items-center gap-2 rounded-2xl border-[1.5px] px-3 py-2.5 text-left tap ${
                  active
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-ink-100 bg-white"
                }`}
              >
                <span className="text-lg">{c.emoji}</span>
                <span
                  className={`font-display text-sm font-bold ${
                    active ? "text-indigo-700" : "text-ink-900"
                  }`}
                >
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-ink-500">Viloyat</label>
          <select
            value={biz.viloyat}
            onChange={(e) => setBiz({ ...biz, viloyat: e.target.value, tuman: "" })}
            className="yz-input mt-1.5"
          >
            <option value="">Tanlang…</option>
            {viloyats.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-500">Tuman / Shahar</label>
          <select
            value={biz.tuman}
            onChange={(e) => setBiz({ ...biz, tuman: e.target.value })}
            disabled={!biz.viloyat}
            className="yz-input mt-1.5 disabled:opacity-50"
          >
            <option value="">{biz.viloyat ? "Tanlang…" : "Avval viloyat"}</option>
            {tumans.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-500">
          Xaritada joylashuv
        </label>
        <div className="mt-1.5">
          <MapPicker
            value={
              biz.latitude !== null && biz.longitude !== null
                ? { lat: biz.latitude, lng: biz.longitude }
                : null
            }
            onChange={(v) => setBiz((f) => ({ ...f, latitude: v.lat, longitude: v.lng }))}
            onAddressLookup={(addr) =>
              setBiz((f) => (f.address.trim() ? f : { ...f, address: addr }))
            }
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-ink-500">Telefon</label>
          <input
            value={biz.phone}
            onChange={(e) => setBiz({ ...biz, phone: e.target.value })}
            placeholder="+998 90 123 45 67"
            className="yz-input mt-1.5"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-500">Manzil</label>
          <input
            value={biz.address}
            onChange={(e) => setBiz({ ...biz, address: e.target.value })}
            placeholder="Amir Temur 15"
            className="yz-input mt-1.5"
          />
        </div>
      </div>
    </div>
  );
}

function Step2({
  services,
  setServices,
}: {
  services: DraftService[];
  setServices: React.Dispatch<React.SetStateAction<DraftService[]>>;
}) {
  function update(i: number, patch: Partial<DraftService>) {
    setServices((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function remove(i: number) {
    setServices((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  }
  function add() {
    setServices((arr) => [...arr, { name: "", price: "", duration_minutes: "30" }]);
  }

  return (
    <div className="space-y-2.5">
      {services.map((s, i) => (
        <div key={i} className="card-soft space-y-3 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div className="font-display text-sm font-bold text-ink-900">
              Xizmat {i + 1}
            </div>
            {services.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="grid h-8 w-8 place-items-center rounded-xl bg-ink-100 text-ink-500 tap"
                aria-label="O‘chirish"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-500">Nomi</label>
            <input
              value={s.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Soch olish"
              className="yz-input mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-500">Narxi (so‘m)</label>
              <input
                type="number"
                inputMode="numeric"
                value={s.price}
                onChange={(e) => update(i, { price: e.target.value })}
                placeholder="50000"
                className="yz-input mt-1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-500">Daqiqa</label>
              <input
                type="number"
                inputMode="numeric"
                value={s.duration_minutes}
                onChange={(e) => update(i, { duration_minutes: e.target.value })}
                className="yz-input mt-1"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-ink-200 bg-white px-4 py-3.5 font-display text-sm font-bold text-ink-700 tap"
      >
        <Plus className="h-4 w-4" /> Yana qo‘shish
      </button>
    </div>
  );
}

function Step3({
  days,
  setDays,
}: {
  days: DraftDay[];
  setDays: React.Dispatch<React.SetStateAction<DraftDay[]>>;
}) {
  function update(i: number, patch: Partial<DraftDay>) {
    setDays((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  return (
    <div className="card-soft divide-y divide-ink-100 p-1.5">
      {days.map((d, i) => (
        <div key={d.day_of_week} className="px-3 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div
                className={`font-display text-[15px] font-bold ${
                  d.is_working ? "text-ink-900" : "text-ink-300"
                }`}
              >
                {DAY_NAMES[i]}
              </div>
              <div className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-xs text-ink-400">
                {d.is_working ? (
                  <>
                    <Clock className="h-3 w-3" />
                    {d.start_time} – {d.end_time}
                  </>
                ) : (
                  "Dam olish kuni"
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => update(i, { is_working: !d.is_working })}
              className={`h-[26px] w-11 rounded-full p-[3px] transition-colors ${
                d.is_working ? "bg-indigo-600" : "bg-ink-200"
              }`}
              aria-label={d.is_working ? "Yopish" : "Ochish"}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  d.is_working ? "translate-x-[18px]" : ""
                }`}
              />
            </button>
          </div>

          {d.is_working && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-500">
                  Boshlanish
                </label>
                <input
                  type="time"
                  value={d.start_time}
                  onChange={(e) => update(i, { start_time: e.target.value })}
                  className="yz-input mt-1"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500">
                  Tugash
                </label>
                <input
                  type="time"
                  value={d.end_time}
                  onChange={(e) => update(i, { end_time: e.target.value })}
                  className="yz-input mt-1"
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

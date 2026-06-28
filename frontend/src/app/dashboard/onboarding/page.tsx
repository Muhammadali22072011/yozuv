"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Clock, MapPin, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { YzLoader } from "@/components/yz/Loader";
import { YzLogo } from "@/components/yz/Logo";
import { MapPicker } from "@/components/yz/MapPicker";
import { apiFetch, setActiveBusinessId } from "@/lib/api";
import { track } from "@/lib/analytics";

const STEP_META: { label: string; title: string; sub: string }[] = [
  {
    label: "Biznes",
    title: "Biznesingizni yarating",
    sub: "Nom, kategoriya va asosiy ma'lumotlar.",
  },
  {
    label: "Xizmatlar",
    title: "Xizmatlarni qo‘shing",
    sub: "2–3 ta xizmat — narx va davomiyligini kiriting.",
  },
  {
    label: "Ish vaqti",
    title: "Ish vaqtingiz",
    sub: "Mijozlar qaysi vaqtda yozila olishini belgilang.",
  },
];

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
  const searchParams = useSearchParams();
  // ?new=1 → adding an *additional* business. Skip the "already onboarded?"
  // redirect so an existing owner can run the wizard again for a new branch.
  const isAdditional = searchParams.get("new") === "1";
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  // After the data wizard saves, instead of bouncing straight to the
  // dashboard we land the owner on a "first value = a booking" screen
  // and remember the slug so we can build their own bot deep-link.
  const [doneSlug, setDoneSlug] = useState<string | null>(null);

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
    // Adding another business: don't bounce back to the dashboard just
    // because one already exists — that's the whole point here.
    if (isAdditional) {
      setLoading(false);
      return;
    }
    apiFetch<{ id: string }>("/api/business/me")
      .then(() => router.replace("/dashboard"))
      .catch(() => setLoading(false));
  }, [router, isAdditional]);

  function next() {
    setErr("");
    if (step === 1) {
      if (!biz.name.trim() || !biz.slug.trim()) {
        setErr("Biznes nomi va URL-slug majburiy");
        return;
      }
      if (biz.slug.trim().length < 2) {
        setErr("URL-slug kamida 2 ta belgidan iborat bo‘lishi kerak");
        return;
      }
      if (!biz.phone.trim()) {
        setErr("Telefon raqamingizni kiriting");
        return;
      }
      setStep(2);
      track("onboarding_step", { step: 2 });
      return;
    }
    if (step === 2) {
      const filled = services.filter((s) => s.name.trim());
      if (filled.length === 0) {
        setErr("Kamida 1 ta xizmat qo‘shing");
        return;
      }
      setStep(3);
      track("onboarding_step", { step: 3 });
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

    const badDay = days.find((d) => d.is_working && d.end_time <= d.start_time);
    if (badDay) {
      setErr(
        `Tugash vaqti boshlanish vaqtidan keyin bo‘lishi kerak (${DAY_NAMES[badDay.day_of_week]})`,
      );
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      try {
        const created = await apiFetch<{ id: string }>("/api/business", {
          method: "POST",
          body: JSON.stringify({
            name: biz.name.trim(),
            slug: biz.slug.trim(),
            category: biz.category,
            description: biz.description.trim(),
            address: biz.address.trim(),
            phone: biz.phone.trim(),
            viloyat: biz.viloyat.trim(),
            tuman: biz.tuman.trim(),
            latitude: biz.latitude,
            longitude: biz.longitude,
            // B2B referral code captured from a ?ref= share link at login.
            ref:
              (typeof window !== "undefined" &&
                (localStorage.getItem("yozuv_ref") ||
                  new URLSearchParams(window.location.search).get("ref"))) ||
              "",
          }),
        });
        // Point the active business at the one we just created so the
        // following services/schedule calls (and the dashboard we land on)
        // act against it rather than a previously-selected business.
        if (created?.id) setActiveBusinessId(created.id);
        if (typeof window !== "undefined") localStorage.removeItem("yozuv_ref");
      } catch (e) {
        const msg = (e as Error).message || "";
        if (!/already exists/i.test(msg)) {
          throw e;
        }
        // Biznes oldingi urinishdan allaqachon yaratilgan — davom etamiz.
      }

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

      track("onboarding_completed");
      // Don't bounce to the dashboard yet — show the "try your first
      // booking" screen so the owner experiences the core value (a real
      // booking flowing through their own bot) before anything else.
      setDoneSlug(biz.slug.trim());
      setSubmitting(false);
    } catch (e) {
      setErr((e as Error).message || "Xatolik. Qayta urinib ko‘ring.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <YzLoader fullscreen />;
  }

  if (doneSlug) {
    // Bot deep-link built the same way the dashboard does, but using the
    // mini-app entry point (?startapp=) instead of ?start= so the owner
    // (and their clients) land in the in-Telegram booking app.
    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "Yozuv_cl_bot";
    const botLink = `https://t.me/${botUsername}?startapp=${doneSlug}`;
    return (
      <main
        className="min-h-screen bg-ink-50"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <header className="px-4 pt-5">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between">
            <div className="flex items-center gap-2.5">
              <YzLogo size={36} />
              <div className="font-display text-[17px] font-extrabold tracking-tighter text-ink-900">
                Yozuv
              </div>
            </div>
            <span className="tnum rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-success shadow-soft-sm">
              Tayyor ✓
            </span>
          </div>
        </header>

        <div className="px-4 pb-24 pt-5">
          <div className="mx-auto max-w-xl space-y-5">
            <div
              className="relative overflow-hidden rounded-4xl p-5 text-white"
              style={{
                background: "linear-gradient(135deg,#7C5CFF 0%,#4853F5 100%)",
                boxShadow: "0 18px 36px -18px rgba(72,83,245,0.6)",
              }}
            >
              <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
              <div className="relative flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                  <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
                </span>
                <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/75">
                  Birinchi qadam
                </div>
              </div>
              <h1 className="relative mt-3.5 font-display text-[28px] font-extrabold leading-tight tracking-tightest text-white">
                Birinchi yozuvni sinab ko‘ring
              </h1>
              <p className="relative mt-2 max-w-md text-sm text-white/80">
                Botingizni oching va o‘zingizga sinov uchun bitta yozuv qoldiring —
                mijozlaringiz buni qanday ko‘rishini va hammasi qanday ishlashini
                shu zahoti his qilasiz.
              </p>
            </div>

            <div className="card space-y-4 p-5 md:p-6">
              <a
                href={botLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  track("first_booking_try", { slug: doneSlug });
                  track("landing_to_bot");
                }}
                className="btn-primary w-full justify-center tap"
              >
                <Send className="mr-2 h-4.5 w-4.5" /> Botni ochib, sinab ko‘rish
              </a>
              <p className="text-center text-xs text-ink-400">
                Bot yangi oynada ochiladi. Sinov yozuvini qoldirib, kabinetga
                qayting.
              </p>
              <button
                type="button"
                onClick={() => router.replace("/dashboard")}
                className="btn-soft w-full justify-center tap"
              >
                Keyinroq
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const meta = STEP_META[step - 1];

  return (
    <main
      className="min-h-screen bg-ink-50"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Светлая воздушная шапка (Havodor) — без большого indigo-блока. */}
      <header className="px-4 pt-5">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <YzLogo size={36} />
            <div className="font-display text-[17px] font-extrabold tracking-tighter text-ink-900">
              Yozuv
            </div>
          </div>
          <span className="tnum rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-ink-500 shadow-soft-sm">
            {step} / 3
          </span>
        </div>
      </header>

      <div className="px-4 pb-24 pt-5">
        <div className="mx-auto max-w-xl space-y-5">
          {/* Премиальная feature-карточка шага — единственный яркий момент. */}
          <div
            className="relative overflow-hidden rounded-4xl p-5 text-white"
            style={{
              background: "linear-gradient(135deg,#7C5CFF 0%,#4853F5 100%)",
              boxShadow: "0 18px 36px -18px rgba(72,83,245,0.6)",
            }}
          >
            <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
            <div className="relative flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
              </span>
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/75">
                Onboarding · {step}-qadam
              </div>
            </div>
            <h1 className="relative mt-3.5 font-display text-[28px] font-extrabold leading-tight tracking-tightest text-white">
              {meta.title}
            </h1>
            <p className="relative mt-2 max-w-md text-sm text-white/80">
              {meta.sub}
            </p>

            {/* Сегментированный прогресс с подписями шагов. */}
            <div className="relative mt-5 grid grid-cols-3 gap-2">
              {STEP_META.map((m, i) => {
                const n = i + 1;
                const done = step > n;
                const current = step === n;
                return (
                  <div key={m.label} className="flex flex-col gap-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-colors ${
                        step >= n ? "bg-white" : "bg-white/25"
                      }`}
                    />
                    <div
                      className={`flex items-center gap-1 text-[11px] font-bold ${
                        current ? "text-white" : "text-white/55"
                      }`}
                    >
                      {done && <Check className="h-3 w-3" strokeWidth={3} />}
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
            <div
              className="rounded-2xl px-3.5 py-2.5 text-sm font-medium"
              style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
            >
              {err}
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            {step > 1 && (
              <button
                type="button"
                onClick={back}
                disabled={submitting}
                className="btn-soft flex-1 justify-center tap disabled:opacity-40"
              >
                Orqaga
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                className="btn-primary flex-[2] justify-center tap"
              >
                Davom etish <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={submitting}
                className="btn-primary flex-[2] justify-center tap"
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
    <div className="card space-y-5 p-5 md:p-6">
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
          t.me/Yozuv_cl_bot?startapp={biz.slug || "sizning-slug"}
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
                className={`flex items-center gap-2 rounded-2xl border-[1.5px] px-3 py-2.5 text-left tap transition-colors ${
                  active
                    ? "border-indigo-500 bg-indigo-50 shadow-soft-sm"
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
        <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
          <MapPin className="h-3.5 w-3.5 text-ink-400" strokeWidth={2.2} />
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
    <div className="space-y-3">
      {services.map((s, i) => (
        <div key={i} className="card space-y-3.5 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="tnum grid h-8 w-8 place-items-center rounded-2xl bg-indigo-50 font-display text-sm font-extrabold text-indigo-700">
                {i + 1}
              </span>
              <div className="font-display text-sm font-bold text-ink-900">
                Xizmat {i + 1}
              </div>
            </div>
            {services.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="grid h-9 w-9 place-items-center rounded-2xl bg-ink-100 text-ink-500 tap transition-colors active:bg-ink-200"
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
                className="yz-input mt-1 tnum"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-500">Daqiqa</label>
              <input
                type="number"
                inputMode="numeric"
                value={s.duration_minutes}
                onChange={(e) => update(i, { duration_minutes: e.target.value })}
                className="yz-input mt-1 tnum"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-[1.5px] border-dashed border-ink-200 bg-white px-4 py-4 font-display text-sm font-bold text-ink-700 tap transition-colors active:bg-ink-50"
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
    <div className="card divide-y divide-ink-100 p-1.5">
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
                    <span className="tnum">
                      {d.start_time} – {d.end_time}
                    </span>
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
                  className="yz-input mt-1 tnum"
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
                  className="yz-input mt-1 tnum"
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

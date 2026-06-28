"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { track } from "@/lib/analytics";

// Tier pricing mirrors the backend value metric (active masters / seats).
// Monthly prices in UZS; daily framing anchors to "cheaper than one client".
// Yearly model per SUBSCRIPTION-PLAN.md: "pay for 10, get 12" → 2 months free
// (−17%). So yearly = monthly × 10 (990k / 1 990k / 3 990k) — matches the plan,
// not an arbitrary discount.
const formatSom = (value: number) => `${value.toLocaleString("ru-RU").replace(/,/g, " ")} so‘m`;

const yearlyFromMonthly = (monthly: number) => monthly * 10;

const tiers = [
  {
    id: "yakka",
    name: "Yakka",
    monthly: 99000,
    note: "1 usta",
    monthlySub: "kuniga ~3 300 so‘m — bitta choynak choy puli",
    yearlySub: "yiliga · 2 oy sovg‘a",
    cta: "Yakka tarifni tanlash",
    perks: [
      "Cheksiz yozilishlar",
      "Eslatma, shaxsiy sahifa, QR",
      "Sodiqlik kartasi",
    ],
    featured: false,
    badge: "",
  },
  {
    id: "salon",
    name: "Salon",
    monthly: 199000,
    note: "5 ustagacha",
    monthlySub: "1 mijozdan arzon — har kuni o‘zini qoplaydi",
    yearlySub: "yiliga · 2 oy sovg‘a",
    cta: "Salon tarifni tanlash",
    perks: [
      "Hammasi Yakka tarifdan",
      "Analitika va hisobotlar",
      "Navbat (waitlist), promokodlar",
    ],
    featured: true,
    badge: "MASHHUR",
  },
  {
    id: "biznes",
    name: "Biznes",
    monthly: 399000,
    note: "cheksiz usta",
    monthlySub: "tarmoq va klinikalar uchun",
    yearlySub: "yiliga · 2 oy sovg‘a",
    cta: "Biznes tarifni tanlash",
    perks: [
      "Hammasi Salon tarifdan",
      "Bir nechta filial",
      "Jamoa rollari · prioritet yordam",
    ],
    featured: false,
    badge: "FILIALLAR",
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="bg-ink-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="eyebrow text-indigo-600">Tariflar</div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tighter text-ink-900 md:text-4xl">
          Avval 14 kun bepul sinab ko&apos;ring
        </h2>
        <p className="mt-3 max-w-xl text-sm text-ink-500">
          Karta kerak emas. Yoqmasa — to&apos;lamaysiz. Hech narsa avtomatik
          yechilmaydi. To&apos;lov Payme, Click yoki karta orqali — sumda.
        </p>

        {/* Oylik / Yillik toggle — yearly unlocks the 2-month gift. */}
        <div className="mt-6 inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-soft-sm">
          <button
            type="button"
            onClick={() => setYearly(false)}
            aria-pressed={!yearly}
            className={`rounded-full px-4 py-1.5 font-display text-[13px] font-bold transition-colors tap ${
              yearly ? "text-ink-500" : "bg-indigo-600 text-white shadow-soft-sm"
            }`}
          >
            Oylik
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            aria-pressed={yearly}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-display text-[13px] font-bold transition-colors tap ${
              yearly ? "bg-indigo-600 text-white shadow-soft-sm" : "text-ink-500"
            }`}
          >
            Yillik
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide ${
                yearly ? "bg-white/20 text-white" : "bg-success-bg text-success"
              }`}
            >
              −17%
            </span>
          </button>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3 md:items-start">
          {tiers.map((t) => {
            const price = yearly
              ? formatSom(yearlyFromMonthly(t.monthly))
              : formatSom(t.monthly);
            const note = yearly ? `yiliga · ${t.note}` : `oyiga · ${t.note}`;
            const sub = yearly ? t.yearlySub : t.monthlySub;
            const href = `/auth/login?plan=${t.id}`;

            return t.featured ? (
              <div
                key={t.name}
                className="relative overflow-hidden rounded-4xl p-7 text-white md:-mt-2 tap"
                style={{
                  background: "linear-gradient(135deg,#7C5CFF,#4853F5)",
                  boxShadow: "0 24px 50px -18px rgba(72,83,245,0.55)",
                }}
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/5" />
                <div className="absolute right-5 top-5 rounded-full bg-lemon px-3 py-1 text-[10px] font-extrabold tracking-wide text-ink-900 shadow-soft-sm">
                  {t.badge}
                </div>
                <div className="relative">
                  <h3 className="font-display text-xl font-extrabold tracking-tight text-white">
                    {t.name}
                  </h3>
                  <p className="mt-5 flex items-baseline gap-1 font-display text-5xl font-extrabold tracking-tightest text-white tnum">
                    {price}
                  </p>
                  <p className="mt-1.5 text-sm text-white/75 tnum">{note}</p>
                  <p className="mt-1 text-[13px] font-medium text-lemon">{sub}</p>

                  <ul className="mt-6 space-y-2.5">
                    {t.perks.map((p) => (
                      <li
                        key={p}
                        className="flex items-start gap-2.5 text-sm font-medium text-white/90"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                          <Check className="h-3.5 w-3.5 text-lemon" strokeWidth={3} />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={href}
                    onClick={() => track("plan_select", { plan: t.id, billing: yearly ? "yearly" : "monthly" })}
                    className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-3.5 font-display text-[15px] font-bold text-indigo-700 shadow-soft-sm transition-transform active:scale-[0.97] tap"
                  >
                    {t.cta}
                  </Link>
                </div>
              </div>
            ) : (
              <div
                key={t.name}
                className="card-lg p-7 tap ring-1 ring-indigo-100"
              >
                <h3 className="font-display text-xl font-extrabold tracking-tight text-ink-900">
                  {t.name}
                </h3>
                {t.badge && (
                  <span className="mt-2 inline-block rounded-full bg-success-bg px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-success">
                    {t.badge}
                  </span>
                )}
                <p className="mt-5 flex items-baseline gap-1 font-display text-5xl font-extrabold tracking-tightest text-ink-900 tnum">
                  {price}
                </p>
                <p className="mt-1.5 text-sm text-ink-500 tnum">{note}</p>
                <p className="mt-1 text-[13px] font-medium text-indigo-600">{sub}</p>

                <ul className="mt-6 space-y-2.5">
                  {t.perks.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2.5 text-sm font-medium text-ink-700"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                        <Check className="h-3.5 w-3.5 text-indigo-600" strokeWidth={3} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>

                <Link
                  href={href}
                  onClick={() => track("plan_select", { plan: t.id, billing: yearly ? "yearly" : "monthly" })}
                  className="btn-soft mt-7 w-full justify-center"
                >
                  {t.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* ROI + trust row — cheaper than one prevented no-show, paid in soum. */}
        <p className="mt-8 text-sm text-ink-600">
          1 ta &laquo;kelmadi&raquo; — bu yo&apos;qolgan mijoz. Yozuv oyiga bitta
          kelmay qolishni to&apos;xtatsa — o&apos;zini qoplaydi.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-ink-500">
          <span>Payme</span>
          <span>Click</span>
          <span>Uzcard / Humo</span>
          <span className="text-success">14 kun bepul · karta kerak emas</span>
          <span>Avtomatik yechmaymiz</span>
        </div>
      </div>
    </section>
  );
}

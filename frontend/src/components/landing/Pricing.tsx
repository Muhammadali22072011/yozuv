import Link from "next/link";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Bepul sinov",
    price: "0 so‘m",
    note: "14 kun · karta kerak emas",
    cta: "Bepul boshlash",
    href: "/auth/login",
    perks: [
      "Barcha imkoniyatlar ochiq",
      "Cheksiz yozilishlar",
      "Istalgan vaqtda bekor qilasiz",
    ],
    featured: false,
    badge: "",
  },
  {
    name: "Oylik",
    price: "187 500 so‘m",
    note: "oyiga · ≈ $15",
    cta: "Oylik tarifni tanlash",
    href: "/dashboard/settings",
    perks: [
      "Kuniga ~6 200 so‘m — bitta mijozdan kam",
      "Cheksiz yozilishlar",
      "Analitika va eslatmalar",
      "QR va broshyura",
    ],
    featured: true,
    badge: "MASHHUR",
  },
  {
    name: "Yillik",
    price: "1 875 000 so‘m",
    note: "yiliga · 2 oy bepul",
    cta: "Yillik tarifni tanlash",
    href: "/dashboard/settings",
    perks: [
      "2 oy sovg‘a — yiliga 375 000 so‘m tejaysiz",
      "Hammasi Oylik tarifdan",
      "Prioritet yordam",
    ],
    featured: false,
    badge: "15% TEJASH",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-ink-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="eyebrow text-indigo-600">Tariflar</div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tighter text-ink-900 md:text-4xl">
          Avval 14 kun bepul sinab ko&apos;ring
        </h2>
        <p className="mt-3 max-w-xl text-sm text-ink-500">
          Karta kerak emas. Yoqmasa — to&apos;lamaysiz. To&apos;lov faqat Payme yoki
          Click orqali, sumda.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3 md:items-start">
          {tiers.map((t) =>
            t.featured ? (
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
                    {t.price}
                  </p>
                  <p className="mt-1.5 text-sm text-white/75 tnum">{t.note}</p>

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
                    href={t.href}
                    className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-3.5 font-display text-[15px] font-bold text-indigo-700 shadow-soft-sm transition-transform active:scale-[0.97] tap"
                  >
                    {t.cta}
                  </Link>
                </div>
              </div>
            ) : (
              <div key={t.name} className="card-lg p-7 tap">
                <h3 className="font-display text-xl font-extrabold tracking-tight text-ink-900">
                  {t.name}
                </h3>
                {t.badge && (
                  <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-emerald-700">
                    {t.badge}
                  </span>
                )}
                <p className="mt-5 flex items-baseline gap-1 font-display text-5xl font-extrabold tracking-tightest text-ink-900 tnum">
                  {t.price}
                </p>
                <p className="mt-1.5 text-sm text-ink-500 tnum">{t.note}</p>

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

                <Link href={t.href} className="btn-soft mt-7 w-full justify-center">
                  {t.cta}
                </Link>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

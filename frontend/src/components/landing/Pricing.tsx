import Link from "next/link";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Trial",
    price: "Bepul",
    note: "14 kun",
    cta: "Boshlash",
    href: "/auth/login",
    perks: ["Barcha imkoniyatlar", "14 kun bepul", "Karta talab qilinmaydi"],
    featured: false,
  },
  {
    name: "Oylik",
    price: "$15",
    note: "187 500 so‘m / oy",
    cta: "To‘lash",
    href: "/dashboard/settings",
    perks: [
      "Cheksiz yozilishlar",
      "Analitika va eslatmalar",
      "QR va broshyura",
      "Premium qo‘llab-quvvatlash",
    ],
    featured: true,
  },
  {
    name: "Yillik",
    price: "$150",
    note: "1 875 000 so‘m / yil",
    cta: "To‘lash",
    href: "/dashboard/settings",
    perks: ["2 oy bepul", "Hammasi Oylik tarifdan", "Prioritet yordam"],
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-ink-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="eyebrow text-indigo-600">Tariflar</div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tighter text-ink-900 md:text-4xl">
          Siz uchun mos reja
        </h2>

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
                  MASHHUR
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

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
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
          Tariflar
        </div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl">
          Siz uchun mos reja
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                t.featured
                  ? "relative overflow-hidden rounded-[22px] bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 text-white shadow-[0_20px_40px_-10px_rgba(72,83,245,0.5)]"
                  : "card-soft p-6"
              }
            >
              {t.featured && (
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
              )}
              {t.featured && (
                <div className="absolute right-4 top-4 rounded-full bg-lemon px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-ink-900">
                  MASHHUR
                </div>
              )}
              <div className="relative">
                <h3 className={`font-display text-xl font-extrabold tracking-tight ${t.featured ? "text-white" : "text-ink-900"}`}>
                  {t.name}
                </h3>
                <p
                  className={`mt-4 font-display text-4xl font-extrabold tracking-[-0.03em] ${
                    t.featured ? "text-white" : "text-ink-900"
                  }`}
                >
                  {t.price}
                </p>
                <p className={`mt-1 text-sm ${t.featured ? "text-white/75" : "text-ink-500"}`}>
                  {t.note}
                </p>

                <ul className="mt-5 space-y-2">
                  {t.perks.map((p) => (
                    <li
                      key={p}
                      className={`flex items-start gap-2 text-sm ${
                        t.featured ? "text-white/90" : "text-ink-700"
                      }`}
                    >
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${t.featured ? "text-lemon" : "text-indigo-600"}`}
                        strokeWidth={2.6}
                      />
                      {p}
                    </li>
                  ))}
                </ul>

                <Link
                  href={t.href}
                  className={
                    t.featured
                      ? "mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-3.5 font-display text-[15px] font-bold text-indigo-700 tap"
                      : "btn-primary mt-6 w-full justify-center"
                  }
                >
                  {t.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600">
          Tariflar
        </div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-4xl">
          Avval 14 kun bepul sinab ko&apos;ring
        </h2>
        <p className="mt-3 max-w-xl text-sm text-ink-500">
          Karta kerak emas. Yoqmasa — to&apos;lamaysiz. To&apos;lov faqat Payme yoki
          Click orqali, sumda.
        </p>

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
              {t.featured && t.badge && (
                <div className="absolute right-4 top-4 rounded-full bg-lemon px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-ink-900">
                  {t.badge}
                </div>
              )}
              <div className="relative">
                <h3 className={`font-display text-xl font-extrabold tracking-tight ${t.featured ? "text-white" : "text-ink-900"}`}>
                  {t.name}
                </h3>
                {!t.featured && t.badge && (
                  <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-emerald-700">
                    {t.badge}
                  </span>
                )}
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

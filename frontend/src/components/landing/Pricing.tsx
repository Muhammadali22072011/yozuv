import Link from "next/link";
import { Check } from "lucide-react";

// Tier pricing mirrors the backend value metric (active masters / seats).
// Yearly = ×10 months → 2 months free. Prices in UZS; daily framing anchors
// to "cheaper than one client".
const tiers = [
  {
    name: "Yakka",
    price: "99 000 so‘m",
    note: "oyiga · 1 usta",
    sub: "kuniga ~3 300 so‘m — bitta choynak choy puli",
    cta: "Yakka tarifni tanlash",
    href: "/auth/login",
    perks: [
      "Cheksiz yozilishlar",
      "Eslatma, shaxsiy sahifa, QR",
      "Sodiqlik kartasi",
    ],
    featured: false,
    badge: "",
  },
  {
    name: "Salon",
    price: "199 000 so‘m",
    note: "oyiga · 5 ustagacha",
    sub: "1 mijozdan arzon — yiliga 1 990 000 (2 oy sovg‘a)",
    cta: "Salon tarifni tanlash",
    href: "/dashboard/settings",
    perks: [
      "Hammasi Yakka tarifdan",
      "Analitika va hisobotlar",
      "Navbat (waitlist), promokodlar",
    ],
    featured: true,
    badge: "MASHHUR",
  },
  {
    name: "Biznes",
    price: "399 000 so‘m",
    note: "oyiga · cheksiz usta",
    sub: "sex va klinikalar uchun — yiliga 3 990 000",
    cta: "Biznes tarifni tanlash",
    href: "/dashboard/settings",
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
                  <p className="mt-1 text-[13px] font-medium text-lemon">{t.sub}</p>

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
                <p className="mt-1 text-[13px] font-medium text-indigo-600">{t.sub}</p>

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

        {/* ROI + trust row — cheaper than one prevented no-show, paid in soum. */}
        <p className="mt-8 text-sm text-ink-600">
          1 ta &laquo;kelmadi&raquo; — bu yo&apos;qolgan mijoz. Yozuv oyiga bitta
          neyavkani to&apos;xtatsa — o&apos;zini qoplaydi.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium text-ink-500">
          <span>Payme</span>
          <span>Click</span>
          <span>Uzcard / Humo</span>
          <span className="text-emerald-700">14 kun bepul · karta kerak emas</span>
          <span>Avtomatik yechmaymiz</span>
        </div>
      </div>
    </section>
  );
}

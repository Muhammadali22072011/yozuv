import Link from "next/link";
import { ArrowRight, Bell, BellRing, CalendarDays, CreditCard, Send, Sparkles } from "lucide-react";
import { YzLogo } from "@/components/yz/Logo";
import { CtaLink } from "@/components/landing/StickyCTA";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-ink-50">
      {/* Havodor — светлый воздушный холст. Один яркий момент — кнопка-градиент
          и стат-чип в макете; фон держим лёгким с пастельными свечениями. */}
      <div className="pointer-events-none absolute -right-28 -top-24 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute right-44 top-28 h-44 w-44 rounded-full bg-lemon/25 blur-2xl" />
      <div className="pointer-events-none absolute -left-20 bottom-16 h-72 w-72 rounded-full bg-lilac/25 blur-3xl" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 pt-16 pb-20 lg:flex-row lg:items-center lg:gap-16 lg:pt-24 lg:pb-28">
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-2.5">
            <YzLogo size={40} />
            <div>
              <div className="eyebrow">Telegram Mini App</div>
              <div className="font-display text-[17px] font-extrabold tracking-tighter text-ink-900">
                Yozuv
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-bold text-indigo-700 shadow-soft-sm">
            <Sparkles className="h-3.5 w-3.5 text-iris" strokeWidth={2.4} />
            14 kun bepul · Karta kerak emas
          </span>

          <h1 className="font-display text-4xl font-extrabold leading-[1.04] tracking-tightest text-ink-900 sm:text-5xl md:text-6xl">
            Daftarni unuting — mijozlar o&apos;zi Telegramda yoziladi
          </h1>
          <p className="max-w-xl text-base text-ink-500 md:text-lg">
            Barbershop, salon va klinikalar uchun. Bot mijozni qabul qiladi, bo&apos;sh
            slotni o&apos;zi topadi va tashrifdan 1 soat oldin eslatadi —
            &laquo;keluvdim, esimdan chiqibdi&raquo; kamayadi. Sayt ham, ilova ham
            kerak emas.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <CtaLink
              where="hero"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-display text-[15px] font-bold text-white tap"
              style={{
                background: "linear-gradient(135deg,#7C5CFF 0%,#4853F5 100%)",
                boxShadow: "0 16px 32px -14px rgba(72,83,245,0.65)",
              }}
            >
              Bepul boshlash — 14 kun <ArrowRight className="h-4 w-4" />
            </CtaLink>
            <Link
              href="#pricing"
              className="inline-flex items-center justify-center rounded-2xl border border-ink-200 bg-white px-6 py-3.5 font-display text-[15px] font-bold text-ink-900 shadow-soft-sm tap"
            >
              Tariflarni ko&apos;rish
            </Link>
          </div>
          <p className="text-[13px] font-medium text-ink-500">
            Karta kerak emas · Payme/Click orqali to&apos;lov
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-3 pt-1 text-[13px] font-semibold text-ink-600">
            {[
              { Icon: Send, label: "Telegram ichida", tile: "tile-indigo", color: "text-indigo-700" },
              { Icon: CreditCard, label: "Payme va Click", tile: "tile-mint", color: "text-success" },
              { Icon: BellRing, label: "Avtomatik eslatmalar", tile: "tile-lemon", color: "text-iris" },
            ].map(({ Icon, label, tile, color }) => (
              <span key={label} className="inline-flex items-center gap-2">
                <span className={`${tile} grid h-8 w-8 shrink-0 place-items-center rounded-xl`}>
                  <Icon className={`h-4 w-4 ${color}`} strokeWidth={2.2} />
                </span>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-4xl border border-ink-100 bg-white p-5 shadow-soft-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <YzLogo size={28} />
                <div>
                  <div className="eyebrow">YOZUV · Salon</div>
                  <div className="font-display text-sm font-bold tracking-tight text-ink-900">
                    Stil Studio
                  </div>
                </div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-ink-50 text-ink-500">
                <Bell className="h-4 w-4" strokeWidth={2} />
              </div>
            </div>

            <div
              className="relative mt-4 overflow-hidden rounded-3xl p-4 text-white"
              style={{
                background: "linear-gradient(135deg,#7C5CFF 0%,#4853F5 100%)",
                boxShadow: "0 16px 32px -18px rgba(72,83,245,0.6)",
              }}
            >
              <div className="pointer-events-none absolute -right-5 -top-6 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-white/70">
                    Bugungi yozilishlar
                  </div>
                  <div className="tnum font-display text-2xl font-extrabold tracking-tighter text-white">
                    8
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {[
                { t: "10:00", n: "Diyora S.", s: "Soch turmagi", c: "pill-success", l: "Tasdiq." },
                { t: "11:00", n: "Sardor I.", s: "Soch olish", c: "pill-success", l: "Tasdiq." },
                { t: "12:30", n: "Nilufar K.", s: "Manikyur", c: "pill-warn", l: "Kutilmoqda" },
              ].map((b) => (
                <div key={b.t} className="flex items-center gap-3 rounded-2xl bg-ink-50 p-3">
                  <div className="min-w-[46px]">
                    <div className="tnum font-display text-[15px] font-extrabold tracking-tight text-indigo-700">
                      {b.t}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-bold tracking-tight text-ink-900">{b.n}</div>
                    <div className="truncate text-xs text-ink-500">{b.s}</div>
                  </div>
                  <span className={`${b.c} text-[10px]`}>
                    {b.l}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

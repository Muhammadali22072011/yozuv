import Link from "next/link";
import { ArrowRight, Bell, CalendarDays } from "lucide-react";
import { YzLogo } from "@/components/yz/Logo";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 yz-hero" />
      <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-40 top-24 h-40 w-40 rounded-full bg-lemon/30 blur-sm" />
      <div className="pointer-events-none absolute -left-16 bottom-20 h-56 w-56 rounded-full bg-lilac/25" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 pt-20 pb-24 lg:flex-row lg:items-center lg:gap-16 lg:pt-28 lg:pb-32">
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-2.5">
            <YzLogo size={40} variant="light" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                Telegram Mini App
              </div>
              <div className="font-display text-[17px] font-extrabold tracking-tight text-white">
                Yozuv
              </div>
            </div>
          </div>

          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl md:text-6xl">
            Daftarni unuting — mijozlar o&apos;zi Telegramda yoziladi
          </h1>
          <p className="max-w-xl text-base text-white/80 md:text-lg">
            Barbershop, salon va klinikalar uchun. Bot mijozni qabul qiladi, bo&apos;sh
            slotni o&apos;zi topadi va tashrifdan 1 soat oldin eslatadi —
            &laquo;keluvdim, esimdan chiqibdi&raquo; kamayadi. Sayt ham, ilova ham
            kerak emas.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-display text-[15px] font-bold text-indigo-700 shadow-[0_10px_30px_rgba(0,0,0,0.2)] tap"
            >
              Bepul boshlash — 14 kun <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#pricing"
              className="inline-flex items-center justify-center rounded-2xl bg-white/15 px-6 py-3.5 font-display text-[15px] font-bold text-white backdrop-blur tap"
            >
              Tariflarni ko&apos;rish
            </Link>
          </div>
          <p className="text-[13px] font-medium text-white/70">
            Karta kerak emas · Payme/Click orqali to&apos;lov
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-[13px] font-semibold text-white/80">
            <span>📱 Telegram ichida</span>
            <span>💳 Payme va Click</span>
            <span>🔔 Avtomatik eslatmalar</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[28px] bg-white p-5 shadow-[0_30px_60px_-20px_rgba(11,15,31,0.45)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <YzLogo size={28} />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                    YOZUV · PRO
                  </div>
                  <div className="font-display text-sm font-bold text-ink-900">
                    Stil Studio
                  </div>
                </div>
              </div>
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-ink-100">
                <Bell className="h-4 w-4 text-ink-500" />
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
                    Bugungi yozilishlar
                  </div>
                  <div className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
                    8
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {[
                { t: "10:00", n: "Diyora S.", s: "Soch turmagi", c: "bg-[#E6FAF3] text-[#0E9577]", l: "Tasdiq." },
                { t: "11:00", n: "Sardor I.", s: "Soch olish", c: "bg-[#E6FAF3] text-[#0E9577]", l: "Tasdiq." },
                { t: "12:30", n: "Nilufar K.", s: "Manikyur", c: "bg-[#FFF3DA] text-[#A8751A]", l: "Kutilmoqda" },
              ].map((b) => (
                <div key={b.t} className="flex items-center gap-3 rounded-2xl bg-ink-50 p-3">
                  <div className="min-w-[46px]">
                    <div className="font-display text-[15px] font-extrabold tracking-tight text-ink-900">
                      {b.t}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-bold text-ink-900">{b.n}</div>
                    <div className="truncate text-xs text-ink-500">{b.s}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${b.c}`}>
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

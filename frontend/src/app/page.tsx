import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Categories } from "@/components/landing/Categories";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { YzLogo } from "@/components/yz/Logo";

export default function HomePage() {
  return (
    <main className="bg-ink-50">
      <Hero />
      <Features />
      <HowItWorks />
      <Categories />
      <Pricing />

      {/* Финальный CTA — единственный «тёмный премиум» момент внизу страницы.
          Градиент задан инлайн-стилем, чтобы гарантированно отрисоваться вне
          зависимости от Tailwind purge/HMR (текст белый — фон обязан быть
          тёмным). Текст и ссылка не тронуты. */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div
          className="relative overflow-hidden rounded-4xl px-8 py-14 shadow-soft-lg md:px-14 md:py-16"
          style={{ background: "linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)" }}
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-lilac/20 blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center md:gap-10">
            <div>
              <div className="eyebrow text-white/55">Yozuv</div>
              <h2 className="mt-2.5 font-display text-3xl font-extrabold tracking-tighter text-white md:text-[42px] md:leading-[1.05]">
                Bugun boshlang
              </h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/75 md:text-base">
                Yozuv bilan navbatlarni tartibga soling. 14 kun bepul — karta talab
                qilinmaydi.
              </p>
            </div>
            <Link
              href="/auth/login"
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-8 py-4 font-display text-[15px] font-bold text-indigo-700 shadow-[0_14px_34px_-10px_rgba(0,0,0,0.5)] tap"
            >
              Kirish <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-12">
          <div className="flex items-center gap-2.5">
            <YzLogo size={30} />
            <span className="font-display text-lg font-extrabold tracking-tighter text-ink-900">
              yozuv
            </span>
          </div>
          <p className="text-sm font-medium text-ink-400">
            © {new Date().getFullYear()} · Telegram orqali onlayn yozilish
          </p>
        </div>
      </footer>
    </main>
  );
}

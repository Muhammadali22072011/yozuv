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
    <main className="bg-white">
      <Hero />
      <Features />
      <HowItWorks />
      <Categories />
      <Pricing />

      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)" }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-20 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-[-0.02em] text-white md:text-4xl">
              Bugun boshlang
            </h2>
            <p className="mt-3 max-w-xl text-white/80">
              Yozuv bilan navbatlarni tartibga soling. 14 kun bepul — karta talab
              qilinmaydi.
            </p>
          </div>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 font-display text-[15px] font-bold text-indigo-700 shadow-[0_10px_30px_rgba(0,0,0,0.25)] tap"
          >
            Kirish <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-10">
          <div className="flex items-center gap-2.5">
            <YzLogo size={28} />
            <span className="font-display text-lg font-extrabold tracking-tight text-ink-900">
              yozuv
            </span>
          </div>
          <p className="text-sm text-ink-400">
            © {new Date().getFullYear()} · Telegram orqali onlayn yozilish
          </p>
        </div>
      </footer>
    </main>
  );
}

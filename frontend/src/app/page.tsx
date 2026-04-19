import Link from "next/link";
import { Categories } from "@/components/landing/Categories";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <Categories />
      <Pricing />
      <section className="border-t border-ink/10 bg-brand text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 md:flex-row md:items-center">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl">Bugun boshlang</h2>
            <p className="mt-2 max-w-xl text-white/80">Yozuv bilan navbatlarni tartibga soling.</p>
          </div>
          <Link
            href="/auth/login"
            className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-brand hover:bg-cream"
          >
            Kirish
          </Link>
        </div>
      </section>
      <footer className="border-t border-ink/10 bg-paper py-10 text-center text-sm text-ink/60">
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-ink text-xs font-bold text-white">
              Y
            </span>
            <span className="font-serif text-lg text-ink">yozuv</span>
          </span>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} · Telegram orqali onlayn yozilish</p>
      </footer>
    </main>
  );
}
